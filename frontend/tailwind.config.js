/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/pages/**/*.{js,jsx}", "./src/components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        renascer: {
          DEFAULT: "#005096",
          dark: "#003A6E",
          deep: "#041B33",
          light: "#EAF4FB",
          mid: "#3C82BE",
          ink: "#0F2A43",
        },
        // Fase 23 (redesign visual): o token "gold" deixou de ser dourado — agora é o azul-destaque
        // usado na Renascer IA (cor de item ativo no menu, badges, linha de topo, etc). Mantivemos o
        // MESMO NOME "gold" de propósito: é o token usado em dezenas de componentes pelo sistema
        // inteiro (bg-gold, ring-gold, badge-gold, bg-gold-line...) e, trocando só os valores de cor
        // aqui, o visual inteiro do app muda pra combinar com a Renascer IA sem precisar editar
        // arquivo por arquivo.
        gold: {
          DEFAULT: "#4FA8DE",
          light: "#E3EFF8",
          dark: "#003A6E",
        },
      },
      fontFamily: {
        // Fase 23: trocado de Plus Jakarta Sans + Fraunces (serifada) para Manrope — a mesma fonte
        // usada em todas as telas da Renascer IA — pra unificar a identidade dos dois produtos.
        sans: ["Manrope", "system-ui", "sans-serif"],
        display: ["Manrope", "system-ui", "sans-serif"],
      },
      boxShadow: {
        premium: "0 10px 30px -12px rgba(0, 80, 150, 0.25)",
        soft: "0 1px 2px rgba(4, 27, 51, 0.04), 0 10px 30px -10px rgba(4, 27, 51, 0.12)",
        lift: "0 18px 40px -16px rgba(0, 80, 150, 0.38)",
        glow: "0 0 0 1px rgba(79, 168, 222, 0.45), 0 10px 26px -6px rgba(79, 168, 222, 0.4)",
      },
      backgroundImage: {
        "renascer-gradient": "linear-gradient(135deg, #003A6E 0%, #005096 55%, #3C82BE 100%)",
        "renascer-deep": "radial-gradient(1200px 700px at 15% -10%, #0B3F73 0%, #041B33 55%, #010B16 100%)",
        "gold-line": "linear-gradient(90deg, transparent, #4FA8DE, transparent)",
      },
    },
  },
  plugins: [],
};
