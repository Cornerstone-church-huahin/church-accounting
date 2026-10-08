import { chromium } from 'playwright'
import fs from 'fs'
const svg = fs.readFileSync('public/icon.svg', 'utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }).catch(() => chromium.launch())
for (const s of [192, 512]) {
  const p = await b.newPage({ viewport: { width: s, height: s } })
  await p.setContent(`<body style="margin:0;background:#1A2B4C">${svg.replace('rx="112"', 'rx="0"').replace('<svg ', `<svg width="${s}" height="${s}" `)}</body>`)
  await p.screenshot({ path: `public/icon-${s}.png` })
}
await b.close()
