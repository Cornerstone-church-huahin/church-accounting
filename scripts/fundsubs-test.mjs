// หมวดภายในกองทุน: สร้างหมวด · เลือกหมวดก่อนบันทึก · ยอด/ใบแยกตามหมวด · จ่ายเกินยอดหมวดต้องยืนยัน · ทุกหมวดบันทึกรายจ่ายไม่ได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4200
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = [], dialogs = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept() })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const store = (prefix) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p) && !k.endsWith('.epoch')).flatMap((k) => JSON.parse(localStorage.getItem(k))), prefix)
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt9`); await page.waitForLoadState('networkidle')
  for (const n of ['พืชผัก', 'โต๊ะจีน']) { await page.getByLabel('ชื่อหมวดใหม่').fill(n); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click() }
  must(await page.getByRole('tab', { name: 'พืชผัก' }).getAttribute('aria-selected') === 'true', 'first category selected by default')
  await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click().catch(() => {})
  await page.getByLabel('ชื่อหมวดใหม่').fill('พืชผัก'); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click()
  must(await page.getByRole('alert').filter({ hasText: 'มีหมวดชื่อนี้แล้ว' }).count() === 1, 'duplicate category name rejected')
  const addIncome = async (cat, amt) => {
    await page.getByRole('tab', { name: cat }).click()
    await page.getByRole('tab', { name: /💚 รับ/ }).click()
    await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(0).click()
    must(await page.locator('#ire-sub').inputValue() !== '', `editor preselects the chosen category (${cat})`)
    await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill(String(amt))
    await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
    await page.waitForTimeout(500)
  }
  await addIncome('พืชผัก', 5000); await addIncome('โต๊ะจีน', 3000)
  const inc = (await store('acct.income.')).filter((x) => x.typeId === 'tt9')
  const subs = new Set(inc.map((x) => x.subId))
  must(inc.length === 2 && subs.size === 2 && !subs.has(undefined), 'each income entry carries its category: ' + JSON.stringify(inc.map((x) => x.subId)))
  const tbl = (await page.getByRole('table', { name: 'สรุปยอดแต่ละหมวด' }).innerText()).replace(/\s+/g, ' ')
  must(/พืชผัก\D*5,000\.00 0\.00 5,000\.00/.test(tbl) && /โต๊ะจีน\D*3,000\.00 0\.00 3,000\.00/.test(tbl), 'per-category totals: ' + tbl)
  // จ่ายเกินยอดหมวด → ถามยืนยัน
  await page.getByRole('tab', { name: 'พืชผัก' }).click()
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await page.getByRole('table', { name: /ใบเบิก-จ่ายเงินสด/ }).locator('tbody tr').nth(0).click()
  await page.locator('#ere-desc').fill('ซื้อผัก')
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('8000')
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(600)
  must(dialogs.some((d) => /เกินยอดที่มี/.test(d)), 'overspend asks for confirmation: ' + dialogs.join('|'))
  const ex = (await store('acct.expenses.')).filter((x) => x.fundId === 'tt9')
  must(ex.length === 1 && ex[0].subId === (inc.find((x) => x.amount === 500000)?.subId), 'expense saved in the selected category')
  // ทุกหมวด: บันทึกรายจ่ายไม่ได้
  dialogs.length = 0
  await page.getByRole('tab', { name: 'ทุกหมวด' }).click()
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await page.getByRole('table', { name: /ใบเบิก-จ่ายเงินสด/ }).locator('tbody tr').nth(1).click()
  await page.locator('#ere-desc').fill('ไม่ระบุหมวด')
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('100')
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(500)
  must(dialogs.some((d) => /เลือกหมวด/.test(d)) && (await store('acct.expenses.')).filter((x) => x.fundId === 'tt9').length === 1, 'all-categories view refuses a new expense: ' + dialogs.join('|'))
  await page.locator('button:has-text("ปิด")').first().click().catch(() => {})
  // ใบกองทุนแยกตามหมวด
  await page.getByRole('tab', { name: 'โต๊ะจีน' }).click()
  await page.getByRole('tab', { name: /ใบกองทุน/ }).click()
  const sheet = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(/โต๊ะจีน/.test(sheet) && /3,000/.test(sheet) && !/5,000/.test(sheet), 'fund sheet is filtered to the category: ' + sheet.slice(0, 200))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundsubs-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
