// ทดสอบหน้าแรก โหมด "รับ": ช่อง 1 มือ · 2 สลิป · 3 ใบถวาย → ใบสรุป (4): npm run build && node scripts/receive-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4174
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  must(await page.getByRole('tab', { name: 'บันทึกด้วยมือ' }).count() === 0, 'sub tabs hidden before clicking รับ')
  await page.getByRole('tab', { name: '💚 รับ' }).click()
  for (const n of ['บันทึกด้วยมือ', 'บันทึกสลิป', 'ใบบันทึกการถวาย']) must(await page.getByRole('tab', { name: new RegExp(n) }).isVisible(), 'sub tab ' + n)
  must(await page.getByRole('heading', { name: /4 · ใบสรุปเงินรับ/ }).isVisible(), 'report visible')
  // 1 บันทึกด้วยมือ: ค่าเช่า 10,000 เงินสด
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByRole('button', { name: '＋ บันทึก' }).click()
  await page.locator('#i-amt').fill('10000')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  // 2 สลิป: โอน 500
  await page.getByRole('tab', { name: /บันทึกสลิป/ }).click()
  await page.getByRole('button', { name: '＋ แนบสลิป' }).click()
  await page.locator('#i-amt').fill('500')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  const rep = page.locator('section', { has: page.locator('#h-rep') })
  const txt = await rep.innerText()
  must(/10,500\.00/.test(txt), 'report total 10,500 :: ' + txt)
  must(/บันทึกด้วยมือ\s+1\s+10,000\.00/.test(txt.replace(/\n/g, ' ').replace(/\t/g, ' ')), 'manual row')
  await page.getByRole('tab', { name: /ใบบันทึกการถวาย/ }).click()
  must(await page.getByRole('link', { name: /กรอกยอดนับเอง/ }).isVisible(), 'sheet manual link')
  await page.getByRole('button', { name: '＋ แนบไฟล์' }).click()
  must(await page.getByLabel(/รูปหรือไฟล์/).isVisible(), 'attach form has file input')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(await page.getByRole('alert').filter({ hasText: 'เลือกรูปหรือไฟล์ก่อน' }).isVisible(), 'asks for a file')
  await page.keyboard.press('Escape')
  await page.goto(`http://localhost:${PORT}/#/`); await page.getByRole('tab', { name: '💚 รับ' }).click()
  await page.getByRole('tab', { name: '🔴 จ่าย' }).click()
  must(await page.getByRole('heading', { name: '🔴 จ่าย' }).isVisible(), 'pay panel')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('RECEIVE OK')
} catch (e) { await page.screenshot({ path: 'shots/receive-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
