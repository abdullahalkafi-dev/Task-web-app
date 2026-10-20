import type { Config } from "tailwindcss";

const v = (name: string): string => `var(--${name})`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: v("bg-canvas"),
        shell: v("bg-shell"),
        surface: v("surface"),
        "surface-muted": v("surface-muted"),
        "surface-hover": v("surface-hover"),
        line: v("border"),
        "line-strong": v("border-strong"),
        ink: v("text"),
        "ink-2": v("text-secondary"),
        "ink-3": v("text-muted"),
        primary: v("primary"),
        "primary-ink": v("primary-text"),
        "accent-blue": v("accent-blue"),
        "accent-orange": v("accent-orange"),
        "accent-teal": v("accent-teal"),
        "st-ns-bg": v("st-notstarted-bg"),
        "st-ns-fg": v("st-notstarted-fg"),
        "st-s-bg": v("st-started-bg"),
        "st-s-fg": v("st-started-fg"),
        "st-c-bg": v("st-completed-bg"),
        "st-c-fg": v("st-completed-fg"),
      },
      borderRadius: {
        shell: v("radius-shell"),
        panel: v("radius-panel"),
        card: v("radius-card"),
        input: v("radius-input"),
        chip: v("radius-chip"),
      },
      boxShadow: {
        sm2: v("shadow-sm"),
        md2: v("shadow-md"),
        lg2: v("shadow-lg"),
        drag: v("shadow-drag"),
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grad-ai": v("grad-ai"),
        "grad-profile": v("grad-profile"),
      },
      keyframes: {
        "slide-in-left": { from: { transform: "translateX(-100%)" }, to: { transform: "translateX(0)" } },
        "slide-in-up": { from: { transform: "translateY(100%)" }, to: { transform: "translateY(0)" } },
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "pop-in": { from: { opacity: "0", transform: "scale(.97)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
      },
      animation: {
        "slide-in-left": "slide-in-left 250ms ease-out",
        "slide-in-up": "slide-in-up 250ms ease-out",
        "fade-in": "fade-in 180ms ease-out",
        "pop-in": "pop-in 180ms ease-out",
      },
    },
  },
  plugins: [],
};

export default config;
