/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{vue,js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      // 工业风配色：深色基底 + 高对比度警示色
      colors: {
        // 船端工业风主色板
        industrial: {
          50:  '#f5f7fa',
          100: '#e4e7ed',
          200: '#c0c4cc',
          300: '#909399',
          400: '#606266',
          500: '#303133',
          600: '#1f2a3a',
          700: '#16202e',
          800: '#0f1825',
          900: '#0b1220'
        },
        // 状态语义色（高对比度）
        status: {
          normal:   '#10b981', // 正常 - 绿
          warning:  '#f59e0b', // 预警 - 琥珀
          danger:   '#ef4444', // 异常 - 红
          offline:  '#64748b', // 离线 - 灰
          running:  '#3b82f6', // 运行中 - 蓝
          repaired: '#8b5cf6'  // 已修复 - 紫
        },
        // 警示黄（工业设备常用）
        caution: {
          DEFAULT: '#fbbf24',
          dark:    '#b45309'
        }
      },
      fontFamily: {
        sans: ['"Microsoft YaHei"', '"PingFang SC"', 'system-ui', 'sans-serif'],
        mono: ['"Consolas"', '"Monaco"', 'monospace']
      },
      fontSize: {
        // 大按钮、大字体适配船端设备
        'control': ['16px', { lineHeight: '1.5', fontWeight: '600' }],
        'control-lg': ['20px', { lineHeight: '1.4', fontWeight: '700' }]
      },
      boxShadow: {
        'industrial': '0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'glow-danger': '0 0 12px rgba(239,68,68,0.6)',
        'glow-normal': '0 0 8px rgba(16,185,129,0.4)'
      }
    }
  },
  plugins: []
}
