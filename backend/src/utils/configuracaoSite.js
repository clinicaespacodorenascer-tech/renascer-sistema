// Fase 79 — configuração única (uma linha só, id fixo "config") do site público — editável pelo
// Dono no painel, lida pelo site estático em frontend/public/site-assets/ (sem login, via
// GET /publico/site/configuracao). Antes disso, tudo aqui (preços, se mostra horário real ou só
// turno) era fixo no código do app.js do site.

const prisma = require("../lib/prisma");

async function obterOuCriarConfiguracaoSite() {
  let config = await prisma.configuracaoSite.findUnique({ where: { id: "config" } });
  if (!config) {
    config = await prisma.configuracaoSite.create({ data: { id: "config" } });
  }
  return config;
}

// Campos que o Dono pode alterar — qualquer outro campo do body é ignorado.
const CAMPOS_EDITAVEIS = [
  "permitirEscolherHorario",
  "precoSessao30min",
  "precoPacote2x30min",
  "precoPacote4x30min",
  "precoSessao50min",
  "precoPacote2x50min",
  "precoPacote4x50min",
];

async function atualizarConfiguracaoSite(dados) {
  await obterOuCriarConfiguracaoSite(); // garante que a linha "config" já existe antes do update
  const data = {};
  for (const campo of CAMPOS_EDITAVEIS) {
    if (dados[campo] === undefined) continue;
    if (campo === "permitirEscolherHorario") {
      data[campo] = Boolean(dados[campo]);
    } else {
      const numero = Number(dados[campo]);
      if (!Number.isFinite(numero) || numero < 0) {
        throw new Error(`Valor inválido para ${campo}.`);
      }
      data[campo] = numero;
    }
  }
  return prisma.configuracaoSite.update({ where: { id: "config" }, data });
}

module.exports = { obterOuCriarConfiguracaoSite, atualizarConfiguracaoSite, CAMPOS_EDITAVEIS };
