/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        navy: "#1B2A4A",
        pink: "#FF6B9D",
        bluebell: "#D1E4F8",
        blue: "#4D9FFF",
        red: "#FF5C7A",
        "red-light": "#FFEEF1",
        gold: "#F59E0B",
        "gold-light": "#FFFBEB",
        "gray-50": "#F8F8FA",
        "gray-100": "#F0F0F5",
        "gray-300": "#C8C8D8",
        "gray-500": "#8E8EA0",
        "gray-900": "#1A1A2E",
      },
      fontFamily: {
        sans: ["Pretendard-Regular", "system-ui"],
        bold: ["Pretendard-Bold", "system-ui"],
        semibold: ["Pretendard-SemiBold", "system-ui"],
      },
      borderRadius: {
        xl: "16px",
        "2xl": "24px",
        full: "999px",
      },
    },
  },
  plugins: [],
};
