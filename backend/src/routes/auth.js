const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");
const { autenticar } = require("../middleware/auth");

const router = express.Router();

function gerarToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
}

function serializarUser(user) {
  const { senha, ...resto } = user;
  return resto;
}

// Login único — a interface decide pra onde mandar com base no `role` devolvido
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Informe email e senha." });

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { profissional: true, cliente: true, atendente: true, dono: true },
  });

  if (!user || !user.ativo) return res.status(401).json({ erro: "Credenciais inválidas." });

  const ok = await bcrypt.compare(senha, user.senha);
  if (!ok) return res.status(401).json({ erro: "Credenciais inválidas." });

  const token = gerarToken(user);
  res.json({ token, user: serializarUser(user) });
});

router.get("/me", autenticar, async (req, res) => {
  res.json({ user: serializarUser(req.user) });
});

router.put("/senha", autenticar, async (req, res) => {
  const { senhaAtual, novaSenha } = req.body;
  if (!senhaAtual || !novaSenha || novaSenha.length < 6) {
    return res.status(400).json({ erro: "Senha nova precisa ter ao menos 6 caracteres." });
  }
  const ok = await bcrypt.compare(senhaAtual, req.user.senha);
  if (!ok) return res.status(401).json({ erro: "Senha atual incorreta." });

  const hash = await bcrypt.hash(novaSenha, 10);
  await prisma.user.update({ where: { id: req.user.id }, data: { senha: hash } });
  res.json({ ok: true });
});

module.exports = router;
