// Fase 64 — versão simplificada do logo (frontend/public/logo.png), pensada só pra selos/ícones
// pequenos (barra lateral, cabeçalho mobile). O arquivo original é rico em detalhe (textura de
// rede neural, traço fino, nome por extenso) — lindo em tamanho grande (login, formulário), mas
// em ~26-40px vira uma mancha ilegível. Este é um desenho vetorial à parte (sempre nítido, em
// qualquer tamanho/tela), com só o essencial do logo original: o monograma "ER" e os raios acima
// dele (o gesto de "despertar" do Renascer), nas mesmas cores de marca (nv-gold → nv-blue).
export default function LogoMark({ size = 32, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label="Espaço do Renascer"
      className={className}
    >
      <defs>
        <linearGradient id="renascerBadgeGrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9C6B2E" />
          <stop offset="1" stopColor="#0B5FA8" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="100" rx="24" fill="url(#renascerBadgeGrad)" />
      {/* raios — mesmo gesto do logo original (despertar), simplificado pra ficar legível pequeno */}
      <g stroke="#fff" strokeWidth="5.5" strokeLinecap="round" opacity="0.9">
        <line x1="50" y1="13" x2="50" y2="25" />
        <line x1="32" y1="19" x2="38" y2="28" />
        <line x1="68" y1="19" x2="62" y2="28" />
      </g>
      <text
        x="50"
        y="73"
        textAnchor="middle"
        fontFamily="'Sora', system-ui, sans-serif"
        fontWeight="700"
        fontSize="40"
        fill="#fff"
      >
        ER
      </text>
    </svg>
  );
}
