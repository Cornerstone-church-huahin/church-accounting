// ทดสอบการเพิ่ม/ลบกองทุนและยอดตั้งต้นในหน้าตั้งค่า: npm run build && node scripts/funds-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4177
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForLoadState('networkidle')
  await page.getByText('📌 ยอดยกมา (ตั้งต้น)').click()
  const card = page.locator('details.fold', { hasText: 'เงินแต่ละกองทุน' })
  must(await card.getByText('กองทุนศึกษา').first().isVisible(), 'default study fund listed')
  // ลบกองทุนตั้งต้น (ที่ยังไม่เคยแก้) ต้องหายจริง
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'ลบกองทุน กองทุนสุสาน' }).click()
  await page.getByText('ลบกองทุน “กองทุนสุสาน” แล้ว').waitFor()
  must((await page.getByRole('button', { name: 'ลบกองทุน กองทุนสุสาน' }).count()) === 0, 'default fund deleted')
  // เพิ่มกองทุนใหม่ + ใส่เงินตั้งต้น
  await page.getByLabel('ชื่อกองทุนใหม่').fill('กองทุนเยาวชน')
  await page.getByRole('button', { name: /เพิ่มกองทุน/ }).click()
  await page.getByText(/เพิ่มกองทุน “กองทุนเยาวชน” แล้ว/).waitFor()
  await page.getByLabel('ชื่อกองทุนใหม่').fill('กองทุนเยาวชน')
  await page.getByRole('button', { name: /เพิ่มกองทุน/ }).click()
  await page.getByText('มี “กองทุนเยาวชน” อยู่แล้ว').waitFor()
  await card.locator('.field', { hasText: 'กองทุนเยาวชน' }).first().locator('input').fill('5000')
  await card.locator('.field', { hasText: 'เงินหมุนเวียน' }).locator('input').fill('2000')
  await page.getByText(/รวมเงินตั้งต้นทั้งหมด 7,000/).waitFor()
  // แก้ชื่อกองทุน → ใช้ชื่อเดียวกันในการ์ดรายการรับและรายการในฟอร์มรับเงิน
  page.once('dialog', (d) => d.accept('กองทุนเพื่อการศึกษา'))
  await page.getByRole('button', { name: 'แก้ชื่อกองทุน กองทุนศึกษา' }).click()
  await page.getByText(/เปลี่ยนชื่อเป็น “กองทุนเพื่อการศึกษา” แล้ว/).waitFor()
  must(await card.getByText('กองทุนเพื่อการศึกษา').first().isVisible(), 'renamed fund shown in opening card')
  // ตั้งประเภทรับธรรมดาเป็นกองทุน → โผล่ในรายการกองทุนทันที
  await page.getByText(/รายการรับที่ยังไม่ใช่กองทุน/).click()
  await page.getByRole('button', { name: 'ตั้ง ขอบพระคุณ เป็นกองทุน' }).click()
  await page.getByRole('button', { name: 'ลบกองทุน ขอบพระคุณ' }).waitFor()
  page.once('dialog', (d) => d.dismiss())
  await page.getByRole('button', { name: 'ลบกองทุน ขอบพระคุณ' }).click()
  await page.getByText(/^🙏 รายการรับ/).click()
  must(await page.locator('li', { hasText: 'กองทุนเพื่อการศึกษา' }).first().isVisible(), 'renamed fund shown in รายการรับ card')
  // รีโหลดแล้วต้องไม่ผุดกลับ
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByText('📌 ยอดยกมา (ตั้งต้น)').click()
  must((await page.getByRole('button', { name: 'ลบกองทุน กองทุนสุสาน' }).count()) === 0, 'deleted fund stays deleted after reload')
  must(await page.getByRole('button', { name: 'ลบกองทุน กองทุนเยาวชน' }).isVisible(), 'new fund persists')
  // ลบ/แก้ชื่อประเภทจากฟอร์มรับเงินโดยตรง (ตัวเลือกแบบเลื่อนลงใส่ปุ่มไม่ได้)
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /💚 รับ/ }).click(); await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByText(/ประเภทที่ไม่ใช้/).click()
  must((await page.locator('#mi-type option', { hasText: 'อาหารวันอาทิตย์' }).count()) === 1, 'food type present before delete')
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'ลบประเภท อาหารวันอาทิตย์' }).click()
  await page.waitForFunction(() => ![...document.querySelectorAll('#mi-type option')].some((o) => o.textContent === 'อาหารวันอาทิตย์'))
  page.once('dialog', (d) => d.accept('ประจำสัปดาห์ใหม่'))
  await page.getByRole('button', { name: 'แก้ชื่อ ประจำสัปดาห์' }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('#mi-type option')].some((o) => o.textContent === 'ประจำสัปดาห์ใหม่'))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('FUNDS OK')
} finally { await browser.close(); server.kill() }
