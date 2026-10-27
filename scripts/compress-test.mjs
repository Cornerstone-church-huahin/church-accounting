// มาตรฐานบีบรูปแนบ: ภาพใหญ่/มีลวดลายมาก ต้องออกมา ≤ ~350KB, ด้านยาว ≤ 1600px, เป็น JPEG · ภาพเล็กไม่ถูกขยาย
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4200
const server = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 5000))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext()).newPage()
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/`)
  const r = await page.evaluate(async () => {
    const { compressImage } = await import('/src/lib/image.ts')
    const make = async (w, h, noisy) => {
      const c = document.createElement('canvas'); c.width = w; c.height = h
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, w, h)
      if (noisy) { const id = x.getImageData(0, 0, w, h); for (let i = 0; i < id.data.length; i += 4) { id.data[i] = Math.random() * 255; id.data[i + 1] = Math.random() * 255; id.data[i + 2] = Math.random() * 255 } x.putImageData(id, 0, 0) }
      else { x.fillStyle = '#333'; x.font = '60px sans-serif'; x.fillText('slip 2,000.00', 50, 200) }
      return new File([await new Promise((res) => c.toBlob(res, 'image/png'))], 'a.png', { type: 'image/png' })
    }
    const out = {}
    for (const [k, w, h, n] of [['noisy', 3000, 2000, true], ['slip', 1080, 2400, false]]) {
      const { data, ext } = await compressImage(await make(w, h, n))
      const bmp = await createImageBitmap(new Blob([data], { type: 'image/jpeg' }))
      out[k] = { bytes: data.byteLength, ext, w: bmp.width, h: bmp.height }
    }
    return out
  })
  console.log(JSON.stringify(r))
  must(r.slip.ext === 'jpg' && r.slip.bytes < 350000 && Math.max(r.slip.w, r.slip.h) === 1600, 'slip screenshot → jpeg ≤350KB, long side 1600')
  must(r.noisy.bytes <= 350000 * 1.15 && Math.max(r.noisy.w, r.noisy.h) <= 1600 && Math.max(r.noisy.w, r.noisy.h) >= 1200, 'noisy photo squeezed near target without dropping below 1200px: ' + JSON.stringify(r.noisy))
  console.log('compress-test OK')
} finally { await browser.close(); server.kill() }
