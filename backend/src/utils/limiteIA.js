// Calcula quantas mensagens a pessoa já usou hoje e quantas ainda pode mandar, considerando o
// limite diário do grátis (e a versão reduzida, quando o teto mensal de gasto já foi atingido).
// Etapa 1 da Renascer IA só tem o plano grátis — quando o plano completo (assinatura) existir,
// este arquivo ganha um branch pelo plano da pessoa.

const prisma = require("../lib/prisma");
const { obterConfiguracaoIA } = require("./configuracaoIA");

async function calcularLimiteEUso(userId) {
  const config = await obterConfiguracaoIA();
  const hoje = new Date();
  const inicioHoje = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  const usadoHoje = await prisma.conversaIA.count({
    where: { userId, autor: "USUARIO", criadoEm: { gte: inicioHoje } },
  });

  const tetoAtingido = config.gastoMesAtualReais >= config.tetoMensalReais;
  const limiteHoje = tetoAtingido ? config.limiteGratisDiaReduzido : config.limiteGratisDia;
  const restantes = Math.max(0, limiteHoje - usadoHoje);

  return { usadoHoje, limiteHoje, restantes, tetoAtingido, config };
}

module.exports = { calcularLimiteEUso };
