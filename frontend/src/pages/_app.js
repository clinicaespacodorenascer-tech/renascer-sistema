import { useEffect } from "react";
import "../styles/globals.css";

export default function App({ Component, pageProps }) {
  useEffect(() => {
    // Fase 78: não registra o service worker na página pública do site (/site). O service
    // worker é o que faz o navegador tratar a página como "app instalável" — isso não deve
    // acontecer para quem está só visitando o site de divulgação vindo de anúncio.
    if (
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      window.location.pathname !== "/site"
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return <Component {...pageProps} />;
}
