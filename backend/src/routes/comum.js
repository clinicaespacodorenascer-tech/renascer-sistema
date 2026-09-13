// Rotas comuns a qualquer usuário autenticado, independente do papel (notificações etc.)
const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar } = require("../middleware/auth");
const { vapidPublicKey } = require("../utils/push");

const router = express.Router();
router.use(autenticar);

// ---------- Notificações push (toque/vibração no aparelho) ----------
// A chave pública é a mesma pra todo mundo — é ela que o navegador usa pra criar a inscrição
// (isso não é segredo, quem guarda segredo é a chave PRIVADA, que nunca sai do backend).
router.get("/push/chave-publica", (req, res) => {
  res.json({ publicKey: vapidPublicKey });
});

// Salva (ou atualiza) a inscrição desse aparelho pra esse usuário. Um mesmo usuário pode ter
// vários aparelhos inscritos (celular + computador) — cada "endpoint" é único por aparelho, por
// isso o upsert é por endpoint, não por usuário.
router.post("/push/inscrever", async (req, res) => {
  const { endpoint, keys } = req.body;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ erro: "Inscrição de notificação inválida." });
  }

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    update: { userId: req.user.id, p256dh: keys.p256dh, auth: keys.auth },
    create: { userId: req.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
  });
  res.json({ ok: true });
});

// Remove a inscrição desse aparelho (usado quando a pessoa desativa notificações).
router.delete("/push/inscrever", async (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: req.user.id } });
  }
  res.json({ ok: true });
});

router.get("/notificacoes", async (req, res) => {
  const notificacoes = await prisma.notificacao.findMany({
    where: { userId: req.user.id },
    orderBy: { criadoEm: "desc" },
    take: 50,
  });
  res.json(notificacoes);
});

router.put("/notificacoes/:id/lida", async (req, res) => {
  await prisma.notificacao.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { lida: true } });
  res.json({ ok: true });
});

router.get("/notificacoes/nao-lidas/total", async (req, res) => {
  const total = await prisma.notificacao.count({ where: { userId: req.user.id, lida: false } });
  res.json({ total });
});

// Foto de perfil — qualquer papel logado (Cliente, Atendente, Dono ou Profissional) pode trocar
// a própria foto por aqui. A Profissional já tinha esse campo dentro da tela de "Perfil"
// completo dela (que também mexe em título, bio etc.); esse endpoint é só a foto, isolado, pra
// funcionar igual pros outros três papéis, que não têm uma tela de perfil própria.
router.put("/minha-foto", async (req, res) => {
  const { fotoBase64 } = req.body;
  if (!fotoBase64) return res.status(400).json({ erro: "Envie uma imagem." });

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { fotoUrl: fotoBase64 }, // fase 2: subir pra storage real e salvar a URL
    select: { id: true, nome: true, fotoUrl: true },
  });
  res.json(user);
});

// Ver o comprovante anexado numa transação financeira (contratação, renovação, pacote).
// Fica guardado no banco pra sempre poder ser visto de novo depois.
// Dono e atendente podem ver qualquer comprovante; a profissional só vê os das próprias
// transações; cliente não tem acesso.
router.get("/transacoes/:id/comprovante", async (req, res) => {
  if (req.user.role === "CLIENTE") {
    return res.status(403).json({ erro: "Você não tem permissão para ver isso." });
  }

  const transacao = await prisma.transacaoFinanceira.findUnique({ where: { id: req.params.id } });
  if (!transacao || !transacao.comprovanteBase64) {
    return res.status(404).json({ erro: "Nenhum comprovante anexado nessa transação." });
  }
  if (req.user.role === "PROFISSIONAL" && transacao.profissionalId !== req.user.profissional.id) {
    return res.status(403).json({ erro: "Você não tem permissão para ver esse comprovante." });
  }

  res.json({ base64: transacao.comprovanteBase64, mimeType: transacao.comprovanteMimeType || "image/jpeg" });
});

// Ver o comprovante do REPASSE (diferente do comprovante do pagamento do cliente acima) — a
// profissional anexa quando manda a parte da Renascer pra clínica, e o dono confere aqui antes
// de confirmar. Mesma regra de permissão do comprovante normal.
router.get("/transacoes/:id/repasse-comprovante", async (req, res) => {
  if (req.user.role === "CLIENTE") {
    return res.status(403).json({ erro: "Você não tem permissão para ver isso." });
  }

  const transacao = await prisma.transacaoFinanceira.findUnique({ where: { id: req.params.id } });
  if (!transacao || !transacao.repasseComprovanteBase64) {
    return res.status(404).json({ erro: "Nenhum comprovante de repasse anexado nessa transação." });
  }
  if (req.user.role === "PROFISSIONAL" && transacao.profissionalId !== req.user.profissional.id) {
    return res.status(403).json({ erro: "Você não tem permissão para ver esse comprovante." });
  }

  res.json({ base64: transacao.repasseComprovanteBase64, mimeType: transacao.repasseComprovanteMimeType || "image/jpeg" });
});

module.exports = router;
