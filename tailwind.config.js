// tailwind.config.js (ESM)
import forms from "@tailwindcss/forms";
import typography from "@tailwindcss/typography";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        primary: "#0D16D1",
        secondary: "#4C4DE9",
        accent: "#47A241",
        softGreen: "#97FC4A",
        darkBg: "#0C1029",
        darkCard: "#161A38",
      },
      fontFamily: {
        poppins: ["Poppins", "sans-serif"],
      },
      backgroundImage: {
        "haseef-gradient":
          "linear-gradient(to bottom right, #0D16D1, #4C4DE9, #47A241, #97FC4A)",
        "haseef-dark":
          "linear-gradient(to bottom right, #0C1029, #161A38, #1E244D)",
      },
      boxShadow: {
        soft: "0 4px 20px rgba(0, 0, 0, 0.05)",
        glow: "0 0 25px rgba(76, 77, 233, 0.3)",
      },
      transitionProperty: {
        spacing: "margin, padding",
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
    },
  },
  plugins: [forms(), typography()],
};
