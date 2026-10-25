import { useEffect, useRef } from "react";
import Head from "next/head";

// Site público do Espaço do Renascer (Fase 62) — página institucional + lista de
// profissionais + popup de agendamento, vivendo dentro do mesmo sistema Next.js (mesmo
// deploy/domínio), em vez de um arquivo solto.
//
// Fase 1 (agora): o HTML/CSS/JS é exatamente o arquivo único que já tinha sido construído e
// testado antes (home + lista de profissionais + páginas individuais + FAQ + popup de
// agendamento terminando no WhatsApp + Pixel da Meta) — só "encaixado" dentro de uma rota do
// Next.js, sem reescrever nada da lógica. Os três pedaços do arquivo original (CSS, o HTML de
// dentro do <body>, e o JS que roda tudo) ficam como arquivos estáticos em
// /public/site-assets/, e esta página só injeta os três no lugar certo quando alguém visita
// "/site". Isso evita qualquer risco de um <script> ou <style> inline conflitar com o resto do
// sistema (login, painéis etc.), porque só carrega quando essa rota específica é visitada.
//
// Fase 2 (depois, ainda não feita): trocar a parte do popup de agendamento que hoje pergunta só
// "manhã/tarde/noite" por horários reais vindos do backend, amarrados a uma conta de
// profissional de verdade do sistema — ver conversa com o Elismael sobre o painel do Dono para
// linkar cada profissional do site público a uma conta real.
export default function SitePublico() {
  const containerRef = useRef(null);
  const iniciado = useRef(false);

  useEffect(() => {
    if (iniciado.current) return; // evita rodar 2x (ex: Fast Refresh em desenvolvimento)
    iniciado.current = true;

    let scriptEl = null;
    let cancelado = false;

    // Fase 62 — endereço real da API, pro app.js (arquivo estático puro, fora do build do
    // Next.js) saber onde buscar os horários reais de cada profissional. Precisa ser setado
    // ANTES do app.js carregar, por isso entra aqui, antes do appendChild do script.
    window.__RENASCER_API_URL__ = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

    fetch("/site-assets/body.html")
      .then((r) => r.text())
      .then((html) => {
        if (cancelado || !containerRef.current) return;
        containerRef.current.innerHTML = html;

        // O app.js original é um IIFE de DOM puro (sem import/export) — só funciona depois que
        // o HTML acima já está no DOM, por isso só é injetado aqui, depois do innerHTML.
        scriptEl = document.createElement("script");
        scriptEl.src = "/site-assets/app.js";
        document.body.appendChild(scriptEl);
      });

    return () => {
      cancelado = true;
      if (scriptEl?.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      if (containerRef.current) containerRef.current.innerHTML = "";
      iniciado.current = false;
    };
  }, []);

  return (
    <>
      <Head>
        <title>Espaço do Renascer</title>
        <meta
          name="description"
          content="Espaço do Renascer, plataforma de saúde emocional com psicólogas, terapeutas e psicanalistas parceiros e atendimento 100% online."
        />
        <link rel="stylesheet" href="/site-assets/style.css" />
        {/* Meta Pixel — só carrega nesta página pública, não afeta o resto do sistema */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1794226587785597');
  fbq('track', 'PageView');
            `,
          }}
        />
      </Head>
      <noscript>
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src="https://www.facebook.com/tr?id=1794226587785597&ev=PageView&noscript=1"
          alt=""
        />
      </noscript>
      <div ref={containerRef} />
    </>
  );
}
