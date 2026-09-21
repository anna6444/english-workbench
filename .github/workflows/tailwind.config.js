/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── 可爱化命名色板：奶油白 / 浅粉 / 鹅黄 / 薄荷绿 / 可可棕 ──
        cream: '#FFF9F2',
        sakura: {
          50: '#FFF5F7',
          100: '#FFE7EC',
          200: '#FFCBD8',
          300: '#FFA8C0',
          400: '#FB87A5',
          500: '#EF6A8D',
          600: '#DB4E73',
          700: '#B93A5C',
        },
        butter: {
          50: '#FFFCF0',
          100: '#FFF6D6',
          200: '#FFECAD',
          300: '#FFE183',
          400: '#FFD45C',
          500: '#FBC129',
        },
        mint: {
          50: '#F0FBF7',
          100: '#DCF5EB',
          200: '#C0EDDA',
          300: '#96DFC4',
          400: '#6BD1AA',
          500: '#45BE90',
        },
        cocoa: {
          300: '#D8C5BC',
          400: '#B79C90',
          500: '#96796C',
          600: '#75594F',
          700: '#5C443D',
          800: '#463330',
        },
        // ── 暖色重映射：全站已有的冷蓝/冷紫类名自动变暖，零页面改动 ──
        // sky → 薄荷绿（原主色冷蓝改暖绿）
        sky: {
          50: '#F0FBF6',
          100: '#DCF5EA',
          200: '#B8EBD6',
          300: '#8BDEC0',
          400: '#5CCFA8',
          500: '#3BBE93',
          600: '#2AA07B',
          700: '#228064',
        },
        // slate → 暖可可灰（原冷蓝灰改暖棕灰）
        slate: {
          50: '#FBF7F4',
          100: '#F6EFEA',
          200: '#EBDFD6',
          300: '#DCCBBE',
          400: '#C4AC9C',
          500: '#9A8072',
          600: '#7C655A',
          700: '#635049',
          800: '#4E3F3A',
          900: '#3E322E',
        },
        // violet → 暖珊瑚粉（原冷紫改暖粉）
        violet: {
          50: '#FFF1F3',
          100: '#FFE0E6',
          200: '#FFC6D2',
          300: '#FFA3B6',
          400: '#FB7F99',
          500: '#EF5F80',
          600: '#DB4467',
          700: '#B93555',
        },
        // emerald / amber → 更柔和的薄荷 / 鹅黄
        emerald: {
          50: '#EDFAF4',
          100: '#D6F3E6',
          200: '#ADE7CF',
          300: '#7ED6B5',
          400: '#4FC49C',
          500: '#2FAF84',
          600: '#238F6C',
          700: '#1E7358',
        },
        amber: {
          50: '#FFF9E6',
          100: '#FFF1C6',
          200: '#FFE49A',
          300: '#FFD766',
          400: '#FFC94A',
          500: '#FBB428',
          600: '#DE931A',
          700: '#B87515',
        },
        // 儿童向糖果色板（旧版保留，部分页面在用）
        kid: {
          sky: '#7DD3FC',
          'sky-deep': '#38BDF8',
          grass: '#86EFAC',
          'grass-deep': '#4ADE80',
          sun: '#FDE047',
          'sun-deep': '#FACC15',
          candy: '#F9A8D4',
          'candy-deep': '#F472B6',
          grape: '#C4B5FD',
          'grape-deep': '#A78BFA',
          cream: '#FFFBF5',
          ink: '#3B3355',
          'ink-soft': '#6B6485',
        },
      },
      borderRadius: {
        kid: '1.5rem',
        'kid-lg': '2rem',
      },
      fontSize: {
        'kid-sm': ['1.0625rem', { lineHeight: '1.5' }],
        'kid-base': ['1.25rem', { lineHeight: '1.6' }],
        'kid-lg': ['1.75rem', { lineHeight: '1.4' }],
        'kid-xl': ['2.5rem', { lineHeight: '1.2' }],
      },
      minHeight: {
        touch: '72px', // 低龄手指最小点击区
      },
      minWidth: {
        touch: '72px',
      },
      boxShadow: {
        kid: '0 6px 0 rgba(59, 51, 85, 0.08)',
        'kid-lg': '0 8px 0 rgba(59, 51, 85, 0.10)',
        soft: '0 4px 20px rgba(0, 0, 0, 0.06)',
        'soft-lg': '0 8px 30px rgba(0, 0, 0, 0.09)',
      },
      keyframes: {
        'pop-in': {
          '0%': { transform: 'scale(0.85)', opacity: '0' },
          '70%': { transform: 'scale(1.04)' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'star-bounce': {
          '0%, 100%': { transform: 'translateY(0) scale(1)' },
          '40%': { transform: 'translateY(-10px) scale(1.2)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        'grow-up': {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'pop-in': 'pop-in 200ms ease-out',
        'star-bounce': 'star-bounce 600ms ease-in-out infinite',
        wiggle: 'wiggle 400ms ease-in-out infinite',
        'grow-up': 'grow-up 240ms ease-out',
      },
    },
  },
  plugins: [],
};
