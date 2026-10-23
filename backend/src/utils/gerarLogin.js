// Fase 51 — gera um e-mail de login automático a partir do nome (primeiro nome + um número),
// igual ao padrão usado no canvas (gerarSlug): usado quando quem está cadastrando (atendente ou
// profissional) não quer/precisa digitar um e-mail manualmente. Tenta alguns sufixos até achar
// um endereço livre, pra nunca travar o cadastro por colisão.
const prisma = require("../lib/prisma");

async function gerarEmailAutomatico(nome) {
  const base =
    (nome || "cliente")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/g, "")
      .trim()
      .split(" ")[0] || "cliente";
  for (let tentativa = 0; tentativa < 8; tentativa++) {
    const numero = Math.floor(100 + Math.random() * 900);
    const email = `${base}${numero}@espacodorenascer.com`;
    const existente = await prisma.user.findUnique({ where: { email } });
    if (!existente) return email;
  }
  // Extremamente improvável (8 colisões seguidas), mas não deixa travar o cadastro.
  return `${base}${Date.now().toString().slice(-6)}@espacodorenascer.com`;
}

module.exports = { gerarEmailAutomatico };
