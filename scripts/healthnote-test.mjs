import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4196
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
})
try {
  for (const n of [1, 2, 8]) {
    await page.goto(`http://localhost:${PORT}/#/meeting/${n}/health`); await page.reload()
    const note = page.getByRole('note', { name: /อยู่ระหว่างพัฒนา/ })
    await note.waitFor({ timeout: 8000 })
    const t = await note.innerText()
    must(/95%/.test(t) && /1 มกราคม 2570/.test(t), `room ${n}: ${t}`)
    const noteY = (await note.boundingBox()).y, h1Y = (await page.getByRole('heading', { name: /สถานะการเงิน/ }).boundingBox()).y
    must(noteY > h1Y && noteY < 200, `note directly under title (room ${n})`)
    if (process.env.SHOT && n === 8) await page.screenshot({ path: process.env.SHOT })
  }
  console.log('healthnote-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
