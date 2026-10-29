const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { diaSemanaDeData, horariosLivres } = require("../utils/horarios");
const { valorDoPlano, calcularRepasse, transacaoDuplicada, parseValorMonetario } = require("../utils/financeiro");
const { notificar, notificarDonos, notificarAtendentes } = require("../utils/notificar");
const { calcularMetricasCliente } = require("../utils/metricas");
const { calcularStatusCliente } = require("../utils/statusCliente");
const { excluirCliente } = require("../utils/excluirUsuario");
const { inicioDoDia, fimDoDia, periodoDoMes, inicioDaSemana } = require("../utils/meuDia");
const { gerarEmailAutomatico } = require("../utils/gerarLogin");
const { cadastrarClienteComProfissional } = require("../utils/cadastrarCliente");
const { listarClientesParaRenovar } = require("../utils/renovacoes");

const router = express.Router();
router.use(autenticar, permitir("ATENDENTE"));

// ---------- Cadastro de novos clientes ----------
// Fase 54/55 — mesmo formato "canvas" da Profissional (pacote + dia/hora fixo), com a profissional
// escolhida (obrigatório). Fase 55: o cliente já ganha login na hora, mas o pacote, a agenda e o
// pagamento (se informado) ficam PENDENTES até a profissional aceitar na aba "Novos pacientes"
// dela — é o aceite que gera a receita de verdade pra clínica/repasse. Toda essa lógica
// compartilhada vive em utils/cadastrarCliente.js, junto com a rota equivalente do Dono.
router.post("/clientes", async (req, res) => {
  const atendenteId = req.user.atendente.id;
  try {
    const resultado = await cadastrarClienteComProfissional({
      ...req.body,
      cadastradoPorId: atendenteId,
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

// Fase 54 — "Cadastrados recentemente": lista curta pra ela conferir (e desfazer, se foi
// engano) os cadastros que ela mesma fez nas últimas 48h. Igual ao que a Profissional já tem.
// Precisa vir ANTES de qualquer rota "/clientes/:id" pra "recentes" não ser interpretado como id.
router.get("/clientes/recentes", async (req, res) => {
  const atendenteId = req.user.atendente.id;
  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const clientes = await prisma.cliente.findMany({
    where: { cadastradoPorId: atendenteId, criadoEm: { gte: desde } },
    include: { user: { select: { nome: true } } },
    orderBy: { criadoEm: "desc" },
    take: 10,
  });
  res.json(clientes.map((c) => ({ id: c.id, nome: c.user.nome, criadoEm: c.criadoEm })));
});

// Desfazer um cadastro recente feito por ela mesma (ex: digitou errado, duplicou). Só funciona
// pro próprio cadastro dela e só dentro das 48h — depois disso ela fala com o Dono.
router.delete("/clientes/:id/recente", async (req, res) => {
  const atendenteId = req.user.atendente.id;
  const desde = new Date(Date.now() - 48 * 60 * 60 * 1000);
  const cliente = await prisma.cliente.findFirst({
    where: { id: req.params.id, cadastradoPorId: atendenteId, criadoEm: { gte: desde } },
    include: { user: { select: { nome: true } } },
  });
  if (!cliente) {
    return res
      .status(404)
      .json({ erro: "Esse cadastro não é seu ou não é recente o suficiente pra excluir por aqui — fale com o Dono." });
  }
  const nomeCliente = cliente.user.nome;
  await excluirCliente(cliente.id);
  await notificarDonos({
    titulo: "Cadastro desfeito",
    mensagem: `${req.user.nome} excluiu o cadastro de ${nomeCliente} (cadastro recente, desfeito por ela mesma).`,
    tipo: "sistema",
  });
  res.json({ ok: true });
});

router.get("/clientes", async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    where: { situacao: "ATIVO" },
    include: {
      user: { select: { nome: true, email: true, telefone: true } },
      profissionalAtual: { include: { user: { select: { nome: true, role: true } } } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
      // Fase 55 — enquanto não é aceito pela profissional, o cliente ainda não tem
      // profissionalAtual; isso é o que deixa a tela dizer "aguardando aceite" em vez de
      // simplesmente "sem profissional" (que ficaria confuso).
      solicitacoesNovoPaciente: {
        where: { status: "PENDENTE" },
        include: { profissional: { include: { user: { select: { nome: true } } } } },
        take: 1,
      },
    },
    orderBy: { criadoEm: "desc" },
  });
  res.json(
    clientes.map((c) => ({
      ...c,
      statusCliente: calcularStatusCliente({ pacote: c.pacotes[0], renovarEm: c.renovarEm }),
      aguardandoAceiteDe: c.solicitacoesNovoPaciente[0]?.profissional?.user?.nome || null,
    }))
  );
});

// A atendente também pode registrar o andamento da relação com o cliente (mesma ação da
// profissional): "ATIVO", "RENOVOU" ou "EXCLUIR" (não renovou — vai pra fila de reativação).
router.put("/clientes/:id/situacao", async (req, res) => {
  const { acao } = req.body; // "ATIVO" | "RENOVOU" | "EXCLUIR"
  const cliente = await prisma.cliente.findUnique({
    where: { id: req.params.id },
    include: { user: true, profissionalAtual: { include: { user: true } }, pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 } },
  });
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado." });

  const pacote = cliente.pacotes[0];
  const pacoteResumo = pacote ? `${pacote.duracao === "MIN30" ? "30min" : "50min"} - ${pacote.totalSessoes} sessão(ões)` : null;
  const base = {
    clienteId: cliente.id,
    nomeCliente: cliente.user.nome,
    whatsapp: cliente.whatsappCadastro || cliente.user.telefone,
    pacoteResumo,
    profissionalNome: cliente.profissionalAtual?.user?.nome || null,
    realizadoPorId: req.user.id,
  };

  if (acao === "RENOVOU") {
    await prisma.historicoCliente.create({ data: { ...base, tipo: "RENOVOU" } });
    await prisma.pacote.updateMany({ where: { clienteId: cliente.id }, data: { avisoPopupNivel: null } });
  } else if (acao === "EXCLUIR") {
    await prisma.historicoCliente.create({ data: { ...base, tipo: "EXCLUIDO", motivo: "Não renovou — removido pela recepção." } });
    await prisma.cliente.update({ where: { id: cliente.id }, data: { situacao: "EXCLUIDO", profissionalAtualId: null } });
    // Libera qualquer horário fixo que esse cliente tivesse — volta a aparecer livre pra outros.
    await prisma.disponibilidade.updateMany({ where: { ocupadoPorClienteId: cliente.id }, data: { ocupadoPorClienteId: null, ocupadoEm: null } });
    await notificarDonos({
      titulo: "Cliente saiu",
      mensagem: `${base.nomeCliente} não renovou e foi removido(a) pela recepção${base.profissionalNome ? ` (profissional: ${base.profissionalNome})` : ""}.`,
      tipo: "cliente",
    });
  } else {
    await prisma.cliente.update({ where: { id: cliente.id }, data: { situacao: "ATIVO" } });
  }

  res.json({ ok: true });
});

// Fila de reativação: clientes que alguma profissional (ou a própria recepção) marcou como
// "não renovou e saiu" — ficam aqui até alguém vincular de novo com uma profissional.
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

// Reativa: vincula o cliente de novo com uma profissional e ele volta a aparecer na lista normal dela.
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
      mensagem: `${cliente.user.nome} foi reativado(a) e vinculado(a) a você pela recepção.`,
      tipo: "cliente",
    });
  }
  res.json({ ok: true });
});

// ---------- Métricas de retenção de um cliente (tempo de casa, renovações) ----------
router.get("/clientes/:id/metricas", async (req, res) => {
  const metricas = await calcularMetricasCliente(req.params.id);
  if (!metricas) return res.status(404).json({ erro: "Cliente não encontrado." });
  res.json(metricas);
});

// Troca o cliente de profissional a qualquer momento — não depende de pacote encerrado nem do
// cliente estar na fila de reativação (isso é diferente da troca que o próprio cliente faz pelo
// app). Pensada pra recepção conseguir mover clientes que estavam soltos ou com outra
// profissional, inclusive pro login do próprio Dono quando ele também atende pacientes (ver Fase
// 13, "Dono também é Profissional"). Também reativa o cliente se ele estava com situação excluída.
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
        ? `Trocado(a) de ${nomeProfissionalAntiga} pela recepção.`
        : "Vinculado(a) a uma profissional pela recepção.",
      realizadoPorId: req.user.id,
    },
  });

  if (cliente.profissionalAtual?.user) {
    await notificar(cliente.profissionalAtual.user.id, {
      titulo: "Novo cliente pra você!",
      mensagem: `${cliente.user.nome} foi vinculado(a) a você pela recepção${
        nomeProfissionalAntiga ? ` (estava com ${nomeProfissionalAntiga})` : ""
      }.`,
      tipo: "cliente",
    });
  }
  res.json(cliente);
});

// ---------- Contato de notificação (e-mail/telefone) + data prevista de renovação ----------
// A atendente cadastra pra que o sistema mande aviso automático de sessão/renovação.
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
    // Fase 69: idem — nova data de renovação reabre a janela do lembrete de check-in de ~7 dias.
    dados.renovarCheckinSemanaEnviado = false;
  }
  const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data: dados });
  res.json(cliente);
});

// ---------- Excluir login de cliente ----------
// Hierarquia: a atendente só pode excluir CLIENTES (nunca profissional/atendente/dono).
router.delete("/clientes/:id", async (req, res) => {
  try {
    await excluirCliente(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ erro: e.message || "Erro ao excluir cliente." });
  }
});

// Lista completa das profissionais — com foto, o que atende, idade e abordagem — pra atendente
// conseguir escolher exatamente quem encaixa no que o cliente quer.
router.get("/profissionais", async (req, res) => {
  const profissionais = await prisma.profissional.findMany({
    include: {
      // "role" vai junto pra recepção conseguir identificar, na lista, qual profissional é
      // também um login de Dono (ex: o próprio Elismael atendendo) — mostra um selo "Dono".
      user: { select: { nome: true, ativo: true, fotoUrl: true, role: true, ultimoAcessoEm: true } },
      disponibilidades: {
        where: { ativo: true },
        include: { ocupadoPorCliente: { select: { user: { select: { nome: true } } } } },
      },
    },
  });
  res.json(profissionais);
});

// A atendente também pode ajustar os horários exatos que uma profissional atende (útil quando
// a própria profissional pede pra recepção alterar). Cada item é um horário EXATO daquele dia
// (ex: {diaSemana: "SEGUNDA", horaInicio: "08:30"}) — não uma faixa contínua — pra não liberar
// pro cliente/atendente horário que ela na verdade não atende.
router.put("/profissionais/:id/disponibilidades", async (req, res) => {
  const profissionalId = req.params.id;
  const { disponibilidades } = req.body; // [{diaSemana, horaInicio}]
  const existe = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  if (!existe) return res.status(404).json({ erro: "Profissional não encontrada." });

  const atuais = await prisma.disponibilidade.findMany({ where: { profissionalId } });
  const chave = (d) => `${d.diaSemana}|${d.horaInicio}`;
  const novasChaves = new Set((disponibilidades || []).map(chave));

  // Nunca apaga um horário que já é fixo de um cliente por engano — se ele sumiu da lista nova,
  // barra e avisa quem é o cliente, em vez de tirar o horário fixo dele sem querer.
  const presoOcupado = atuais.find((d) => d.ocupadoPorClienteId && !novasChaves.has(chave(d)));
  if (presoOcupado) {
    const cliente = await prisma.cliente.findUnique({ where: { id: presoOcupado.ocupadoPorClienteId }, include: { user: true } });
    return res.status(400).json({
      erro: `O horário ${presoOcupado.diaSemana} ${presoOcupado.horaInicio} já é fixo do cliente ${cliente?.user?.nome || "cadastrado"} e não pode ser removido por aqui. Agende um novo horário pra ele primeiro (isso libera este automaticamente).`,
    });
  }

  const chavesAtuais = new Set(atuais.map(chave));
  const remover = atuais.filter((d) => !novasChaves.has(chave(d)));
  const adicionar = (disponibilidades || []).filter((d) => !chavesAtuais.has(chave(d)));

  if (remover.length > 0) {
    await prisma.disponibilidade.deleteMany({ where: { id: { in: remover.map((d) => d.id) } } });
  }
  if (adicionar.length > 0) {
    await prisma.disponibilidade.createMany({
      data: adicionar.map((d) => ({ diaSemana: d.diaSemana, horaInicio: d.horaInicio, profissionalId })),
    });
  }
  res.json({ ok: true });
});

// Horários livres de uma profissional numa data específica, já descontando o que está ocupado —
// é essa lista que a atendente usa pra marcar exatamente o horário que o cliente quer.
router.get("/profissionais/:id/horarios", async (req, res) => {
  const { data, duracao, clienteId } = req.query;
  if (!data) return res.status(400).json({ erro: "Informe a data (YYYY-MM-DD)." });

  const diaSemana = diaSemanaDeData(data);
  const [disponibilidadesDoDia, agendamentosDoDia] = await Promise.all([
    prisma.disponibilidade.findMany({
      where: {
        profissionalId: req.params.id,
        diaSemana,
        ativo: true,
        // Um horário que já é fixo de outro cliente não aparece como livre — a não ser que seja
        // livre mesmo (ninguém ocupando) ou já seja fixo desse MESMO cliente (ela reagendando).
        OR: [{ ocupadoPorClienteId: null }, { ocupadoPorClienteId: clienteId || "__nenhum__" }],
      },
    }),
    prisma.agendamento.findMany({
      where: {
        profissionalId: req.params.id,
        status: { in: ["AGENDADO", "CONFIRMADO", "REALIZADO"] },
        data: { gte: new Date(`${data}T00:00:00`), lt: new Date(`${data}T23:59:59`) },
      },
      select: { horaInicio: true, duracao: true },
    }),
  ]);

  const livres = horariosLivres({ disponibilidadesDoDia, agendamentosDoDia, duracao: duracao || "MIN50" });
  res.json({ diaSemana, livres });
});

// ---------- Agendar para o cliente (a atendente escolhe o horário exato que ele quer) ----------
router.post("/agendamentos", async (req, res) => {
  const { clienteId, profissionalId, data, horaInicio, duracao } = req.body;
  if (!clienteId || !profissionalId || !data || !horaInicio) {
    return res.status(400).json({ erro: "Informe cliente, profissional, data e horário." });
  }

  const diaSemana = diaSemanaDeData(data);

  // Revalida que o horário ainda está livre (evita choque se duas atendentes marcarem junto)
  const [disponibilidadesDoDia, agendamentosDoDia] = await Promise.all([
    prisma.disponibilidade.findMany({ where: { profissionalId, diaSemana, ativo: true } }),
    prisma.agendamento.findMany({
      where: {
        profissionalId,
        status: { in: ["AGENDADO", "CONFIRMADO", "REALIZADO"] },
        data: { gte: new Date(`${data}T00:00:00`), lt: new Date(`${data}T23:59:59`) },
      },
      select: { horaInicio: true, duracao: true },
    }),
  ]);
  const livres = horariosLivres({ disponibilidadesDoDia, agendamentosDoDia, duracao: duracao || "MIN50" });
  if (!livres.includes(horaInicio)) {
    return res.status(400).json({ erro: "Esse horário não está mais disponível. Escolha outro." });
  }

  const pacote = await prisma.pacote.findFirst({ where: { clienteId, profissionalId, status: "ATIVO" }, orderBy: { iniciadoEm: "desc" } });
  if (!pacote || pacote.sessoesUsadas >= pacote.totalSessoes) {
    return res.status(400).json({
      erro: "Esse cliente não tem sessões disponíveis com essa profissional. Registre o pacote pago antes de agendar.",
      semPacoteAtivo: true,
    });
  }

  // Garante que o cliente está vinculado a essa profissional
  await prisma.cliente.update({ where: { id: clienteId }, data: { profissionalAtualId: profissionalId } });

  const agendamento = await prisma.agendamento.create({
    data: { profissionalId, clienteId, pacoteId: pacote.id, data: new Date(data), diaSemana, horaInicio, duracao: duracao || "MIN50" },
  });

  // Esse dia+horário passa a ser o horário FIXO desse cliente com essa profissional — toda
  // semana esse mesmo horário já é dele, e some da lista de livres pra qualquer outro cliente.
  // Se ele já tinha outro horário fixo com ela, libera o antigo (o fixo dele é sempre o mais
  // recente que foi agendado). Fase 76: só trava como recorrente quando o pacote dele tem mais
  // de 1 sessão — sessão única não deve reservar o horário pras semanas seguintes.
  if (pacote.totalSessoes > 1) {
    const slotFixo = await prisma.disponibilidade.findFirst({ where: { profissionalId, diaSemana, horaInicio, ativo: true } });
    if (slotFixo) {
      await prisma.disponibilidade.updateMany({
        where: { profissionalId, ocupadoPorClienteId: clienteId, NOT: { id: slotFixo.id } },
        data: { ocupadoPorClienteId: null, ocupadoEm: null },
      });
      await prisma.disponibilidade.update({
        where: { id: slotFixo.id },
        data: { ocupadoPorClienteId: clienteId, ocupadoEm: new Date() },
      });
    }
  }

  // Avisa a profissional que uma nova sessão foi marcada pra ela
  const [profissionalAgendada, clienteAgendado] = await Promise.all([
    prisma.profissional.findUnique({ where: { id: profissionalId }, select: { userId: true } }),
    prisma.cliente.findUnique({ where: { id: clienteId }, include: { user: true } }),
  ]);
  if (profissionalAgendada) {
    await notificar(profissionalAgendada.userId, {
      titulo: "Nova sessão agendada",
      mensagem: `${clienteAgendado?.user?.nome || "Um cliente"} tem uma sessão marcada para ${new Date(data).toLocaleDateString("pt-BR")} às ${horaInicio}.`,
      tipo: "sistema",
      referenciaTipo: "CLIENTE",
      referenciaId: clienteId,
    });
  }

  res.json(agendamento);
});

// Registrar o pacote pago (a atendente também fecha o cadastro/pagamento inicial do cliente).
// Aqui é onde ela anexa o comprovante de contratação/pagamento/renovação — ele fica guardado
// no cadastro do cliente pra poder ser visto depois, e já contabiliza automaticamente
// quanto vai pra profissional e quanto fica pra Renascer (aparece no painel do Dono no mesmo dia).
router.post("/clientes/:id/pacotes", async (req, res) => {
  const { duracao, totalSessoes, valorTotal, valorPacoteTotal, tipo, imagemBase64, mimeType, observacao } = req.body;
  // É sempre a profissional que recebe o pagamento direto do cliente e repassa a parte da
  // Renascer — por isso todo lançamento feito pela atendente já nasce como pendência de repasse.
  const recebidoPorFinal = "PROFISSIONAL";
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id }, include: { user: true } });
  if (!cliente?.profissionalAtualId) {
    return res.status(400).json({ erro: "Vincule o cliente a uma profissional antes de registrar o pacote." });
  }
  const profissional = await prisma.profissional.findUnique({ where: { id: cliente.profissionalAtualId } });

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

  // Fase 59 — pagamento parcial: quando o valor pago agora é menor que o preço cheio combinado
  // do pacote, o pacote entra com o preço CHEIO (valorPacoteTotal) e a transação registra só o
  // que entrou de fato agora (valorFinal) + o quanto ficou pendente — o repasse sai calculado só
  // em cima do que entrou, igual sempre foi.
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
  const transacao = await prisma.transacaoFinanceira.create({
    data: {
      profissionalId: cliente.profissionalAtualId,
      clienteId: cliente.id,
      tipo: tipo || "PACOTE_NOVO",
      valorTotal: valorFinal,
      valorPacoteTotal: precoPacoteFinal > valorFinal ? precoPacoteFinal : null,
      valorProfissional,
      valorRenascer,
      recebidoPor: recebidoPorFinal,
      origem: "ATENDENTE",
      comprovanteBase64: imagemBase64 || null,
      comprovanteMimeType: imagemBase64 ? mimeType || "image/jpeg" : null,
      observacao: observacao || null,
    },
  });

  const pendenteRegistro = precoPacoteFinal > valorFinal ? precoPacoteFinal - valorFinal : 0;

  await notificar(cliente.userId, {
    titulo: "Novo pacote liberado",
    mensagem: `Seu pacote de ${totalSessoes} sessão(ões) foi confirmado. Já pode agendar seus horários!`,
    tipo: "sistema",
  });

  await notificar(profissional.userId, {
    titulo: "Lembrete de repasse",
    mensagem: `Pagamento de ${cliente.user?.nome || "seu cliente"} registrado — você recebe direto e precisa repassar R$ ${valorRenascer.toFixed(2)} pra Renascer (anexe o comprovante na aba Financeiro assim que repassar).`,
    tipo: "financeiro",
    referenciaTipo: "TRANSACAO",
    referenciaId: transacao.id,
  });

  await notificarDonos({
    titulo: "Tem dinheiro na área!",
    mensagem:
      `Pagamento de R$ ${valorFinal.toFixed(2)} de ${cliente.user?.nome || "um cliente"} registrado pela recepção — repasse esperado da profissional: R$ ${valorRenascer.toFixed(2)}.` +
      (pendenteRegistro > 0 ? ` Pagamento parcial — ainda falta R$ ${pendenteRegistro.toFixed(2)} do pacote.` : ""),
    tipo: "financeiro",
  });

  res.json({ pacote, transacao });
});

// Fase 80 — corrige a duração e o contador de sessões (usadas/total) de um pacote já existente,
// sem precisar marcar sessões passadas uma por uma — útil pra cliente que já estava em
// atendimento antes de entrar no sistema. NÃO mexe no valorTotal/financeiro.
router.put("/pacotes/:id", async (req, res) => {
  const pacote = await prisma.pacote.findUnique({ where: { id: req.params.id } });
  if (!pacote) return res.status(404).json({ erro: "Pacote não encontrado." });

  const { duracao, totalSessoes, sessoesUsadas } = req.body;
  const data = {};
  if (duracao !== undefined) {
    if (!["MIN30", "MIN50"].includes(duracao)) return res.status(400).json({ erro: "Duração inválida." });
    data.duracao = duracao;
  }
  if (totalSessoes !== undefined) {
    const n = Number(totalSessoes);
    if (!Number.isInteger(n) || n < 1) return res.status(400).json({ erro: "Número de sessões inválido." });
    data.totalSessoes = n;
  }
  if (sessoesUsadas !== undefined) {
    const n = Number(sessoesUsadas);
    if (!Number.isInteger(n) || n < 0) return res.status(400).json({ erro: "Sessões usadas inválido." });
    data.sessoesUsadas = n;
  }

  const totalFinal = data.totalSessoes !== undefined ? data.totalSessoes : pacote.totalSessoes;
  const usadasFinal = data.sessoesUsadas !== undefined ? data.sessoesUsadas : pacote.sessoesUsadas;
  if (usadasFinal > totalFinal) {
    return res.status(400).json({ erro: "Sessões usadas não pode ser maior que o total do pacote." });
  }

  const atualizado = await prisma.pacote.update({ where: { id: pacote.id }, data });
  res.json(atualizado);
});

// Histórico de pagamentos do cliente (contratações, renovações) com os comprovantes
// anexados — fica guardado pra poder ver depois. Não devolve a imagem em si (pesado),
// só se tem comprovante; a imagem é buscada à parte em /comum/transacoes/:id/comprovante.
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

// ---------- Ferramentas básicas: agenda geral (somente leitura) ----------
// "chamadaVideo" vai junto pra dar pra ver, sessão por sessão, se a profissional já entrou na
// videochamada (aí sim a sessão está de fato acontecendo) ou ainda não — mesmo registro que já
// existia desde a Fase 1/videochamada, só que agora também aparece pra atendente e pro dono.
// Fase 56 — passou a trazer também "ontem" (não só daqui pra frente): a atendente precisa ver se
// as sessões recentes das profissionais foram realizadas, pra acompanhar o uso do sistema.
router.get("/agenda-geral", async (req, res) => {
  // Fase 69 — trocado de "new Date(); setHours(0,0,0,0)" (meia-noite no fuso do SERVIDOR, que no
  // Railway roda em UTC) pra inicioDoDia() (meia-noite real em Brasília — ver Fase 59 em dono.js).
  // Sem isso, entre 21h e meia-noite em Brasília o filtro de "ontem" ficava 3h adiantado.
  const inicioOntem = new Date(inicioDoDia().getTime() - 24 * 60 * 60 * 1000);

  const agendamentos = await prisma.agendamento.findMany({
    where: { data: { gte: inicioOntem } },
    include: {
      profissional: { include: { user: { select: { nome: true } } } },
      cliente: { include: { user: { select: { nome: true } } } },
      chamadaVideo: true,
    },
    // Fase 60 — todo agendamento do mesmo dia tem o mesmo "data" (meia-noite UTC daquele dia — a
    // hora real é só horaInicio); sem o segundo critério, dois agendamentos no mesmo dia saíam em
    // ordem arbitrária em vez de por horário.
    orderBy: [{ data: "asc" }, { horaInicio: "asc" }],
    take: 150,
  });
  res.json(agendamentos);
});

// Fase 69 — lista "clientes pra renovar essa semana" (segunda a sábado, inclui quem já está
// atrasado), pro pop-up que abre sozinho ao entrar no sistema — a atendente não tinha acesso às
// rotas de /financeiro/* (de propósito, não deveria ver CAC/retiradas/imposto), então essa lista
// tem rota própria aqui, mas reaproveita a MESMA consulta (utils/renovacoes.js) usada na aba
// "Clientes pra renovar" do Financeiro/Dono.
router.get("/clientes-para-renovar-semana", async (req, res) => {
  const inicioSemana = inicioDaSemana();
  const fimSemanaExclusivo = new Date(inicioSemana.getTime() + 7 * 24 * 60 * 60 * 1000);
  const lista = await listarClientesParaRenovar({ ateExclusivo: fimSemanaExclusivo });
  res.json(lista);
});

// Fase 69 — "Marcar como contatado" pro pop-up da atendente (mesmo toggle que já existia em
// financeiro.js/profissional.js, só que ela não tinha acesso a nenhuma das duas rotas).
router.put("/clientes/:id/marcar-contatado", async (req, res) => {
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id }, select: { renovarContatadoEm: true } });
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado." });

  const atualizado = await prisma.cliente.update({
    where: { id: req.params.id },
    data: { renovarContatadoEm: cliente.renovarContatadoEm ? null : new Date() },
  });
  res.json({ renovarContatadoEm: atualizado.renovarContatadoEm });
});

// ---------- Suporte escalado à gerência (só visualização, item 19) ----------
router.get("/suporte-gerencia", async (req, res) => {
  const tickets = await prisma.ticketSuporte.findMany({
    where: { escalonadoGerencia: true },
    include: {
      cliente: { include: { user: { select: { nome: true } } } },
      mensagens: { orderBy: { criadoEm: "asc" } },
    },
    orderBy: { criadoEm: "desc" },
  });
  res.json(tickets);
});

// ======================================================================================
// ---------- "MEU DIA" (Fase 30) — recorte operacional pra Atendente: só o que já é dela
// em outras partes do sistema (agenda, reativação, clientes novos) + o registro de
// marketing, que ela também pode lançar. Nunca financeiro consolidado da clínica — isso
// continua só na visão do Dono.
// ======================================================================================

router.get("/meu-dia/indicadores", async (req, res) => {
  const hojeInicio = inicioDoDia();
  const hojeFim = fimDoDia();
  const { inicio: inicioMes, fim: fimMes } = periodoDoMes();

  const [agendamentosHoje, clientesEsperandoReativacao, clientesNovosHoje, clientesNovosMes, registrosMarketingMes] =
    await Promise.all([
      prisma.agendamento.findMany({
        where: { data: { gte: hojeInicio, lt: hojeFim } },
        select: { status: true },
      }),
      prisma.cliente.count({ where: { situacao: "EXCLUIDO", profissionalAtualId: null } }),
      prisma.cliente.count({ where: { criadoEm: { gte: hojeInicio, lt: hojeFim } } }),
      prisma.cliente.count({ where: { criadoEm: { gte: inicioMes, lt: fimMes } } }),
      prisma.registroMarketing.count({ where: { criadoPorId: req.user.id, data: { gte: inicioMes, lt: fimMes } } }),
    ]);

  const porStatusHoje = {};
  for (const ag of agendamentosHoje) porStatusHoje[ag.status] = (porStatusHoje[ag.status] || 0) + 1;

  res.json({
    agendaHoje: { total: agendamentosHoje.length, porStatus: porStatusHoje },
    clientesEsperandoReativacao,
    clientesNovosHoje,
    clientesNovosMes,
    registrosMarketingMeusMes: registrosMarketingMes,
  });
});

// Mesmo registro de marketing que o Dono usa (RegistroMarketing é um log só, de quem quer que
// registre) — a atendente também pode lançar o que postou/respondeu no dia.
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

module.exports = router;
