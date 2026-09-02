const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { valorDoPlano } = require("../utils/financeiro");
const { notificar } = require("../utils/notificar");

const router = express.Router();
router.use(autenticar, permitir("CLIENTE"));

const WHATSAPP_RENASCER = process.env.WHATSAPP_RENASCER || "5575983203429";
const LINK_EBOOK_HOTMART = process.env.LINK_EBOOK_HOTMART || "https://pay.hotmart.com/SEU-PRODUTO-AQUI";

async function getClienteId(req) {
  return req.user.cliente.id;
}

// ---------- 16. Contrato — obrigatório antes de liberar o resto do app ----------
router.get("/contrato", async (req, res) => {
  const clienteId = await getClienteId(req);
  const contrato = await prisma.contrato.findUnique({ where: { clienteId } });
  res.json({
    aceito: !!contrato?.aceitoEm,
    contrato,
    textoContrato: TEXTO_CONTRATO,
  });
});

router.post("/contrato/aceitar", async (req, res) => {
  const clienteId = await getClienteId(req);
  const { nomeCompleto, cpf, fotoDocumentoUrl, fotoRostoUrl } = req.body;
  if (!nomeCompleto || !cpf || !fotoDocumentoUrl) {
    return res.status(400).json({ erro: "Nome, CPF e foto do documento são obrigatórios." });
  }
  const contrato = await prisma.contrato.upsert({
    where: { clienteId },
    update: { nomeCompleto, cpf, fotoDocumentoUrl, fotoRostoUrl, aceitoEm: new Date(), ip: req.ip },
    create: { clienteId, nomeCompleto, cpf, fotoDocumentoUrl, fotoRostoUrl, aceitoEm: new Date(), ip: req.ip },
  });
  await prisma.cliente.update({ where: { id: clienteId }, data: { cpf } });
  res.json(contrato);
});

// Middleware que bloqueia o resto do app se o contrato não foi aceito
async function exigirContrato(req, res, next) {
  const clienteId = await getClienteId(req);
  const contrato = await prisma.contrato.findUnique({ where: { clienteId } });
  if (!contrato?.aceitoEm) {
    return res.status(412).json({ erro: "Você precisa aceitar o contrato antes de continuar.", bloqueadoPorContrato: true });
  }
  next();
}

// ---------- Home / painel do cliente ----------
router.get("/painel", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const cliente = await prisma.cliente.findUnique({
    where: { id: clienteId },
    include: {
      profissionalAtual: { include: { user: { select: { nome: true, fotoUrl: true } } } },
      pacotes: { orderBy: { iniciadoEm: "desc" }, take: 1 },
    },
  });

  const pacoteAtivo = cliente.pacotes[0] || null;
  const sessoesRestantes = pacoteAtivo ? pacoteAtivo.totalSessoes - pacoteAtivo.sessoesUsadas : 0;

  const proximaSessao = await prisma.agendamento.findFirst({
    where: { clienteId, status: { in: ["AGENDADO", "CONFIRMADO"] }, data: { gte: new Date() } },
    orderBy: { data: "asc" },
  });

  const pendencias = [];
  if (pacoteAtivo && sessoesRestantes <= 1) {
    pendencias.push("Seu pacote está terminando. Renove pra não perder seu horário.");
  }
  if (pacoteAtivo?.status === "AGUARDANDO_RENOVACAO") {
    pendencias.push("Seu pacote encerrou. Renove ou escolha um novo plano para continuar agendando.");
  }

  res.json({ cliente, pacoteAtivo, sessoesRestantes, proximaSessao, pendencias });
});

// ---------- 10. Sessões restantes (detalhado) ----------
router.get("/sessoes-restantes", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const pacote = await prisma.pacote.findFirst({ where: { clienteId, status: "ATIVO" }, orderBy: { iniciadoEm: "desc" } });
  if (!pacote) return res.json({ restantes: 0, pacote: null });
  res.json({ restantes: pacote.totalSessoes - pacote.sessoesUsadas, pacote });
});

// ---------- 1. Agendar com a profissional já vinculada ----------
router.get("/agenda/disponibilidade", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId } });
  if (!cliente.profissionalAtualId) return res.status(400).json({ erro: "Você ainda não tem uma profissional vinculada." });

  const disponibilidades = await prisma.disponibilidade.findMany({
    where: { profissionalId: cliente.profissionalAtualId, ativo: true },
  });
  const ocupados = await prisma.agendamento.findMany({
    where: { profissionalId: cliente.profissionalAtualId, status: { in: ["AGENDADO", "CONFIRMADO"] } },
    select: { data: true, diaSemana: true, horaInicio: true },
  });
  res.json({ disponibilidades, ocupados });
});

// Fase atual (combinada com a Renascer): quem marca a sessão é a atendente, que já
// desconta a agenda real da profissional (ver rota /atendente/agendamentos). O
// agendamento direto pelo cliente fica pausado por enquanto para não gerar horário
// duplicado ou fora da disponibilidade real — é só reativar esta rota quando a fase
// de auto-agendamento do cliente for ligada.
router.post("/agenda/agendar", exigirContrato, async (req, res) => {
  res.status(400).json({
    erro: "Agendamento direto pelo app ainda não está disponível. Fale com a recepção do Espaço do Renascer para marcar sua sessão.",
  });
});

// Lista as sessões já marcadas do próprio cliente (passadas e futuras)
router.get("/agenda", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const agendamentos = await prisma.agendamento.findMany({
    where: { clienteId },
    include: { profissional: { include: { user: { select: { nome: true } } } } },
    orderBy: { data: "asc" },
  });
  res.json(agendamentos);
});

// ---------- 2. Reagendar (regra de 24h de antecedência) ----------
router.post("/agenda/:id/reagendar", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const original = await prisma.agendamento.findFirst({ where: { id: req.params.id, clienteId } });
  if (!original) return res.status(404).json({ erro: "Agendamento não encontrado." });

  const horasAteSessao = (original.data.getTime() - Date.now()) / 1000 / 60 / 60;
  if (horasAteSessao < 24) {
    return res.status(400).json({
      erro: "Não é possível reagendar com menos de 24h de antecedência.",
      podeReagendar: false,
    });
  }

  const { data, diaSemana, horaInicio } = req.body;
  await prisma.agendamento.update({ where: { id: original.id }, data: { status: "REAGENDADO" } });
  const novo = await prisma.agendamento.create({
    data: {
      profissionalId: original.profissionalId,
      clienteId,
      pacoteId: original.pacoteId,
      data: new Date(data),
      diaSemana,
      horaInicio,
      duracao: original.duracao,
      reagendadoDe: original.id,
    },
  });
  res.json(novo);
});

// ---------- Trocar de profissional (precisa encerrar o pacote atual primeiro) ----------
router.get("/profissionais-disponiveis", exigirContrato, async (req, res) => {
  const profissionais = await prisma.profissional.findMany({
    include: { user: { select: { nome: true, fotoUrl: true } }, disponibilidades: true },
  });
  res.json(profissionais.map((p) => ({
    id: p.id,
    nome: p.user.nome,
    fotoUrl: p.user.fotoUrl,
    titulo: p.titulo,
    idade: p.idade,
    especialidades: p.especialidades,
    abordagens: p.abordagens,
    disponibilidades: p.disponibilidades,
  })));
});

router.post("/trocar-profissional", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const { novoProfissionalId } = req.body;

  const pacoteAtivo = await prisma.pacote.findFirst({ where: { clienteId, status: "ATIVO" } });
  if (pacoteAtivo) {
    return res.status(400).json({
      erro: "Você precisa encerrar seu pacote atual antes de trocar de profissional.",
      precisaEncerrarPacote: true,
    });
  }

  await prisma.cliente.update({ where: { id: clienteId }, data: { profissionalAtualId: novoProfissionalId } });

  // Pagamento do novo pacote é finalizado no WhatsApp, como no site
  const profissional = await prisma.profissional.findUnique({ where: { id: novoProfissionalId }, include: { user: true } });
  const mensagem = encodeURIComponent(
    `Olá! Escolhi trocar de profissional no app e quero fechar um novo pacote com ${profissional.user.nome}. Pode me ajudar a finalizar o pagamento?`
  );
  res.json({ ok: true, linkWhatsapp: `https://wa.me/${WHATSAPP_RENASCER}?text=${mensagem}` });
});

// ---------- 3. Renovar pacote / 4. Trocar plano (planos oficiais do site) ----------
router.get("/planos", (req, res) => {
  res.json({
    MIN30: [
      { totalSessoes: 1, valor: valorDoPlano("MIN30", 1) },
      { totalSessoes: 2, valor: valorDoPlano("MIN30", 2) },
      { totalSessoes: 4, valor: valorDoPlano("MIN30", 4) },
    ],
    MIN50: [
      { totalSessoes: 1, valor: valorDoPlano("MIN50", 1) },
      { totalSessoes: 2, valor: valorDoPlano("MIN50", 2) },
      { totalSessoes: 4, valor: valorDoPlano("MIN50", 4) },
    ],
  });
});

router.post("/renovar-ou-trocar-plano", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, include: { profissionalAtual: { include: { user: true } } } });
  const { duracao, totalSessoes } = req.body;
  const valor = valorDoPlano(duracao, totalSessoes);
  if (!valor) return res.status(400).json({ erro: "Plano inválido." });

  // Encerra pacote anterior (se ainda existir algum ativo) e cria intenção de novo pacote
  await prisma.pacote.updateMany({ where: { clienteId, status: { in: ["ATIVO", "AGUARDANDO_RENOVACAO"] } }, data: { status: "ENCERRADO", encerradoEm: new Date() } });

  const mensagem = encodeURIComponent(
    `Olá! Quero renovar/contratar um pacote de ${totalSessoes} sessão(ões) de ${duracao === "MIN30" ? "30 minutos" : "50 minutos"} (R$ ${valor}) com ${cliente.profissionalAtual?.user?.nome || "minha profissional"}. Pode confirmar o pagamento?`
  );
  res.json({ ok: true, valor, linkWhatsapp: `https://wa.me/${WHATSAPP_RENASCER}?text=${mensagem}` });
});

// Observação: a confirmação do pagamento e a criação do pacote em si são feitas pela
// profissional (POST /api/profissional/clientes/:id/pacotes) depois que o pagamento cai
// no WhatsApp — o cliente nunca cria o próprio pacote, por segurança (fase 2 automatiza
// isso via webhook do gateway de pagamento).

// ---------- 5. Sessão extra ----------
router.post("/sessao-extra", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, include: { profissionalAtual: { include: { user: true } } } });
  const { duracao } = req.body;
  const valor = valorDoPlano(duracao, 1);
  const mensagem = encodeURIComponent(
    `Olá! Quero pagar por uma sessão extra de ${duracao === "MIN30" ? "30 minutos" : "50 minutos"} (R$ ${valor}) com ${cliente.profissionalAtual?.user?.nome || "minha profissional"}.`
  );
  res.json({ valor, linkWhatsapp: `https://wa.me/${WHATSAPP_RENASCER}?text=${mensagem}` });
});

// ---------- 6. E-book / cursos (Hotmart) ----------
router.get("/materiais", (req, res) => {
  res.json({
    ebook: { titulo: "E-book Espaço do Renascer", linkHotmart: LINK_EBOOK_HOTMART, disponivel: true },
    cursos: [],
    videoAulas: [],
  });
});

// ---------- 7. + 19. Suporte ----------
router.get("/suporte", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const tickets = await prisma.ticketSuporte.findMany({
    where: { clienteId },
    include: { mensagens: { orderBy: { criadoEm: "asc" } } },
    orderBy: { criadoEm: "desc" },
  });
  res.json(tickets);
});

router.post("/suporte", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const { assunto, texto, escalonarGerencia } = req.body;
  const ticket = await prisma.ticketSuporte.create({
    data: {
      clienteId,
      assunto,
      escalonadoGerencia: !!escalonarGerencia,
      status: escalonarGerencia ? "ESCALADO_GERENCIA" : "ABERTO",
      mensagens: { create: { remetenteId: req.user.id, texto } },
    },
    include: { mensagens: true },
  });
  res.json(ticket);
});

router.post("/suporte/:id/mensagens", exigirContrato, async (req, res) => {
  const { texto, anexoUrl } = req.body;
  const msg = await prisma.mensagem.create({ data: { remetenteId: req.user.id, ticketId: req.params.id, texto, anexoUrl } });
  res.json(msg);
});

// ---------- 8. Recado do dia (leitura) ----------
router.get("/recados", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const recados = await prisma.recadoDiario.findMany({ where: { clienteId }, orderBy: { data: "desc" } });
  res.json(recados);
});

// ---------- 9. Diário de humor (opcional, todo dia) ----------
router.post("/checkin", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const { humor, nota, tarefaFeita } = req.body;
  const checkin = await prisma.checkinDiario.create({ data: { clienteId, humor, nota, tarefaFeita } });
  res.json(checkin);
});

router.get("/checkins", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const checkins = await prisma.checkinDiario.findMany({ where: { clienteId }, orderBy: { data: "desc" }, take: 60 });
  res.json(checkins);
});

// ---------- 12. Notificações (pendências, mensalidade, tarefas) ----------
// Movido para /api/comum/notificacoes (rota compartilhada por qualquer papel autenticado)

// ---------- 13. + 17. Tarefas ----------
router.get("/tarefas", exigirContrato, async (req, res) => {
  const clienteId = await getClienteId(req);
  const atribuidas = await prisma.tarefaCliente.findMany({
    where: { clienteId },
    include: { tarefa: true },
    orderBy: { atribuidoEm: "desc" },
  });
  res.json(atribuidas);
});

router.put("/tarefas/:id/concluir", exigirContrato, async (req, res) => {
  const atualizado = await prisma.tarefaCliente.update({
    where: { id: req.params.id },
    data: { concluida: true, concluidoEm: new Date() },
  });
  res.json(atualizado);
});

// Biblioteca geral de tarefas de apoio por tema (item 17) — livre pra consulta
router.get("/biblioteca-tarefas", async (req, res) => {
