// Service worker mínimo do Espaço do Renascer.
// Só existe pra deixar o app "instalável" (ter o ícone na tela e abrir sem barra do navegador).
// De propósito NÃO guarda em cache as chamadas de API nem as páginas — é um sistema com dados que
// mudam a toda hora (agenda, financeiro), então cache agressivo aqui ia mostrar informação velha.
const CACHE_NOME = "renascer-v1";
const ARQUIVOS_ESTATICOS = ["/icon-192.png", "/icon-512.png", "/logo.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOME).then((cache) => cache.addAll(ARQUIVOS_ESTATICOS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) => Promise.all(chaves.filter((c) => c !== CACHE_NOME).map((c) => caches.delete(c))))
  );
  self.clients.claim();
});

// Só intercepta pedidos de imagem estática (ícones/logo); todo o resto (páginas, API) vai
// direto pra rede, sempre buscando a versão mais atual.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (ARQUIVOS_ESTATICOS.includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((resposta) => resposta || fetch(event.request)));
  }
});

// ---------- Notificação push de verdade (toque/vibração, mesmo com o app fechado) ----------
// O backend manda um JSON { titulo, mensagem, url } — aqui só transforma isso na notificação
// visual do sistema operacional.
self.addEventListener("push", (event) => {
  let dados = { titulo: "Espaço do Renascer", mensagem: "Você tem um novo aviso.", url: "/" };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch (e) {
    // Se por algum motivo o payload não for JSON, mostra um aviso genérico mesmo assim.
  }

  event.waitUntil(
    self.registration.showNotification(dados.titulo, {
      body: dados.mensagem,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url || "/" },
    })
  );
});

// Ao tocar na notificação: se o app já estiver aberto numa aba, foca nela; senão, abre uma nova.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (janela.url.includes(destino) && "focus" in janela) return janela.focus();
      }
      if (janelas.length > 0 && "focus" in janelas[0]) {
        janelas[0].focus();
        if ("navigate" in janelas[0]) return janelas[0].navigate(destino);
        return;
      }
      if (self.clients.openWindow) return self.clients.openWindow(destino);
    })
  );
});
