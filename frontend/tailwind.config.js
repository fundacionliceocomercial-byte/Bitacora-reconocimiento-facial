/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#e1f5ee",
          100: "#9fe1cb",
          500: "#0f6e56",
          600: "#0c5946",
          700: "#085041",
        },
      },
    },
  },
  plugins: [],
};
