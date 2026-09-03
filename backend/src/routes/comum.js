// Rotas comuns a qualquer usuário autenticado, independente do papel (notificações etc.)
const express = require("express");
const prisma = require("../lib/prisma");
const { autenticar } = require("../middleware/auth");

const router = express.Router();
router.use(autenticar);

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

module.exports = router;
