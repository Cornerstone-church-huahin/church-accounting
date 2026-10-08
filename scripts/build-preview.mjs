// สร้างไฟล์พรีวิวไฟล์เดียว (HTML + CSS + JS รวมกัน) สำหรับเปิดในแผงพรีวิว: npm run build:preview → preview.html
import { build } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
process.env.VITE_EMBED = '1'
const out = 'dist-preview'
await build({
  configFile: false, base: './', plugins: [react()], logLevel: 'warn',
  // ตัวสร้าง PDF และตัวอ่านสลิป (OCR) ใหญ่และต้องมีไฟล์ประกอบ — ไม่รวมในพรีวิวไฟล์เดียว
  resolve: { alias: { html2canvas: path.resolve('scripts/stubs/pdf-stub.mjs'), jspdf: path.resolve('scripts/stubs/pdf-stub.mjs'), 'tesseract.js': path.resolve('scripts/stubs/pdf-stub.mjs') } },
  build: { outDir: out, emptyOutDir: true, modulePreload: false, cssCodeSplit: false, rollupOptions: { output: { format: 'iife', inlineDynamicImports: true } } },
})
const dir = path.join(out, 'assets')
const files = fs.readdirSync(dir)
const css = fs.readFileSync(path.join(dir, files.find((f) => f.endsWith('.css'))), 'utf8')
const js = fs.readFileSync(path.join(dir, files.find((f) => f.endsWith('.js'))), 'utf8').replace(/<\/script/g, '<\\/script')
const html = `<!doctype html>
<html lang="th"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>บัญชีคริสตจักร (พรีวิว)</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Pridi:wght@500;600&family=Sarabun:wght@400;500;700&display=swap">
<style>${css}</style></head>
<body><div id="root"></div><script>${js}</script></body></html>
`
fs.writeFileSync('preview.html', html)
console.log('preview.html', (html.length / 1024).toFixed(0), 'KB')
