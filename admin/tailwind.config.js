/** Ranavista brand tokens — from the Brand Color Guide */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        forest: { DEFAULT: '#0D3B32', 900: '#082a24', 800: '#0D3B32', 700: '#134a40', 600: '#1b5c50' },
        gold: { DEFAULT: '#B89B6B', light: '#d4bf98', dark: '#9c8155' },
        cream: '#F7F3EA',
        beige: '#E8DDD1',
        ink: { DEFAULT: '#1F2D2A', medium: '#6B7A78' },
        sage: '#8BA88E',
        olive: '#6B7F5B',
        earth: '#A47148',
        muted: '#5A7D9A',
        danger: '#D9534F',
        success: '#28A745',
        warning: '#F0AD4E',
        line: '#E0E0E0',
        mist: '#F1F1F1',
        slate: { DEFAULT: '#CBD5D1', dark: '#495057' },
      },
      fontFamily: {
        serif: ['"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Poppins', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(13,59,50,.04), 0 8px 24px -12px rgba(13,59,50,.18)',
        lift: '0 2px 4px rgba(13,59,50,.06), 0 24px 48px -20px rgba(13,59,50,.35)',
      },
      borderRadius: { xl2: '1.25rem' },
    },
  },
  plugins: [],
};
