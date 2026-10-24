// ---------- SETOR FINANCEIRO (Fase 31) ----------
// Painel de quem cuida do financeiro da clínica no dia a dia (ex: Patrícia) — CAC/ROI de
// anúncio, calculadora de imposto, retiradas/pró-labore, status de pagamento de anúncio, mais
// as 3 telas que o setor também precisa pra trabalhar: clientes pra renovar, repasses das
// profissionais e agenda geral (mesma lógica já usada pelo Dono/Atendente, só reaproveitada
// aqui com o próprio papel liberado).
//
// Dinheiro: na medida do possível, tudo aqui vira um MovimentoCaixa normal (mesma tabela que
// o Dono já usa na aba "Meu dia > Caixa") — assim o caixa/lucro do dia do Dono já sai batendo
// sozinho com o que o Setor Financeiro lança, sem duplicar nenhuma conta. A única informação que
// não cabe em MovimentoCaixa é leads/conversões do anúncio do dia — por isso o lançamento de
// anúncio tem uma tabela própria (InvestimentoAnuncioDiario), que também cria/atualiza um
// MovimentoCaixa ligado a ela pra entrar no caixa geral.
const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { parseValorMonetario } = require("../utils/financeiro");
const { notificar } = require("../utils/notificar");
const { inicioDoDia, fimDoDia, calcularSaldoCaixaDoDia } = require("../utils/meuDia");

const router = express.Router();
router.use(autenticar, permitir("FINANCEIRO", "DONO"));

const CATEGORIA_RETIRADA = "Retirada/Pró-labore";
const CATEGORIA_IMPOSTO = "Imposto";
const CATEGORIA_ANUNCIO = "Anúncio (Setor Financeiro)";

function formatarDataCurta(data) {
  return new Date(data).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

// ======================================================================================
// ---------- Painel financeiro ----------
// ======================================================================================

router.get("/painel", async (req, res) => {
  const hojeInicio = inicioDoDia();
  const hojeFim = fimDoDia();
  const trintaDiasAtras = new Date(hojeInicio.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [saldoHoje, investimentoHoje, historico, ticketMedioAgg, pagamentosHoje] = await Promise.all([
    calcularSaldoCaixaDoDia(),
    prisma.investimentoAnuncioDiario.findUnique({ where: { data: hojeInicio } }),
    prisma.investimentoAnuncioDiario.findMany({ orderBy: { data: "desc" }, take: 14 }),
    // Ticket médio dos últimos 30 dias — base pro ROI (quanto cada conversão vale, na média
    // real da clínica, em vez de um valor fixo chutado).
    prisma.transacaoFinanceira.aggregate({ where: { data: { gte: trintaDiasAtras, lt: hojeFim } }, _avg: { valorTotal: true } }),
    prisma.pagamentoAnuncioStatus.findMany({ where: { data: hojeInicio } }),
  ]);

  const valorMedioPacote = ticketMedioAgg._avg.valorTotal || 0;
  const cacHoje = investimentoHoje && investimentoHoje.conversoes ? investimentoHoje.investido / investimentoHoje.conversoes : 0;
  const roiHoje = investimentoHoje && investimentoHoje.investido ? (investimentoHoje.conversoes * valorMedioPacote) / investimentoHoje.investido : 0;

  const historicoComCac = historico.map((h, idx) => {
    const custoPorLead = h.leads ? h.investido / h.leads : 0;
    const cac = h.conversoes ? h.investido / h.conversoes : 0;
    const anterior = historico[idx + 1];
    const cacAnterior = anterior && anterior.conversoes ? anterior.investido / anterior.conversoes : null;
    return {
      data: formatarDataCurta(h.data),
      investido: Number(h.investido.toFixed(2)),
      leads: h.leads,
      conversoes: h.conversoes,
      custoPorLead: Number(custoPorLead.toFixed(2)),
      cac: Number(cac.toFixed(2)),
      corCac: cacAnterior === null ? null : cac <= cacAnterior ? "verde" : "vermelho",
    };
  });

  const BASE_ANUNCIOS = [
    { canal: "META", nome: "Meta Ads (Instagram/Facebook)" },
    { canal: "GOOGLE", nome: "Google Ads" },
  ];
  const anuncios = BASE_ANUNCIOS.map((a) => {
    const status = pagamentosHoje.find((p) => p.canal === a.canal);
    return { ...a, pago: !!status?.pago };
  });

  res.json({
    cac: Number(cacHoje.toFixed(2)),
    roi: Number(roiHoje.toFixed(1)),
    receitaHoje: Number((saldoHoje.totalEntradasClientes + saldoHoje.totalEntradasExtra).toFixed(2)),
    lucroHoje: saldoHoje.saldoSistema,
    investimentoHojeForm: investimentoHoje
      ? { investido: investimentoHoje.investido, leads: investimentoHoje.leads, conversoes: investimentoHoje.conversoes }
      : null,
    historicoInvestimento: historicoComCac,
    anuncios,
  });
});

// "Lançar dia" do card de investimento em anúncios — um registro por dia (relançar o mesmo dia
// atualiza em vez de duplicar, tanto aqui quanto no MovimentoCaixa ligado a ele).
router.post("/investimento-anuncio", async (req, res) => {
  const { investido, leads, conversoes } = req.body;
  const valorInvestido = parseValorMonetario(investido);
  const totalLeads = parseInt(leads, 10);
  const totalConversoes = parseInt(conversoes, 10) || 0;
  if (!valorInvestido || valorInvestido <= 0 || !totalLeads || totalLeads < 0 || Number.isNaN(totalLeads)) {
    return res.status(400).json({ erro: "Informe o valor investido e os leads de hoje." });
  }

  const hoje = inicioDoDia();
  const existente = await prisma.investimentoAnuncioDiario.findUnique({ where: { data: hoje } });

  let movimentoCaixaId = existente?.movimentoCaixaId || null;
  if (movimentoCaixaId) {
    await prisma.movimentoCaixa.update({
      where: { id: movimentoCaixaId },
      data: { valor: valorInvestido, descricao: `${totalLeads} lead(s), ${totalConversoes} conversão(ões)` },
    });
  } else {
    const movimento = await prisma.movimentoCaixa.create({
      data: {
        tipo: "SAIDA",
        categoria: CATEGORIA_ANUNCIO,
        valor: valorInvestido,
        descricao: `${totalLeads} lead(s), ${totalConversoes} conversão(ões)`,
        criadoPorId: req.user.id,
        data: hoje,
      },
    });
    movimentoCaixaId = movimento.id;
  }

  const registro = await prisma.investimentoAnuncioDiario.upsert({
    where: { data: hoje },
    update: { investido: valorInvestido, leads: totalLeads, conversoes: totalConversoes, movimentoCaixaId },
    create: {
      data: hoje,
      investido: valorInvestido,
      leads: totalLeads,
      conversoes: totalConversoes,
      movimentoCaixaId,
      criadoPorId: req.user.id,
    },
  });
  res.json(registro);
});

// Calculadora de imposto — "Lançar esse valor" grava direto como saída no caixa.
router.post("/imposto", async (req, res) => {
  const { valorRecebido, percentual } = req.body;
  const valor = parseValorMonetario(valorRecebido);
  const pct = parseFloat(String(percentual || "").replace(",", "."));
  if (!valor || valor <= 0 || !pct || pct <= 0) {
    return res.status(400).json({ erro: "Informe o valor recebido e a % do imposto." });
  }
  const imposto = Number(((valor * pct) / 100).toFixed(2));
  const movimento = await prisma.movimentoCaixa.create({
    data: {
      tipo: "SAIDA",
      categoria: CATEGORIA_IMPOSTO,
      valor: imposto,
      descricao: `Imposto de ${pct}% sobre R$ ${valor.toFixed(2)}`,
      criadoPorId: req.user.id,
    },
  });
  res.json(movimento);
});

// Retiradas e pró-labore — sem valor padrão, cada retirada é lançada na hora.
router.get("/retiradas", async (req, res) => {
  const { filtro } = req.query;
  const hojeInicio = inicioDoDia();
  const where = { categoria: CATEGORIA_RETIRADA, tipo: "SAIDA" };
  if (filtro === "dia") where.data = { gte: hojeInicio, lt: fimDoDia() };
  else if (filtro === "semana") where.data = { gte: new Date(hojeInicio.getTime() - 6 * 24 * 60 * 60 * 1000) };
  else if (filtro === "mes") where.data = { gte: new Date(hojeInicio.getFullYear(), hojeInicio.getMonth(), 1) };
  // "todos" (ou qualquer outro valor) não filtra por data — histórico completo.

  const lista = await prisma.movimentoCaixa.findMany({ where, orderBy: { data: "desc" }, take: 200 });
  res.json(lista.map((m) => ({ id: m.id, nome: m.descricao || "—", valor: m.valor, data: m.data })));
});

router.post("/retiradas", async (req, res) => {
  const { nome, valor } = req.body;
  const valorNumerico = parseValorMonetario(valor);
  if (!nome || !nome.trim() || !valorNumerico || valorNumerico <= 0) {
    return res.status(400).json({ erro: "Informe quem está retirando e o valor." });
  }
  const movimento = await prisma.movimentoCaixa.create({
    data: { tipo: "SAIDA", categoria: CATEGORIA_RETIRADA, valor: valorNumerico, descricao: nome.trim(), criadoPorId: req.user.id },
  });
  res.json(movimento);
});

// Pagamento de anúncios de hoje — alterna "pago"/"a pagar" por canal, por dia.
router.put("/anuncio-pago", async (req, res) => {
  const { canal } = req.body;
  if (!["META", "GOOGLE"].includes(canal)) return res.status(400).json({ erro: "Canal inválido." });
  const hoje = inicioDoDia();
  const atual = await prisma.pagamentoAnuncioStatus.findUnique({ where: { data_canal: { data: hoje, canal } } });
  const novoPago = !atual?.pago;
  const status = await prisma.pagamentoAnuncioStatus.upsert({
    where: { data_canal: { data: hoje, canal } },
    update: { pago: novoPago, pagoEm: novoPago ? new Date() : null, pagoPorId: req.user.id },
    create: { data: hoje, canal, pago: true, pagoEm: new Date(), pagoPorId: req.user.id },
  });
  res.json(status);
});

// ======================================================================================
// ---------- Clientes pra renovar (mesma fila que Dono/Atendente usam) ----------
// ======================================================================================

router.get("/clientes-reativar", async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    where: { situacao: "EXCLUIDO", profissionalAtualId: null },
    include: { user: { select: { nome: true } }, historico: { orderBy: { criadoEm: "desc" }, take: 1 } },
    orderBy: { criadoEm: "desc" },
  });
  res.json(
    clientes.map((c) => ({
      id: c.id,
      nome: c.user.nome,
      whatsapp: c.whatsappCadastro,
      pacoteResumo: c.historico[0]?.pacoteResumo || null,
      excluidoEm: c.historico[0]?.criadoEm || null,
    }))
  );
});

// Fase 53 — fila de renovação da CLÍNICA INTEIRA (todos os profissionais), organizada por data de
// renovação combinada (Cliente.renovarEm) — diferente da fila acima, que é sobre quem já saiu
// (situacao EXCLUIDO). Esta é sobre quem ainda está ativo mas com a renovação prevista chegando,
// pra Financeiro/Dono conseguirem ligar no dia certo — ordenada por data (mais próxima primeiro)
// e, dentro do mesmo dia, em ordem alfabética.
router.get("/clientes-renovar-por-data", async (req, res) => {
  // ?todos=1 -> "ver todos os clientes": lista a clínica inteira (ativos), não só quem já tem
  // data de renovação marcada. Sem o parâmetro, continua só a fila de renovação (comportamento
  // original, usado também pela Análise pra não inflar os números com quem não está na fila).
  const mostrarTodos = req.query.todos === "1" || req.query.todos === "true";
  const clientes = await prisma.cliente.findMany({
    where: mostrarTodos ? { situacao: "ATIVO" } : { situacao: "ATIVO", renovarEm: { not: null } },
    include: {
      user: { select: { nome: true, telefone: true } },
      profissionalAtual: { include: { user: { select: { nome: true } } } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
    },
    orderBy: [{ renovarEm: "asc" }, { user: { nome: "asc" } }],
  });

  res.json(
    clientes.map((c) => ({
      id: c.id,
      nome: c.user.nome,
      whatsapp: c.user.telefone || c.whatsappCadastro || null,
      profissionalNome: c.profissionalAtual?.user?.nome || "Sem profissional",
      valorPacote: c.pacotes[0]?.valorTotal ?? null,
      duracao: c.pacotes[0]?.duracao ?? null,
      renovarEm: c.renovarEm,
      renovarContatadoEm: c.renovarContatadoEm,
    }))
  );
});

// Fase 57 — "Marcar como contatado" (novo layout): alterna o campo Cliente.renovarContatadoEm.
// É um toggle simples (manda de novo pra desfazer, caso tenha marcado sem querer) — volta a ficar
// vazio sozinho sempre que uma nova data de renovarEm é definida (novo ciclo de renovação).
router.put("/clientes/:id/marcar-contatado", async (req, res) => {
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id }, select: { renovarContatadoEm: true } });
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado." });

  const atualizado = await prisma.cliente.update({
    where: { id: req.params.id },
    data: { renovarContatadoEm: cliente.renovarContatadoEm ? null : new Date() },
  });
  res.json({ renovarContatadoEm: atualizado.renovarContatadoEm });
});

// Fase 57 — números de resumo pro topo/rodapé da tela "Clientes" (novo layout, igual ao Canva):
// quanto de receita (valor de pacote) está "em risco" nos próximos 30 dias (inclui quem já está
// atrasado) e a taxa de renovação dos últimos 90 dias (quantos clientes que chegaram no fim do
// pacote de fato renovaram, vs. quantos saíram/foram excluídos por não renovar).
router.get("/renovacoes-resumo", async (req, res) => {
  const agora = new Date();
  const em30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);
  const ha90Dias = new Date(agora.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [clientesEmRisco, renovaram, saíram] = await Promise.all([
    prisma.cliente.findMany({
      where: { situacao: "ATIVO", renovarEm: { lte: em30Dias } },
      include: { pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 } },
    }),
    prisma.historicoCliente.count({ where: { tipo: "RENOVOU", criadoEm: { gte: ha90Dias } } }),
    prisma.historicoCliente.count({ where: { tipo: "EXCLUIDO", criadoEm: { gte: ha90Dias } } }),
  ]);

  const receitaEmRisco30d = clientesEmRisco.reduce((s, c) => s + (c.pacotes[0]?.valorTotal || 0), 0);
  const baseRenovacao = renovaram + saíram;
  const taxaRenovacao90d = baseRenovacao > 0 ? Math.round((renovaram / baseRenovacao) * 100) : null;

  res.json({ receitaEmRisco30d, taxaRenovacao90d });
});

router.get("/profissionais", async (req, res) => {
  const profissionais = await prisma.profissional.findMany({
    include: { user: { select: { nome: true, ativo: true, fotoUrl: true, role: true, ultimoAcessoEm: true } } },
    orderBy: { criadoEm: "asc" },
  });
  res.json(profissionais);
});

router.put("/clientes/:id/reativar", async (req, res) => {
  const { profissionalId } = req.body;
  if (!profissionalId) return res.status(400).json({ erro: "Escolha a profissional que vai atender de novo." });

  const cliente = await prisma.cliente.update({
    where: { id: req.params.id },
    data: { situacao: "ATIVO", profissionalAtualId: profissionalId },
    include: { user: true, profissionalAtual: { include: { user: true } } },
  });
  await prisma.historicoCliente.create({
    data: {
      clienteId: cliente.id,
      tipo: "REATIVADO",
      nomeCliente: cliente.user.nome,
      whatsapp: cliente.whatsappCadastro,
      profissionalNome: cliente.profissionalAtual?.user?.nome || null,
      realizadoPorId: req.user.id,
    },
  });
  if (cliente.profissionalAtual?.user) {
    await notificar(cliente.profissionalAtual.user.id, {
      titulo: "Novo cliente pra você!",
      mensagem: `${cliente.user.nome} foi reativado(a) e vinculado(a) a você pelo setor financeiro.`,
      tipo: "cliente",
    });
  }
  res.json({ ok: true });
});

// ======================================================================================
// ---------- Repasses das profissionais (mesma lógica da visão do Dono) ----------
// ======================================================================================

router.get("/repasses-pendentes", async (req, res) => {
  const pendentes = await prisma.transacaoFinanceira.findMany({
    where: {
      recebidoPor: "PROFISSIONAL",
      repassado: false,
      OR: [{ origem: "ATENDENTE" }, { origem: "PROFISSIONAL", tipo: { in: ["RENOVACAO", "SESSAO_EXTRA"] } }],
    },
    select: {
      id: true,
      tipo: true,
      valorTotal: true,
      valorRenascer: true,
      data: true,
      profissionalId: true,
      origem: true,
      repasseSolicitadoEm: true,
      repasseComprovanteMimeType: true,
      repasseValorInformado: true,
      repasseReconhecidoPorIA: true,
      profissional: { select: { user: { select: { nome: true } } } },
      cliente: { select: { user: { select: { nome: true } } } },
    },
    orderBy: { data: "asc" },
  });

  const porProfissional = {};
  for (const t of pendentes) {
    const nome = t.profissional.user.nome;
    porProfissional[nome] = porProfissional[nome] || { profissionalId: t.profissionalId, totalPendente: 0, transacoes: [] };
    porProfissional[nome].totalPendente += t.valorRenascer;
    porProfissional[nome].transacoes.push({
      ...t,
      temComprovanteRepasse: !!t.repasseComprovanteMimeType,
      bateComEsperado:
        t.repasseValorInformado != null ? Math.abs(t.repasseValorInformado - t.valorRenascer) < 0.01 : null,
    });
  }

  res.json({ porProfissional });
});

router.put("/repasses/:transacaoId/marcar", async (req, res) => {
  const transacao = await prisma.transacaoFinanceira.findFirst({
    where: { id: req.params.transacaoId, recebidoPor: "PROFISSIONAL" },
    include: { profissional: { select: { userId: true } } },
  });
  if (!transacao) return res.status(404).json({ erro: "Transação não encontrada." });
  if (transacao.repassado) return res.json(transacao);

  const atualizada = await prisma.transacaoFinanceira.update({
    where: { id: transacao.id },
    data: { repassado: true, repassadoEm: new Date(), repassadoObs: "Confirmado pelo setor financeiro." },
  });

  await notificar(transacao.profissional.userId, {
    titulo: "Repasse confirmado",
    mensagem: `Seu repasse de R$ ${transacao.valorRenascer.toFixed(2)} foi conferido e confirmado — já saiu da sua lista de pendências.`,
    tipo: "financeiro",
  });

  res.json(atualizada);
});

// ======================================================================================
// ---------- Agenda geral ----------
// ======================================================================================

// Fase 56 — passou a trazer também "ontem" (não só daqui pra frente): o setor financeiro
// precisa ver se as sessões recentes foram realizadas ou não, pra saber se é hora de chamar o
// cliente pra renovar. Continua sendo só agenda/status — nenhum dado de evolução/prontuário.
router.get("/agenda-geral", async (req, res) => {
  const inicioOntem = new Date();
  inicioOntem.setDate(inicioOntem.getDate() - 1);
  inicioOntem.setHours(0, 0, 0, 0);

  const agendamentos = await prisma.agendamento.findMany({
    where: { data: { gte: inicioOntem } },
    include: {
      profissional: { include: { user: { select: { nome: true } } } },
      cliente: { include: { user: { select: { nome: true } } } },
      chamadaVideo: true,
    },
    orderBy: { data: "asc" },
    take: 150,
  });
  res.json(agendamentos);
});

module.exports = router;
