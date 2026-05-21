/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Ravenburst brand palette — matches app tokens
        'rb-bg':        '#1A1917',
        'rb-surface':   '#252422',
        'rb-border':    '#3A3937',
        'rb-text':      '#E8E6E1',
        'rb-muted':     '#6A6865',
        'rb-accent':    '#5B8EFF',
        'rb-accent-hv': '#4A7CFF',
        'rb-green':     '#16A34A',
        'rb-amber':     '#D97706',
      },
      fontFamily: {
        serif: ['Georgia', 'Lora', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        mono:  ['JetBrains Mono', 'monospace'],
      },
    },
  },
}
