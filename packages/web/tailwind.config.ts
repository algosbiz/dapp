import type { Config } from "tailwindcss";

// Design tokens derived from DESIGN.md (Wise-inspired). Product-register usage:
// brand green is reserved for primary actions, ink carries text, sage canvas + white
// cards carry elevation through surface contrast rather than heavy shadows.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#9fe870", // Wise green — the single primary-action color
          active: "#cdffad", // hover / pressed
          neutral: "#c5edab",
          pale: "#e2f6d5", // soft green surface / reward badge
        },
        ink: {
          DEFAULT: "#0e0f0c", // headings + default text
          deep: "#163300", // forest ink on positive surfaces
          body: "#454745", // secondary body text
          mute: "#868685", // fine print (use only on darker tints, not white)
        },
        canvas: {
          DEFAULT: "#ffffff", // card interiors
          soft: "#e8ebe6", // sage page background
        },
        positive: { DEFAULT: "#2ead4b", deep: "#054d28" },
        warning: { DEFAULT: "#ffd11a", deep: "#b86700", content: "#4a3b1c" },
        negative: { DEFAULT: "#d03238", deep: "#a72027", bg: "#320707" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "system-ui", "-apple-system", "sans-serif"],
        // Manrope carries the heavy display voice — the open-source stand-in DESIGN.md
        // recommends for Wise Sans; Inter stays on body/UI.
        display: ["var(--font-manrope)", "var(--font-inter)", "system-ui", "sans-serif"],
      },
      maxWidth: {
        container: "72rem",
      },
      borderRadius: {
        card: "24px", // canonical card + button radius
        control: "12px", // inputs, small chrome
      },
      boxShadow: {
        card: "0 1px 2px rgba(14,15,12,0.04), 0 10px 30px -12px rgba(14,15,12,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
