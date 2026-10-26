// กองทุนที่มีหมวดชื่อกิจกรรมอยู่แล้ว (วันขอบคุณพระเจ้า วันคริสต์มาส) → เปิดโหมดกิจกรรม: แปลงเป็นการ์ดเอง เงินเดิมไม่หาย · เปิดมาเจอการ์ดทันที
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
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForLoadState('networkidle')
  await page.locator('#h-types').click()
  await page.getByLabel('แบ่ง กองทุนศึกษา เป็นกิจกรรม').check()
  await page.goto(`http://localhost:${PORT}/#/funds/tt9`); await page.waitForTimeout(700)
  const names = (await page.locator('.actcard__name').allInnerTexts()).sort()
  must(names.join('|') === ['วันขอบคุณพระเจ้า', 'วันคริสต์มาส'].sort().join('|'), 'categories named like activities became activity cards: ' + names)
  must(await page.getByRole('region', { name: /แบ่งเป็นกิจกรรม|หมวดของกองทุน/ }).count() === 0, 'nothing but the total, the add button and the cards')
  must(/ยังไม่ประเมิน/.test(await page.getByRole('button', { name: /กิจกรรม วันคริสต์มาส/ }).innerText()), 'every card has an evaluation gauge')
  must(/300/.test(await page.getByRole('button', { name: /กิจกรรม วันคริสต์มาส/ }).innerText()) && /1,000/.test(await page.getByRole('button', { name: /กิจกรรม วันขอบคุณพระเจ้า/ }).innerText()), 'old money moved with its activity (other categories joined the earliest activity)')
  must(/1,300/.test(await page.getByRole('status', { name: /ยอดคงเหลือ กองทุน/ }).innerText()), 'fund total = all activities')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundwiz-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
