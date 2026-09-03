const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { diaSemanaDeData, horariosLivres } = require("../utils/horarios");
const { valorDoPlano } = require("../utils/financeiro");
const { notificar } = require("../utils/notificar");
const { calcularMetricasCliente } = require("../utils/metricas");
const { excluirCliente } = require("../utils/excluirUsuario");
const router = express.Router();
router.use(autenticar, permitir("ATENDENTE"));

// ---------- Cadastro de novos clientes ----------
router.post("/clientes", async (req, res) => {
  const { nome, email, telefone, senhaProvisoria, profissionalAtualId } = req.body;

  const existente = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existente) return res.status(400).json({ erro: "Já existe um usuário com esse e-mail." });

  const senha = senhaProvisoria || Math.random().toString(36).slice(-8);
  const hash = await bcrypt.hash(senha, 10);

  const atendenteId = req.user.atendente.id;

  const user = await prisma.user.create({
    data: {
      nome,
      email: email.toLowerCase().trim(),
      telefone,
      senha: hash,
      role: "CLIENTE",
      cliente: {
        create: {
          profissionalAtualId: profissionalAtualId || null,
          cadastradoPorId: atendenteId,
        },
      },
    },
    include: { cliente: true },
  });

  res.json({ id: user.id, email: user.email, senhaProvisoria: senha, cliente: user.cliente });
});

router.get("/clientes", async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    include: {
      user: { select: { nome: true, email: true, telefone: true } },
      profissionalAtual: { include: { user: { select: { nome: true } } } },
    },
    orderBy: { criadoEm: "desc" },
  });
  res.json(clientes);
});

// ---------- Métricas de retenção de um cliente (tempo de casa, renovações) ----------
router.get("/clientes/:id/metricas", async (req, res) => {
  const metricas = await calcularMetricasCliente(req.params.id);
  if (!metricas) return res.status(404).json({ erro: "Cliente não encontrado." });
  res.json(metricas);
});
router.put("/clientes/:id/vincular-profissional", async (req, res) => {
  const { profissionalId } = req.body;
  const cliente = await prisma.cliente.update({ where: { id: req.params.id }, data: { profissionalAtualId: profissionalId } });
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
      user: { select: { nome: true, ativo: true, fotoUrl: true } },
      disponibilidades: { where: { ativo: true } },
    },
  });
  res.json(profissionais);
});

// Horários livres de uma profissional numa data específica, já descontando o que está ocupado —
// é essa lista que a atendente usa pra marcar exatamente o horário que o cliente quer.
router.get("/profissionais/:id/horarios", async (req, res) => {
  const { data, duracao } = req.query;
  if (!data) return res.status(400).json({ erro: "Informe a data (YYYY-MM-DD)." });

  const diaSemana = diaSemanaDeData(data);
  const [disponibilidadesDoDia, agendamentosDoDia] = await Promise.all([
    prisma.disponibilidade.findMany({ where: { profissionalId: req.params.id, diaSemana, ativo: true } }),
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

  res.json(agendamento);
});

// Registrar o pacote pago (a atendente também fecha o cadastro/pagamento inicial do cliente)
router.post("/clientes/:id/pacotes", async (req, res) => {
  const { duracao, totalSessoes, valorTotal } = req.body;
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
  if (!cliente?.profissionalAtualId) {
    return res.status(400).json({ erro: "Vincule o cliente a uma profissional antes de registrar o pacote." });
  }

  const valorOficial = valorDoPlano(duracao, totalSessoes);
  const valorFinal = valorTotal ?? valorOficial;
  if (!valorFinal) return res.status(400).json({ erro: "Informe duração, quantidade de sessões e/ou valor válidos." });

  await prisma.pacote.updateMany({
    where: { clienteId: cliente.id, status: { in: ["ATIVO", "AGUARDANDO_RENOVACAO"] } },
    data: { status: "ENCERRADO", encerradoEm: new Date() },
  });

  const pacote = await prisma.pacote.create({
    data: { clienteId: cliente.id, profissionalId: cliente.profissionalAtualId, duracao, totalSessoes, valorTotal: valorFinal, status: "ATIVO" },
  });

  await notificar(cliente.userId, {
    titulo: "Novo pacote liberado",
    mensagem: `Seu pacote de ${totalSessoes} sessão(ões) foi confirmado. Já pode agendar seus horários!`,
    tipo: "sistema",
  });

  res.json(pacote);
});

// ---------- Ferramentas básicas: agenda geral (somente leitura) ----------
router.get("/agenda-geral", async (req, res) => {
  const agendamentos = await prisma.agendamento.findMany({
    where: { data: { gte: new Date() } },
    include: {
      profissional: { include: { user: { select: { nome: true } } } },
      cliente: { include: { user: { select: { nome: true } } } },
    },
    orderBy: { data: "asc" },
    take: 100,
  });
  res.json(agendamentos);
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

module.exports = router;
