import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "var(--canvas)",
        panel: "var(--panel)",
        "panel-2": "var(--panel-2)",
        ink: "var(--ink)",
        "ink-soft": "var(--ink-soft)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        line: "var(--line)",
        "line-strong": "var(--line-strong)",
        accent: "var(--accent)",
        "accent-ink": "var(--accent-ink)",
        "accent-soft": "var(--accent-soft)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        thai: ["var(--font-thai)", "var(--font-sans)", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem", letterSpacing: "0.04em" }],
      },
      borderRadius: {
        DEFAULT: "6px",
        md: "8px",
        lg: "10px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(18, 22, 20, 0.04)",
        lift: "0 8px 24px -12px rgba(18, 22, 20, 0.16)",
      },
      maxWidth: {
        page: "1240px",
      },
    },
  },
  plugins: [],
};

export default config;
