import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#271f1a",
        "primary-container": "#3d342f",
        "on-primary": "#ffffff",
        "on-primary-container": "#a99c95",
        background: "#fbf9f6",
        surface: "#fbf9f6",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f3f0",
        "surface-container": "#efeeeb",
        "surface-container-high": "#eae8e5",
        "surface-container-highest": "#e4e2df",
        "on-surface": "#1b1c1a",
        "on-surface-variant": "#4e4540",
        secondary: "#705a4d",
        "secondary-container": "#f8dac9",
        "secondary-fixed": "#fbddcc",
        "on-secondary-container": "#745e51",
        tertiary: "#401200",
        "tertiary-container": "#632000",
        "on-tertiary-container": "#ea8459",
        outline: "#7f7570",
        "outline-variant": "#d1c4be",
        error: "#ba1a1a",
        "error-container": "#ffdad6",
      },
      fontFamily: {
        sans: ["Manrope", "Hanken Grotesk", "ui-sans-serif", "system-ui", "sans-serif"],
        headline: ["Manrope", "sans-serif"],
        label: ["Hanken Grotesk", "sans-serif"],
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        subtle: "0 1px 8px rgba(61, 52, 47, 0.04)",
        card: "0 2px 12px -2px rgba(61, 52, 47, 0.06)",
        float: "0 10px 30px -4px rgba(61, 52, 47, 0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
