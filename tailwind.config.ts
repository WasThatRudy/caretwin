import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "#080C12",
        panel: "#0F1822",
        panel2: "#0B131C",
        line: "#1D2A38",
        ink: "#E8EEF4",
        mute: "#8A98A8",
        faint: "#586878",
        teal: "#2FB3A3",
        tealD: "#0E8A7D",
        gold: "#E3A82B",
        danger: "#E5533C",
        amber: "#E39B2B",
        good: "#3FB27F",
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "SF Mono", "Cascadia Code", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
