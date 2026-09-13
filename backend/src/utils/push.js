// Notificação push de verdade — a que aparece com som/vibração na tela do celular/computador,
// mesmo com o app fechado. Usa o protocolo Web Push (padrão do navegador, não é Firebase nem
// nada de loja de app) via a lib "web-push".
//
// Só funciona se as chaves VAPID_PUBLIC_KEY e VAPID_PRIVATE_KEY estiverem configuradas no
// Railway (ver instruções). Sem elas, essa função simplesmente não manda o push — mas o resto do
// sistema (o aviso salvo no sininho dentro do app) continua funcionando normal.
const webpush = require("web-push");
const prisma = require("../lib/prisma");

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:contato@espacodorenascer.com.br";

const configurado = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (configurado) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY não configuradas — notificações push desativadas (o sininho dentro do app continua funcionando normal).");
}

// Manda o push pra TODOS os aparelhos inscritos desse usuário (pode ter mais de um: celular +
// computador). Nunca lança erro pra quem chamou — se falhar, só loga, pra nunca quebrar o fluxo
// principal (cadastro de cliente, pagamento etc.) por causa de uma notificação.
async function enviarPushParaUsuario(userId, { titulo, mensagem, url }) {
  if (!configurado) return;

  try {
    const inscricoes = await prisma.pushSubscription.findMany({ where: { userId } });
    if (inscricoes.length === 0) return;

    const payload = JSON.stringify({ titulo, mensagem, url: url || "/" });

    await Promise.all(
      inscricoes.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload);
        } catch (erro) {
          // 404/410 = inscrição expirou ou foi revogada (desinstalou o app, trocou de aparelho,
          // limpou os dados do navegador) — apaga do banco pra não tentar de novo pra sempre.
          if (erro.statusCode === 404 || erro.statusCode === 410) {
            await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          } else {
            console.error("Erro ao enviar push:", erro.statusCode, erro.body || erro.message);
          }
        }
      })
    );
  } catch (erro) {
    console.error("Falha geral ao tentar enviar push:", erro);
  }
}

module.exports = { enviarPushParaUsuario, vapidPublicKey: VAPID_PUBLIC_KEY || null };
