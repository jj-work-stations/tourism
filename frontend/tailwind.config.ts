import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Vazirmatn", "Tahoma", "system-ui", "sans-serif"],
        display: ["Amiri", "Vazirmatn", "serif"],
        accent: ["Unna", "Amiri", "serif"],
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
        /* Persian palette accents */
        terracotta: {
          50: "#fdf2ef",
          100: "#fae4de",
          200: "#f6d2c8",
          300: "#eeb5a3",
          400: "#e3917d",
          500: "#b5442c",
          600: "#9a3824",
          700: "#7d2c1d",
          800: "#642319",
          900: "#531d15",
        },
        gold: {
          50: "#fffdf7",
          100: "#fffbe8",
          200: "#fff3c4",
          300: "#ffe999",
          400: "#fcd266",
          500: "#b8860b",
          600: "#a07009",
          700: "#855d07",
          800: "#6d4a05",
          900: "#5a3d04",
        },
        turquoise: {
          50: "#f0fbfb",
          100: "#d8f4f4",
          200: "#b3e7e7",
          300: "#7fdcdc",
          400: "#3cb8b8",
          500: "#0fa3a3",
          600: "#0d8585",
          700: "#0b6b6b",
          800: "#0a5656",
          900: "#084444",
        },
      },
      boxShadow: {
        soft: "0 18px 50px -24px rgba(6, 61, 53, 0.28)",
        card: "0 10px 30px -18px rgba(11, 31, 29, 0.25)",
        ornamental: "0 20px 60px -28px rgba(181, 68, 44, 0.35)",
        gold: "0 18px 40px -24px rgba(184, 134, 11, 0.45)",
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
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        "ornament-spin": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        float: "float 6s ease-in-out infinite",
        "fade-up": "fade-up .6s ease-out both",
        "pulse-soft": "pulse-soft 2.4s ease-in-out infinite",
        "ornament-spin": "ornament-spin 24s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
