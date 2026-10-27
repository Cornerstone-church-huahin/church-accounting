// เงินถวายกองทุนในสัปดาห์: รายรับหมุนเวียนไม่นับ · ขึ้นแถวรายจ่ายชื่อกองทุนเดียวกันทันที · ท้ายใบมีแถว "จำนวนที่ต้องเบิก": npm run build && node scripts/fundflow-test.mjs
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
const add = async (type, cash) => {
  await page.locator('#mi-type').selectOption({ label: type })
  await page.locator('.entryrow .field', { hasText: 'เงินสด (บาท)' }).locator('input').fill(String(cash))
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
}
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await add('ประจำสัปดาห์', 1000)
  await add('กองทุนเพื่อที่ดินคริสตจักร', 500)
  const circ = (await page.getByLabel('ใบบันทึกการถวาย รายรับเงินหมุนเวียน (A4)').first().innerText()).replace(/\s+/g, ' ')
  const fund = (await page.getByLabel('ใบบันทึกการถวาย รายรับเงินกองทุน (A4)').first().innerText()).replace(/\s+/g, ' ')
  must(/ประจำสัปดาห์/.test(circ) && !/กองทุนเพื่อที่ดิน/.test(circ), 'circulating sheet has no fund row: ' + circ.slice(0, 200))
  must(/กองทุนเพื่อที่ดินคริสตจักร/.test(fund) && !/ประจำสัปดาห์ 1/.test(fund), 'fund sheet has the fund row only: ' + fund.slice(0, 200))
  const all = (await page.locator('.a4page').allInnerTexts()).join(' ').replace(/\s+/g, ' ')
  must(/ยอดรวมทั้งตู้ถวาย \(หมุนเวียน \+ กองทุน\) 1,500/.test(all), 'grand total of the whole box 1,500: ' + all.slice(-300))
  console.log('offering-split OK')
} finally { await browser.close(); server.kill() }
if (errors.length) { console.log(errors); process.exit(1) }
