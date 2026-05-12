import type { Config } from "tailwindcss";

export default {
  theme: {
    extend: {
      colors: {
        kraft: "#F5F2EB",
        espresso: "#3E2723",
        "warm-brown": "#5D4037",
        terracotta: "#C62828",
        "fresh-green": "#2E7D32",
        "warm-gold": "#F57F17",
        parchment: "#FFFDF8",
        ticket: "#EBE6D9",
        "table-dark": "#2D1B18",
        "ticket-rule": "#D7CCC8",
        ink: "#1A1A1A",
      },
      fontFamily: {
        sans: ["var(--font-assistant)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
      },
    },
  },
} satisfies Config;
