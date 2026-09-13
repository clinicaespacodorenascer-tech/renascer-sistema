const prisma = require("../lib/prisma");
const { enviarPushParaUsuario } = require("./push");

// Cria o aviso dentro do app (aparece no sininho) E manda a notificação push de verdade pro
// aparelho (toque/vibração, mesmo com o app fechado — só funciona se a pessoa já tiver ativado
// notificações e se o Railway tiver as chaves VAPID configuradas). Se o push falhar por
// qualquer motivo, isso nunca derruba quem chamou — o aviso já foi salvo, e é isso que garante
// o funcionamento mínimo do sistema.
async function notificar(userId, { titulo, mensagem, tipo = "sistema", url }) {
  const notificacao = await prisma.notificacao.create({
    data: { userId, titulo, mensagem, tipo },
  });
  enviarPushParaUsuario(userId, { titulo, mensagem, url }).catch((erro) => console.error("Push falhou:", erro));
  return notificacao;
}

// Manda o mesmo aviso pra TODOS os donos de uma vez (o sistema pode ter mais de um login de
// dono) — usado pros avisos de gestão: novo cliente, dinheiro entrando, cliente saindo etc.
// `excetoUserId` evita notificar o próprio dono quando foi ele quem fez a ação.
async function notificarDonos({ titulo, mensagem, tipo = "sistema", url }, excetoUserId = null) {
  const donos = await prisma.dono.findMany({ select: { userId: true } });
  await Promise.all(
    donos.filter((d) => d.userId !== excetoUserId).map((d) => notificar(d.userId, { titulo, mensagem, tipo, url }))
  );
}

// Manda o mesmo aviso pra todas as atendentes de uma vez — usado pro aviso de "novo cliente
// cadastrado". `excetoUserId` evita mandar a notificação pra ela mesma quando foi ela quem fez a
// ação (não faz sentido avisar quem já sabe porque acabou de fazer).
async function notificarAtendentes({ titulo, mensagem, tipo = "sistema", url }, excetoUserId = null) {
  const atendentes = await prisma.atendente.findMany({ select: { userId: true } });
  await Promise.all(
    atendentes.filter((a) => a.userId !== excetoUserId).map((a) => notificar(a.userId, { titulo, mensagem, tipo, url }))
  );
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

module.exports = { notificar, notificarDonos, notificarAtendentes, precisaAvisoRenovacao };
