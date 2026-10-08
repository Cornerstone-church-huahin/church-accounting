import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/tokens.css'
import './styles/app.css'

try { const sc = localStorage.getItem('acct.scale'); if (sc) document.documentElement.dataset.scale = sc } catch { /* ignore */ }

// ติดตั้ง Service Worker (ใช้ได้เมื่อเปิดผ่าน HTTPS) — ถ้าไม่รองรับก็ข้ามไปเงียบ ๆ
if (!import.meta.env.VITE_EMBED) import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true })).catch(() => {})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
