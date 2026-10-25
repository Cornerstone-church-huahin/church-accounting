// แฟ้ม/ใบของสัปดาห์หนึ่ง มีเฉพาะรายการ (และรูป) ของสัปดาห์นั้น ไม่ดึงสัปดาห์อื่น/โซนกองทุนมาปน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4206
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7)); sun.setHours(12)
const at = (n) => { const d = new Date(sun); d.setDate(d.getDate() + n); return iso(d) }
const Y = sun.getFullYear()
await page.goto(`http://localhost:${PORT}/#/`)
await page.evaluate(async ([Y, days]) => {
  const png = await new Promise((res) => { const c = document.createElement('canvas'); c.width = 40; c.height = 30; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 40, 30); c.toBlob(res, 'image/png') })
  const db = await new Promise((res) => { const r = indexedDB.open('acct-images', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result) })
  await new Promise((res) => { const t = db.transaction('img', 'readwrite'); for (let i = 0; i < 6; i++) t.objectStore('img').put(png, `attachments/w${i}.png`); t.oncomplete = res })
  const ph = (i) => ({ path: `attachments/w${i}.png`, name: 'w.png' })
  const D = (n) => days[String(n)]
  const inc = [
    { id: 'i-prev', date: D(-7), typeId: 'tt1', amount: 111100, method: 'cash', source: 'manual', updated: 1, photos: [ph(0)] },
    { id: 'i-mon', date: D(-6), typeId: 'tt1', amount: 222200, method: 'cash', source: 'manual', updated: 2, photos: [ph(1)] },
    { id: 'i-sun', date: D(0), typeId: 'tt2', amount: 333300, method: 'cash', source: 'manual', updated: 3, photos: [ph(2)] },
    { id: 'i-next', date: D(1), typeId: 'tt1', amount: 444400, method: 'cash', source: 'manual', updated: 4, photos: [ph(3)] },
    { id: 'i-fund', date: D(-3), typeId: 'tt9', amount: 666600, method: 'transfer', source: 'manual', updated: 5, fz: true, photos: [ph(4)] },
  ]
  const exp = (id, n, desc, amt, i) => ({ id, channel: 'manual', date: D(n), amount: amt, desc, status: 'paid', method: 'cash', updated: 10, ...(i === undefined ? {} : { file: ph(i) }) })
  const years = [...new Set([-7, -6, 0, 1].map((n) => Number(D(n).slice(0, 4))))]
  for (const y of years) localStorage.setItem(`acct.income.${y}.v1`, JSON.stringify(inc.filter((x) => x.date.startsWith(String(y)))))
  const ex = [exp('e-prev', -7, 'รายจ่ายสัปดาห์ก่อน', 11100, 0), exp('e-mon', -6, 'รายจ่ายวันจันทร์', 22200, 1), exp('e-sun', 0, 'รายจ่ายวันอาทิตย์', 33300, 2), exp('e-next', 1, 'รายจ่ายสัปดาห์หน้า', 44400, 3),
    { ...exp('e-fund', -2, 'รายจ่ายกองทุน', 55500, 4), fundId: 'tt9' }]
  for (const y of years) localStorage.setItem(`acct.expenses.${y}.v1`, JSON.stringify(ex.filter((x) => x.date.startsWith(String(y)))))
}, [Y, Object.fromEntries([-7, -6, -3, -2, 0, 1].map((n) => [String(n), at(n)]))])
try {
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  await page.getByRole('tab', { name: /แฟ้มประจำสัปดาห์/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('figure img').length >= 1, null, { timeout: 15000 })
  await page.waitForTimeout(800)
  const txt = (await page.locator('.a4page').allInnerTexts()).join('\n')
  const cap = (await page.locator('figcaption').allInnerTexts()).join('\n')
  const shown = (s) => txt.includes(s) || cap.includes(s)
  must(shown('รายจ่ายวันจันทร์') && shown('รายจ่ายวันอาทิตย์'), 'this week (Mon–Sun) is there: ' + txt.slice(0, 300))
  must(!shown('รายจ่ายสัปดาห์ก่อน') && !shown('รายจ่ายสัปดาห์หน้า') && !shown('รายจ่ายกองทุน'), 'no other week / fund expenses')
  must(/2,222/.test(txt) && /3,333/.test(txt) && !/1,111/.test(txt) && !/4,444/.test(txt) && !/6,666/.test(txt), 'income rows only from this week and not the fund zone')
  const nImg = await page.locator('figure img').count()
  must(nImg === 4, 'photos: 2 expenses + 2 incomes of this week only: ' + nImg)
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('weekonly-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
