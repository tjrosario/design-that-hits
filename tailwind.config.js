/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream:       '#F5EFE6',
        beige:       '#EDE3D4',
        sand:        '#D9CBBA',
        terracotta:  '#C06B45',
        'terra-lt':  '#E8A688',
        sage:        '#7A9E87',
        'sage-lt':   '#B5CFBC',
        'dusty-rose':'#C97B84',
        amber:       '#D4A843',
        dark:        '#1C1A17',
        mid:         '#5C5248',
        light:       '#8C8278',
      },
      borderRadius: {
        'xl':  '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [
    require("@tailwindcss/typography"),
  ],
};
