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
  must(!/กองทุนเพื่อที่ดินคริสตจักร/.test(sheet), 'fund money is not a row of the circulating expense table: ' + sheet.slice(0, 300))
  const fsheet = (await page.getByLabel('ใบเบิก-จ่ายเงินสด เงินกองทุน (A4)').first().innerText()).replace(/\s+/g, ' ')
  must(/กองทุนเพื่อที่ดินคริสตจักร 500/.test(fsheet) && /เตรียมนำฝาก/.test(fsheet) && /รวมเงินกองทุนเป็นเงินทั้งสิ้น 500/.test(fsheet), 'fund money is its own table (separate sheet): ' + fsheet.slice(0, 300))
  const box = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/รวมรับเงินหมุนเวียน 2,000/.test(box) && !/กองทุนเพื่อที่ดิน/.test(box), 'box 1: circulating 2,000 then the fund by name 500, total 2,500: ' + box)
  const wd = (await page.getByLabel('หมายเหตุ ต้องเบิก').first().innerText()).replace(/\s+/g, ' ')
  must(/กองทุนเพื่อที่ดินคริสตจักร\s+500/.test(wd) && /รวมต้องเบิก\s+500/.test(wd) && !/สำรองจ่ายต้องเบิก|กองทุนต้องเบิก/.test(wd), 'withdrawal row lists the fund and total 500: ' + wd)
  // รายจ่ายหมุนเวียน 500 ที่ใส่ชื่อในช่อง รอจ่าย → รวมจ่าย 1,000 (หมุนเวียน 500 + กองทุน 500) · ที่ต้องเบิก 1,000
  await page.locator('.entryrow .field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('500')
  await page.locator('summary', { hasText: /ชื่อ \(/ }).click()
  await page.getByLabel('ชื่อชื่อใหม่').fill('อ.กฤต')
  await page.getByLabel('ชื่อชื่อใหม่').locator('xpath=ancestor::details[1]').getByRole('button', { name: '＋ เพิ่ม' }).click()
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
  const box2 = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/รวมจ่ายเงินหมุนเวียน 500/.test(box2) && !/กองทุนเพื่อที่ดิน/.test(box2), 'box 2: circulating expense 500 + fund 500 = 1,000: ' + box2)
  const wd1 = (await page.getByLabel('หมายเหตุ ต้องเบิก').first().innerText()).replace(/\s+/g, ' ')
  must(/อ\.กฤต — .* 500/.test(wd1) && /รวมต้องเบิก\s+1,000/.test(wd1), 'withdraw = fund 500 + waiting 500 = 1,000: ' + wd1)
  // ค่าซ่อม 830 ที่ไม่มีชื่อรอจ่าย/ไม่มีบิล = จ่ายจริงแล้ว ไม่ต้องเบิก → ต้องเบิกยัง 1,000 · รวมจ่าย 1,830
  await page.locator('.entryrow .field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('830')
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
  const wd1b = (await page.getByLabel('หมายเหตุ ต้องเบิก').first().innerText()).replace(/\s+/g, ' ')
  const box3 = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/รวมต้องเบิก\s+1,000/.test(wd1b) && /รวมจ่ายเงินหมุนเวียน 1,330/.test(box3) && !/ค้างจ่าย/.test(box3), 'paid expense without bill is not in ต้องเบิก (1,000) while circulating out is 1,330, no ค้างจ่าย row: ' + wd1b + ' | ' + box3)
  must(/สรุปสัปดาห์นี้ 670 สรุปเดือนนี้ 670 สรุปปีนี้ 670/.test(box3) && /เงินหมุนเวียนทั้งหมดปัจจุบัน/.test(box3), 'box 3 rows: current balance, this week, this month, this year (circulating only): ' + box3)
  // หน้าแรก: ช่องหมุนเวียน = เงินหมุนเวียนคงเหลือสะสมทั้งหมด (ไม่รวมกองทุน) + มีบรรทัดบอกที่มา/รุ่นแอป
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click()
  must(/670/.test(await page.locator('.btile--own').innerText()), 'home circulating tile = cumulative circulating balance 670: ' + await page.locator('.btile--own').innerText())
  await page.locator('.stepbtn', { hasText: 'ใบเบิก-จ่ายเงินสด' }).click()
  await page.screenshot({ path: 'shots/fundflow-sheet.png', fullPage: true })
  // วางบิลที่รอจ่ายรวมเข้ากับกองทุน
  await page.getByRole('tab', { name: /วางบิล/ }).click()
  await page.getByRole('button', { name: '✍️ กรอกเอง (ไม่มีรูป)' }).click()
  await page.locator('#e-desc').fill('ค่าไฟ')
  await page.locator('#e-amt').fill('1200')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  const wd2 = (await page.getByLabel('หมายเหตุ ต้องเบิก').first().innerText()).replace(/\s+/g, ' ')
  must(/ค่าไฟ 1,200/.test(wd2) && /รวมต้องเบิก\s+2,200/.test(wd2), 'pending bill joins the withdrawal total (1,000 + 1,200): ' + wd2)
  // สรุป: ใบประกาศแสดงเงินถวายกองทุนแยกไว้ ไม่ปนยอดรายรับ
  await page.getByRole('tab', { name: /สรุป/ }).click()
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  const notice = await page.locator('.a4page').first().innerText()
  must(/เงินถวายกองทุน/.test(notice) && /กองทุนเพื่อที่ดินคริสตจักร/.test(notice) && /500/.test(notice), 'summary notice lists the fund separately: ' + notice.slice(0, 400))
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  // แตะแถวในใบ → แนบรูปบิล/สลิปเป็นหลักฐานได้
  await page.getByLabel('ใบเบิก-จ่ายเงินสด (A4)').first().locator('tbody tr').nth(0).click()
  must(await page.locator('#ere-file').count() === 1, 'row editor has the evidence image input')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('FUNDFLOW OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
