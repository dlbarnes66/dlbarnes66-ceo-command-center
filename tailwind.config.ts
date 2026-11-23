import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"] },
      colors: {
        ink: { DEFAULT: "#1f1f1d", soft: "#5f5e5a", muted: "#8a8984" },
        line: "#e7e5df",
        canvas: "#fbfaf7",
      },
    },
  },
  plugins: [],
} satisfies Config;
