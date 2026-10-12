// Rotas da Renascer IA (etapa 1 — base grátis): cadastro público (sem precisar ser cliente da
// clínica), conversa com limite diário, protocolo de crise, e o que o Dono usa pra configurar as
// travas de custo. A conversa é dado sensível (LGPD) — nenhuma rota aqui devolve a conversa de uma
// pessoa pra outra pessoa; cada usuário só enxerga a própria.

const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { autenticar, permitir } = require("../middleware/auth");
const { contemSinalDeCrise } = require("../utils/crise");
const { responderRenascerIA } = require("../utils/ia");
const { calcularLimiteEUso } = require("../utils/limiteIA");
const { registrarGastoIA } = require("../utils/configuracaoIA");

const router = express.Router();

function gerarToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "30d" });
}

function serializarUser(user) {
  const { senha, ...resto } = user;
  return resto;
}

function apenasDigitos(texto) {
  return (texto || "").toString().replace(/\D/g, "");
}

// Custo estimado por mensagem respondida (grátis), só pra alimentar o teto mensal — não é uma
// cobrança real, é uma estimativa pra travar o gasto antes que ele vire um problema de verdade.
const CUSTO_ESTIMADO_POR_MENSAGEM_REAIS = 0.002;

// Palavras que, quando aparecem na mensagem da pessoa, já sugerem sessão na hora (ela pediu).
const PALAVRAS_PEDIDO_DE_SESSAO = [
  "terapia",
  "sessao",
  "sessão",
  "consulta",
  "psicologa",
  "psicóloga",
  "profissional",
  "marcar horario",
  "marcar um horario",
  "agendar",
  "atendimento",
];

function pediuSessao(texto) {
  const normalizado = (texto || "").toLowerCase();
  return PALAVRAS_PEDIDO_DE_SESSAO.some((p) => normalizado.includes(p));
}

// ---------- Cadastro público (sem autenticação) ----------
router.post("/cadastro", async (req, res) => {
  const { nome, email, whatsapp, senha, aceitouTermos } = req.body;

  if (!nome || !nome.trim()) return res.status(400).json({ erro: "Informe seu nome." });
  if (!email || !email.includes("@")) return res.status(400).json({ erro: "Informe um e-mail válido." });
  const whatsappDigitos = apenasDigitos(whatsapp);
  if (whatsappDigitos.length < 10) return res.status(400).json({ erro: "Informe um WhatsApp válido, com DDD." });
  if (!senha || senha.length < 6) return res.status(400).json({ erro: "A senha precisa ter ao menos 6 caracteres." });
  if (aceitouTermos !== true) {
    return res.status(400).json({ erro: "É preciso confirmar que tem 18 anos ou mais e aceitar os termos para continuar." });
  }

  const emailNormalizado = email.toString().trim().toLowerCase();

  const jaExisteEmail = await prisma.user.findUnique({ where: { email: emailNormalizado } });
  if (jaExisteEmail) {
    return res.status(409).json({ erro: "Já existe uma conta com esse e-mail. Quer entrar?" });
  }

  // Checa duplicidade de WhatsApp comparando só os dígitos (o campo `telefone` não tem unicidade
  // garantida no banco — ver caveat da Fase 6 — então a checagem é feita aqui, estreitando a busca
  // pelos últimos 8 dígitos antes de comparar o número completo, pra não varrer a tabela inteira).
  const ultimosDigitos = whatsappDigitos.slice(-8);
  const candidatos = await prisma.user.findMany({
    where: { telefone: { contains: ultimosDigitos } },
    select: { telefone: true },
  });
  const jaExisteWhatsapp = candidatos.some((u) => apenasDigitos(u.telefone) === whatsappDigitos);
  if (jaExisteWhatsapp) {
    return res.status(409).json({ erro: "Já existe uma conta com esse WhatsApp. Quer entrar?" });
  }

  const senhaHash = await bcrypt.hash(senha, 10);

  const user = await prisma.user.create({
    data: {
      nome: nome.trim(),
      email: emailNormalizado,
      senha: senhaHash,
      telefone: whatsappDigitos,
      role: "USUARIO_IA",
      aceitouTermosIAEm: new Date(),
    },
  });

  const token = gerarToken(user);
  res.status(201).json({ token, user: serializarUser(user) });
});

// A partir daqui, todas as rotas exigem login de "usuário da IA".
router.use(autenticar, permitir("USUARIO_IA"));

// ---------- Conversa ----------

// Histórico da conversa (só a própria) + quantas mensagens ainda restam hoje.
router.get("/mensagens", async (req, res) => {
  const [mensagens, limite] = await Promise.all([
    prisma.conversaIA.findMany({
      where: { userId: req.user.id },
      orderBy: { criadoEm: "asc" },
      take: 200,
    }),
    calcularLimiteEUso(req.user.id),
  ]);

  res.json({
    mensagens,
    restantesHoje: limite.restantes,
    limiteDiario: limite.limiteHoje,
  });
});

router.post("/mensagens", async (req, res) => {
  const { texto } = req.body;
  if (!texto || !texto.trim()) return res.status(400).json({ erro: "Escreva uma mensagem." });
  if (texto.length > 2000) return res.status(400).json({ erro: "Mensagem muito longa." });

  const limite = await calcularLimiteEUso(req.user.id);
  if (limite.restantes <= 0) {
    return res.status(429).json({
      erro: "limite_diario",
      restantesHoje: 0,
      limiteDiario: limite.limiteHoje,
      tetoAtingido: limite.tetoAtingido,
    });
  }

  const crise = contemSinalDeCrise(texto);

  await prisma.conversaIA.create({
    data: { userId: req.user.id, autor: "USUARIO", texto: texto.trim(), sinalizouCrise: crise },
  });

  // Últimas mensagens da conversa (incluindo a que acabou de ser salva), do mais antigo pro mais
  // novo, pra dar contexto pra IA sem mandar a conversa inteira (custo).
  const ultimasMensagens = await prisma.conversaIA.findMany({
    where: { userId: req.user.id },
    orderBy: { criadoEm: "desc" },
    take: 20,
  });
  const historico = ultimasMensagens.reverse().map((m) => ({ autor: m.autor, texto: m.texto }));

  // A chamada pra IA da Anthropic precisa estar protegida: se ela falhar por qualquer motivo (chave
  // ausente, instabilidade, limite de uso), isso NÃO pode derrubar o servidor inteiro — a pessoa só
  // recebe uma resposta de indisponibilidade, e as outras 3 áreas do sistema (dono, atendente,
  // profissional, cliente) continuam funcionando normalmente.
  let resultado;
  try {
    resultado = await responderRenascerIA({ historico, maxTokens: 500 });
  } catch (e) {
    resultado = {
      disponivel: false,
      texto: "A Renascer IA está temporariamente indisponível. Tente de novo em alguns minutos, ou fale com a nossa equipe pelo WhatsApp.",
    };
  }

  await prisma.conversaIA.create({
    data: { userId: req.user.id, autor: "IA", texto: resultado.texto },
  });

  if (resultado.disponivel) {
    registrarGastoIA(CUSTO_ESTIMADO_POR_MENSAGEM_REAIS).catch(() => {});
  }

  // Quando sugerir sessão: pedido explícito sempre sugere; senão, só depois da primeira troca
  // (nunca na primeira mensagem) e respeitando os 7 dias de pausa se a pessoa já dispensou antes.
  const totalMensagensDaPessoa = await prisma.conversaIA.count({
    where: { userId: req.user.id, autor: "USUARIO" },
  });
  const dispensadaAte = req.user.sessaoIADispensadaAte;
  const emPausa = dispensadaAte && dispensadaAte.getTime() > Date.now();
  const pedidoExplicito = pediuSessao(texto);
  const sugerirSessao = pedidoExplicito || (!emPausa && totalMensagensDaPessoa > 1 && totalMensagensDaPessoa % 8 === 0);

  res.json({
    resposta: resultado.texto,
    restantesHoje: Math.max(0, limite.restantes - 1),
    limiteDiario: limite.limiteHoje,
    crise,
    sugerirSessao,
  });
});

// A pessoa tocou em "Agora não" na sugestão de sessão — não sugere de novo por 7 dias.
router.post("/sessao-dispensada", async (req, res) => {
  const daqui7Dias = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.user.update({ where: { id: req.user.id }, data: { sessaoIADispensadaAte: daqui7Dias } });
  res.json({ ok: true });
});

// A pessoa pode apagar a própria conversa quando quiser (item de privacidade da especificação).
router.delete("/conversa", async (req, res) => {
  await prisma.conversaIA.deleteMany({ where: { userId: req.user.id } });
  res.json({ ok: true });
});

module.exports = router;
