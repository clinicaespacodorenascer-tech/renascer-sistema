const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { calcularMetricasCliente } = require("../utils/metricas");
const router = express.Router();
router.use(autenticar, permitir("DONO"));

// ---------- Visão geral ----------
router.get("/dashboard", async (req, res) => {
  const [totalProfissionais, totalClientes, pacotesAtivos] = await Promise.all([
    prisma.profissional.count(),
    prisma.cliente.count(),
    prisma.pacote.count({ where: { status: "ATIVO" } }),
  ]);

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const transacoesMes = await prisma.transacaoFinanceira.aggregate({
    where: { data: { gte: inicioMes } },
    _sum: { valorTotal: true, valorProfissional: true, valorRenascer: true },
  });

  res.json({
    totalProfissionais,
    totalClientes,
    pacotesAtivos,
    faturamentoMes: transacoesMes._sum.valorTotal || 0,
    repasseProfissionaisMes: transacoesMes._sum.valorProfissional || 0,
    receitaRenascerMes: transacoesMes._sum.valorRenascer || 0,
  });
});

// ---------- Todos os profissionais e seus clientes (mapa cliente -> profissional) ----------
router.get("/profissionais", async (req, res) => {
  const profissionais = await prisma.profissional.findMany({
    include: {
      user: { select: { nome: true, email: true, telefone: true, ativo: true, fotoUrl: true } },
      clientes: { include: { user: { select: { nome: true } } } },
      disponibilidades: true,
      _count: { select: { clientes: true, agendamentos: true } },
    },
  });
  res.json(profissionais);
});

router.get("/clientes", async (req, res) => {
  const clientes = await prisma.cliente.findMany({
    include: {
      user: { select: { nome: true, email: true, telefone: true, ativo: true } },
      profissionalAtual: { include: { user: { select: { nome: true } } } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
    },
  });
  res.json(clientes);
});

// ---------- Métricas de retenção de um cliente (tempo de casa, renovações) ----------
router.get("/clientes/:id/metricas", async (req, res) => {
  const metricas = await calcularMetricasCliente(req.params.id);
  if (!metricas) return res.status(404).json({ erro: "Cliente não encontrado." });
  res.json(metricas);
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
    include: {
      profissional: { include: { user: { select: { nome: true } } } },
      cliente: { include: { user: { select: { nome: true } } } },
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

  res.json({ transacoes, porProfissional, mes: m + 1, ano: a });
});

// ---------- Gestão de usuários (criar login de profissional/atendente/dono) ----------
router.post("/usuarios", async (req, res) => {
  const { nome, email, telefone, senha, role, dadosProfissional } = req.body;
  if (!["PROFISSIONAL", "ATENDENTE", "DONO"].includes(role)) {
    return res.status(400).json({ erro: "Papel inválido." });
  }

  const existente = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existente) return res.status(400).json({ erro: "Já existe um usuário com esse e-mail." });

  const hash = await bcrypt.hash(senha, 10);

  const user = await prisma.user.create({
    data: {
      nome,
      email: email.toLowerCase().trim(),
      telefone,
      senha: hash,
      role,
      ...(role === "PROFISSIONAL" && {
        profissional: {
          create: {
            titulo: dadosProfissional?.titulo || "Profissional",
            registro: dadosProfissional?.registro || null,
            bio: dadosProfissional?.bio || null,
            abordagens: dadosProfissional?.abordagens || null,
            percentualRepasse: dadosProfissional?.percentualRepasse ?? 50,
          },
        },
      }),
      ...(role === "ATENDENTE" && { atendente: { create: {} } }),
      ...(role === "DONO" && { dono: { create: {} } }),
    },
  });

  res.json({ id: user.id, email: user.email, role: user.role });
});

router.get("/usuarios", async (req, res) => {
  const usuarios = await prisma.user.findMany({
    select: { id: true, nome: true, email: true, role: true, ativo: true, criadoEm: true },
    orderBy: { criadoEm: "desc" },
  });
  res.json(usuarios);
});

router.put("/usuarios/:id/status", async (req, res) => {
  const { ativo } = req.body;
  await prisma.user.update({ where: { id: req.params.id }, data: { ativo } });
  res.json({ ok: true });
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

module.exports = router;
