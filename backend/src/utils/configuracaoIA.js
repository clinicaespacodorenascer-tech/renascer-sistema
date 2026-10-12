// Configuração única (uma linha só, id fixo "config") das travas de custo da Renascer IA —
// editável pelo Dono no painel. O gasto do mês zera sozinho quando o mês vira, sem precisar de
// nenhum job agendado: toda vez que alguém olha ou grava um gasto, primeiro confere se
// `mesReferencia` ainda é o mês atual, e se não for, zera antes de seguir.

const prisma = require("../lib/prisma");

function mesAtualString() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`;
}

async function obterConfiguracaoIA() {
  let config = await prisma.configuracaoIA.findUnique({ where: { id: "config" } });
  if (!config) {
    config = await prisma.configuracaoIA.create({ data: { id: "config", mesReferencia: mesAtualString() } });
  }
  if (config.mesReferencia !== mesAtualString()) {
    config = await prisma.configuracaoIA.update({
      where: { id: "config" },
      data: { gastoMesAtualReais: 0, mesReferencia: mesAtualString() },
    });
  }
  return config;
}

// Soma uma estimativa de gasto (em reais) ao total do mês — chamado depois de cada resposta da IA.
async function registrarGastoIA(valorReais) {
  const config = await obterConfiguracaoIA(); // garante que já está no mês certo antes de somar
  return prisma.configuracaoIA.update({
    where: { id: "config" },
    data: { gastoMesAtualReais: config.gastoMesAtualReais + valorReais },
  });
}

module.exports = { obterConfiguracaoIA, registrarGastoIA, mesAtualString };
