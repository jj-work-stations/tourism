import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#ecfdf7",
          100: "#d1faec",
          200: "#a7f3d8",
          300: "#6ee7bf",
          400: "#34d3a2",
          500: "#10b981",
          600: "#0d9668",
          700: "#0e7c66",
          800: "#115e52",
          900: "#134e45",
          950: "#052e2b",
        },
        sand: {
          50: "#fbf8f3",
          100: "#f6f0e6",
          200: "#ece0cc",
          300: "#ddc7a8",
          400: "#c9a97e",
          500: "#b78e5d",
          600: "#a4774c",
          700: "#885f40",
          800: "#6f4e39",
          900: "#5b4131",
        },
        ink: "#0b1f1d",
      },
      boxShadow: {
        soft: "0 18px 50px -24px rgba(6, 61, 53, 0.28)",
        card: "0 10px 30px -18px rgba(11, 31, 29, 0.25)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-up": "fade-up .6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
