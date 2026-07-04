/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        'bg-app': '#F0F2F5',
        'bg-panel': '#F7F8FA',
        'bg-surface': '#FFFFFF',
        'bg-hover': '#F5F7FA',
        'bg-selected': '#E8F3FF',
        'bg-chat': '#F7F8FA',
        'bg-primary': '#F0F2F5',
        'bg-secondary': '#F7F8FA',
        'bg-card': '#FFFFFF',
        'border-primary': '#E5E6EB',
        'border-secondary': '#F2F3F5',
        'border-color': '#E5E6EB',
        'accent': '#1677FF',
        'success': '#00B42A',
        'warning': '#FF7D00',
        'danger': '#F53F3F',
        'offline': '#86909C',
        'text-primary': '#1D2129',
        'text-secondary': '#646A73',
        'text-muted': '#8B919A'
      },
      fontFamily: {
        'mono-num': ['Consolas', 'monospace']
      }
    }
  },
  plugins: []
}
