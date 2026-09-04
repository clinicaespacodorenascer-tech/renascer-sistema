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

// Login único — a interface decide pra onde mandar com base no `role` devolvido.
// O campo "email" aceita, na verdade, e-mail, CPF ou telefone: se tiver "@" busca por e-mail
// (jeito de sempre); senão, considera que é CPF/telefone e busca pelos dígitos, olhando tanto
// o campo direto no User quanto o CPF salvo no cadastro do Cliente (contrato aceito).
router.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha) return res.status(400).json({ erro: "Informe e-mail, CPF ou telefone e a senha." });

  const identificador = email.toString().trim();
  const include = { profissional: true, cliente: true, atendente: true, dono: true };
  let user;

  if (identificador.includes("@")) {
    user = await prisma.user.findUnique({ where: { email: identificador.toLowerCase() }, include });
  } else {
    const apenasDigitos = identificador.replace(/\D/g, "");
    if (apenasDigitos) {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { telefone: { contains: apenasDigitos } },
            { cpf: { contains: apenasDigitos } },
            { cliente: { cpf: { contains: apenasDigitos } } },
          ],
        },
        include,
      });
    }
  }

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
