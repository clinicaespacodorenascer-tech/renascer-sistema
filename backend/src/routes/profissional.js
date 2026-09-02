const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { calcularRepasse, valorDoPlano } = require("../utils/financeiro");
const { reconhecerComprovante } = require("../utils/ia");
const { notificar, precisaAvisoRenovacao } = require("../utils/notificar");

const router = express.Router();
router.use(autenticar, permitir("PROFISSIONAL"));

async function getProfissionalId(req) {
  return req.user.profissional.id;
}

// ---------- 1. Perfil ----------
router.get("/perfil", async (req, res) => {
  const prof = await prisma.profissional.findUnique({
    where: { id: await getProfissionalId(req) },
    include: { disponibilidades: true, user: { select: { nome: true, email: true, fotoUrl: true, telefone: true } } },
  });
  res.json(prof);
});

// Perfil completo que a atendente vai enxergar pra escolher a profissional certa:
// nome/foto (User) + o que atende/categorias + idade + abordagem
router.put("/perfil", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { nome, fotoBase64, titulo, registro, bio, idade, especialidades, abordagens, linkMeet } = req.body;
  if (nome || fotoBase64) {
    await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(nome && { nome }),
        ...(fotoBase64 && { fotoUrl: fotoBase64 }), // fase 2: subir pra storage real e salvar a URL
      },
    });
  }

  const prof = await prisma.profissional.update({
    where: { id: profissionalId },
    data: {
      ...(titulo !== undefined && { titulo }),
      ...(registro !== undefined && { registro }),
      ...(bio !== undefined && { bio }),
      ...(idade !== undefined && { idade: idade ? Number(idade) : null }),
      ...(especialidades !== undefined && { especialidades }),
            ...(abordagens !== undefined && { abordagens }),
      ...(linkMeet !== undefined && { linkMeet: linkMeet || null }),
    },
    include: { user: { select: { nome: true, fotoUrl: true } } },
  });

  res.json(prof);
});

router.put("/disponibilidades", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { disponibilidades } = req.body; // [{diaSemana, horaInicio, horaFim}]
  await prisma.disponibilidade.deleteMany({ where: { profissionalId } });
  await prisma.disponibilidade.createMany({
    data: disponibilidades.map((d) => ({ ...d, profissionalId })),
  });
  res.json({ ok: true });
});

// ---------- 2. Agenda estilo Trello (por dia da semana) ----------
router.get("/agenda", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const agendamentos = await prisma.agendamento.findMany({
    where: { profissionalId, status: { not: "CANCELADO" } },
    include: { cliente: { include: { user: { select: { nome: true, telefone: true, fotoUrl: true } } } }, pacote: true },
    orderBy: { data: "asc" },
  });

  const colunas = { SEGUNDA: [], TERCA: [], QUARTA: [], QUINTA: [], SEXTA: [], SABADO: [], DOMINGO: [] };
  for (const ag of agendamentos) colunas[ag.diaSemana].push(ag);
  res.json(colunas);
});

router.put("/agenda/:id/status", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { status, motivoCancelamento } = req.body;
  const agendamento = await prisma.agendamento.findFirst({ where: { id: req.params.id, profissionalId } });
  if (!agendamento) return res.status(404).json({ erro: "Agendamento não encontrado." });

  const atualizado = await prisma.agendamento.update({
    where: { id: agendamento.id },
    data: { status, motivoCancelamento },
  });

  // Se realizou a sessão, soma no pacote e dispara aviso de renovação quando aplicável
  if (status === "REALIZADO" && agendamento.pacoteId) {
    const pacote = await prisma.pacote.update({
      where: { id: agendamento.pacoteId },
      data: { sessoesUsadas: { increment: 1 } },
    });

    if (precisaAvisoRenovacao(pacote)) {
      const cliente = await prisma.cliente.findUnique({ where: { id: pacote.clienteId } });
      await notificar(cliente.userId, {
        titulo: "Seu pacote está terminando",
        mensagem: `Você já usou ${pacote.sessoesUsadas} de ${pacote.totalSessoes} sessões. Que tal renovar pra não perder seu horário fixo?`,
        tipo: "renovacao",
      });
      await notificar(req.user.id, {
        titulo: "Cliente perto de renovar",
        mensagem: `Avise seu cliente sobre a renovação do pacote (sessão ${pacote.sessoesUsadas}/${pacote.totalSessoes}).`,
        tipo: "renovacao",
      });
    }

    if (pacote.sessoesUsadas >= pacote.totalSessoes) {
      await prisma.pacote.update({ where: { id: pacote.id }, data: { status: "AGUARDANDO_RENOVACAO" } });
    }
  }

  res.json(atualizado);
});

// Videochamada (espelha as rotas do cliente — as duas pontas usam o mesmo registro
// de ChamadaVideo, ligado ao agendamento, então quem entra primeiro "inicia" e o
// outro lado só acompanha o mesmo horário/duração registrados)
router.post("/agenda/:id/iniciar-chamada", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const agendamento = await prisma.agendamento.findFirst({ where: { id: req.params.id, profissionalId } });
  if (!agendamento) return res.status(404).json({ erro: "Agendamento não encontrado." });

  const chamada = await prisma.chamadaVideo.upsert({
    where: { agendamentoId: agendamento.id },
    update: {},
    create: { agendamentoId: agendamento.id, iniciadaEm: new Date() },
  });
  res.json({ ...chamada, aviso: process.env.DAILY_API_KEY ? undefined : "Videochamada ainda não configurada (falta DAILY_API_KEY). Sala de demonstração." });
});

router.post("/agenda/:id/encerrar-chamada", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const agendamento = await prisma.agendamento.findFirst({ where: { id: req.params.id, profissionalId } });
  if (!agendamento) return res.status(404).json({ erro: "Agendamento não encontrado." });

  const chamada = await prisma.chamadaVideo.findUnique({ where: { agendamentoId: agendamento.id } });
  if (!chamada?.iniciadaEm) return res.status(400).json({ erro: "Chamada não foi iniciada." });
  if (chamada.encerradaEm) return res.json(chamada);

  const encerradaEm = new Date();
  const duracaoMinutos = Math.round((encerradaEm.getTime() - chamada.iniciadaEm.getTime()) / 60000);
  const atualizado = await prisma.chamadaVideo.update({
    where: { agendamentoId: agendamento.id },
    data: { encerradaEm, duracaoMinutos },
  });
  res.json(atualizado);
});

// Imprevisto / reagendar por iniciativa da profissional
router.post("/agenda/:id/reagendar", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { novaData, novoDiaSemana, novaHora, motivo } = req.body;
  const original = await prisma.agendamento.findFirst({ where: { id: req.params.id, profissionalId } });
  if (!original) return res.status(404).json({ erro: "Agendamento não encontrado." });

  await prisma.agendamento.update({ where: { id: original.id }, data: { status: "REAGENDADO", motivoCancelamento: motivo } });
  const novo = await prisma.agendamento.create({
    data: {
      profissionalId,
      clienteId: original.clienteId,
      pacoteId: original.pacoteId,
      data: new Date(novaData),
      diaSemana: novoDiaSemana,
      horaInicio: novaHora,
      duracao: original.duracao,
      reagendadoDe: original.id,
    },
  });

  const cliente = await prisma.cliente.findUnique({ where: { id: original.clienteId } });
  await notificar(cliente.userId, {
    titulo: "Sua sessão foi reagendada",
    mensagem: `Sua profissional precisou remarcar sua sessão. Novo horário: ${novoDiaSemana} às ${novaHora}. Motivo: ${motivo || "imprevisto"}.`,
    tipo: "pendencia",
  });

  res.json(novo);
});

// ---------- 3. Comunicação com o cliente ----------
router.get("/clientes/:clienteId/mensagens", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const mensagens = await prisma.mensagemInterna.findMany({
    where: { profissionalId, clienteId: req.params.clienteId },
    orderBy: { criadoEm: "asc" },
  });
  res.json(mensagens);
});

router.post("/clientes/:clienteId/mensagens", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { texto, tipo } = req.body;
  const msg = await prisma.mensagemInterna.create({
    data: { profissionalId, clienteId: req.params.clienteId, autor: "PROFISSIONAL", texto, tipo: tipo || "mensagem" },
  });

  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.clienteId } });
  await notificar(cliente.userId, {
    titulo: "Nova mensagem da sua profissional",
    mensagem: texto.slice(0, 120),
    tipo: "sistema",
  });

  res.json(msg);
});

// Recado sobre o dia (imprevisto / o que vai trabalhar) — vira RecadoDiario visível ao cliente
router.post("/clientes/:clienteId/recado", async (req, res) => {
  const { texto } = req.body;
  const recado = await prisma.recadoDiario.create({ data: { clienteId: req.params.clienteId, texto } });
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.clienteId } });
  await notificar(cliente.userId, { titulo: "Recado da sua profissional", mensagem: texto.slice(0, 120), tipo: "sistema" });
  res.json(recado);
});

// ---------- 4. Financeiro ----------
router.get("/financeiro/resumo", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { mes, ano } = req.query; // ex mes=9 ano=2026
  const hoje = new Date();
  const m = mes ? Number(mes) - 1 : hoje.getMonth();
  const a = ano ? Number(ano) : hoje.getFullYear();
  const inicio = new Date(a, m, 1);
  const fim = new Date(a, m + 1, 1);

  const transacoes = await prisma.transacaoFinanceira.findMany({
    where: { profissionalId, data: { gte: inicio, lt: fim } },
    include: { cliente: { include: { user: { select: { nome: true } } } } },
    orderBy: { data: "desc" },
  });

  const totalRecebido = transacoes.reduce((s, t) => s + t.valorTotal, 0);
  const totalProfissional = transacoes.reduce((s, t) => s + t.valorProfissional, 0);
  const totalRenascer = transacoes.reduce((s, t) => s + t.valorRenascer, 0);

  res.json({ transacoes, totalRecebido, totalProfissional, totalRenascer, mes: m + 1, ano: a });
});

// Calculadora manual de repasse (sem precisar anexar comprovante)
router.post("/financeiro/calcular", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const prof = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  const { valorTotal } = req.body;
  res.json(calcularRepasse(Number(valorTotal), prof.percentualRepasse));
});

// Upload de comprovante — a IA tenta reconhecer valor/tipo automaticamente
router.post("/financeiro/comprovante", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const prof = await prisma.profissional.findUnique({ where: { id: profissionalId } });
  const { clienteId, imagemBase64, mimeType, valorManual, tipoManual } = req.body;

  let reconhecido = { disponivel: false };
  if (imagemBase64) {
    try {
      reconhecido = await reconhecerComprovante({ base64: imagemBase64, mimeType: mimeType || "image/jpeg" });
    } catch (e) {
      reconhecido = { disponivel: true, erro: "Falha ao consultar a IA.", detalhe: String(e) };
    }
  }

  const valorFinal = Number(valorManual ?? reconhecido.valor);
  if (!valorFinal || Number.isNaN(valorFinal)) {
    return res.status(400).json({ erro: "Não consegui identificar o valor. Informe manualmente.", reconhecido });
  }

  const { valorProfissional, valorRenascer } = calcularRepasse(valorFinal, prof.percentualRepasse);

  const transacao = await prisma.transacaoFinanceira.create({
    data: {
      profissionalId,
      clienteId: clienteId || null,
      tipo: tipoManual || reconhecido.tipoProvavel || "OUTRO",
      valorTotal: valorFinal,
      valorProfissional,
      valorRenascer,
      comprovanteUrl: imagemBase64 ? "anexado-base64" : null, // fase 2: subir pra storage (S3/Cloudinary) e salvar URL real
      reconhecidoPorIA: !!reconhecido.valor,
      dadosBrutosIA: reconhecido.respostaCrua || null,
    },
  });

  res.json({ transacao, reconhecido });
});

// ---------- 5. Clientes do profissional ----------
router.get("/clientes", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const clientes = await prisma.cliente.findMany({
    where: { profissionalAtualId: profissionalId },
    include: {
      user: { select: { nome: true, email: true, telefone: true, fotoUrl: true } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
    },
  });
  res.json(clientes);
});

router.get("/clientes/:id", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const cliente = await prisma.cliente.findFirst({
    where: { id: req.params.id, profissionalAtualId: profissionalId },
    include: {
      user: true,
      pacotes: { orderBy: { iniciadoEm: "desc" } },
      agendamentos: { orderBy: { data: "desc" } },
      relatorios: { where: { profissionalId }, orderBy: { criadoEm: "desc" } },
    },
  });
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado." });
  res.json(cliente);
});

// Registrar o pacote depois que o pagamento foi confirmado (Pix/cartão via WhatsApp, fase 1).
// Isso é o que efetivamente libera sessões pro cliente agendar no app.
router.post("/clientes/:id/pacotes", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const cliente = await prisma.cliente.findFirst({ where: { id: req.params.id, profissionalAtualId: profissionalId } });
  if (!cliente) return res.status(404).json({ erro: "Cliente não encontrado ou não é seu." });

  const { duracao, totalSessoes, valorTotal } = req.body;
  const valorOficial = valorDoPlano(duracao, totalSessoes);
  const valorFinal = valorTotal ?? valorOficial;
  if (!valorFinal) return res.status(400).json({ erro: "Informe duração, quantidade de sessões e/ou valor válidos." });

  // Encerra qualquer pacote anterior pendurado antes de abrir um novo
  await prisma.pacote.updateMany({
    where: { clienteId: cliente.id, status: { in: ["ATIVO", "AGUARDANDO_RENOVACAO"] } },
    data: { status: "ENCERRADO", encerradoEm: new Date() },
  });

  const pacote = await prisma.pacote.create({
    data: { clienteId: cliente.id, profissionalId, duracao, totalSessoes, valorTotal: valorFinal, status: "ATIVO" },
  });

  await notificar(cliente.userId, {
    titulo: "Novo pacote liberado",
    mensagem: `Seu pacote de ${totalSessoes} sessão(ões) foi confirmado. Já pode agendar seus horários!`,
    tipo: "sistema",
  });

  res.json(pacote);
});

// ---------- 6. Relatórios do cliente (com opção de publicar) ----------
router.post("/clientes/:id/relatorios", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { titulo, conteudo, visivelParaCliente } = req.body;
  const relatorio = await prisma.relatorioCliente.create({
    data: { profissionalId, clienteId: req.params.id, titulo, conteudo, visivelParaCliente: !!visivelParaCliente },
  });

  if (visivelParaCliente) {
    const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
    await notificar(cliente.userId, { titulo: "Novo relatório disponível", mensagem: titulo, tipo: "sistema" });
  }

  res.json(relatorio);
});

router.put("/relatorios/:id", async (req, res) => {
  const profissionalId = await getProfissionalId(req);
  const { titulo, conteudo, visivelParaCliente } = req.body;
  const relatorio = await prisma.relatorioCliente.updateMany({
    where: { id: req.params.id, profissionalId },
    data: { titulo, conteudo, visivelParaCliente },
  });
  res.json(relatorio);
});

// ---------- Tarefas atribuídas a clientes (parte que cabe à profissional) ----------
router.post("/clientes/:id/tarefas", async (req, res) => {
  const { tarefaId } = req.body;
  const atribuicao = await prisma.tarefaCliente.create({ data: { tarefaId, clienteId: req.params.id } });
  const cliente = await prisma.cliente.findUnique({ where: { id: req.params.id } });
  await notificar(cliente.userId, { titulo: "Nova tarefa de apoio", mensagem: "Sua profissional te enviou uma nova tarefa.", tipo: "tarefa" });
  res.json(atribuicao);
});

module.exports = router;
