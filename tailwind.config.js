/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0e17',
        'bg-secondary': '#111827',
        'bg-tertiary': '#1f2937',
        'accent-primary': '#00d4ff',
        'accent-secondary': '#8b5cf6',
        'accent-success': '#10b981',
        'accent-danger': '#ef4444',
        'accent-warning': '#f59e0b',
        'text-primary': '#f9fafb',
        'text-secondary': '#9ca3af',
        'text-muted': '#6b7280',
        'border-color': '#374151',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Inter', '"SF Pro Display"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
