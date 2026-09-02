const prisma = require("../lib/prisma");

async function notificar(userId, { titulo, mensagem, tipo = "sistema" }) {
  return prisma.notificacao.create({
    data: { userId, titulo, mensagem, tipo },
  });
}

// Verifica se um pacote precisa de aviso de renovação:
// - avisa a PARTIR da 2ª sessão realizada, e reforça na 3ª, se o pacote tiver 4 sessões
//   (pacotes de 1 ou 2 sessões avisam quando faltar só 1 pra acabar)
function precisaAvisoRenovacao(pacote) {
  if (pacote.status !== "ATIVO") return false;
  const restantes = pacote.totalSessoes - pacote.sessoesUsadas;
  if (pacote.totalSessoes >= 4) {
    return pacote.sessoesUsadas === 2 || pacote.sessoesUsadas === 3;
  }
  return restantes === 1;
}

module.exports = { notificar, precisaAvisoRenovacao };
