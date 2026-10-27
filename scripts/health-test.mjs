// สถานะการเงินคริสตจักร: ปุ่มเดียวในหน้างาน → หน้าสถานะ (สี ตัววัดสำรอง แนวโน้ม ทางช่วยกัน) · เงินหมุนเวียนต่ำ = แดง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4196
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const t = new Date(), ago = (n) => { const d = new Date(t); d.setDate(d.getDate() - n); return iso(d) }
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/4`); await page.waitForLoadState('networkidle')
  must(await page.getByRole('link', { name: /สถานะการเงินคริสตจักร/ }).count() === 1, 'one button')
  must(await page.getByRole('link', { name: /^💚 บัญชีรับ/ }).count() === 0, 'the three pills are gone from the work page')
  // ยอดยกมา 50,000 บาท ไม่มีรายจ่าย = เขียว
  await page.evaluate(([o]) => localStorage.setItem('acct.opening.v1', JSON.stringify([{ id: 'opening', updated: 1, date: o, own: 5000000, funds: {} }])), [ago(60)])
  await page.getByRole('link', { name: /สถานะการเงินคริสตจักร/ }).click()
  const card = page.getByRole('region', { name: 'สถานะการเงินคริสตจักร' })
  must(/การเงินมั่นคง/.test(await card.innerText()), 'plenty of reserve = steady: ' + await card.innerText())
  // ยอดยกมา 1,000 บาท · จ่ายประจำ 8 สัปดาห์ รวม 8,000 → 1 สัปดาห์ = แดง
  const Y = t.getFullYear()
  await page.evaluate(([Y, a, o]) => {
    localStorage.setItem('acct.opening.v1', JSON.stringify([{ id: 'opening', updated: 1, date: o, own: 100000, funds: {} }]))
    localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify(Array.from({ length: 8 }, (_, i) => ({ id: 'e' + i, channel: 'manual', date: a[i], amount: 100000, desc: 'ค่าใช้จ่าย ' + i, status: 'paid', method: 'cash', updated: 1 }))))
  }, [Y, Array.from({ length: 8 }, (_, i) => ago(i * 7 + 1)), ago(60)])
  await page.reload(); await page.waitForLoadState('networkidle')
  const txt = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  must(/ต้องช่วยกันเร่งด่วน/.test(txt), 'low reserve shows urgent: ' + txt)
  must(await page.getByRole('progressbar').count() === 1 && /ช่วยกันได้อย่างไร/.test(txt) && /ดูรายละเอียดบัญชี/.test(txt), 'meter, tips and detail links')
  await page.screenshot({ path: 'shots/health.png' })
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('health-test OK')
} finally { await browser.close(); server.kill() }
