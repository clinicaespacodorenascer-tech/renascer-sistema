const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { calcularMetricasCliente } = require("../utils/metricas");
const { calcularStatusCliente } = require("../utils/statusCliente");
const { excluirUsuarioPorId, excluirCliente } = require("../utils/excluirUsuario");
const { notificar, notificarDonos, notificarAtendentes } = require("../utils/notificar");
const { cadastrarClienteComProfissional } = require("../utils/cadastrarCliente");
const { parseValorMonetario, valorDoPlano, calcularRepasse, transacaoDuplicada } = require("../utils/financeiro");
const { obterConfiguracaoIA } = require("../utils/configuracaoIA");
const {
  hojeBrasil,
  inicioDoDia,
  periodoDoMes,
  trimestreAtual,
  inicioDaSemana,
  obterConfiguracaoFinanceiraClinica,
  calcularTaxaFaltas,
  calcularTempoRespostaMedio,
  calcularCACPorCanal,
  calcularSaldoCaixaDoDia,
} = require("../utils/meuDia");

const router = express.Router();
router.use(autenticar, permitir("DONO"));

// ---------- Visão geral (Fase 35: resultado da semana, pacotes por status, clientes p/ renovar) ----------
// Fase 69 — inicioDaSemana() promovida pra utils/meuDia.js (reaproveitada agora também pela
// atendente, na lista "clientes pra renovar essa semana") — segunda-feira da semana que contém
// `data`, semana sempre começando na segunda, igual ao calendário real de atendimento da clínica.
const DIAS_SEMANA_LABEL = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
function chaveDia(d) {
  const dt = new Date(d);
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()).getTime();
}

// ---------- Visão geral ----------
router.get("/dashboard", async (req, res) => {
  const [totalProfissionais, totalClientes, pacotesAtivos, profissionais] = await Promise.all([
    prisma.profissional.count(),
    prisma.cliente.count(),
    prisma.pacote.count({ where: { status: "ATIVO" } }),
    prisma.profissional.findMany({
      include: { user: { select: { nome: true } }, _count: { select: { clientes: true } } },
      orderBy: { criadoEm: "asc" },
    }),
  ]);

  // Fase 59 — correção de bug: "hoje" tem que ser o dia de hoje em Brasília, não no UTC do
  // servidor (ver comentário de hojeBrasil() em utils/meuDia.js) — senão, nas últimas 3h do dia
  // (21h–24h em Brasília), o painel passa a considerar "hoje" o dia seguinte, e tudo que aconteceu
  // mais cedo no dia de verdade (agendamentos, pagamentos) some das contas de "hoje"/"semana".
  const hoje = hojeBrasil();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioAmanha = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  const [transacoesMes, transacoesHoje, pendentesRepasse] = await Promise.all([
    prisma.transacaoFinanceira.aggregate({
      where: { data: { gte: inicioMes } },
      _sum: { valorTotal: true, valorProfissional: true, valorRenascer: true },
    }),
    // Tudo que a ATENDENTE fechou/anexou hoje (contratação nova, renovação, sessão extra, o que
    // for) — é o que representa "negócio novo fechado hoje" e por isso entra em "a receber
    // hoje". O que a própria profissional lança sozinha (renovação/sessão extra dela) não entra
    // aqui — isso só aparece nas pendências de repasse. Essa lista muda sozinha de um dia pro
    // outro, porque só olha pra data de hoje: não precisa "zerar" nada, amanhã já começa vazia.
    prisma.transacaoFinanceira.findMany({
      where: { data: { gte: inicioHoje, lt: inicioAmanha }, origem: "ATENDENTE" },
      select: {
        valorTotal: true,
        valorProfissional: true,
        valorRenascer: true,
        profissional: { select: { user: { select: { nome: true } } } },
      },
    }),
    // Quanto, no total, as profissionais já receberam direto dos clientes (sem passar pela
    // clínica) e ainda não repassaram a parte da Renascer — ver aba Repasses pro detalhe.
    prisma.transacaoFinanceira.aggregate({
      where: { recebidoPor: "PROFISSIONAL", repassado: false },
      _sum: { valorRenascer: true },
    }),
  ]);

  const porProfissionalHoje = {};
  for (const t of transacoesHoje) {
    const nome = t.profissional.user.nome;
    porProfissionalHoje[nome] = porProfissionalHoje[nome] || { totalRecebido: 0, valorProfissional: 0, valorRenascer: 0 };
    porProfissionalHoje[nome].totalRecebido += t.valorTotal;
    porProfissionalHoje[nome].valorProfissional += t.valorProfissional;
    porProfissionalHoje[nome].valorRenascer += t.valorRenascer;
  }
  const hojeTotais = transacoesHoje.reduce(
    (acc, t) => ({
      totalRecebido: acc.totalRecebido + t.valorTotal,
      valorProfissional: acc.valorProfissional + t.valorProfissional,
      valorRenascer: acc.valorRenascer + t.valorRenascer,
    }),
    { totalRecebido: 0, valorProfissional: 0, valorRenascer: 0 }
  );

  // ---- Resultado da semana (Seg–Sáb), pacotes por status e fila de renovação (Fase 35) ----
  const inicioSemana = inicioDaSemana(hoje);
  const fimSemanaExclusivo = new Date(inicioSemana.getTime() + 6 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);

  // Fase 68 — mesma janela de 90 dias usada em /financeiro/renovacoes-resumo, pra "Taxa de
  // renovação" significar a MESMA coisa em todo o sistema: de cada cliente que terminou o pacote
  // nos últimos 90 dias (RENOVOU ou foi EXCLUIDO por não renovar), quantos % renovaram.
  const ha90Dias = new Date(hoje.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [
    agendamentosSemana,
    transacoesSemana,
    gastosAnuncioSemana,
    clientesNovosSemana,
    pacotesPorStatusRaw,
    clientesParaRenovarRaw,
    renovaram90d,
    saíram90d,
  ] = await Promise.all([
      prisma.agendamento.findMany({
        where: { data: { gte: inicioSemana, lt: fimSemanaExclusivo }, status: { not: "CANCELADO" } },
        select: { data: true },
      }),
      prisma.transacaoFinanceira.findMany({
        where: { data: { gte: inicioSemana, lt: fimSemanaExclusivo } },
        select: { data: true, valorTotal: true },
      }),
      prisma.movimentoCaixa.findMany({
        where: { tipo: "SAIDA", canalOrigem: { not: null }, data: { gte: inicioSemana, lt: fimSemanaExclusivo } },
        select: { data: true, valor: true },
      }),
      prisma.cliente.findMany({
        where: { criadoEm: { gte: inicioSemana, lt: fimSemanaExclusivo } },
        select: { criadoEm: true },
      }),
      prisma.pacote.groupBy({ by: ["status"], _count: { status: true } }),
      // Clientes com data de renovação cadastrada, os mais próximos primeiro — vira a lista
      // "Clientes para renovar" da Visão geral (mesmo semáforo VERDE/AMARELO/VERMELHO usado em
      // todo o resto do sistema, calculado por calcularStatusCliente).
      prisma.cliente.findMany({
        where: { renovarEm: { not: null } },
        select: {
          renovarEm: true,
          user: { select: { nome: true } },
          profissionalAtual: { select: { user: { select: { nome: true } } } },
          pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
        },
        orderBy: { renovarEm: "asc" },
        take: 8,
      }),
      prisma.historicoCliente.count({ where: { tipo: "RENOVOU", criadoEm: { gte: ha90Dias } } }),
      prisma.historicoCliente.count({ where: { tipo: "EXCLUIDO", criadoEm: { gte: ha90Dias } } }),
    ]);

  const resultadoSemana = DIAS_SEMANA_LABEL.map((label, i) => {
    const diaRef = new Date(inicioSemana.getTime() + i * 24 * 60 * 60 * 1000);
    const chave = chaveDia(diaRef);
    const faturamento = transacoesSemana.filter((t) => chaveDia(t.data) === chave).reduce((s, t) => s + t.valorTotal, 0);
    const agendamentosDia = agendamentosSemana.filter((a) => chaveDia(a.data) === chave).length;
    const investimento = gastosAnuncioSemana.filter((g) => chaveDia(g.data) === chave).reduce((s, g) => s + g.valor, 0);
    const conversoes = clientesNovosSemana.filter((c) => chaveDia(c.criadoEm) === chave).length;
    return {
      label,
      data: diaRef,
      faturamento: Number(faturamento.toFixed(2)),
      agendamentos: agendamentosDia,
      investimento: Number(investimento.toFixed(2)),
      conversoes,
      cac: investimento > 0 && conversoes > 0 ? Number((investimento / conversoes).toFixed(2)) : null,
    };
  });

  const contagemStatusPacote = { ATIVO: 0, AGUARDANDO_RENOVACAO: 0, ENCERRADO: 0, CANCELADO: 0 };
  for (const grupo of pacotesPorStatusRaw) contagemStatusPacote[grupo.status] = grupo._count.status;
  const totalPacotesConsiderados = contagemStatusPacote.ATIVO + contagemStatusPacote.AGUARDANDO_RENOVACAO + contagemStatusPacote.ENCERRADO;
  // Fase 68 — Taxa de renovação = de cada cliente que TERMINOU o pacote nos últimos 90 dias
  // (marcado como RENOVOU ou EXCLUIDO/saiu por não renovar — ver utils/notificar.js e as rotas
  // que criam HistoricoCliente), quantos % renovaram de fato. É a MESMA fórmula/janela da aba
  // Financeiro ("Clientes pra renovar" > Taxa de renovação 90 dias), pra não ter dois números
  // diferentes pra mesma pergunta em telas diferentes. null só quando ainda não teve nenhum
  // desfecho (renovou ou saiu) nos últimos 90 dias — sistema novo, sem histórico ainda.
  const baseRenovacao90d = renovaram90d + saíram90d;
  const taxaRenovacao = baseRenovacao90d > 0 ? Number(((renovaram90d / baseRenovacao90d) * 100).toFixed(1)) : null;

  const clientesParaRenovar = clientesParaRenovarRaw.map((c) => ({
    nome: c.user.nome,
    profissional: c.profissionalAtual?.user?.nome || null,
    dias: Math.ceil((new Date(c.renovarEm).getTime() - Date.now()) / (24 * 60 * 60 * 1000)),
    status: calcularStatusCliente({ pacote: c.pacotes[0], renovarEm: c.renovarEm }),
  }));

  res.json({
    totalProfissionais,
    totalClientes,
    pacotesAtivos,
    faturamentoMes: transacoesMes._sum.valorTotal || 0,
    repasseProfissionaisMes: transacoesMes._sum.valorProfissional || 0,
    receitaRenascerMes: transacoesMes._sum.valorRenascer || 0,
    // "A receber hoje": tudo que foi registrado/anexado hoje, e quanto disso fica pra Renascer.
    hoje: hojeTotais,
    porProfissionalHoje,
    // Dinheiro que as profissionais já receberam direto dos clientes e ainda te devem repassar
    // (some sozinho conforme elas ou você marcam como recebido na aba Repasses).
    totalPendenteRepasseProfissionais: pendentesRepasse._sum.valorRenascer || 0,
    // Quantos clientes cada profissional tem hoje — soma tudo, seja cliente cadastrado
    // pela recepção ou pela própria profissional na aba dela.
    clientesPorProfissional: profissionais.map((p) => ({ nome: p.user.nome, total: p._count.clientes })),
    // Fase 35 — alimenta a Visão geral redesenhada:
    sessoesSemana: agendamentosSemana.length,
    taxaRenovacao,
    // números por trás do percentual acima, pra quem quiser o "de quantos" (últimos 90 dias)
    renovacao90d: { renovaram: renovaram90d, saíram: saíram90d },
    resultadoSemana,
    pacotesPorStatus: {
      ativos: contagemStatusPacote.ATIVO,
      aRenovar: contagemStatusPacote.AGUARDANDO_RENOVACAO,
      encerrados: contagemStatusPacote.ENCERRADO,
      total: totalPacotesConsiderados,
    },
    clientesParaRenovar,
  });
});

// ---------- Todos os profissionais e seus clientes (mapa cliente -> profissional) ----------
router.get("/profissionais", async (req, res) => {
  const [profissionais, pacotesPorProfissionalStatus] = await Promise.all([
    prisma.profissional.findMany({
      include: {
        // "role" vai junto pra dar pra identificar, na lista, qual profissional é também um
        // login de Dono (ex: o próprio Elismael atendendo) — mostra um selo "Dono".
        user: { select: { nome: true, email: true, telefone: true, ativo: true, fotoUrl: true, role: true, ultimoAcessoEm: true } },
        clientes: { include: { user: { select: { nome: true } } } },
        disponibilidades: true,
        _count: { select: { clientes: true, agendamentos: true } },
      },
    }),
    // Base pra "taxa de renovação" individual de cada profissional (Fase 37) — mesmo critério já
    // usado na Visão geral (Fase 35): % de pacotes ativos/aguardando renovação sobre o total de
    // pacotes não cancelados dela.
    prisma.pacote.groupBy({ by: ["profissionalId", "status"], _count: { status: true } }),
  ]);

  const porProfissional = {};
  for (const linha of pacotesPorProfissionalStatus) {
    const bucket = (porProfissional[linha.profissionalId] = porProfissional[linha.profissionalId] || {});
    bucket[linha.status] = linha._count.status;
  }

  const comTaxaRenovacao = profissionais.map((p) => {
    const b = porProfissional[p.id] || {};
    const total = (b.ATIVO || 0) + (b.AGUARDANDO_RENOVACAO || 0) + (b.ENCERRADO || 0);
    const taxaRenovacao = total > 0 ? Number((((b.ATIVO || 0) + (b.AGUARDANDO_RENOVACAO || 0)) / total * 100).toFixed(1)) : null;
    return { ...p, taxaRenovacao };
  });

  res.json(comTaxaRenovacao);
});

// Fase 51 — editar a % de repasse (quanto fica com a profissional x quanto fica com a clínica)
// direto do cartão "% de repasse por profissional" na aba Financeiro do Dono (canvas pedia
// editável porque "hoje nem todo mundo é 50/50" — já era assim no cadastro, só não tinha tela
// pra editar depois).
router.put("/profissionais/:id/percentual-repasse", async (req, res) => {
  const { percentualRepasse } = req.body;
  const pct = Number(percentualRepasse);
  if (Number.isNaN(pct) || pct < 0 || pct > 100) {
    return res.status(400).json({ erro: "Informe uma porcentagem entre 0 e 100." });
  }
  try {
    const atualizado = await prisma.profissional.update({
      where: { id: req.params.id },
      data: { percentualRepasse: pct },
      select: { id: true, percentualRepasse: true },
    });
    res.json(atualizado);
  } catch (e) {
    res.status(404).json({ erro: "Profissional não encontrada." });
  }
});

// Fase 62 — vincula (ou desvincula, mandando slugSitePublico vazio) esta conta ao card dela no
// site institucional (espacodorenascer.com/site), pra o popup de agendamento do site buscar a
// agenda real dela em vez de perguntar turno genérico. O slug precisa bater exatamente com a
// chave usada em frontend/public/site-assets/app.js (objeto PROFISSIONAIS), ex: "andrea-santos".
router.put("/profissionais/:id/slug-site-publico", async (req, res) => {
  const slug = (req.body.slugSitePublico || "").trim();
  try {
    const atualizado = await prisma.profissional.update({
      where: { id: req.params.id },
      data: { slugSitePublico: slug || null },
      select: { id: true, slugSitePublico: true },
    });
    res.json(atualizado);
  } catch (e) {
    if (e.code === "P2002") {
      return res.status(400).json({ erro: "Esse endereço já está sendo usado por outra profissional." });
    }
    res.status(404).json({ erro: "Profissional não encontrada." });
  }
});

// Fase 54 — antes essa lista vinha sem filtro de situação, então misturava clientes ativos com
// clientes já excluídos (soft-delete), o que deixava a contagem do Dono maior que a da
// Atendente/Profissional (que só contam ATIVO). Clientes excluídos continuam acessíveis pela aba
// própria "Reativar clientes" — aqui a lista principal fica só com quem está ativo de fato.
router.get("/clientes", async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    where: { situacao: "ATIVO" },
    include: {
      user: { select: { nome: true, email: true, telefone: true, ativo: true } },
      profissionalAtual: { include: { user: { select: { nome: true, role: true } } } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
      // Fase 55 — enquanto não é aceito pela profissional, ainda não tem profissionalAtual; isso
      // é o que deixa a tela dizer "aguardando aceite" em vez de "sem profissional".
      // Fase 72 — antes só vinha a solicitação PENDENTE (pra saber "quem falta aceitar"). Agora
      // vem a mais recente de qualquer status (PENDENTE ou ACEITA), pra também saber SE E QUANDO
      // a profissional aceitou quem já foi aceito (pedido do Dono: data do aceite na ficha, e uma
      // aba separada juntando quem ainda está "não aceito").
      solicitacoesNovoPaciente: {
        orderBy: { criadoEm: "desc" },
        include: { profissional: { include: { user: { select: { nome: true } } } } },
        take: 1,
      },
    },
  });
  res.json(
    clientes.map((c) => {
      const solicitacao = c.solicitacoesNovoPaciente[0] || null;
      return {
        ...c,
        statusCliente: calcularStatusCliente({ pacote: c.pacotes[0], renovarEm: c.renovarEm }),
        aguardandoAceiteDe: solicitacao?.status === "PENDENTE" ? solicitacao.profissional?.user?.nome || null : null,
        // Fase 72 — resumo do aceite, pronto pra tela não precisar reconstruir essa lógica:
        // "ACEITA" quando a profissional já aceitou (com a data), "PENDENTE" quando ainda não
        // (vai pra aba "Não aceitos"), e null quando o cliente nem passou por esse fluxo (ex:
        // cadastrado direto pela própria profissional, que não precisa aceitar o próprio cadastro).
        aceite: solicitacao
          ? {
              status: solicitacao.status, // "PENDENTE" | "ACEITA"
              profissionalNome: solicitacao.profissional?.user?.nome || null,
              solicitadoEm: solicitacao.criadoEm,
              aceitoEm: solicitacao.respondidoEm,
            }
          : null,
      };
    })
  );
});

// Fase 54 — o Dono não tinha NENHUMA forma geral de cadastrar cliente (só indiretamente, se
// ativasse o próprio perfil de "Atender pacientes" e usasse a aba "Meus clientes" dele). Usa o
// mesmo utilitário compartilhado com a Atendente (utils/cadastrarCliente.js) — login automático,
// pacote + dia/hora fixo com agendamento automático, e pagamento já recebido (opcional).
router.post("/clientes", async (req, res) => {
  try {
    const resultado = await cadastrarClienteComProfissional({
      ...req.body,
      cadastradoPorId: null, // esse campo só existe pra Atendente (ver schema) — Dono fica registrado via realizadoPorId no histórico
      registradoPor: { id: req.user.id, nome: req.user.nome },
    });
    res.json({
      id: resultado.user.id,
      email: resultado.user.email,
      senhaProvisoria: resultado.senha,
      cliente: resultado.cliente,
      aguardandoAceite: true,
    });
  } catch (e) {
    res.status(e.status || 500).json({ erro: e.message || "Erro ao cadastrar cliente." });
  }
});

// "Cadastrados recentemente pelo Dono" — mesma ideia do que a Atendente e a Profissional já têm,
// só que, como o Cliente não tem uma coluna própria de "cadastrado pelo Dono" (só existe pra
// Atendente no schema), usa o histórico (realizadoPorId) pra achar os cadastros feitos por esse
// login nas últimas 48h. Precisa vir ANTES de "/clientes/:id/..." pra não colidir com elas.
router.get("/clientes/recentes", async (req, res) => {
  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const eventos = await prisma.historicoCliente.findMany({
    where: { tipo: "ENTROU", realizadoPorId: req.user.id, criadoEm: { gte: desde } },
    orderBy: { criadoEm: "desc" },
    take: 10,
  });
  res.json(eventos.map((h) => ({ id: h.clienteId, nome: h.nomeCliente, criadoEm: h.criadoEm })));
});

router.delete("/clientes/:id/recente", async (req, res) => {
  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const evento = await prisma.historicoCliente.findFirst({
    where: { clienteId: req.params.id, tipo: "ENTROU", realizadoPorId: req.user.id, criadoEm: { gte: desde } },
  });
  if (!evento) {
    return res.status(404).json({ erro: "Esse cadastro não é seu ou não é recente o suficiente pra excluir por aqui." });
  }
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id }, include: { user: { select: { nome: true } } } });
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado." });
  await excluirCliente(cliente.id);
  res.json({ ok: true });
});

// Troca o cliente de profissional a qualquer momento — não depende de pacote encerrado nem do
// cliente estar na fila de reativação. Pensada pro dono conseguir mover clientes que estavam
// soltos ou com outra profissional, inclusive pro próprio login dele quando também atende
// pacientes (ver Fase 13, "Dono também é Profissional"). Também reativa o cliente se ele estava
// com situação excluída.
router.put("/clientes/:id/vincular-profissional", async (req, res) => {
  const { profissionalId } = req.body;
  if (!profissionalId) return res.status(400).json({ erro: "Escolha a profissional que vai atender esse cliente." });

  const antes = await prisma.cliente.findUnique({
    where: { id: req.params.id },
    include: { profissionalAtual: { include: { user: { select: { nome: true } } } } },
  });
  if (!antes) return res.status(404).json({ erro: "Cliente não encontrado." });
  const nomeProfissionalAntiga = antes.profissionalAtual?.user?.nome || null;

  const cliente = await prisma.cliente.update({
    where: { id: req.params.id },
    data: { profissionalAtualId: profissionalId, situacao: "ATIVO" },
    include: { user: true, profissionalAtual: { include: { user: true } } },
  });

  await prisma.historicoCliente.create({
    data: {
      clienteId: cliente.id,
      tipo: "TROCOU_PROFISSIONAL",
      nomeCliente: cliente.user.nome,
      whatsapp: cliente.whatsappCadastro,
      profissionalNome: cliente.profissionalAtual?.user?.nome || null,
      motivo: nomeProfissionalAntiga
        ? `Trocado(a) de ${nomeProfissionalAntiga} pelo Dono.`
        : "Vinculado(a) a uma profissional pelo Dono.",
      realizadoPorId: req.user.id,
    },
  });

  if (cliente.profissionalAtual?.user) {
    await notificar(cliente.profissionalAtual.user.id, {
      titulo: "Novo cliente pra você!",
      mensagem: `${cliente.user.nome} foi vinculado(a) a você${
        nomeProfissionalAntiga ? ` (estava com ${nomeProfissionalAntiga})` : ""
      }.`,
      tipo: "cliente",
      referenciaTipo: "CLIENTE",
      referenciaId: cliente.id,
    });
  }
  res.json(cliente);
});

// ---------- Fila de reativação (clientes que não renovaram e foram removidos da lista de
// alguma profissional) — o dono também consegue reativar direto por aqui, igual a atendente.
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
      mensagem: `${cliente.user.nome} foi reativado(a) e vinculado(a) a você.`,
      tipo: "cliente",
      referenciaTipo: "CLIENTE",
      referenciaId: cliente.id,
    });
  }
  res.json({ ok: true });
});

// ---------- Histórico completo de clientes (entrou/renovou/saiu/reativado) — só o dono vê. ----------
router.get("/historico-clientes", async (req, res) => {
  const historico = await prisma.historicoCliente.findMany({ orderBy: { criadoEm: "desc" }, take: 300 });
  res.json(historico);
});

// ---------- Métricas de retenção de um cliente (tempo de casa, renovações) ----------
router.get("/clientes/:id/metricas", async (req, res) => {
  const metricas = await calcularMetricasCliente(req.params.id);
  if (!metricas) return res.status(404).json({ erro: "Cliente não encontrado." });
  res.json(metricas);
});

// Histórico de pagamentos do cliente (contratações, renovações) com os comprovantes
// anexados — o dono pode ver de qualquer cliente, de qualquer profissional.
router.get("/clientes/:id/transacoes", async (req, res) => {
  const transacoes = await prisma.transacaoFinanceira.findMany({
    where: { clienteId: req.params.id },
    select: {
      id: true,
      tipo: true,
      valorTotal: true,
      valorPacoteTotal: true,
      quitadoEm: true,
      valorProfissional: true,
      valorRenascer: true,
      data: true,
      comprovanteMimeType: true,
      profissional: { select: { user: { select: { nome: true } } } },
    },
    orderBy: { data: "desc" },
  });
  res.json(transacoes.map((t) => ({ ...t, temComprovante: !!t.comprovanteMimeType })));
});

// Fase 60 — o Dono registra uma renovação/pacote novo EM NOME da profissional (ex: ela recebeu o
// Pix direto no WhatsApp, mandou o comprovante pra ele, mas ainda não sabe/conseguiu lançar
// sozinha no sistema — enquanto o time todo não pega o jeito). É exatamente a mesma conta de
// quando a própria profissional registra (utils/financeiro calcularRepasse, pagamento parcial
// igual à Fase 59): ela aparece como quem recebeu o dinheiro (recebidoPor: PROFISSIONAL), fica
// com a pendência de repasse pra Renascer, e o lançamento aparece no histórico/Financeiro dela
// normalmente — só a observação registra que foi o Dono quem lançou, pra ficar rastreável.
router.post("/clientes/:id/pacotes", async (req, res) => {
  const { duracao, totalSessoes, valorTotal, valorPacoteTotal, tipo, imagemBase64, mimeType, observacao } = req.body;
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!cliente?.profissionalAtualId) {
    return res.status(400).json({ erro: "Esse cliente ainda não tem uma profissional vinculada — vincule antes de registrar." });
  }
  const profissional = await prisma.profissional.findUnique({ where: { id: cliente.profissionalAtualId }, include: { user: true } });

  const valorOficial = valorDoPlano(duracao, totalSessoes);
  const valorFinal = valorTotal ? parseValorMonetario(valorTotal) : valorOficial;
  if (!valorFinal) return res.status(400).json({ erro: "Informe duração, quantidade de sessões e/ou valor válidos." });

  const duplicada = await transacaoDuplicada(prisma, cliente.id, valorFinal);
  if (duplicada) {
    return res.status(400).json({
      erro: "Já existe um pagamento desse mesmo valor pra esse cliente registrado hoje — não lancei de novo pra não duplicar o repasse.",
      duplicado: true,
      transacaoExistente: duplicada,
    });
  }

  const precoPacoteParsed = valorPacoteTotal ? parseValorMonetario(valorPacoteTotal) : null;
  const precoPacoteFinal = precoPacoteParsed && precoPacoteParsed > valorFinal ? precoPacoteParsed : valorFinal;

  await prisma.pacote.updateMany({
    where: { clienteId: cliente.id, status: { in: ["ATIVO", "AGUARDANDO_RENOVACAO"] } },
    data: { status: "ENCERRADO", encerradoEm: new Date() },
  });

  const pacote = await prisma.pacote.create({
    data: {
      clienteId: cliente.id,
      profissionalId: cliente.profissionalAtualId,
      duracao,
      totalSessoes,
      valorTotal: precoPacoteFinal,
      status: "ATIVO",
    },
  });

  const { valorProfissional, valorRenascer } = calcularRepasse(valorFinal, profissional.percentualRepasse);
  const observacaoFinal = observacao
    ? `${observacao} (lançado por ${req.user.nome}, Dono, no lugar dela)`
    : `Lançado por ${req.user.nome} (Dono) em nome da profissional.`;
  const transacao = await prisma.transacaoFinanceira.create({
    data: {
      profissionalId: cliente.profissionalAtualId,
      clienteId: cliente.id,
      tipo: tipo || "RENOVACAO",
      valorTotal: valorFinal,
      valorPacoteTotal: precoPacoteFinal > valorFinal ? precoPacoteFinal : null,
      valorProfissional,
      valorRenascer,
      recebidoPor: "PROFISSIONAL",
      origem: "PROFISSIONAL",
      comprovanteBase64: imagemBase64 || null,
      comprovanteMimeType: imagemBase64 ? mimeType || "image/jpeg" : null,
      observacao: observacaoFinal,
    },
  });

  const pendenteRegistro = precoPacoteFinal > valorFinal ? precoPacoteFinal - valorFinal : 0;

  await notificar(cliente.userId, {
    titulo: "Novo pacote liberado",
    mensagem: `Seu pacote de ${totalSessoes} sessão(ões) foi confirmado. Já pode agendar seus horários!`,
    tipo: "sistema",
  });

  if (profissional.user) {
    await notificar(profissional.user.id, {
      titulo: "Renovação lançada pra você",
      mensagem:
        `${req.user.nome} registrou o pagamento de ${cliente.user?.nome || "um cliente"} em seu nome (R$ ${valorFinal.toFixed(2)}) — ` +
        `já conta pra você, e falta repassar R$ ${valorRenascer.toFixed(2)} pra Renascer.`,
      tipo: "financeiro",
      referenciaTipo: "TRANSACAO",
      referenciaId: transacao.id,
    });
  }

  await notificarAtendentes({
    titulo: "Renovação lançada pelo Dono",
    mensagem:
      `${req.user.nome} registrou pagamento de R$ ${valorFinal.toFixed(2)} de ${cliente.user?.nome || "um cliente"} em nome de ${profissional.user?.nome || "uma profissional"}.` +
      (pendenteRegistro > 0 ? ` Pagamento parcial — ainda falta R$ ${pendenteRegistro.toFixed(2)} do pacote.` : ""),
    tipo: "financeiro",
  });

  res.json({ pacote, transacao });
});

// Contrato assinado (foto do documento, foto do rosto, CPF/nome informados e data do aceite) —
// o dono pode ver de qualquer cliente, pra conferência/auditoria. Se o cliente ainda não aceitou
// o contrato, devolve null (ainda não existe registro).
router.get("/clientes/:id/contrato", async (req, res) => {
  const contrato = await prisma.contrato.findUnique({ where: { clienteId: req.params.id } });
  res.json(contrato);
});

// ---------- Contato de notificação (e-mail/telefone) + data prevista de renovação ----------
// O dono também pode cadastrar isso pra qualquer cliente (mesma função que atendente/profissional têm).
router.put("/clientes/:id/notificacao", async (req, res) => {
  const { notifEmail, notifTelefone, renovarEm } = req.body;
  const dados = {
    ...(notifEmail !== undefined && { notifEmail: notifEmail || null }),
    ...(notifTelefone !== undefined && { notifTelefone: notifTelefone || null }),
  };
  if (renovarEm !== undefined) {
    dados.renovarEm = renovarEm ? new Date(renovarEm) : null;
    dados.renovarEmAvisoEnviado = false;
    dados.renovarContatadoEm = null;
    // Fase 69: toda vez que a data de renovação muda, o lembrete de "ligar pra saber como ele
    // está" (que dispara ~7 dias antes) tem que poder disparar de novo pra essa nova data.
    dados.renovarCheckinSemanaEnviado = false;
  }
  const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data: dados });
  res.json(cliente);
});

// Excluir login de cliente direto pela aba Clientes (mesma exclusão em cascata da atendente)
router.delete("/clientes/:id", async (req, res) => {
  try {
    await excluirCliente(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Erro ao excluir cliente." });
  }
});

// ---------- Agenda geral (todas as profissionais) — mesma rota que a atendente tem, pro dono
// também conseguir ver, sessão por sessão, se a profissional já entrou na videochamada (sessão
// de fato em andamento) ou ainda não. "chamadaVideo" é o mesmo registro usado desde a
// videochamada da Fase 1.
router.get("/agenda-geral", async (req, res) => {
  const { mes, ano } = req.query;
  // Sem mes/ano: comportamento de sempre (a partir de agora, até 100 sessões). Com mes/ano
  // (Fase 38 — calendário mensal da Agenda geral): mostra o mês inteiro pedido, passado ou
  // futuro, pra dar pra navegar o calendário pra trás e pra frente.
  const where =
    mes && ano
      ? { data: { gte: new Date(Number(ano), Number(mes) - 1, 1), lt: new Date(Number(ano), Number(mes), 1) } }
      : { data: { gte: new Date() } };

  const agendamentos = await prisma.agendamento.findMany({
    where,
    include: {
      profissional: { include: { user: { select: { nome: true } } } },
      cliente: { include: { user: { select: { nome: true } } } },
      chamadaVideo: true,
    },
    // Fase 60 — todo agendamento do mesmo dia tem o mesmo "data" (meia-noite UTC daquele dia — a
    // hora real é só horaInicio); sem o segundo critério, dois agendamentos no mesmo dia saíam em
    // ordem arbitrária em vez de por horário.
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    take: mes && ano ? undefined : 100,
  });
  res.json(agendamentos);
});

// ---------- Financeiro consolidado ----------
router.get("/financeiro", async (req, res) => {
  const { mes, ano } = req.query;
  const hoje = new Date();
  const m = mes ? Number(mes) - 1 : hoje.getMonth();
  const a = ano ? Number(ano) : hoje.getFullYear();
  const inicio = new Date(a, m, 1);
  const fim = new Date(a, m + 1, 1);

  const transacoes = await prisma.transacaoFinanceira.findMany({
    where: { data: { gte: inicio, lt: fim } },
    select: {
      id: true,
      tipo: true,
      valorTotal: true,
      valorProfissional: true,
      valorRenascer: true,
      data: true,
      comprovanteMimeType: true,
      recebidoPor: true,
      repassado: true,
      profissional: { select: { user: { select: { nome: true } } } },
      cliente: { select: { user: { select: { nome: true } } } },
    },
    orderBy: { data: "desc" },
  });

  const porProfissional = {};
  for (const t of transacoes) {
    const nome = t.profissional.user.nome;
    porProfissional[nome] = porProfissional[nome] || { totalRecebido: 0, valorProfissional: 0, valorRenascer: 0 };
    porProfissional[nome].totalRecebido += t.valorTotal;
    porProfissional[nome].valorProfissional += t.valorProfissional;
    porProfissional[nome].valorRenascer += t.valorRenascer;
  }

  res.json({
    transacoes: transacoes.map((t) => ({ ...t, temComprovante: !!t.comprovanteMimeType })),
    porProfissional,
    mes: m + 1,
    ano: a,
  });
});

// ---------- Repasses das profissionais (dinheiro que elas receberam direto dos clientes e
// ainda devem repassar a parte da Renascer) ----------
// Lista, agrupado por profissional, tudo que está pendente (recebidoPor = PROFISSIONAL e ainda
// não repassado) — pra você conseguir cobrar/lançar exatamente o que cada uma te deve.
router.get("/repasses-pendentes", async (req, res) => {
  const pendentes = await prisma.transacaoFinanceira.findMany({
    // Tudo que a atendente lançou entra aqui (qualquer tipo). Já o que a própria profissional
    // lançou sozinha só entra se for renovação ou sessão extra — contratação nova é sempre coisa
    // da atendente, então uma "PACOTE_NOVO" lançada pela profissional não devia existir, mas por
    // segurança não deixamos aparecer aqui como pendência de repasse.
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

  // Fase 38 — ledger de repasses já confirmados (últimos 40), pra tela nova mostrar também o que já
  // foi conferido, sem precisar entrar em cada profissional. Não muda nada do que já existia acima.
  const confirmadosRaw = await prisma.transacaoFinanceira.findMany({
    where: { recebidoPor: "PROFISSIONAL", repassado: true },
    select: {
      id: true,
      tipo: true,
      valorRenascer: true,
      repassadoEm: true,
      profissional: { select: { user: { select: { nome: true } } } },
    },
    orderBy: { repassadoEm: "desc" },
    take: 40,
  });
  const confirmados = confirmadosRaw.map((t) => ({
    id: t.id,
    profissional: t.profissional.user.nome,
    tipo: t.tipo,
    valorRenascer: t.valorRenascer,
    repassadoEm: t.repassadoEm,
  }));

  res.json({ porProfissional, confirmados });
});

// Marca uma transação específica como repassada (o dono confere — vendo o comprovante que a
// profissional anexou, quando tiver, ou de outra forma — que recebeu aquele pagamento exato) e
// avisa a profissional que o repasse dela foi confirmado.
router.put("/repasses/:transacaoId/marcar", async (req, res) => {
  const transacao = await prisma.transacaoFinanceira.findFirst({
    where: { id: req.params.transacaoId, recebidoPor: "PROFISSIONAL" },
    include: { profissional: { select: { userId: true } } },
  });
  if (!transacao) return res.status(404).json({ erro: "Transação não encontrada." });
  if (transacao.repassado) return res.json(transacao);

  const atualizada = await prisma.transacaoFinanceira.update({
    where: { id: transacao.id },
    data: { repassado: true, repassadoEm: new Date(), repassadoObs: "Confirmado pelo dono." },
  });

  await notificar(transacao.profissional.userId, {
    titulo: "Repasse confirmado",
    mensagem: `Seu repasse de R$ ${transacao.valorRenascer.toFixed(2)} foi conferido e confirmado — já saiu da sua lista de pendências.`,
    tipo: "financeiro",
    referenciaTipo: "TRANSACAO",
    referenciaId: transacao.id,
  });

  res.json(atualizada);
});

// Correção pontual pra transações antigas (lançadas antes da regra "sempre é a profissional
// que recebe" entrar no ar) que ficaram marcadas como "recebido pela clínica" — o dono usa esse
// botão quando sabe que, na prática, foi a profissional quem recebeu. Depois disso a transação
// passa a contar normalmente como pendência de repasse.
router.put("/transacoes/:id/reclassificar-profissional", async (req, res) => {
  const transacao = await prisma.transacaoFinanceira.findUnique({
    where: { id: req.params.id },
    include: { profissional: { select: { userId: true } } },
  });
  if (!transacao) return res.status(404).json({ erro: "Transação não encontrada." });

  const atualizada = await prisma.transacaoFinanceira.update({
    where: { id: transacao.id },
    data: { recebidoPor: "PROFISSIONAL", origem: "ATENDENTE" },
  });

  await notificar(transacao.profissional.userId, {
    titulo: "Lembrete de repasse",
    mensagem: `Um pagamento antigo (R$ ${transacao.valorTotal.toFixed(2)}) foi corrigido: você recebeu direto e precisa repassar R$ ${transacao.valorRenascer.toFixed(2)} pra Renascer, se ainda não repassou.`,
    tipo: "financeiro",
    referenciaTipo: "TRANSACAO",
    referenciaId: transacao.id,
  });

  res.json(atualizada);
});

// Lançamento rápido: "recebi R$X da profissional Y" — marca como repassadas as transações
// pendentes mais antigas dela até bater esse valor (não precisa procurar uma por uma).
router.post("/repasses/:profissionalId/lancar", async (req, res) => {
  const { valor } = req.body;
  const valorRecebido = parseValorMonetario(valor) || 0;
  if (!valorRecebido || valorRecebido <= 0) return res.status(400).json({ erro: "Informe um valor recebido válido." });

  const pendentes = await prisma.transacaoFinanceira.findMany({
    where: { profissionalId: req.params.profissionalId, recebidoPor: "PROFISSIONAL", repassado: false },
    select: { id: true, valorRenascer: true },
    orderBy: { data: "asc" },
  });

  let restante = valorRecebido;
  const marcadas = [];
  for (const t of pendentes) {
    if (restante < t.valorRenascer - 0.01) break;
    marcadas.push(t.id);
    restante -= t.valorRenascer;
  }

  if (marcadas.length > 0) {
    await prisma.transacaoFinanceira.updateMany({
      where: { id: { in: marcadas } },
      data: { repassado: true, repassadoEm: new Date(), repassadoObs: `Lançamento do dono: recebido R$ ${valorRecebido.toFixed(2)}.` },
    });
  }

  res.json({
    marcadas: marcadas.length,
    valorConsiderado: valorRecebido - restante,
    sobrou: Number(restante.toFixed(2)),
    aviso:
      marcadas.length === 0
        ? "Não achei nenhuma pendência dela com valor igual ou menor que isso — confira se o valor está certo ou marque manualmente na lista."
        : restante > 0.01
        ? `Sobrou R$ ${restante.toFixed(2)} sem pendência correspondente (pode ser adiantamento ou valor a mais).`
        : null,
  });
});

// ---------- Gestão de usuários (criar login de profissional/atendente/dono) ----------
router.post("/usuarios", async (req, res) => {
  const { nome, email, telefone, senha, role, dadosProfissional, profissionalAtualId, tambemProfissional } = req.body;
  if (!["PROFISSIONAL", "ATENDENTE", "DONO", "CLIENTE", "FINANCEIRO"].includes(role)) {
    return res.status(400).json({ erro: "Papel inválido." });
  }

  const existente = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existente) return res.status(400).json({ erro: "Já existe um usuário com esse e-mail." });

  const hash = await bcrypt.hash(senha, 10);

  // Um Dono também pode nascer já com agenda própria de atendimento (quando marca a opção "também
  // atende pacientes") — nesse caso cria o cadastro de Profissional vinculado ao MESMO login, sem
  // trocar o papel principal dele (continua entrando como Dono; o acesso extra é liberado no
  // middleware `permitir`, ver backend/src/middleware/auth.js).
  const criaPerfilProfissional = role === "PROFISSIONAL" || (role === "DONO" && tambemProfissional);

  const user = await prisma.user.create({
    data: {
      nome,
      email: email.toLowerCase().trim(),
      telefone,
      senha: hash,
      role,
      ...(criaPerfilProfissional && {
        profissional: {
          create: {
            titulo: dadosProfissional?.titulo || (role === "DONO" ? "Psicoterapeuta" : "Profissional"),
            registro: dadosProfissional?.registro || null,
            bio: dadosProfissional?.bio || null,
            abordagens: dadosProfissional?.abordagens || null,
            // Um Dono que também atende (mesma pessoa que já é sócia da clínica) recebe 100% do
            // valor de qualquer pagamento ligado a ele — não existe "repasse" nesse caso, porque
            // o dinheiro já é da própria clínica de qualquer jeito. Profissionais contratadas
            // continuam no padrão de 50%.
            percentualRepasse: dadosProfissional?.percentualRepasse ?? (role === "DONO" ? 100 : 50),
          },
        },
      }),
      ...(role === "ATENDENTE" && { atendente: { create: {} } }),
      ...(role === "DONO" && { dono: { create: {} } }),
      ...(role === "FINANCEIRO" && { financeiro: { create: {} } }), // Fase 31
      ...(role === "CLIENTE" && {
        cliente: {
          create: {
            profissionalAtualId: profissionalAtualId || null,
            whatsappCadastro: telefone || null,
          },
        },
      }),
    },
    include: { cliente: true },
  });

  if (role === "CLIENTE" && user.cliente) {
    await prisma.historicoCliente.create({
      data: { clienteId: user.cliente.id, tipo: "ENTROU", nomeCliente: nome, whatsapp: telefone || null, realizadoPorId: req.user.id },
    });
    await notificarDonos({ titulo: "Novo cliente cadastrado", mensagem: `${nome} foi cadastrado(a) por ${req.user.nome}.`, tipo: "cliente" }, req.user.id);
    await notificarAtendentes({ titulo: "Novo cliente cadastrado", mensagem: `${nome} foi cadastrado(a) por ${req.user.nome}.`, tipo: "cliente" });
    if (profissionalAtualId) {
      const profissionalVinculada = await prisma.profissional.findUnique({ where: { id: profissionalAtualId }, select: { userId: true } });
      if (profissionalVinculada) {
        await notificar(profissionalVinculada.userId, {
          titulo: "Novo cliente pra você!",
          mensagem: `${nome} foi vinculado(a) a você.`,
          tipo: "cliente",
          referenciaTipo: "CLIENTE",
          referenciaId: user.cliente.id,
        });
      }
    }
  }

  res.json({ id: user.id, email: user.email, role: user.role, cliente: user.cliente || undefined });
});

// Ativa a agenda de atendimento (cadastro de Profissional) pra um login que já existe — sem
// trocar o papel principal dele. Serve tanto pra um Dono ativar isso no PRÓPRIO login (Elismael
// também é psicoterapeuta) quanto pra ativar no de outro Dono. Idempotente: se esse usuário já
// tiver um cadastro de Profissional, só devolve o que já existe, sem duplicar nem dar erro.
router.post("/usuarios/:id/tornar-profissional", async (req, res) => {
  const alvo = await prisma.user.findUnique({ where: { id: req.params.id }, include: { profissional: true } });
  if (!alvo) return res.status(404).json({ erro: "Usuário não encontrado." });
  if (alvo.profissional) {
    return res.json({ ok: true, jaExistia: true, profissional: alvo.profissional });
  }

  const { titulo, registro, bio, abordagens, percentualRepasse } = req.body || {};
  const profissional = await prisma.profissional.create({
    data: {
      userId: alvo.id,
      titulo: titulo || "Psicoterapeuta",
      registro: registro || null,
      bio: bio || null,
      abordagens: abordagens || null,
      // Sem repasse: quem ativa isso é um Dono (sócio da clínica), então o valor de qualquer
      // pagamento ligado a ele já é 100% da própria Renascer — não faz sentido "repassar" pra
      // ele mesmo. Continua sendo possível ajustar isso depois, na tela de Disponibilidade
      // (ela reaproveita o mesmo perfil de Profissional), se um dia precisar.
      percentualRepasse: percentualRepasse ?? 100,
    },
  });
  res.json({ ok: true, jaExistia: false, profissional });
});

router.get("/usuarios", async (req, res) => {
  const usuarios = await prisma.user.findMany({
    select: {
      id: true,
      nome: true,
      email: true,
      role: true,
      ativo: true,
      criadoEm: true,
      ultimoAcessoEm: true, // Fase 51 — "Supervisão dos setores" no cartão Financeiro do Dono
      profissional: { select: { id: true } },
    },
    orderBy: { criadoEm: "desc" },
  });
  res.json(usuarios);
});

router.put("/usuarios/:id/status", async (req, res) => {
  const { ativo } = req.body;
  await prisma.user.update({ where: { id: req.params.id }, data: { ativo } });
  res.json({ ok: true });
});

// Editar dados de qualquer login (nome, e-mail, telefone, senha) — só o dono pode.
router.put("/usuarios/:id", async (req, res) => {
  const { nome, email, telefone, novaSenha } = req.body;
  const dados = {};
  if (nome !== undefined) dados.nome = nome;
  if (email !== undefined) dados.email = email.toLowerCase().trim();
  if (telefone !== undefined) dados.telefone = telefone;
  if (novaSenha) dados.senha = await bcrypt.hash(novaSenha, 10);

  try {
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: dados,
      select: { id: true, nome: true, email: true, telefone: true, role: true, ativo: true },
    });
    res.json(user);
  } catch (e) {
    res.status(400).json({ erro: "Não foi possível atualizar (verifique se o e-mail já não está em uso)." });
  }
});

// Excluir qualquer login (cliente, profissional, atendente ou outro dono) — hierarquia máxima.
router.delete("/usuarios/:id", async (req, res) => {
  if (req.params.id === req.user.id) {
    return res.status(400).json({ erro: "Você não pode excluir o seu próprio login." });
  }
  try {
    await excluirUsuarioPorId(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Erro ao excluir usuário." });
  }
});

// ---------- Secretaria — Supervisão de setor (Fase 33) ----------
// Painel do Dono acompanhando um login da recepção (Atendente): se está online agora e desde
// quando, quanto tempo ficou ativa hoje, quantos clientes cadastrou, quantas reativações fez e
// quantos chamados de suporte respondeu — tudo "hoje" e um gráfico dos últimos 7 dias de
// cadastro. Por enquanto só existe pra logins da Secretaria (role ATENDENTE); outros papéis
// (Profissional, Financeiro) podem ganhar sua própria versão depois, se fizer sentido.
//
// "Online agora"/tempo online usam os mesmos carimbos (ultimoAcessoEm, sessaoAtivaDesde,
// tempoOnlineHojeSegundos) que o middleware de autenticação já atualiza em toda request —
// nenhuma chamada nova precisa existir no frontend da atendente pra isso funcionar.
const LIMIAR_ONLINE_AGORA_MS = 3 * 60 * 1000; // até 3min sem request ainda mostra como "online agora"
const LABELS_DIA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

router.get("/usuarios/:id/supervisao", async (req, res) => {
  const usuario = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { atendente: true },
  });
  if (!usuario || usuario.role !== "ATENDENTE" || !usuario.atendente) {
    return res
      .status(404)
      .json({ erro: "Supervisão disponível, por enquanto, só pra logins da Secretaria (Atendente)." });
  }
  const atendenteId = usuario.atendente.id;
  const hoje = inicioDoDia();

  const onlineAgora = !!usuario.ultimoAcessoEm && Date.now() - usuario.ultimoAcessoEm.getTime() <= LIMIAR_ONLINE_AGORA_MS;
  const tempoOnlineHojeSegundos =
    usuario.tempoOnlineHojeData && usuario.tempoOnlineHojeData.getTime() === hoje.getTime()
      ? usuario.tempoOnlineHojeSegundos
      : 0;

  // Janela dos últimos 7 dias (hoje incluso) pro gráfico de cadastros por dia
  const diasJanela = [];
  for (let i = 6; i >= 0; i--) diasJanela.push(new Date(hoje.getTime() - i * 24 * 60 * 60 * 1000));

  const [clientesCadastradosHoje, cadastrosNaJanela, reativacoesHojeLista, suportesHojeLista] = await Promise.all([
    prisma.cliente.count({ where: { cadastradoPorId: atendenteId, criadoEm: { gte: hoje } } }),
    prisma.cliente.findMany({
      where: { cadastradoPorId: atendenteId, criadoEm: { gte: diasJanela[0] } },
      select: {
        criadoEm: true,
        user: { select: { nome: true } },
        profissionalAtual: { select: { user: { select: { nome: true } } } },
      },
    }),
    prisma.historicoCliente.findMany({
      where: { tipo: "REATIVADO", realizadoPorId: usuario.id, criadoEm: { gte: hoje } },
      select: { criadoEm: true, nomeCliente: true },
    }),
    // Um registro por ticket respondido hoje por essa atendente (distinct por ticket, pega a
    // mensagem mais recente dela em cada um) — alimenta o indicador e o feed de atividade.
    prisma.mensagem.findMany({
      where: { remetenteId: usuario.id, ticketId: { not: null }, criadoEm: { gte: hoje } },
      distinct: ["ticketId"],
      orderBy: { criadoEm: "desc" },
      select: { criadoEm: true, ticket: { select: { cliente: { select: { user: { select: { nome: true } } } } } } },
    }),
  ]);

  const cadastrosPorDia = diasJanela.map((data) => {
    const total = cadastrosNaJanela.filter(
      (c) =>
        c.criadoEm.getFullYear() === data.getFullYear() &&
        c.criadoEm.getMonth() === data.getMonth() &&
        c.criadoEm.getDate() === data.getDate()
    ).length;
    return { data: data.toISOString().slice(0, 10), label: LABELS_DIA_SEMANA[data.getDay()], total };
  });

  const cadastrosHojeDetalhe = cadastrosNaJanela.filter(
    (c) =>
      c.criadoEm.getFullYear() === hoje.getFullYear() &&
      c.criadoEm.getMonth() === hoje.getMonth() &&
      c.criadoEm.getDate() === hoje.getDate()
  );

  // Atividade de hoje: junta cadastros + reativações + suportes respondidos num feed só, do
  // mais recente pro mais antigo.
  const atividades = [
    ...cadastrosHojeDetalhe.map((c) => ({
      quando: c.criadoEm,
      texto: `Cadastrou ${c.user.nome}${c.profissionalAtual?.user?.nome ? ` (${c.profissionalAtual.user.nome})` : ""}`,
    })),
    ...reativacoesHojeLista.map((h) => ({ quando: h.criadoEm, texto: `Reativou ${h.nomeCliente}` })),
    ...suportesHojeLista.map((m) => ({
      quando: m.criadoEm,
      texto: `Respondeu suporte de ${m.ticket?.cliente?.user?.nome || "cliente"}`,
    })),
  ]
    .sort((a, b) => b.quando.getTime() - a.quando.getTime())
    .slice(0, 20)
    .map((a) => ({ texto: a.texto, hora: a.quando.toTimeString().slice(0, 5) }));

  res.json({
    usuario: { id: usuario.id, nome: usuario.nome },
    presenca: {
      onlineAgora,
      onlineDesde: onlineAgora ? usuario.sessaoAtivaDesde : null,
      tempoOnlineHojeSegundos,
    },
    indicadores: {
      clientesCadastradosHoje,
      reativacoesHoje: reativacoesHojeLista.length,
      suportesAtendidosHoje: suportesHojeLista.length,
    },
    cadastrosPorDia,
    atividades,
  });
});

// ---------- Suporte escalado à gerência (visão dos donos) ----------
router.get("/suporte-gerencia", async (req, res) => {
  const tickets = await prisma.ticketSuporte.findMany({
    where: { escalonadoGerencia: true },
    include: {
      cliente: { include: { user: { select: { nome: true } }, profissionalAtual: { include: { user: { select: { nome: true } } } } } },
      mensagens: { orderBy: { criadoEm: "asc" } },
    },
    orderBy: { criadoEm: "desc" },
  });
  res.json(tickets);
});

router.post("/suporte-gerencia/:id/responder", async (req, res) => {
  const { texto } = req.body;
  const msg = await prisma.mensagem.create({ data: { remetenteId: req.user.id, ticketId: req.params.id, texto } });
  await prisma.ticketSuporte.update({ where: { id: req.params.id }, data: { status: "EM_ANDAMENTO" } });
  res.json(msg);
});

router.put("/suporte-gerencia/:id/resolver", async (req, res) => {
  await prisma.ticketSuporte.update({ where: { id: req.params.id }, data: { status: "RESOLVIDO" } });
  res.json({ ok: true });
});

// ---------- Renascer IA (etapa 1 — base grátis): gasto, usuários e travas de custo ----------
router.get("/renascer-ia", async (req, res) => {
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const [config, usuariosIAList, mensagensHoje] = await Promise.all([
    obterConfiguracaoIA(),
    prisma.user.findMany({ where: { role: "USUARIO_IA" }, select: { id: true, nome: true, email: true, criadoEm: true } }),
    // Total de mensagens enviadas (de qualquer pessoa) hoje — só conta, nunca o texto da
    // conversa, que é dado sensível e não aparece pro Dono (ver comentário no schema).
    prisma.conversaIA.count({ where: { autor: "USUARIO", criadoEm: { gte: inicioHoje } } }),
  ]);

  // Uso de hoje por usuário da IA, numa query só (em vez de uma chamada por usuário) — vira a
  // lista "Usuários da IA" do painel, com status de quem já chegou no limite diário.
  const usoHojePorUsuario = usuariosIAList.length
    ? await prisma.conversaIA.groupBy({
        by: ["userId"],
        where: { autor: "USUARIO", criadoEm: { gte: inicioHoje }, userId: { in: usuariosIAList.map((u) => u.id) } },
        _count: { _all: true },
      })
    : [];
  const usoMap = Object.fromEntries(usoHojePorUsuario.map((u) => [u.userId, u._count._all]));

  const tetoAtingido = config.gastoMesAtualReais >= config.tetoMensalReais;
  const limiteHojeGratis = tetoAtingido ? config.limiteGratisDiaReduzido : config.limiteGratisDia;

  const usuariosIA = usuariosIAList
    .map((u) => ({
      id: u.id,
      nome: u.nome,
      email: u.email,
      usadoHoje: usoMap[u.id] || 0,
      limiteHoje: limiteHojeGratis,
    }))
    .sort((a, b) => b.usadoHoje - a.usadoHoje);

  res.json({
    gastoMesAtualReais: config.gastoMesAtualReais,
    tetoMensalReais: config.tetoMensalReais,
    limiteGratisDia: config.limiteGratisDia,
    limiteGratisDiaReduzido: config.limiteGratisDiaReduzido,
    limiteAssinanteDia: config.limiteAssinanteDia,
    usuariosGratis: usuariosIAList.length,
    mensagensHoje,
    usuariosIA,
    // A assinatura (plano completo pago) ainda não foi construída — chega numa etapa futura da
    // Renascer IA. Por enquanto esses dois números ficam zerados, só pra não quebrar a tela.
    assinantes: 0,
    assinaturasNoMesReais: 0,
    assinaturaDisponivel: false,
  });
});

router.put("/renascer-ia/configuracao", async (req, res) => {
  const { tetoMensalReais, limiteGratisDia, limiteAssinanteDia } = req.body;

  const dados = {};
  if (tetoMensalReais !== undefined) {
    const valor = Number(tetoMensalReais);
    if (!Number.isFinite(valor) || valor < 0) return res.status(400).json({ erro: "Teto mensal inválido." });
    dados.tetoMensalReais = valor;
  }
  if (limiteGratisDia !== undefined) {
    const valor = Number(limiteGratisDia);
    if (!Number.isInteger(valor) || valor < 1) return res.status(400).json({ erro: "Limite do grátis inválido." });
    dados.limiteGratisDia = valor;
  }
  if (limiteAssinanteDia !== undefined) {
    const valor = Number(limiteAssinanteDia);
    if (!Number.isInteger(valor) || valor < 1) return res.status(400).json({ erro: "Limite do assinante inválido." });
    dados.limiteAssinanteDia = valor;
  }

  await obterConfiguracaoIA(); // garante que a linha "config" já existe antes do update
  const config = await prisma.configuracaoIA.update({ where: { id: "config" }, data: dados });
  res.json(config);
});

// ======================================================================================
// ---------- "MEU DIA" (Fase 30) — checklist, indicadores reais, marketing, gestão de
// pessoas, fechamento de caixa, diário de decisões e metas do trimestre, visão completa
// do Dono (quem decide a estratégia da clínica inteira).
// ======================================================================================

// ---------- Indicadores reais ----------
// Traz tudo que o painel "Indicadores" do Meu dia mostra, já calculado a partir do mês
// informado (ou do mês atual). Cada indicador que ainda não tem dado suficiente (ex: nenhum
// gasto de anúncio lançado ainda) volta como null/zero em vez de inventar número.
router.get("/meu-dia/indicadores", async (req, res) => {
  const { mes, ano } = req.query;
  const { inicio, fim } = periodoDoMes(mes, ano);

  const [
    transacoesMes,
    pendentesRepasse,
    novosClientesMes,
    churnMes,
    clientesAtivos,
    registrosMarketingMes,
    taxaFaltas,
    tempoResposta,
    cacPorCanal,
    sessoesPorProfissional,
    saldoHoje,
    configFinanceira,
    metasTrimestreAtual,
  ] = await Promise.all([
    prisma.transacaoFinanceira.aggregate({
      where: { data: { gte: inicio, lt: fim } },
      _sum: { valorTotal: true, valorProfissional: true, valorRenascer: true },
    }),
    prisma.transacaoFinanceira.aggregate({
      where: { recebidoPor: "PROFISSIONAL", repassado: false },
      _sum: { valorRenascer: true },
    }),
    prisma.cliente.count({ where: { criadoEm: { gte: inicio, lt: fim } } }),
    prisma.historicoCliente.count({ where: { tipo: "EXCLUIDO", criadoEm: { gte: inicio, lt: fim } } }),
    prisma.cliente.count({ where: { situacao: "ATIVO" } }),
    prisma.registroMarketing.groupBy({ by: ["tipo"], where: { data: { gte: inicio, lt: fim } }, _count: { _all: true } }),
    calcularTaxaFaltas({ inicio, fim }),
    calcularTempoRespostaMedio({ inicio, fim }),
    calcularCACPorCanal({ inicio, fim }),
    prisma.agendamento.groupBy({
      by: ["profissionalId"],
      where: { status: "REALIZADO", data: { gte: inicio, lt: fim } },
      _count: { _all: true },
    }),
    calcularSaldoCaixaDoDia(),
    obterConfiguracaoFinanceiraClinica(),
    prisma.metaTrimestre.findMany({ where: { trimestre: trimestreAtual() }, orderBy: { criadoEm: "asc" } }),
  ]);

  const profissionais = await prisma.profissional.findMany({ select: { id: true, user: { select: { nome: true } } } });
  const nomePorProfissionalId = Object.fromEntries(profissionais.map((p) => [p.id, p.user.nome]));
  const sessoesRealizadasPorProfissional = sessoesPorProfissional.map((s) => ({
    profissionalId: s.profissionalId,
    nome: nomePorProfissionalId[s.profissionalId] || "—",
    sessoesRealizadas: s._count._all,
  }));

  const faturamentoMes = transacoesMes._sum.valorTotal || 0;
  const custoFixoMensalReais = configFinanceira.custoFixoMensalReais || 0;
  const lucroMes = Number((faturamentoMes - custoFixoMensalReais).toFixed(2));
  const mesesDeReserva = custoFixoMensalReais > 0 ? Number((configFinanceira.reservaCaixaReais / custoFixoMensalReais).toFixed(1)) : null;

  res.json({
    periodo: { mes: inicio.getMonth() + 1, ano: inicio.getFullYear() },
    financeiro: {
      saldoCaixaHoje: saldoHoje.saldoSistema,
      faturamentoMes,
      repasseProfissionaisMes: transacoesMes._sum.valorProfissional || 0,
      receitaRenascerMes: transacoesMes._sum.valorRenascer || 0,
      totalPendenteRepasseProfissionais: pendentesRepasse._sum.valorRenascer || 0,
    },
    crescimento: {
      novosClientesMes,
      churnMes,
      clientesAtivos,
    },
    marketing: {
      registrosMarketingMes: registrosMarketingMes.map((r) => ({ tipo: r.tipo, total: r._count._all })),
      cacPorCanal: cacPorCanal.porCanal,
      totalGastoAnunciosMes: cacPorCanal.totalGastoAnuncios,
      totalClientesNovosMes: cacPorCanal.totalClientesNovos,
    },
    processos: {
      taxaFaltasMes: taxaFaltas,
      tempoRespostaMedioMes: tempoResposta,
    },
    pessoas: {
      sessoesRealizadasPorProfissional,
    },
    estrategia: {
      custoFixoMensalReais,
      reservaCaixaReais: configFinanceira.reservaCaixaReais || 0,
      pontoDeEquilibrioReais: custoFixoMensalReais,
      lucroMes,
      mesesDeReserva,
      metasTrimestreAtual,
    },
  });
});

// Configuração financeira da clínica (custo fixo mensal + reserva de caixa) — usada só pelos
// indicadores de estratégia acima. Editável a qualquer momento pelo Dono.
router.get("/meu-dia/configuracao-financeira", async (req, res) => {
  const config = await obterConfiguracaoFinanceiraClinica();
  res.json(config);
});

router.put("/meu-dia/configuracao-financeira", async (req, res) => {
  const { custoFixoMensalReais, reservaCaixaReais } = req.body;
  await obterConfiguracaoFinanceiraClinica(); // garante que a linha "config" já existe
  const dados = {};
  if (custoFixoMensalReais !== undefined) {
    const valor = parseValorMonetario(custoFixoMensalReais);
    if (valor === null || valor < 0) return res.status(400).json({ erro: "Custo fixo mensal inválido." });
    dados.custoFixoMensalReais = valor;
  }
  if (reservaCaixaReais !== undefined) {
    const valor = parseValorMonetario(reservaCaixaReais);
    if (valor === null || valor < 0) return res.status(400).json({ erro: "Reserva de caixa inválida." });
    dados.reservaCaixaReais = valor;
  }
  const config = await prisma.configuracaoFinanceiraClinica.update({ where: { id: "config" }, data: dados });
  res.json(config);
});

// ---------- Marketing (registro de post/stories/resposta/avaliação) ----------
router.get("/meu-dia/marketing", async (req, res) => {
  const lista = await prisma.registroMarketing.findMany({ orderBy: { data: "desc" }, take: 200 });
  res.json(lista);
});

router.post("/meu-dia/marketing", async (req, res) => {
  const { tipo, descricao, link } = req.body;
  if (!tipo || !descricao) return res.status(400).json({ erro: "Informe o tipo e a descrição." });
  const registro = await prisma.registroMarketing.create({
    data: { criadoPorId: req.user.id, tipo, descricao, link: link || null },
  });
  res.json(registro);
});

router.delete("/meu-dia/marketing/:id", async (req, res) => {
  await prisma.registroMarketing.deleteMany({ where: { id: req.params.id, criadoPorId: req.user.id } });
  res.json({ ok: true });
});

// ---------- Gestão de pessoas (anotações do Dono sobre cada profissional) ----------
router.get("/meu-dia/pessoas", async (req, res) => {
  const { profissionalId } = req.query;
  const lista = await prisma.registroPessoas.findMany({
    where: profissionalId ? { profissionalId } : undefined,
    orderBy: { data: "desc" },
    take: 200,
  });
  res.json(lista);
});

router.post("/meu-dia/pessoas", async (req, res) => {
  const { profissionalId, tipo, anotacao } = req.body;
  if (!profissionalId || !tipo || !anotacao) {
    return res.status(400).json({ erro: "Escolha a profissional, o tipo e escreva a anotação." });
  }
  const registro = await prisma.registroPessoas.create({
    data: { criadoPorId: req.user.id, profissionalId, tipo, anotacao },
  });
  res.json(registro);
});

router.delete("/meu-dia/pessoas/:id", async (req, res) => {
  await prisma.registroPessoas.deleteMany({ where: { id: req.params.id, criadoPorId: req.user.id } });
  res.json({ ok: true });
});

// ---------- Diário de decisões ----------
router.get("/meu-dia/decisoes", async (req, res) => {
  const lista = await prisma.decisaoRegistro.findMany({
    where: { criadoPorId: req.user.id },
    orderBy: { data: "desc" },
    take: 200,
  });
  res.json(lista);
});

router.post("/meu-dia/decisoes", async (req, res) => {
  const { texto } = req.body;
  if (!texto) return res.status(400).json({ erro: "Escreva a decisão ou ideia antes de salvar." });
  const registro = await prisma.decisaoRegistro.create({ data: { criadoPorId: req.user.id, texto } });
  res.json(registro);
});

router.delete("/meu-dia/decisoes/:id", async (req, res) => {
  await prisma.decisaoRegistro.deleteMany({ where: { id: req.params.id, criadoPorId: req.user.id } });
  res.json({ ok: true });
});

// ======================================================================================
// ---------- Fase 71 — Banco de Oportunidades ----------
// ======================================================================================
// Todo este arquivo já é exclusivo de DONO (ver `router.use(autenticar, permitir("DONO"))` no
// topo), então "só o dono acessa" não precisa de nenhuma regra extra aqui.

router.get("/oportunidades", async (req, res) => {
  const { empresa, tipo, status } = req.query;
  const lista = await prisma.oportunidade.findMany({
    where: {
      ...(empresa && { empresa }),
      ...(tipo && { tipo }),
      ...(status && { status }),
    },
    orderBy: [{ pontuacaoTotal: "desc" }, { criadoEm: "desc" }],
  });
  res.json(lista);
});

// As 3 melhores pontuadas que ainda não entraram em teste (status Ideia ou Avaliada, já com nota)
// — destaque pedido pelo Elismael pra ver rápido no que vale a pena focar.
router.get("/oportunidades/destaques", async (req, res) => {
  const lista = await prisma.oportunidade.findMany({
    where: { status: { in: ["IDEIA", "AVALIADA"] }, pontuacaoTotal: { not: null } },
    orderBy: { pontuacaoTotal: "desc" },
    take: 3,
  });
  res.json(lista);
});

// Ainda sem NENHUMA nota — alimenta o cartão de segunda-feira ("dia de Estratégia") no Meu dia.
router.get("/oportunidades/nao-avaliadas", async (req, res) => {
  const lista = await prisma.oportunidade.findMany({
    where: { status: "IDEIA", pontuacaoTotal: null },
    orderBy: { criadoEm: "asc" },
  });
  res.json(lista);
});

// Soma as 5 notas do filtro de avaliação — null se QUALQUER uma ainda não foi preenchida (nunca
// soma parcial, pra não confundir "3 pontos porque só uma nota foi dada" com "3 pontos de verdade
// numa avaliação completa"). Sempre recalculado aqui no servidor, nunca confia num total vindo do
// front.
function calcularPontuacaoOportunidade(notas) {
  const valores = [
    notas.notaTamanhoProblema,
    notas.notaDisposicaoPagar,
    notas.notaCapacidadeExecutar,
    notas.notaCustoTestar,
    notas.notaAlinhamento,
  ];
  if (valores.some((n) => n === null || n === undefined)) return null;
  return valores.reduce((soma, n) => soma + n, 0);
}

// Cadastro — serve tanto o formulário completo quanto o atalho rápido "Registrar ideia" do
// Fechamento do Meu dia (que manda só título + empresa, o resto fica undefined/vazio pra
// preencher depois).
router.post("/oportunidades", async (req, res) => {
  const {
    titulo,
    empresa,
    descricao,
    tipo,
    fonte,
    notaTamanhoProblema,
    notaDisposicaoPagar,
    notaCapacidadeExecutar,
    notaCustoTestar,
    notaAlinhamento,
  } = req.body;
  if (!titulo || !titulo.trim() || !empresa) {
    return res.status(400).json({ erro: "Título e empresa são obrigatórios." });
  }

  const notas = { notaTamanhoProblema, notaDisposicaoPagar, notaCapacidadeExecutar, notaCustoTestar, notaAlinhamento };
  const pontuacaoTotal = calcularPontuacaoOportunidade(notas);

  const criada = await prisma.oportunidade.create({
    data: {
      titulo: titulo.trim(),
      empresa,
      descricao: descricao || null,
      tipo: tipo || null,
      fonte: fonte || null,
      notaTamanhoProblema: notaTamanhoProblema ?? null,
      notaDisposicaoPagar: notaDisposicaoPagar ?? null,
      notaCapacidadeExecutar: notaCapacidadeExecutar ?? null,
      notaCustoTestar: notaCustoTestar ?? null,
      notaAlinhamento: notaAlinhamento ?? null,
      pontuacaoTotal,
      // se já veio com as 5 notas preenchidas (cadastro completo direto), já nasce "Avaliada" —
      // senão fica "Ideia" até alguém dar as notas depois.
      status: pontuacaoTotal != null ? "AVALIADA" : "IDEIA",
      criadoPorId: req.user.id,
    },
  });
  res.json(criada);
});

router.put("/oportunidades/:id", async (req, res) => {
  const atual = await prisma.oportunidade.findUnique({ where: { id: req.params.id } });
  if (!atual) return res.status(404).json({ erro: "Oportunidade não encontrada." });

  const {
    titulo,
    descricao,
    empresa,
    tipo,
    fonte,
    notaTamanhoProblema,
    notaDisposicaoPagar,
    notaCapacidadeExecutar,
    notaCustoTestar,
    notaAlinhamento,
    status,
    motivoArquivamento,
  } = req.body;

  const dados = {
    ...(titulo !== undefined && { titulo: titulo.trim() }),
    ...(descricao !== undefined && { descricao: descricao || null }),
    ...(empresa !== undefined && { empresa }),
    ...(tipo !== undefined && { tipo: tipo || null }),
    ...(fonte !== undefined && { fonte: fonte || null }),
  };

  // Só recalcula a pontuação se alguma nota veio nesse PUT — senão ela fica como já estava
  // (editar só o título, por exemplo, não deve mexer na nota).
  const notasRecebidas = { notaTamanhoProblema, notaDisposicaoPagar, notaCapacidadeExecutar, notaCustoTestar, notaAlinhamento };
  if (Object.values(notasRecebidas).some((n) => n !== undefined)) {
    const notasFinais = {
      notaTamanhoProblema: notaTamanhoProblema !== undefined ? notaTamanhoProblema : atual.notaTamanhoProblema,
      notaDisposicaoPagar: notaDisposicaoPagar !== undefined ? notaDisposicaoPagar : atual.notaDisposicaoPagar,
      notaCapacidadeExecutar: notaCapacidadeExecutar !== undefined ? notaCapacidadeExecutar : atual.notaCapacidadeExecutar,
      notaCustoTestar: notaCustoTestar !== undefined ? notaCustoTestar : atual.notaCustoTestar,
      notaAlinhamento: notaAlinhamento !== undefined ? notaAlinhamento : atual.notaAlinhamento,
    };
    Object.assign(dados, notasFinais);
    const novaPontuacao = calcularPontuacaoOportunidade(notasFinais);
    dados.pontuacaoTotal = novaPontuacao;
    // acabou de completar a avaliação (5ª nota) e ainda estava em "Ideia", sem pedido explícito de
    // mudar o status nesse mesmo PUT → promove sozinho pra "Avaliada".
    if (novaPontuacao != null && atual.status === "IDEIA" && status === undefined) {
      dados.status = "AVALIADA";
    }
  }

  if (status !== undefined) {
    if (status === "ARQUIVADA" && !motivoArquivamento && !atual.motivoArquivamento) {
      return res.status(400).json({ erro: "Informe o motivo do arquivamento antes de arquivar." });
    }
    dados.status = status;
  }
  if (motivoArquivamento !== undefined) dados.motivoArquivamento = motivoArquivamento || null;

  const atualizada = await prisma.oportunidade.update({ where: { id: req.params.id }, data: dados });
  res.json(atualizada);
});

router.delete("/oportunidades/:id", async (req, res) => {
  await prisma.oportunidade.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ======================================================================================
// ---------- Fase 71 — Bloco de notas de aula (pop-up separado, ver notas-popup.js) ----------
// ======================================================================================
router.get("/anotacoes-estudo", async (req, res) => {
  const lista = await prisma.anotacaoEstudo.findMany({
    where: { criadoPorId: req.user.id },
    orderBy: { atualizadoEm: "desc" },
  });
  res.json(lista);
});

router.post("/anotacoes-estudo", async (req, res) => {
  const { tema } = req.body;
  if (!tema || !tema.trim()) return res.status(400).json({ erro: "Dê um tema pra aula antes de criar." });
  const criada = await prisma.anotacaoEstudo.create({
    data: { tema: tema.trim(), conteudo: "", criadoPorId: req.user.id },
  });
  res.json(criada);
});

router.put("/anotacoes-estudo/:id", async (req, res) => {
  const { tema, conteudo } = req.body;
  const dados = {
    ...(tema !== undefined && { tema: tema.trim() }),
    ...(conteudo !== undefined && { conteudo }),
  };
  const resultado = await prisma.anotacaoEstudo.updateMany({ where: { id: req.params.id, criadoPorId: req.user.id }, data: dados });
  if (resultado.count === 0) return res.status(404).json({ erro: "Anotação não encontrada." });
  const atualizada = await prisma.anotacaoEstudo.findUnique({ where: { id: req.params.id } });
  res.json(atualizada);
});

router.delete("/anotacoes-estudo/:id", async (req, res) => {
  await prisma.anotacaoEstudo.deleteMany({ where: { id: req.params.id, criadoPorId: req.user.id } });
  res.json({ ok: true });
});

// ======================================================================================
// ---------- Fase 75 — Site institucional: perfis dos profissionais editáveis daqui ----------
// Antes, toda troca de foto/bio/descrição de quem aparece no site público (espacodorenascer.com/
// site) só podia ser feita editando o arquivo estático do site na mão. Agora isso vira um
// cadastro no banco (PerfilSiteProfissional, 1:1 com Profissional), editável por aqui, e o site
// público passa a buscar os dados dele por uma rota pública nova (ver backend/src/routes/
// publico.js) em vez de ler um objeto fixo no código do front.
// ======================================================================================

// Lista TODOS os profissionais (não só quem já tem perfil de site), pra essa tela mostrar tanto
// quem já está publicado quanto quem ainda pode ser adicionado. Ordenado pelos que já têm perfil
// (por ordem de exibição) primeiro, depois os que ainda não têm perfil nenhum, por nome.
router.get("/site/profissionais", async (req, res) => {
  const profissionais = await prisma.profissional.findMany({
    include: {
      user: { select: { nome: true, ativo: true } },
      perfilSite: true,
    },
  });
  const comPerfil = profissionais
    .filter((p) => p.perfilSite)
    .sort((a, b) => a.perfilSite.ordem - b.perfilSite.ordem);
  const semPerfil = profissionais
    .filter((p) => !p.perfilSite)
    .sort((a, b) => a.user.nome.localeCompare(b.user.nome));
  res.json([...comPerfil, ...semPerfil]);
});

// Cria ou atualiza o perfil de site de uma profissional (upsert por profissionalId). O slug
// público (Profissional.slugSitePublico) continua sendo editado pela rota que já existia
// (PUT /profissionais/:id/slug-site-publico) — é o mesmo campo usado hoje pro popup de
// agendamento achar os horários reais dela, não duplicado aqui.
router.put("/site/profissionais/:profissionalId", async (req, res) => {
  const profissional = await prisma.profissional.findUnique({ where: { id: req.params.profissionalId } });
  if (!profissional) return res.status(404).json({ erro: "Profissional não encontrada." });

  const { nomeExibicao, cargoExibicao, registro, genero, bioParagrafos, tags, quote, testemunhos, fotoBase64, ativo, ordem } = req.body;
  if (!nomeExibicao || !nomeExibicao.trim()) return res.status(400).json({ erro: "Informe o nome como vai aparecer no site." });
  if (!cargoExibicao || !cargoExibicao.trim()) return res.status(400).json({ erro: "Informe o cargo/categoria (ex: Psicóloga Clínica)." });

  const dados = {
    nomeExibicao: nomeExibicao.trim(),
    cargoExibicao: cargoExibicao.trim(),
    registro: registro?.trim() || null,
    genero: genero || null,
    bioParagrafos: Array.isArray(bioParagrafos) ? bioParagrafos.filter(Boolean) : [],
    tags: Array.isArray(tags) ? tags.filter(Boolean) : [],
    quote: quote?.trim() || null,
    testemunhos: Array.isArray(testemunhos) ? testemunhos.filter(Boolean) : [],
    ...(fotoBase64 && { fotoBase64 }), // só troca a foto se vier uma nova — não apaga a existente mandando vazio
    ...(ativo !== undefined && { ativo: !!ativo }),
    ...(ordem !== undefined && { ordem: Number(ordem) || 0 }),
  };

  const perfil = await prisma.perfilSiteProfissional.upsert({
    where: { profissionalId: req.params.profissionalId },
    update: dados,
    create: {
      profissionalId: req.params.profissionalId,
      ordem: 0,
      ...dados,
    },
  });
  res.json(perfil);
});

// Reordena a lista (arrastar/soltar na tela) — recebe os ids do PerfilSiteProfissional já na
// ordem final e grava o índice de cada um.
router.put("/site/profissionais/reordenar", async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids)) return res.status(400).json({ erro: "Lista de ids inválida." });
  await Promise.all(ids.map((id, indice) => prisma.perfilSiteProfissional.update({ where: { id }, data: { ordem: indice } }).catch(() => null)));
  res.json({ ok: true });
});

// "Deixou de fazer a parceria" — exclui o perfil de site de vez (não mexe no login/cadastro dela
// dentro do sistema, só tira do site). Ela some do site automaticamente na próxima visita.
router.delete("/site/profissionais/:profissionalId", async (req, res) => {
  await prisma.perfilSiteProfissional.deleteMany({ where: { profissionalId: req.params.profissionalId } });
  res.json({ ok: true });
});

// Importação única dos 13 perfis que já estavam publicados no site antes dessa mudança (Fase 75)
// — casa cada um pelo slugSitePublico que a profissional já tinha vinculado (mesmo campo que já
// fazia o popup de agendamento funcionar). Só cria quem ainda NÃO tem perfil de site (não
// sobrescreve edição manual já feita) — pode ser chamada de novo sem medo de duplicar ou de
// perder o que já foi ajustado na mão.
router.post("/site/profissionais/importar-dados-atuais", async (req, res) => {
  const seed = require("../data/perfisSiteSeed.json");
  const resultado = { importados: [], semSlugVinculado: [], jaTinhaPerfil: [] };

  for (const item of seed) {
    const profissional = await prisma.profissional.findFirst({ where: { slugSitePublico: item.slugSitePublico } });
    if (!profissional) {
      resultado.semSlugVinculado.push(item.nomeExibicao);
      continue;
    }
    const jaTemPerfil = await prisma.perfilSiteProfissional.findUnique({ where: { profissionalId: profissional.id } });
    if (jaTemPerfil) {
      resultado.jaTinhaPerfil.push(item.nomeExibicao);
      continue;
    }
    const { slugSitePublico, ...dadosPerfil } = item;
    await prisma.perfilSiteProfissional.create({ data: { profissionalId: profissional.id, ...dadosPerfil } });
    resultado.importados.push(item.nomeExibicao);
  }

  res.json(resultado);
});

// ======================================================================================
// Fase 75-B — Rodízio do site: escala semanal fixa (quem atende de manhã/tarde em cada dia)
// + exceções pontuais (tirar alguém do site só numa data específica, sem bagunçar a escala das
// próximas semanas). Ver RodizioSiteProfissional/RodizioSiteExcecao em schema.prisma e o filtro
// aplicado em GET /publico/site/profissionais.
// ======================================================================================

const DIAS_SEMANA_RODIZIO = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"];

// Devolve a escala semanal inteira (agrupada por dia/turno, já com os nomes pra montar a grade
// na tela) + as exceções de hoje em diante (passado não interessa mais pra quem tá organizando).
router.get("/site/rodizio", async (req, res) => {
  const [perfis, atribuicoes, excecoes] = await Promise.all([
    prisma.perfilSiteProfissional.findMany({
      where: { profissional: { slugSitePublico: { not: null } } },
      select: { nomeExibicao: true, cargoExibicao: true, profissional: { select: { id: true } } },
      orderBy: { ordem: "asc" },
    }),
    prisma.rodizioSiteProfissional.findMany(),
    prisma.rodizioSiteExcecao.findMany({
      // "Hoje" em horário de Brasília (mesmo cálculo usado em publico.js) — sem isso, entre 21h
      // e meia-noite (Brasília) o relógio UTC do servidor já marca o dia seguinte, e a exceção
      // de hoje sumiria da lista um pouco antes da hora.
      where: { data: { gte: new Date(new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10)) } },
      include: { profissional: { select: { perfilSite: { select: { nomeExibicao: true } } } } },
      orderBy: { data: "asc" },
    }),
  ]);

  const profissionais = perfis.map((p) => ({ id: p.profissional.id, nome: p.nomeExibicao, cargo: p.cargoExibicao }));

  const escala = {};
  for (const dia of DIAS_SEMANA_RODIZIO) escala[dia] = { manha: [], tarde: [] };
  for (const a of atribuicoes) {
    if (!escala[a.diaSemana]) continue; // defensivo — enum sempre bate, mas não custa
    escala[a.diaSemana][a.turno === "MANHA" ? "manha" : "tarde"].push(a.profissionalId);
  }

  res.json({
    profissionais,
    escala,
    excecoes: excecoes.map((e) => ({
      id: e.id,
      profissionalId: e.profissionalId,
      nome: e.profissional.perfilSite?.nomeExibicao || "(sem perfil de site)",
      data: e.data.toISOString().slice(0, 10),
    })),
  });
});

// Substitui a escala de UM dia da semana inteiro (manhã + tarde), recebendo a lista final de
// quem fica em cada turno naquele dia — mais simples e seguro do que ficar togglando célula por
// célula, e o Dono salva um dia da vez na tela.
router.put("/site/rodizio/:diaSemana", async (req, res) => {
  const diaSemana = req.params.diaSemana;
  if (!DIAS_SEMANA_RODIZIO.includes(diaSemana)) return res.status(400).json({ erro: "Dia da semana inválido." });

  const { manha, tarde } = req.body;
  if (!Array.isArray(manha) || !Array.isArray(tarde)) {
    return res.status(400).json({ erro: "Envie as listas de profissionais de manhã e de tarde." });
  }

  await prisma.$transaction([
    prisma.rodizioSiteProfissional.deleteMany({ where: { diaSemana } }),
    prisma.rodizioSiteProfissional.createMany({
      data: [
        ...manha.map((profissionalId) => ({ profissionalId, diaSemana, turno: "MANHA" })),
        ...tarde.map((profissionalId) => ({ profissionalId, diaSemana, turno: "TARDE" })),
      ],
    }),
  ]);

  res.json({ ok: true });
});

// Tira uma profissional do site só numa data (ex: ela avisou que não vai atender hoje). Se já
// existir exceção pra essa profissional nessa data, não dá erro — já está removida, segue o jogo.
router.post("/site/rodizio/excecoes", async (req, res) => {
  const { profissionalId, data } = req.body;
  if (!profissionalId || !data) return res.status(400).json({ erro: "Informe a profissional e a data." });

  await prisma.rodizioSiteExcecao.upsert({
    where: { profissionalId_data: { profissionalId, data: new Date(data) } },
    update: {},
    create: { profissionalId, data: new Date(data) },
  });
  res.json({ ok: true });
});

// Desfaz a remoção pontual (ela volta a aparecer no site normalmente a partir de agora).
router.delete("/site/rodizio/excecoes/:id", async (req, res) => {
  await prisma.rodizioSiteExcecao.deleteMany({ where: { id: req.params.id } });
  res.json({ ok: true });
});

// ---------- Fechamento de caixa ----------
// Dia a dia: lançamentos soltos (entrada/saída que não é pagamento de cliente) + conferência
// contra o saldo informado do banco/Pix.
router.get("/meu-dia/caixa", async (req, res) => {
  const { data } = req.query;
  const [saldo, conferencia] = await Promise.all([
    calcularSaldoCaixaDoDia(data),
    prisma.conferenciaCaixa.findUnique({ where: { data: inicioDoDia(data) } }),
  ]);
  res.json({ ...saldo, conferencia });
});

router.post("/meu-dia/caixa/movimentos", async (req, res) => {
  const { tipo, categoria, valor, descricao, canalOrigem, data } = req.body;
  if (!tipo || !categoria || !valor) return res.status(400).json({ erro: "Informe o tipo, a categoria e o valor." });
  const valorNumerico = parseValorMonetario(valor);
  if (!valorNumerico || valorNumerico <= 0) return res.status(400).json({ erro: "Valor inválido." });

  const movimento = await prisma.movimentoCaixa.create({
    data: {
      tipo,
      categoria,
      valor: valorNumerico,
      descricao: descricao || null,
      canalOrigem: canalOrigem || null,
      criadoPorId: req.user.id,
      data: data ? new Date(`${data}T12:00:00`) : new Date(),
    },
  });
  res.json(movimento);
});

router.delete("/meu-dia/caixa/movimentos/:id", async (req, res) => {
  await prisma.movimentoCaixa.deleteMany({ where: { id: req.params.id, criadoPorId: req.user.id } });
  res.json({ ok: true });
});

// Confere o saldo do sistema (calculado) com o saldo informado do banco/Pix nesse dia — salva
// (ou atualiza, se já tinha conferido esse mesmo dia) um registro de conferência.
router.post("/meu-dia/caixa/conferir", async (req, res) => {
  const { data, saldoBancoInformado, observacao } = req.body;
  const valorBanco = parseValorMonetario(saldoBancoInformado);
  if (valorBanco === null) return res.status(400).json({ erro: "Informe o saldo do banco/Pix desse dia." });

  const saldo = await calcularSaldoCaixaDoDia(data);
  const diferenca = Number((saldo.saldoSistema - valorBanco).toFixed(2));

  const conferencia = await prisma.conferenciaCaixa.upsert({
    where: { data: inicioDoDia(data) },
    update: { saldoSistema: saldo.saldoSistema, saldoBancoInformado: valorBanco, diferenca, observacao: observacao || null },
    create: {
      data: inicioDoDia(data),
      saldoSistema: saldo.saldoSistema,
      saldoBancoInformado: valorBanco,
      diferenca,
      observacao: observacao || null,
      criadoPorId: req.user.id,
    },
  });
  res.json(conferencia);
});

// ---------- Metas do trimestre ----------
router.get("/meu-dia/metas", async (req, res) => {
  const { trimestre } = req.query;
  const lista = await prisma.metaTrimestre.findMany({
    where: { trimestre: trimestre || trimestreAtual() },
    orderBy: { criadoEm: "asc" },
  });
  res.json({ trimestre: trimestre || trimestreAtual(), metas: lista });
});

router.post("/meu-dia/metas", async (req, res) => {
  const { titulo, unidade, valorMeta, valorAtual, observacao, trimestre } = req.body;
  if (!titulo || !valorMeta) return res.status(400).json({ erro: "Informe o título e a meta." });
  const meta = await prisma.metaTrimestre.create({
    data: {
      titulo,
      unidade: unidade || "reais",
      valorMeta: Number(valorMeta),
      valorAtual: valorAtual ? Number(valorAtual) : 0,
      observacao: observacao || null,
      trimestre: trimestre || trimestreAtual(),
      criadoPorId: req.user.id,
    },
  });
  res.json(meta);
});

router.put("/meu-dia/metas/:id", async (req, res) => {
  const { titulo, unidade, valorMeta, valorAtual, observacao } = req.body;
  const dados = {};
  if (titulo !== undefined) dados.titulo = titulo;
  if (unidade !== undefined) dados.unidade = unidade;
  if (valorMeta !== undefined) dados.valorMeta = Number(valorMeta);
  if (valorAtual !== undefined) dados.valorAtual = Number(valorAtual);
  if (observacao !== undefined) dados.observacao = observacao || null;
  const meta = await prisma.metaTrimestre.update({ where: { id: req.params.id }, data: dados });
  res.json(meta);
});

router.delete("/meu-dia/metas/:id", async (req, res) => {
  await prisma.metaTrimestre.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

module.exports = router;
