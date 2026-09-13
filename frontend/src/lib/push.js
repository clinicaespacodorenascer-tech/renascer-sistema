// Notificações push de verdade (toque/vibração no aparelho, mesmo com o app fechado).
// Usa o protocolo Web Push padrão do navegador — funciona em Android/desktop direto no
// navegador, e no iPhone SÓ depois que o app foi adicionado à Tela de Início (Apple exige isso).
import api from "./api";

// Converte a chave pública VAPID (formato base64url que vem do backend) pro formato binário
// que a API do navegador (pushManager.subscribe) exige.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Se o navegador nem sabe o que é notificação push, nem vale tentar (ex: iPhone fora do modo
// "app instalado", ou navegador muito antigo).
export function suportaPush() {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// "default" = ainda não perguntou, "granted" = já pode mandar, "denied" = a pessoa negou
// (nesse caso só dá pra mudar via configuração do próprio navegador/celular).
export function statusPermissao() {
  if (typeof window === "undefined" || !("Notification" in window)) return "indisponivel";
  return Notification.permission;
}

// Pede permissão (se ainda não foi pedida) e inscreve esse aparelho pra receber notificações.
// Retorna { ok, motivo? } — nunca lança erro, pra nunca travar a tela por causa disso.
export async function inscreverPush() {
  if (!suportaPush()) return { ok: false, motivo: "Esse navegador/aparelho não suporta notificações push." };

  try {
    const permissao = await Notification.requestPermission();
    if (permissao !== "granted") {
      return { ok: false, motivo: "Permissão de notificação não foi concedida." };
    }

    const registro = await navigator.serviceWorker.ready;
    const { data } = await api.get("/comum/push/chave-publica");
    if (!data?.publicKey) {
      return { ok: false, motivo: "Notificações push ainda não foram configuradas no sistema." };
    }

    let inscricao = await registro.pushManager.getSubscription();
    if (!inscricao) {
      inscricao = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.publicKey),
      });
    }

    const inscricaoJSON = inscricao.toJSON();
    await api.post("/comum/push/inscrever", { endpoint: inscricaoJSON.endpoint, keys: inscricaoJSON.keys });

    return { ok: true };
  } catch (erro) {
    return { ok: false, motivo: "Não consegui ativar as notificações agora. Tente de novo em alguns instantes." };
  }
}

// Cancela a inscrição desse aparelho (usado no botão "Desativar notificações").
export async function cancelarPush() {
  if (!suportaPush()) return { ok: true };
  try {
    const registro = await navigator.serviceWorker.ready;
    const inscricao = await registro.pushManager.getSubscription();
    if (inscricao) {
      const endpoint = inscricao.endpoint;
      await inscricao.unsubscribe();
      await api.delete("/comum/push/inscrever", { data: { endpoint } });
    }
    return { ok: true };
  } catch (erro) {
    return { ok: false };
  }
}

// Se a pessoa já ativou antes (permissão "granted") mas a inscrição some por algum motivo
// (trocou de navegador, limpou dados), tenta reinscrever sem perguntar de novo — só funciona
// quando a permissão já está concedida, então não interrompe ninguém com um popup.
export async function tentarReinscreverSilenciosamente() {
  if (!suportaPush() || Notification.permission !== "granted") return;
  try {
    const registro = await navigator.serviceWorker.ready;
    const jaInscrito = await registro.pushManager.getSubscription();
    if (jaInscrito) return; // já tá inscrito nesse aparelho, não precisa fazer nada
    await inscreverPush();
  } catch (erro) {
    // silencioso de propósito — isso roda sozinho em segundo plano
  }
}
