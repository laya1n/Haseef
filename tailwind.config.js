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
        primary: "#0D16D1", // أزرق حصيف
        secondary: "#4C4DE9",
        accent: "#97FC4A", // الأخضر الفسفوري المستخدم في البادجز
        softGreen: "#CDEFE3", // خلفيات كروت خضراء فاتحة
        brandGreen: "#0E6B43", // الأخضر الداكن للأزرار
        darkBg: "#0C1029",
        darkCard: "#161A38",
      },
      fontFamily: {
        poppins: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        // للخلفية العامة اللي استخدمناها في الداشبورد
        "haseef-surface":
          "linear-gradient(180deg, #F5F7FB 0%, #E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,0.15), transparent 60%)",
        // تدرّج غامق اختياري للبطاقات
        "haseef-dark":
          "linear-gradient(to bottom right, #0C1029, #161A38, #1E244D)",
        // تدرج برّاق لبطاقة الـ AI
        "ai-card":
          "linear-gradient(135deg, #2B2D6B 0%, #4C4DE9 42%, #0D16D1 100%)",
      },
      boxShadow: {
        // تُنشئ shadow-soft و shadow-ai التي نستخدمها في الصفحة
        soft: "0 12px 30px rgba(2, 6, 23, 0.08)",
        ai: "0 16px 40px rgba(13, 22, 209, 0.18)",
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
