const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { calcularMetricasCliente } = require("../utils/metricas");
const { calcularStatusCliente } = require("../utils/statusCliente");
const { excluirUsuarioPorId, excluirCliente } = require("../utils/excluirUsuario");

const router = express.Router();
router.use(autenticar, permitir("DONO"));

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

  const hoje = new Date();
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicioAmanha = new Date(inicioHoje.getTime() + 24 * 60 * 60 * 1000);

  const [transacoesMes, transacoesHoje] = await Promise.all([
    prisma.transacaoFinanceira.aggregate({
      where: { data: { gte: inicioMes } },
      _sum: { valorTotal: true, valorProfissional: true, valorRenascer: true },
    }),
    // Tudo que foi anexado/registrado hoje (contratação, renovação, pacote) — seja pela
    // atendente ou pela própria profissional. Essa lista muda sozinha de um dia pro outro,
    // porque só olha pra data de hoje: não precisa "zerar" nada, amanhã ela já começa vazia.
    prisma.transacaoFinanceira.findMany({
      where: { data: { gte: inicioHoje, lt: inicioAmanha } },
      select: {
        valorTotal: true,
        valorProfissional: true,
        valorRenascer: true,
        profissional: { select: { user: { select: { nome: true } } } },
      },
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
    // Quantos clientes cada profissional tem hoje — soma tudo, seja cliente cadastrado
    // pela recepção ou pela própria profissional na aba dela.
    clientesPorProfissional: profissionais.map((p) => ({ nome: p.user.nome, total: p._count.clientes })),
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
  res.json(
    clientes.map((c) => ({ ...c, statusCliente: calcularStatusCliente({ pacote: c.pacotes[0], renovarEm: c.renovarEm }) }))
  );
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
    },
  });
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
