/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/pages/**/*.{js,jsx}", "./src/components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        renascer: {
          DEFAULT: "#005096",
          dark: "#003B70",
          deep: "#041B33",
          light: "#EAF4FB",
          mid: "#3C82BE",
          ink: "#10233F",
        },
        gold: {
          DEFAULT: "#C6A15B",
          light: "#F5EBD8",
          dark: "#9C7B3C",
        },
      },
      fontFamily: {
        sans: ["Plus Jakarta Sans", "system-ui", "sans-serif"],
        display: ["Fraunces", "ui-serif", "serif"],
      },
      boxShadow: {
        premium: "0 10px 30px -12px rgba(0, 80, 150, 0.25)",
        soft: "0 1px 2px rgba(4, 27, 51, 0.04), 0 10px 30px -10px rgba(4, 27, 51, 0.12)",
        lift: "0 18px 40px -16px rgba(0, 80, 150, 0.38)",
        glow: "0 0 0 1px rgba(198, 161, 91, 0.45), 0 10px 26px -6px rgba(198, 161, 91, 0.4)",
      },
      backgroundImage: {
        "renascer-gradient": "linear-gradient(135deg, #003B70 0%, #005096 55%, #3C82BE 100%)",
        "renascer-deep": "radial-gradient(1200px 700px at 15% -10%, #0B3F73 0%, #041B33 55%, #010B16 100%)",
        "gold-line": "linear-gradient(90deg, transparent, #C6A15B, transparent)",
      },
    },
  },
  plugins: [],
};
