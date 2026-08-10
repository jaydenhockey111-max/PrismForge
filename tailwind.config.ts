import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        cream: "rgb(var(--color-cream) / <alpha-value>)",
        moss: "rgb(var(--color-moss) / <alpha-value>)",
        lime: "rgb(var(--color-lime) / <alpha-value>)",
        coral: "rgb(var(--color-coral) / <alpha-value>)",
        violet: "rgb(var(--color-violet) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        sky: "rgb(var(--color-sky) / <alpha-value>)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
        glow: "var(--shadow-glow)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
