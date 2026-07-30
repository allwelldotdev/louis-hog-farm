/** Tailwind v4 has no tailwind.config.js — the `@theme` block in
 *  src/app/globals.css is the single source of truth for design tokens. */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
