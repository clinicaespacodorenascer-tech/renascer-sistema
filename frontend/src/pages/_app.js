import { useEffect } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  // Registra o service worker (necessário pro navegador oferecer "Instalar app"/"Adicionar à
  // tela de início"). Só roda no navegador, nunca no build do servidor.
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return <Component {...pageProps} />;
}
