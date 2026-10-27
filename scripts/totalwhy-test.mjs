// หน้า รวมเงินสด: กล่อง "ทำไมรวมเงินสดถึงเป็นยอดนี้" อธิบายด้วยตัวเลขจริง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4197
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/balance/total`)
  await page.evaluate(() => localStorage.setItem('acct.opening.v1', JSON.stringify([{ id: 'opening', updated: 1, date: '2026-01-01', own: 1326570, funds: {} }])))
  await page.reload(); await page.waitForLoadState('networkidle')
  const box = page.getByLabel('ทำไมรวมเงินสดถึงเป็นยอดนี้')
  const t = (await box.innerText()).replace(/\s+/g, ' ')
  const big = (await page.locator('.bigfig').first().innerText()).replace(/ บาท/, '').trim()
  must(big === '13,265.70', 'seeded total shown: ' + big)
  must(t.includes(big), 'explanation quotes the same total as the big figure: ' + big + ' / ' + t)
  must(/เงินหมุนเวียนมาจากไหน/.test(t) && /เงินกองทุนมาจากไหน/.test(t) && /ไม่ทำให้ยอดรวมเปลี่ยน/.test(t) && /ภาระที่ดินไม่นับ/.test(t), 'all explanation steps')
  await page.screenshot({ path: 'shots/totalwhy.png', fullPage: true })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('totalwhy-test OK')
} finally { await browser.close(); server.kill() }
