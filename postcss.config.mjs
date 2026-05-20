// Tailwind v4 + Next.js : déclare le plugin PostCSS @tailwindcss/postcss
// pour que `@import "tailwindcss"` dans globals.css soit effectivement
// transformé en CSS (utilities + variants + @theme).
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
