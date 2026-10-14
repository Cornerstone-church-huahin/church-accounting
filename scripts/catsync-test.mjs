// รายการรับ/จ่ายในป๊อปอัพแก้ไขแถวกับในตั้งค่าเป็นชุดเดียวกัน (เพิ่ม/ลบ/ย้ายไปรายจ่าย): npm run build && node scripts/catsync-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4183
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  // รับ: เพิ่มประเภทจากป๊อปอัพแก้ไขแถว
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('table', { name: /ใบบันทึกการถวาย \(A4 แนวนอน\)/ }).locator('tbody tr').nth(0).click()
  const opts0 = await page.locator('#ire-type option').allInnerTexts()
  must(opts0.length === 9, 'popup lists every income type like settings: ' + opts0.join('|'))
  await page.locator('summary', { hasText: /ประเภท \(/ }).click()
  await page.getByLabel('ชื่อประเภทใหม่').fill('ถวายซ่อมรถตู้')
  await page.getByRole('button', { name: '＋ เพิ่ม' }).click()
  must((await page.locator('#ire-type option:checked').innerText()) === 'ถวายซ่อมรถตู้', 'new type from popup is selected')
  // พิมพ์ชื่อใหม่ในช่อง "รายการ" ของป๊อปอัพ (ไม่มีในตัวเลือก) → สร้างเป็นประเภทปกติ + บันทึกแถว
  await page.locator('#ire-label').fill('ถวายค่าไฟ')
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('300')
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  must((await page.getByRole('table', { name: /ใบบันทึกการถวาย \(A4 แนวนอน\)/ }).innerText()).includes('ถวายค่าไฟ'), 'typed new item saved as a row on the sheet')
  await page.goto(`http://localhost:${PORT}/#/settings`)
  await page.getByText(/🙏 รายการรับ/).click()
  must((await page.locator('#h-types').locator('xpath=ancestor::details[1]').innerText()).includes('ถวายค่าไฟ'), 'typed item joins the normal income list in settings')
  must((await page.locator('#h-types').locator('xpath=ancestor::details[1]').innerText()).includes('ถวายซ่อมรถตู้'), 'type from popup appears in settings')
  // ตั้งค่า: ย้ายไปรายจ่าย
  await page.getByRole('button', { name: 'ย้าย ถวายซ่อมรถตู้ ไปรายการจ่าย' }).click()
  await page.getByText(/🧾 รายการจ่าย/).click()
  must((await page.locator('#h-ecat').locator('xpath=ancestor::details[1]').innerText()).includes('ถวายซ่อมรถตู้'), 'moved item shows under expense list')
  await page.getByText(/🙏 รายการรับ/).scrollIntoViewIfNeeded()
  must((await page.getByRole('button', { name: 'ลบ ถวายซ่อมรถตู้' }).count()) === 1, 'moved item exists only once in settings (expense side)')
  // จ่าย: ป๊อปอัพแถวมีรายการนั้น และเพิ่มจากป๊อปอัพได้
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await page.getByRole('table', { name: /ใบเบิก-จ่ายเงินสด \(A4\)/ }).locator('tbody tr').nth(0).click()
  must((await page.locator('#ere-item option', { hasText: 'ถวายซ่อมรถตู้' }).count()) === 1, 'expense popup has the moved item')
  await page.locator('summary', { hasText: /รายการจ่าย \(/ }).click()
  await page.getByLabel('ชื่อรายการจ่ายใหม่').fill('ซ่อมรถตู้')
  await page.getByRole('button', { name: '＋ เพิ่ม' }).click()
  must((await page.locator('#ere-item option:checked').innerText()) === 'ซ่อมรถตู้', 'new expense item from popup is selected')
  must((await page.locator('#ere-desc').inputValue()) === 'ซ่อมรถตู้', 'description filled with the new item')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('CATSYNC OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
