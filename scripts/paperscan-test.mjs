// สแกนใบกระดาษที่เขียนมือไว้: ใบบันทึกการถวาย (รับ) และใบเบิก-จ่ายเงินสด (จ่าย) → กรอกลงใบอัตโนมัติ แก้ไขได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const S = iso(sun)
const d3 = new Date(sun); d3.setDate(d3.getDate() - 3)
await page.goto(`http://localhost:${PORT}/#/meeting/3`)
await page.evaluate(() => localStorage.setItem('acct.gemini.v1', JSON.stringify({ key: 'TEST', model: 'gemini-flash-latest' })))
await page.route('**/generativelanguage.googleapis.com/**', (route) => {
  const prompt = JSON.parse(route.request().postData() || '{}').contents?.[0]?.parts?.[0]?.text ?? ''
  const rows = prompt.includes('ใบเบิก-จ่ายเงินสด')
    ? [{ date: iso(d3), desc: 'ค่าน้ำประปา', amount: 250, note: 'มน.', who: 'การประปา' }, { desc: 'ค่าไฟ', amount: 1200 }]
    : [{ date: iso(d3), label: 'สิบลด', cashCount: 6, cashAmount: 1900, transferCount: 2, transferAmount: 600 }, { label: 'ขอบพระคุณ', cashAmount: 500 }]
  return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rows }) }] } }] }) })
})
try {
  await page.reload()
  await page.getByRole('tab', { name: /รับ/ }).first().click()
  must(await page.getByText('ดาวน์โหลด PDF ไฟล์เปล่า').first().isVisible(), 'download buttons present')
  await page.getByLabel('สแกนใบบันทึกการถวาย').setInputFiles('public/icon-512.png')
  await page.getByLabel('ชื่อรายการ แถว 2').waitFor({ timeout: 20000 })
  must(await page.getByLabel('ชื่อรายการ แถว 1').inputValue() === 'สิบลด', 'row 1 label read')
  await page.getByLabel('ซอง แถว 1').fill('7') // แก้ไขได้
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  await page.getByText(/ขอบพระคุณ/).first().waitFor({ timeout: 5000 })
  const body = await page.locator('main, body').first().innerText()
  must(/สิบลด/.test(body) && /ขอบพระคุณ/.test(body), 'rows added to income sheet')
  must(/1,900/.test(body) && /600/.test(body), 'cash + transfer entries both created: ' + body.slice(0, 200))
  // จ่าย
  await page.getByRole('tab', { name: /จ่าย/ }).first().click()
  await page.getByLabel('สแกนใบเบิก-จ่ายเงินสด').setInputFiles('public/icon-512.png')
  await page.getByLabel('รายการ แถว 2').waitFor({ timeout: 20000 })
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  await page.getByText(/ค่าน้ำประปา/).first().waitFor({ timeout: 5000 })
  must(/ค่าไฟ/.test(await page.locator('body').innerText()), 'voucher rows added')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('paperscan-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
