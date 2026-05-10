/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: {
          base: "#0a0b0f",
          elevated: "#16181f",
          hover: "#1a1d26",
        },
        border: {
          DEFAULT: "#2a2d38",
          hover: "#383c4a",
        },
        accent: {
          DEFAULT: "#3b82f6",
          hover: "#2563eb",
        },
        text: {
          primary: "#e7e9ee",
          secondary: "#94a3b8",
          muted: "#64748b",
        },
      },
      fontFamily: {
        sans: ["-apple-system", "Segoe UI", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
