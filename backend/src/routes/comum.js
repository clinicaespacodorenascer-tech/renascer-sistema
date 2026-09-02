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

module.exports = router;
