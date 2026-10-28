// ห้องทำงาน: เลขแท็บ+ชื่ออยู่แถวเดียว · ตัววัด % ของแต่ละช่อง = แท็บที่ตั้งชื่อแล้ว ÷ 6
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4194
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  const tiles = page.locator('.hubgrid a.btile')
  must(await tiles.count() === 18, '18 tiles')
  const same = await page.evaluate(() => [...document.querySelectorAll('.hubgrid .btile__top')].every((t) => { const a = t.querySelector('small').getBoundingClientRect(), b = t.querySelector('b').getBoundingClientRect(); return Math.abs((a.top + a.height / 2) - (b.top + b.height / 2)) < 4 }))
  must(same, 'number and name share one row on every tile')
  const pct = async (n) => (await tiles.nth(n - 1).locator('.btile__pct').innerText()).trim()
  must(await pct(1) === '50%' && await pct(3) === '100%' && await pct(4) === '33%' && await pct(14) === '17%' && await pct(5) === '0%' && await pct(15) === '0%', 'percentages: 1=50 3=100 4=33 14=17 5=0')
  must(await tiles.nth(0).locator('.btile__meter i').evaluate((e) => Math.round(e.getBoundingClientRect().width / e.parentElement.getBoundingClientRect().width * 100)) === 50, 'bar fill 50%')
  must(/พัฒนาแล้ว 3 จาก 6/.test(await tiles.nth(0).getAttribute('aria-label')), 'aria label')
  const fit = await page.evaluate(() => [...document.querySelectorAll('.hubgrid .btile')].every((t) => t.scrollHeight <= t.clientHeight + 1 && t.scrollWidth <= t.clientWidth + 1))
  must(fit, 'content fits each tile')
  console.log('hubmeter-test OK')
} finally { await browser.close(); server.kill() }
