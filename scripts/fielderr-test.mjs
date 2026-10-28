// กรอบแดงทั้งแอป: บันทึกไม่ผ่านแล้วช่องที่ผิดเป็นกรอบแดง + ข้อความใต้ช่อง · แก้แล้วกรอบหาย (ฟอร์มเอกสาร · แผนงาน)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4203
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const invalid = async (sel) => (await page.locator(sel).getAttribute('aria-invalid')) === 'true'
const red = async (sel) => page.locator(sel).evaluate((e) => getComputedStyle(e).borderColor)
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/1`); await page.waitForLoadState('networkidle')
  // ฟอร์มเอกสาร: ยังไม่เลือกไฟล์
  await page.getByRole('link', { name: /คลังเอกสาร/ }).click()
  await page.getByRole('button', { name: /เพิ่มเอกสาร/ }).click()
  // ลืมหลายช่องพร้อมกัน → แดงพร้อมกันทุกช่อง (ชื่อ + ไฟล์ + เลขที่ + วันที่)
  await page.locator('#df-no').fill(''); await page.locator('#df-date').fill('')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.locator('#df-title[aria-invalid=true]').waitFor({ timeout: 3000 })
  for (const id of ['#df-file', '#df-no', '#df-date']) must(await invalid(id), `${id} is red at the same time`)
  must(await page.locator('.field-err').count() === 4, 'four messages under four fields: ' + await page.locator('.field-err').count())
  must(/ตรงกับไฟล์/.test(await page.locator('label[for=df-date]').innerText()) && /ใส่\/เช็ค เลขที่เอกสาร/.test(await page.locator('label[for=df-no]').innerText()), 'new labels')
  await page.locator('#df-no').fill('X.001'); await page.locator('#df-date').fill('2026-03-01')
  await page.locator('#df-title').fill('หนังสือทดสอบ')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.locator('#df-file[aria-invalid=true]').waitFor({ timeout: 3000 })
  must(await page.locator('.field-err').first().isVisible() && /เลือกไฟล์/.test(await page.locator('.field-err').first().innerText()), 'file field shows red message under it')
  must(/192, 38, 27|179, 38, 30|rgb\(1[0-9]{2}/.test(await red('#df-file')), 'border is red: ' + await red('#df-file'))
  // เลือกไฟล์ → กรอบแดงหาย
  await page.locator('#df-file').setInputFiles({ name: 'a.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') })
  must(!(await invalid('#df-file')) && await page.locator('.field-err').count() === 0, 'red mark clears after choosing a file')
  // ชื่อเอกสารว่าง
  await page.locator('#df-title').fill('')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.locator('#df-title[aria-invalid=true]').waitFor({ timeout: 3000 })
  must(!(await invalid('#df-file')), 'only the problem field is red')
  await page.locator('#df-title').fill('x')
  must(!(await invalid('#df-title')), 'typing clears the red border')
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก' }).click()
  // แผนงานประจำปี: รายละเอียดว่าง
  await page.goto(`http://localhost:${PORT}/#/meeting/1/2`); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /เพิ่มกิจกรรม/ }).click()
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.locator('#ap-t[aria-invalid=true]').waitFor({ timeout: 3000 })
  await page.locator('#ap-d').fill('')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.waitForTimeout(300)
  must(await invalid('#ap-t') && await invalid('#ap-d'), 'plan: title and date both red together')
  must(/ใส่รายละเอียด/.test(await page.locator('.field-err').first().innerText()), 'annual plan: description field red with message')
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด', exact: true }).click()
  await page.screenshot({ path: 'shots/fielderr.png' })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fielderr-test OK')
} finally { await browser.close(); server.kill() }
