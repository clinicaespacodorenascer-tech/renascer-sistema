const prisma = require("../lib/prisma");

async function notificar(userId, { titulo, mensagem, tipo = "sistema" }) {
  return prisma.notificacao.create({
    data: { userId, titulo, mensagem, tipo },
  });
}

// Verifica se um pacote precisa de aviso de renovação:
// - pacotes com 4 sessões ou mais (4, 5, 6, 10, 12...) avisam quando faltarem 2 sessões pra
//   acabar, e reforçam quando faltar só 1 — baseado em quantas RESTAM, não em quantas já foram
//   usadas, pra funcionar certo em qualquer tamanho de pacote (antes só funcionava certinho pra
//   pacotes de exatamente 4 sessões; num pacote de 10, por exemplo, avisava faltando 7/8 sessões)
// - pacotes de 1 a 3 sessões avisam quando faltar só 1 pra acabar
function precisaAvisoRenovacao(pacote) {
  if (pacote.status !== "ATIVO") return false;
  const restantes = pacote.totalSessoes - pacote.sessoesUsadas;
  if (pacote.totalSessoes >= 4) {
    return restantes === 2 || restantes === 1;
  }
  return restantes === 1;
}

module.exports = { notificar, precisaAvisoRenovacao };
