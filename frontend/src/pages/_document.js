import NextDocument, { Html, Head, Main, NextScript } from "next/document";

// Fase 78: o site institucional público (/site) não deve se comportar como o app interno.
// As tags de PWA abaixo (manifest + meta tags de "instalar o app") ficavam disponíveis em
// TODAS as páginas, inclusive na página pública de divulgação — isso fazia o navegador, em
// alguns celulares, oferecer "instalar app" pra quem só estava vindo ver o site pelo anúncio,
// o que prejudicava a experiência e pode ter contribuído na queda de conversão. Agora essas
// tags só entram fora da rota /site.
export default function Document({ isSitePublico }) {
  return (
    <Html lang="pt-BR">
      <Head>
        <link rel="icon" href="/icon-192.png" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

        {!isSitePublico && (
          <>
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
          </>
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

Document.getInitialProps = async (ctx) => {
  const initialProps = await NextDocument.getInitialProps(ctx);
  var pathname = ctx.pathname || "";
  return { ...initialProps, isSitePublico: pathname === "/site" };
};
