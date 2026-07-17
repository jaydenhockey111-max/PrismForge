import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#18201b",
        cream: "#f7f4ea",
        moss: "#315b43",
        lime: "#d9f99d",
        coral: "#ff7a5c",
        violet: "#6d5dfc",
        gold: "#ffd166",
        sky: "#9be7ff",
      },
      boxShadow: {
        card: "0 18px 60px rgba(24, 32, 27, 0.09)",
        glow: "0 24px 90px rgba(109, 93, 252, 0.18)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "sans-serif"],
        display: ["var(--font-display)", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
