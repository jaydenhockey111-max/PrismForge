import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#181a19",
        cream: "#f5f4f0",
        moss: "#31694b",
        lime: "#e8f2df",
        coral: "#d95c46",
        violet: "#6255e7",
        gold: "#e7bd58",
        sky: "#dceef2",
      },
      boxShadow: {
        card: "inset 0 1px 0 rgba(255,255,255,.95), 0 1px 2px rgba(24,26,25,.05), 0 12px 32px rgba(24,26,25,.07)",
        glow: "inset 0 1px 0 rgba(255,255,255,.18), 0 2px 5px rgba(24,26,25,.10), 0 18px 48px rgba(24,26,25,.12)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "sans-serif"],
        display: ["var(--font-display)", "ui-sans-serif", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
