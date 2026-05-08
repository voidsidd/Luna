import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#151816",
        field: "#f7f5ee",
        moss: "#466149",
        clay: "#b45f43",
        steel: "#4e6678",
        amber: "#d39f3b"
      }
    }
  },
  plugins: []
};

export default config;
