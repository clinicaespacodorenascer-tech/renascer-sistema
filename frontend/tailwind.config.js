/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/pages/**/*.{js,jsx}", "./src/components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        renascer: {
          DEFAULT: "#005096",
          dark: "#003B70",
          light: "#EAF4FB",
          mid: "#3C82BE",
          ink: "#10233F",
        },
      },
      fontFamily: {
        sans: ["Poppins", "system-ui", "sans-serif"],
      },
      boxShadow: {
        premium: "0 10px 30px -12px rgba(0, 80, 150, 0.25)",
      },
    },
  },
  plugins: [],
};
