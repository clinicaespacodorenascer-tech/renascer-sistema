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
