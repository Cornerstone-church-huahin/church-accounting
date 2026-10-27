// แท็บ ปรับ: ผลที่อ่านจากรูปค้างอยู่แม้ออกจากหน้า (แบบร่าง) · บันทึกแล้วแก้ชนิด/ลบรายการสมุดได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4198
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const day = (n) => { const d = new Date(sun); d.setDate(d.getDate() - n); return iso(d) }
await page.goto(`http://localhost:${PORT}/#/meeting/3`)
await page.evaluate(() => localStorage.setItem('acct.gemini.v1', JSON.stringify({ key: 'TEST', model: 'gemini-flash-latest' })))
await page.route('**/generativelanguage.googleapis.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rows: [{ date: day(3), code: 'DEP', amount: 300, balance: 1300 }, { date: day(2), code: 'DEP', amount: 200, balance: 1500 }] }) }] } }] }) }))
try {
  await page.reload()
  await page.getByRole('tab', { name: /ปรับ/ }).first().click()
  await page.getByLabel('แนบรูปสมุดบัญชี').setInputFiles('public/icon-512.png')
  await page.getByLabel('รายการ บรรทัด 2').waitFor({ timeout: 20000 })
  // ออกจากหน้าโดยยังไม่บันทึก แล้วกลับมา → แบบร่างยังอยู่
  await page.goto(`http://localhost:${PORT}/#/income`); await page.waitForLoadState('networkidle')
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.reload()
  await page.getByRole('tab', { name: /ปรับ/ }).first().click()
  await page.getByLabel('รายการ บรรทัด 2').waitFor({ timeout: 8000 })
  must(await page.getByRole('button', { name: 'บันทึกและจับคู่' }).isVisible(), 'unsaved draft survives leaving the page')
  await page.getByRole('button', { name: 'บันทึกและจับคู่' }).click()
  must(await page.getByLabel('รายการ บรรทัด 1').count() === 0, 'draft cleared after saving')
  const list = page.getByRole('list', { name: 'รายการสมุดที่บันทึกไว้' })
  must(await list.locator('li').count() === 2 && /ฝากเงินสด/.test(await list.innerText()), 'saved lines listed as cash deposits')
  // แก้ชนิด: ฝากเงินสด 300 → โอนเข้า (เงินโอนที่ไม่มีสลิป)
  await list.getByRole('button', { name: /แก้ไขรายการ.*300/ }).click()
  await page.getByLabel('ชนิดรายการ').selectOption('in')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/โอนเข้า/.test(await list.innerText()), 'kind edited to transfer-in')
  must(await page.getByText(/Unkonw 1 รายการ/).first().isVisible(), 'edited transfer counts as unknown source')
  await page.goto(`http://localhost:${PORT}/#/income`)
  must(/โอน \(ไม่แจ้งวัตถุประสงค์\) Unkonw/.test(await page.locator('section[aria-label="รายการรายรับ"]').innerText()), 'unknown row now appears on the income page')
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.reload()
  await page.getByRole('tab', { name: /ปรับ/ }).first().click()
  await page.getByRole('list', { name: 'รายการสมุดที่บันทึกไว้' }).getByRole('button', { name: /ลบรายการ.*200/ }).click()
  must(await page.getByRole('list', { name: 'รายการสมุดที่บันทึกไว้' }).locator('li').count() === 1, 'line deleted')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('adjustkeep-test OK')
} finally { await browser.close(); server.kill() }
