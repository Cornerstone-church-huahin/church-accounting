// ทดสอบแท็บ ปรับ (ใหม่): เลือกสัปดาห์ → แนบ 2 รูป (จำลอง Gemini) รวมเป็นการสแกนเดียว → จับคู่รายรับโอน 2×300 → เงินเข้าที่ไม่ทราบที่มา
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const S = iso(sun), Y = sun.getFullYear()
const day = (n) => { const d = new Date(sun); d.setDate(d.getDate() - n); return iso(d) }
await page.goto(`http://localhost:${PORT}/#/`)
await page.evaluate(([Y, d3, d2]) => {
  const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
  set(`income.${Y}`, [
    { id: 'in1', date: d3, typeId: 'tt1', amount: 30000, method: 'transfer', source: 'slip', updated: 1 },
    { id: 'in2', date: d3, typeId: 'tt1', amount: 30000, method: 'transfer', source: 'slip', updated: 1 },
    { id: 'in3', date: d2, typeId: 'tt1', amount: 77700, method: 'transfer', source: 'slip', updated: 1 },
  ])
  localStorage.setItem('acct.gemini.v1', JSON.stringify({ key: 'TEST', model: 'gemini-flash-latest' }))
}, [Y, day(3), day(2)])
let call = 0
await page.route('**/generativelanguage.googleapis.com/**', (route) => {
  const rows = call++ === 0
    ? [{ date: day(3), code: 'TRD', amount: 300, balance: 1300 }, { date: day(3), code: 'TRD', amount: 300, balance: 1600 }]
    : [{ date: day(3), code: 'TRD', amount: 300, balance: 1600 }, { date: day(1), code: 'TRD', amount: 1234, balance: 2834 }, { date: day(20), code: 'DEP', amount: 5, balance: 9 }]
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rows }) }] } }] }) })
})
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.goto(`http://localhost:${PORT}/#/`); await page.reload()
  await page.getByRole('tab', { name: /ปรับ/ }).first().click()
  must(!(await page.getByText(/ต้องเตรียมเบิก/).count()), 'old content removed')
  must(await page.getByText('ระหว่างวันที่').first().isVisible(), 'week picker shown')
  await page.getByLabel('แนบรูปสมุดบัญชี').setInputFiles(['public/icon-512.png', 'public/icon-512.png'])
  await page.getByLabel('รายการ บรรทัด 3').waitFor({ timeout: 20000 })
  must(!(await page.getByLabel('รายการ บรรทัด 4').count()), 'dup row across photos dropped + out-of-week row skipped (3 rows)')
  await page.getByRole('button', { name: 'บันทึกและจับคู่' }).click()
  must(await page.getByText(/ตรงกัน 2 รายการ/).first().isVisible(), 'two 300 transfers matched')
  must(await page.getByText(/ไม่ทราบที่มา 1 รายการ/).first().isVisible(), 'one unknown deposit')
  must(await page.getByText(/ไม่เจอในสมุด 1 รายการ/).first().isVisible(), 'recorded 777 not in passbook')
  must(await page.getByText(/ผลตรวจ: มีรายการที่ต้องตรวจ/).first().isVisible() && await page.getByRole('button', { name: /แชร์รายงาน/ }).isVisible(), 'report verdict + share button')
  await page.getByLabel(/เปิดรูปสมุด/).first().waitFor({ timeout: 10000 })
  must((await page.getByLabel(/เปิดรูปสมุด/).count()) === 2, 'two scanned photos kept as cards at the bottom')
  await page.goto(`http://localhost:${PORT}/#/income`)
  const ul = page.locator('section[aria-label="รายการรายรับ"]')
  must(/ไม่ทราบที่มา \(Unknown\)/.test(await ul.innerText()) && /1,234\.00/.test(await ul.innerText()), 'income page shows one unknown row with the sum')
  must(/จำนวนรายการ\s*4/.test(await page.locator('.kpi').innerText()), 'count = 3 entries + 1 unknown row: ' + await page.locator('.kpi').innerText())
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('adjust-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
