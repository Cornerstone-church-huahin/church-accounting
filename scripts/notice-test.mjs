// แท็บ สรุป: รายการสัปดาห์เป็นแถบเล็ก → แตะ = ใบสรุปรับ-จ่าย A4 สำหรับติดประกาศ (ไม่มีข้อมูลภายใน)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const d2 = new Date(sun); d2.setDate(d2.getDate() - 2)
const old = new Date(sun); old.setDate(old.getDate() - 9)
const Y = sun.getFullYear()
await page.goto(`http://localhost:${PORT}/#/`)
await page.evaluate(([Y, a, b]) => {
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([
    { id: 'i1', date: a, typeId: 'tt1', amount: 285500, method: 'cash', source: 'manual', updated: 1 },
    { id: 'i2', date: a, typeId: 'tt2', amount: 30000, method: 'transfer', source: 'manual', updated: 1 },
    { id: 'i3', date: a, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 },
    { id: 'i4', date: b, typeId: 'tt1', amount: 100000, method: 'cash', source: 'manual', updated: 1 },
  ]))
  localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify([
    { id: 'e1', channel: 'advance', date: a, amount: 150000, desc: 'ค่าอาหาร', status: 'open', requester: 'อ.ลับ สำรองจ่าย', biller: 'อ.ลับ', who: 'ร้านลับ', updated: 1 },
    { id: 'e2', channel: 'manual', date: a, amount: 100000, desc: 'ค่าน้ำมัน อ.กฤต', status: 'paid', method: 'cash', updated: 1 },
    { id: 'e3', channel: 'manual', date: a, amount: 100000, desc: 'ค่าน้ำมัน อ.พิชิต', status: 'paid', method: 'cash', updated: 1 },
    ...Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, channel: 'manual', date: a, amount: 1000, desc: 'รายการย่อย ' + (i + 1), status: 'paid', method: 'cash', updated: 1 })),
  ]))
}, [Y, iso(d2), iso(old)])
try {
  await page.reload()
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  must(await page.getByRole('heading', { name: /สรุปและรายงาน/ }).isVisible() && await page.getByRole('tab', { name: 'รายสัปดาห์' }).isVisible(), 'summary & report page with three tabs')
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  const t = await page.locator('.a4page').first().innerText()
  const all = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must((await page.locator('.a4page').count()) >= 2, 'many expenses continue on a following A4 page: ' + await page.locator('.a4page').count())
  must(/ค่าน้ำมัน อ\.กฤต/.test(all) && /ค่าน้ำมัน อ\.พิชิต/.test(all) && /รายการย่อย 40/.test(all), 'every actual expense line is listed')
  must(/รวมรายรับ/.test(all) && /รวมรายจ่ายทั้งสิ้น/.test(all) && /รับมากกว่าจ่าย|จ่ายมากกว่ารับ/.test(all), 'income+expense+summary: ' + all.slice(0, 300))
  must(/จ่ายมากกว่ารับ\s+[-−]/.test(all), 'deficit shown with a minus sign')
  must(/3,155/.test(all), 'income total 3,155 (cash+transfer, funds separate)')
  must(/ค่าอาหาร \(อ\.ลับ\)/.test(all) && !/ผู้วางบิล|สำรองจ่าย|ร้านลับ/.test(all), 'payer/biller name shown in brackets after the item, no other internal notes')
  must(/เงินถวายกองทุน/.test(all) && /ไม่รวมกับเงินหมุนเวียน/.test(all) && /ไม่นำไปคำนวณ/.test(all), 'fund donations shown separately with the explanation')
  must(await page.getByRole('button', { name: /ดาวน์โหลดใบสรุป/ }).isVisible(), 'admin can download')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('notice-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
