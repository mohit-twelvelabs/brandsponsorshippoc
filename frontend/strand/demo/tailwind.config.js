import strandPreset from '../tailwind-preset.js'

/** @type {import('tailwindcss').Config} */
export default {
  presets: [strandPreset],
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
