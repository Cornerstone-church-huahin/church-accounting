import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// base './' ทำให้ build เปิดได้ทั้งบนโดเมนหลักและในโฟลเดอร์ย่อย (GitHub Pages)
export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'บัญชีคริสตจักร',
        short_name: 'บัญชีคริสตจักร',
        description: 'บันทึกรายรับ งบประมาณ การนับเงินวันอาทิตย์ ใบเบิกจ่าย และรายงานของคริสตจักร',
        lang: 'th',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#F9F8F5',
        theme_color: '#1A2B4C',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      // cache เฉพาะตัวแอป ห้าม cache ข้อมูลบัญชี/รูปใบเสร็จ (ต้องมาจาก repo ข้อมูลเท่านั้น)
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png}'], navigateFallback: 'index.html' },
    }),
  ],
  test: { include: ['src/**/*.test.ts'] },
})
