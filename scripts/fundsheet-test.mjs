// ใบกองทุน: ใบต่อเนื่องใบเดียว — เงินถวายกองทุนของแต่ละสัปดาห์ต่อเป็นแถวถัดไป พร้อมยอดสะสม
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const w1 = new Date(sun); w1.setDate(w1.getDate() - 7)
const Y = sun.getFullYear()
await page.goto(`http://localhost:${PORT}/#/`)
await page.evaluate(([Y, a, b]) => {
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([
    { id: 'f1', date: a, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 },
    { id: 'f2', date: b, typeId: 'tt4', amount: 5000, method: 'transfer', source: 'manual', updated: 1 },
  ]))
}, [Y, iso(w1), iso(sun)])
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt4`); await page.reload()
  const t = await page.locator('table[aria-label^="ใบกองทุน"]').first().innerText()
  must(/ยอดตั้งต้น/.test(t), 'opening row: ' + t)
  must((t.match(/เงินถวายเข้ากองทุน/g) ?? []).length === 2, 'one row per week continues on the same sheet: ' + t)
  must(/120/.test(t) && /50/.test(t) && /170/.test(t), 'running balance 120 → 170: ' + t)
  must(await page.getByRole('button', { name: /ดาวน์โหลด PDF ใบกองทุน/ }).isVisible(), 'download button')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundsheet-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
