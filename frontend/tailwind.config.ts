import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        app: {
          background: '#E5E7EB',
          panel: '#FFFFFF',
          panelMuted: '#F3F4F6',
          border: '#9CA3AF',
          borderLight: '#D1D5DB',
          text: '#111827',
          textMuted: '#4B5563',
          primary: '#1D4ED8',
          primaryHover: '#1E40AF',
          success: '#15803D',
          warning: '#B45309',
          danger: '#B91C1C',
          navBg: '#1E293B',
          navText: '#CBD5E1',
          navActive: '#FFFFFF',
          headerBg: '#0F172A',
          headerText: '#F8FAFC',
          toolbar: '#F9FAFB',
        },
      },
      boxShadow: {
        panel: '0 1px 2px rgba(0, 0, 0, 0.1)',
        inset: 'inset 0 1px 2px rgba(0, 0, 0, 0.06)',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
