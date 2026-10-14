// เงินถวายกองทุนในสัปดาห์: รายรับหมุนเวียนไม่นับ · ขึ้นแถวรายจ่ายชื่อกองทุนเดียวกันทันที · ท้ายใบมีแถว "จำนวนที่ต้องเบิก": npm run build && node scripts/fundflow-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4184
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
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await add('ประจำสัปดาห์', 1000)
  await add('ขอบพระคุณ', 1000)
  await add('กองทุนเพื่อที่ดินคริสตจักร', 500)
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  const sheet = (await page.getByLabel('ใบเบิก-จ่ายเงินสด (A4)').first().innerText()).replace(/\s+/g, ' ')
  must(/กองทุนเพื่อที่ดินคริสตจักร 500/.test(sheet), 'fund income shows as an expense row with the same name: ' + sheet.slice(0, 300))
  const box = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/เงินหมุนเวียน 2,000/.test(box) && /กองทุน 500/.test(box) && /รวมรับทั้งสิ้น 2,500/.test(box), 'box 1 separates circulating 2,000 from fund 500: ' + box)
  must(/เงินหมุนเวียน \(คงอยู่ในระบบ\) 2,000/.test(box) && /กองทุน · กองทุนเพื่อที่ดินคริสตจักร 500/.test(box) && /รวมทั้งสิ้น 2,500/.test(box.split('②')[1] ?? ''), 'box 2 shows circulating 2,000 + fund 500 = 2,500: ' + box)
  const wd = (await page.getByLabel('จำนวนที่ต้องเบิก').first().innerText()).replace(/\s+/g, ' ')
  must(/กองทุน · กองทุนเพื่อที่ดินคริสตจักร 500/.test(wd) && /รวมที่ต้องเบิก 500/.test(wd), 'withdrawal row lists the fund and total 500: ' + wd)
  // วางบิลที่รอจ่ายรวมเข้ากับกองทุน
  await page.getByRole('tab', { name: /วางบิล/ }).click()
  await page.getByRole('button', { name: '✍️ กรอกเอง (ไม่มีรูป)' }).click()
  await page.locator('#e-desc').fill('ค่าไฟ')
  await page.locator('#e-amt').fill('1200')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  const wd2 = (await page.getByLabel('จำนวนที่ต้องเบิก').first().innerText()).replace(/\s+/g, ' ')
  must(/บิล\/สำรองจ่าย · ค่าไฟ 1,200/.test(wd2) && /รวมที่ต้องเบิก 1,700/.test(wd2), 'pending bill joins the withdrawal total (500 + 1,200): ' + wd2)
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('FUNDFLOW OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
