import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Mirror the existing CSS custom property design tokens
        accent: {
          blue: '#1a73e8',
          green: '#34a853',
          red: '#ea4335',
          orange: '#f59f00',
          purple: '#9c27b0',
        },
        priority: {
          high: '#ea4335',
          medium: '#f59f00',
          low: '#34a853',
          none: '#9ca3af',
        },
        status: {
          open: '#6b7280',
          'in-progress': '#1a73e8',
          fixed: '#9c27b0',
          completed: '#34a853',
          closed: '#374151',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
      },
      boxShadow: {
        panel: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
        dropdown: '0 4px 20px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}

export default config
