import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="pt-BR">
      <Head>
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {/* PWA — permite "instalar" o app (ícone na tela, abre sem barra do navegador) sem
            precisar publicar na App Store nem na Play Store. */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#005096" />

        {/* iOS (Safari) não lê o manifest.json pra virar app — precisa dessas tags específicas
            pra "Adicionar à Tela de Início" funcionar direito, sem barra de endereço. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Renascer" />

        {/* Android/Chrome — mesma ideia, garante o app abrindo em tela cheia */}
        <meta name="mobile-web-app-capable" content="yes" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
