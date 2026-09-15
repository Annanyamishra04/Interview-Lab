import type { Config } from "tailwindcss";

/**
 * InterviewLab design tokens.
 *
 * Palette is grounded in a recording-studio metaphor (this is a place you
 * rehearse and get coached), not a generic AI-product gradient kit:
 *  - ink      → the near-black studio wall
 *  - stone    → the paper/backdrop surface
 *  - brass    → the single warm accent, used only for active/recording state
 *  - teal     → the "green room" secondary accent, used sparingly for tags
 *  - line     → hairline borders, replacing card shadows everywhere
 */
const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./features/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#12181B",
          soft: "#232B2F",
          muted: "#4A5459",
        },
        stone: {
          DEFAULT: "#ECEAE2",
          panel: "#F5F4EF",
          deep: "#DFDCD1",
        },
        brass: {
          DEFAULT: "#C98A3E",
          dim: "#A9702E",
          tint: "#F1DEBE",
        },
        teal: {
          DEFAULT: "#1F3A3D",
          tint: "#D9E4E2",
        },
        line: {
          DEFAULT: "#D9D6CB",
          strong: "#B9B5A6",
        },
        signal: {
          success: "#3F6B4F",
          error: "#9A3B32",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // Type scale — 1.25 ratio, tuned by hand rather than left mechanical.
        "display-xl": ["4.5rem", { lineHeight: "1.02", letterSpacing: "-0.02em" }],
        "display-lg": ["3.25rem", { lineHeight: "1.05", letterSpacing: "-0.015em" }],
        "display-md": ["2.25rem", { lineHeight: "1.12", letterSpacing: "-0.01em" }],
        "display-sm": ["1.625rem", { lineHeight: "1.2", letterSpacing: "-0.005em" }],
        body: ["1.0625rem", { lineHeight: "1.65" }],
        "body-sm": ["0.9375rem", { lineHeight: "1.55" }],
        meta: ["0.8125rem", { lineHeight: "1.4" }],
        data: ["0.8125rem", { lineHeight: "1.3", letterSpacing: "0.01em" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        30: "7.5rem",
      },
      maxWidth: {
        studio: "78rem",
        prose: "38rem",
      },
      borderRadius: {
        none: "0px",
        sm: "3px",
        DEFAULT: "6px",
        md: "8px",
        lg: "12px",
        full: "9999px",
      },
      boxShadow: {
        // Deliberately shallow — surfaces are distinguished by hairline
        // borders, not drop shadows. Reserved for overlays only.
        overlay: "0 12px 32px -12px rgba(18, 24, 27, 0.28)",
      },
      keyframes: {
        "wave-draw": {
          "0%": { strokeDashoffset: "240" },
          "100%": { strokeDashoffset: "0" },
        },
        "pulse-ring": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.35" },
        },
      },
      animation: {
        "wave-draw": "wave-draw 1.1s ease-out forwards",
        "pulse-ring": "pulse-ring 2.2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
