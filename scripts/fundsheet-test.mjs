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
await page.goto(`http://localhost:${PORT}/#/meeting/3`)
await page.evaluate(([Y, a, b]) => {
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([
    { id: 'f1', date: a, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 },
    { id: 'f2', date: b, typeId: 'tt4', amount: 5000, method: 'transfer', source: 'manual', updated: 1 },
  ]))
}, [Y, iso(w1), iso(sun)])
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt4`); await page.reload()
  const tabs = await page.getByRole('tab').allInnerTexts()
  must(/รับ/.test(tabs[0]) && /จ่าย/.test(tabs[1]) && /ใบกองทุน/.test(tabs[2]), 'tab order รับ · จ่าย · ใบกองทุน: ' + tabs.join('|'))
  await page.getByRole('tab', { name: /ใบกองทุน/ }).click()
  const tin = await page.locator('table[aria-label$="ใบรับ (A4)"]').innerText()
  const tout = await page.locator('table[aria-label$="ใบจ่าย (A4)"]').innerText()
  must(/ยอดตั้งต้น/.test(tin) && tin.indexOf('ยอดตั้งต้น') < tin.indexOf('120') && /170/.test(tin), 'opening row first, then lines with running balance 120 → 170: ' + tin)
  must(/รวมจ่ายทั้งสิ้น/.test(tout), 'expense sheet present: ' + tout)
  must(/เงินคงเหลือกองทุน/.test(await page.locator('body').innerText()), 'balance summary')
  must(await page.getByRole('button', { name: /ดาวน์โหลด PDF ใบกองทุน/ }).isVisible(), 'download button')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundsheet-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
