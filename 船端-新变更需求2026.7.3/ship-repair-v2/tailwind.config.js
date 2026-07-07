/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0A1628',
        'bg-secondary': '#0F1F38',
        'bg-card': '#0B1A2E',
        'bg-chat': '#0B1422',
        'border-color': '#1E3A5F',
        'accent': '#1890FF',
        'success': '#52C41A',
        'warning': '#FAAD14',
        'danger': '#FF4D4F',
        'offline': '#5A7A92',
        'text-primary': '#E8F0FF',
        'text-secondary': '#8BAAC0',
        'text-muted': '#5A7A92'
      },
      fontFamily: {
        'mono-num': ['Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
