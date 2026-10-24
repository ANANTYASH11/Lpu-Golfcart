/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        lpu: {
          blue: "#1E40AF",
          orange: "#EA580C",
          dark: "#0F172A",
          card: "#1E293B"
        }
      }
    },
  },
  plugins: [],
}
