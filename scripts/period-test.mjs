// ใบสรุปรายเดือน/รายปี (ตาราง + กราฟ): รายการสัปดาห์เป็นแถบเล็ก → แตะ = ใบสรุปรับ-จ่าย A4 สำหรับติดประกาศ (ไม่มีข้อมูลภายใน)
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
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const d2 = new Date(sun); d2.setDate(d2.getDate() - 2)
const old = new Date(sun); old.setDate(old.getDate() - 9)
const Y = sun.getFullYear()
await page.goto(`http://localhost:${PORT}/#/meeting/3`)
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
    { id: 'e4', channel: 'manual', date: a, amount: 15000, desc: 'เงินเดือน อ.กฤต', status: 'paid', method: 'cash', updated: 1 },
    { id: 'e5', channel: 'manual', date: a, amount: 15000, desc: 'เงินเดือน อ.พิชิต', status: 'paid', method: 'cash', updated: 1 },
    { id: 'e6', channel: 'manual', date: a, amount: 5000, desc: 'เงินเดือน อ.สายฝน', status: 'paid', method: 'cash', updated: 1 },
    ...Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, channel: 'manual', date: a, amount: 1000, desc: 'รายการย่อย ' + (i + 1), status: 'paid', method: 'cash', updated: 1 })),
  ]))
}, [Y, iso(d2), iso(old)])
try {
  await page.reload()
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  await page.getByRole('tab', { name: 'รายเดือน' }).click()
  // ข้อมูลทดสอบอยู่ปลายเดือนตุลาคม: ถ้าเปิดมาที่เดือนถัดไปให้ถอยกลับมา
  if (!(await page.getByText('รายรับหมุนเวียนรวมเดือน').count())) await page.getByRole('button', { name: 'ช่วงก่อน' }).click()
  const kpi = (await page.getByText('รายรับหมุนเวียนรวมเดือน').locator('xpath=..').innerText()).replace(/\s+/g, ' ')
  const kpiIn = (kpi.match(/([\d,]+)\s*$/) ?? [])[1]
  await page.getByRole('button', { name: /เปิดใบสรุปรายเดือน/ }).click()
  must((await page.locator('.a4page').count()) === 2, 'monthly notice = 2 A4 sheets (summary + charts)')
  const t1 = (await page.locator('.a4page').nth(0).innerText()).replace(/\s+/g, ' ')
  const t2 = (await page.locator('.a4page').nth(1).innerText()).replace(/\s+/g, ' ')
  must(/สรุปรายรับ - รายจ่ายประจำเดือน/.test(t1) && /รายจ่ายเงินหมุนเวียน \(แยกตามหมวด\)/.test(t1) && /ส่วนที่ 2 · เงินกองทุน/.test(t1), 'monthly summary sheet has both zones: ' + t1.slice(0, 200))
  must(new RegExp('รวมรายรับ\\s+' + kpiIn).test(t1), 'notice income total equals the monthly screen KPI (' + kpiIn + '): ' + t1.slice(0, 400))
  must(/อ\.กฤต/.test(t1) && /ค่าตอบแทนและสวัสดิการ \(รายบุคคล/.test(t1), 'admin copy lists compensation by person')
  must(/กราฟสรุปประจำเดือน/.test(t2) && (await page.locator('.a4page').nth(1).locator('svg').count()) >= 3, 'chart sheet has the charts: ' + t2.slice(0, 120))
  must(/ข้อมูลที่บันทึกแล้ว \d+\/\d+ สัปดาห์/.test(t1), 'completeness strip')
  const order = await page.locator('[aria-label="ฉบับของใบสรุป"] [role="tab"]').allInnerTexts()
  must(order.length === 3 && /แอดมิน/.test(order[0]) && /รายงานที่ประชุม/.test(order[1]) && /ประกาศ/.test(order[2]), 'tabs for a month: admin, meeting report, announcement (no weekly file): ' + order.join('|'))
  await page.getByRole('tab', { name: /รายงานที่ประชุม/ }).click()
  const rp = (await page.locator('.a4page').nth(0).innerText()).replace(/\s+/g, ' ')
  must(/เสนอที่ประชุม/.test(rp) && /เหรัญญิก/.test(rp) && /ประธาน/.test(rp) && /รวมเงินสด/.test(rp) && /อ\.กฤต/.test(rp), 'monthly meeting report: header, signatures, tiles, names')
  await page.getByRole('tab', { name: /สำหรับประกาศสมาชิก/ }).click()
  const pub = (await page.locator('.a4page').allInnerTexts()).join(' ').replace(/\s+/g, ' ')
  must(!/อ\.กฤต|อ\.พิชิต|อ\.สายฝน|รายบุคคล/.test(pub) && /สวัสดิการผู้รับใช้ \(ยอดรวม\)/.test(pub), 'public copy: no names, compensation merged into one figure: ' + pub.slice(0, 300))
  await page.screenshot({ path: 'shots/period-month-public.png', fullPage: true })
  await page.getByRole('tab', { name: 'รายปี' }).click()
  const ty = (await page.locator('.a4page').allInnerTexts()).join(' ').replace(/\s+/g, ' ')
  must((await page.locator('.a4page').count()) === 2 && /ประจำปี/.test(ty) && /ข้อมูลที่บันทึกแล้ว \d+\/12 เดือน/.test(ty), 'yearly notice = 2 sheets with month completeness')
  await page.getByRole('tab', { name: 'รายสัปดาห์' }).click()
  must((await page.locator('.a4page').count()) === 1, 'weekly stays one sheet')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('period-test OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
