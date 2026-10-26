// กองทุนที่มีหมวดชื่อกิจกรรมอยู่แล้ว (วันขอบคุณพระเจ้า วันคริสต์มาส) → ตัวช่วยแปลงเป็นการ์ดกิจกรรม เงินเดิมไม่หาย · เปิดมาเจอการ์ดทันที
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4211
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const addIncome = async (cat, amt) => {
  await page.getByRole('tab', { name: cat, exact: true }).click()
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(0).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill(String(amt))
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(500)
}
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt9`); await page.waitForLoadState('networkidle')
  for (const n of ['พืชผัก', 'โต๊ะจีน', 'วันขอบคุณพระเจ้า', 'วันคริสต์มาส']) { await page.getByLabel('ชื่อหมวดใหม่').fill(n); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click() }
  await addIncome('พืชผัก', 1000); await addIncome('วันคริสต์มาส', 300)
  must(await page.getByRole('region', { name: 'แบ่งเป็นกิจกรรม' }).count() === 1, 'a clear card invites the admin to split the fund into activities')
  await page.getByRole('button', { name: 'แบ่งเป็นกิจกรรม', exact: true }).click()
  must(await page.getByLabel('ชื่อกิจกรรมที่ 1').inputValue() === 'วันขอบคุณพระเจ้า' && await page.getByLabel('ชื่อกิจกรรมที่ 2').inputValue() === 'วันคริสต์มาส', 'categories named like activities become activity rows')
  await page.getByLabel('วันเริ่มกิจกรรมที่ 1').fill('2026-10-25'); await page.getByLabel('วันเริ่มกิจกรรมที่ 2').fill('2026-12-25'); await page.getByLabel('วันสิ้นสุดกิจกรรมที่ 2').fill('2026-12-26')
  await page.getByLabel('กิจกรรมของหมวด พืชผัก').selectOption({ label: 'วันขอบคุณพระเจ้า' })
  await page.getByRole('button', { name: 'เปิดโหมดกิจกรรม' }).click()
  await page.waitForTimeout(500)
  const names = await page.locator('.actcard__name').allInnerTexts()
  must(names.join('|') === 'วันคริสต์มาส|วันขอบคุณพระเจ้า', 'cards first, newest on top: ' + names)
  const xm = await page.getByRole('button', { name: /กิจกรรม วันคริสต์มาส/ }).innerText()
  must(/25 ธ.ค. 69 – 26 ธ.ค. 69 · 2 วัน/.test(xm) && /300/.test(xm) && /ยังไม่ประเมิน/.test(xm), 'card: dates, money and an evaluation gauge: ' + xm)
  must(/1,000/.test(await page.getByRole('button', { name: /กิจกรรม วันขอบคุณพระเจ้า/ }).innerText()), 'the old category money moved with its activity')
  must(/1,300/.test(await page.getByRole('status', { name: /ยอดคงเหลือ กองทุน/ }).innerText()), 'fund total = all activities')
  await page.getByRole('button', { name: /กิจกรรม วันขอบคุณพระเจ้า/ }).click()
  const cats = await page.getByRole('region', { name: 'หมวดของกองทุน' }).innerText()
  must(/พืชผัก/.test(cats) && /รายการทั่วไป/.test(cats) && !/วันคริสต์มาส/.test(cats), 'inside an activity: its own categories only: ' + cats)
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundwiz-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
