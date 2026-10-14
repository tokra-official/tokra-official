import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Tokra Obsidian Fintech Palette
        obsidian: "#080C14",
        surface: "#0F172A",
        "surface-border": "#1E293B",
        "gain-green": "#10B981",
        "loss-red": "#EF4444",
        "gold-accent": "#F59E0B",
        "crypto-cyan": "#06B6D4",
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
      backgroundColor: {
        DEFAULT: "var(--background)",
      },
      borderColor: {
        DEFAULT: "var(--surface-border)",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
        "card-hover":
          "0 10px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.4)",
        "glow-green": "0 0 20px rgb(16 185 129 / 0.15)",
        "glow-red": "0 0 20px rgb(239 68 68 / 0.15)",
        "glow-gold": "0 0 20px rgb(245 158 11 / 0.15)",
        "glow-cyan": "0 0 20px rgb(6 182 212 / 0.15)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        ticker: "ticker 30s linear infinite",
        "fade-in": "fade-in 0.5s ease-out forwards",
      },
      keyframes: {
        ticker: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
