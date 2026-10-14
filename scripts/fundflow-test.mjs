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
  must(/เงินหมุนเวียน 2,000 กองทุน · กองทุนเพื่อที่ดินคริสตจักร 500 รวมรับทั้งสิ้น 2,500/.test(box), 'box 1: circulating 2,000 then the fund by name 500, total 2,500: ' + box)
  const wd = (await page.getByLabel('ต้องเบิก', { exact: true }).first().innerText()).replace(/\s+/g, ' ')
  must(/กองทุน · กองทุนเพื่อที่ดินคริสตจักร 500/.test(wd) && /รวมต้องเบิก 500/.test(wd), 'withdrawal row lists the fund and total 500: ' + wd)
  // รายจ่ายหมุนเวียน 500 ที่ใส่ชื่อในช่อง รอจ่าย → รวมจ่าย 1,000 (หมุนเวียน 500 + กองทุน 500) · ที่ต้องเบิก 1,000
  await page.locator('.entryrow .field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('500')
  await page.locator('summary', { hasText: /ชื่อ \(/ }).click()
  await page.getByLabel('ชื่อชื่อใหม่').fill('อ.กฤต')
  await page.getByLabel('ชื่อชื่อใหม่').locator('xpath=ancestor::details[1]').getByRole('button', { name: '＋ เพิ่ม' }).click()
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
  const box2 = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/รายจ่ายหมุนเวียน 500/.test(box2) && /กองทุน · กองทุนเพื่อที่ดินคริสตจักร 500 รวมจ่ายทั้งสิ้น 1,000/.test(box2), 'box 2: circulating expense 500 + fund 500 = 1,000: ' + box2)
  const wd1 = (await page.getByLabel('ต้องเบิก', { exact: true }).first().innerText()).replace(/\s+/g, ' ')
  must(/รอจ่าย · .* 500/.test(wd1) && /รวมต้องเบิก 1,000/.test(wd1), 'withdraw = fund 500 + waiting 500 = 1,000: ' + wd1)
  // ค่าซ่อม 830 ที่ไม่มีชื่อรอจ่าย/ไม่มีบิล = จ่ายจริงแล้ว ไม่ต้องเบิก → ต้องเบิกยัง 1,000 · รวมจ่าย 1,830
  await page.locator('.entryrow .field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('830')
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
  const wd1b = (await page.getByLabel('ต้องเบิก', { exact: true }).first().innerText()).replace(/\s+/g, ' ')
  const box3 = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/รวมต้องเบิก 1,000/.test(wd1b) && /รวมจ่ายทั้งสิ้น 1,830/.test(box3) && !/ค้างจ่าย/.test(box3), 'paid expense without bill is not in ต้องเบิก (1,000) while total out is 1,830, no ค้างจ่าย row: ' + wd1b + ' | ' + box3)
  await page.screenshot({ path: 'shots/fundflow-sheet.png', fullPage: true })
  // วางบิลที่รอจ่ายรวมเข้ากับกองทุน
  await page.getByRole('tab', { name: /วางบิล/ }).click()
  await page.getByRole('button', { name: '✍️ กรอกเอง (ไม่มีรูป)' }).click()
  await page.locator('#e-desc').fill('ค่าไฟ')
  await page.locator('#e-amt').fill('1200')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  const wd2 = (await page.getByLabel('ต้องเบิก', { exact: true }).first().innerText()).replace(/\s+/g, ' ')
  must(/รอจ่าย · ค่าไฟ 1,200/.test(wd2) && /รวมต้องเบิก 2,200/.test(wd2), 'pending bill joins the withdrawal total (1,000 + 1,200): ' + wd2)
  // แตะแถวในใบ → แนบรูปบิล/สลิปเป็นหลักฐานได้
  await page.getByLabel('ใบเบิก-จ่ายเงินสด (A4)').first().locator('tbody tr').nth(0).click()
  must(await page.locator('#ere-file').count() === 1, 'row editor has the evidence image input')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('FUNDFLOW OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
