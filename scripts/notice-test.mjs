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
  must(await page.getByRole('heading', { name: /สรุปและรายงาน/ }).isVisible() && await page.getByRole('tab', { name: 'รายสัปดาห์' }).isVisible(), 'summary & report page with three tabs')
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  must(await page.getByRole('tab', { name: /สำหรับแอดมินและเหรัญญิก/ }).getAttribute('aria-selected') === 'true', 'admin sees the evidence copy first')
  must(/เงินเดือน อ\.กฤต/.test((await page.locator('.a4page').allInnerTexts()).join('\n')), 'evidence copy lists each salary by name')
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  must(/เงินเดือน อ\.กฤต/.test((await page.locator('.a4page').allInnerTexts()).join('\n')), 'evidence copy keeps names even when printing')
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  // 📑 รายงานที่ประชุม: ลำดับแท็บ แอดมิน → แฟ้ม → รายงาน → ประกาศ · ฉบับมีชื่อ + ต้องเบิก + เรื่องติดตาม + ช่องลงนาม แผ่นเดียว
  const order = await page.locator('[aria-label="ฉบับของใบสรุป"] [role="tab"]').allInnerTexts()
  must(/แอดมิน/.test(order[0]) && /แฟ้ม/.test(order[1]) && /รายงานที่ประชุม/.test(order[2]) && /ประกาศ/.test(order[3]), 'tab order: admin, file, meeting report, announcement: ' + order.join(' | '))
  await page.getByRole('tab', { name: /รายงานที่ประชุม/ }).click()
  const rp = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must((await page.locator('.a4page').count()) === 1, 'meeting report is one A4 sheet')
  must(/เสนอที่ประชุม/.test(rp) && /ต้องเบิกสัปดาห์นี้/.test(rp) && /เรื่องต้องติดตาม/.test(rp) && /เหรัญญิก/.test(rp) && /ประธาน/.test(rp) && /รวมเงินสด/.test(rp), 'meeting report has header, withdrawal, follow-ups, signatures, cash tiles: ' + rp.slice(0, 300))
  must(/เงินเดือน อ\.กฤต/.test(rp), 'meeting report keeps names and individual salaries')
  await page.getByRole('tab', { name: /สำหรับประกาศสมาชิก/ }).click()
  const pubTxt = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(/สวัสดิการผู้รับใช้ \(ยอดรวม\)\s+350/.test(pubTxt) && !/เงินเดือน อ\.|\(อ\.ลับ\)|ผู้วางบิล/.test(pubTxt), 'public copy: no names, salaries merged: ' + pubTxt.slice(0, 200))
  await page.getByRole('tab', { name: /สำหรับแอดมินและเหรัญญิก/ }).click()
  const t = await page.locator('.a4page').first().innerText()
  const all = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must((await page.locator('.a4page').count()) === 1, 'even with many expenses the notice is ONE A4 sheet: ' + await page.locator('.a4page').count())
  const fits = await page.evaluate(() => { const pg = document.querySelector('.a4page'); const box = pg.querySelector('[class*="fit--"], div'); const kids = [...pg.querySelectorAll('.zone')]; const pr = pg.getBoundingClientRect(); return kids.every((z) => z.getBoundingClientRect().bottom <= pr.bottom + 1) })
  must(fits, 'every zone is inside the single page (nothing cut off)')
  await page.locator('.a4page').first().screenshot({ path: 'shots/notice-onepage.png' })
  must(/ค่าน้ำมัน อ\.กฤต/.test(all) && /ค่าน้ำมัน อ\.พิชิต/.test(all) && /รายการย่อย 40/.test(all), 'every actual expense line is listed')
  must(/รวมรายรับ/.test(all) && /รวมรายจ่ายทั้งสิ้น/.test(all) && /รับมากกว่าจ่าย|จ่ายมากกว่ารับ/.test(all), 'income+expense+summary: ' + all.slice(0, 300))
  must(/จ่ายมากกว่ารับ\s+[-−]/.test(all), 'deficit shown with a minus sign')
  must(/3,155/.test(all), 'income total 3,155 (cash+transfer, funds separate)')
  must(/ผู้วางบิล/.test(all) && /ค่าอาหาร\s+อ\.ลับ/.test(all) && !/\(อ\.ลับ\)/.test(all) && !/สำรองจ่าย|ร้านลับ/.test(all), 'admin copy: a ผู้วางบิล column after the item holds the name, no bracketed name, no other internal notes: ' + all.slice(0, 400))
  must(/เงินเดือน อ\.กฤต/.test(all) && /เงินเดือน อ\.สายฝน/.test(all), 'in the app each salary is listed by person')
  await page.getByRole('tab', { name: /สำหรับประกาศสมาชิก/ }).click()
  await page.evaluate(() => window.dispatchEvent(new Event('beforeprint')))
  const merged = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(!/อ\.กฤต|อ\.พิชิต|อ\.สายฝน/.test(merged.replace(/ค่าน้ำมัน อ\.(กฤต|พิชิต)/g, '')) && /สวัสดิการผู้รับใช้ \(ยอดรวม\)\s+350/.test(merged), 'print merge: ' + merged.split('\n').filter((l) => /สวัสดิการ|เงินเดือน|อ\./.test(l)).join(' | '))
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')))
  must(/สวัสดิการผู้รับใช้ \(ยอดรวม\)/.test((await page.locator('.a4page').allInnerTexts()).join('\n')), 'public copy stays merged after print')
  await page.emulateMedia({ media: 'print' })
  const printed = (await page.locator('.a4page').allInnerTexts()).join('\n')
  await page.emulateMedia({ media: 'screen' })
  must(/ค่าอาหาร/.test(printed) && !/อ\.ลับ/.test(printed), 'printed sheet hides personal names but keeps the item: ' + printed.slice(0, 200))
  must(/เงินถวายกองทุน/.test(all) && /เก็บไว้ เตรียมนำฝาก/.test(all) && !/รายจ่ายเงินกองทุน/.test(all) && /ไม่รวมกับเงินหมุนเวียน/.test(all) && /ไม่นำไปคำนวณ/.test(all), 'fund donations shown separately with the explanation')
  must(await page.getByRole('button', { name: /ดาวน์โหลดใบสรุป/ }).isVisible(), 'admin can download')
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { n: d.files.length, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size } } })
  await page.getByRole('button', { name: 'แชร์ใบสรุปเป็น PDF' }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 30000 })
  const sh = await page.evaluate(() => window.__shared)
  must(sh.n === 1 && sh.type === 'application/pdf' && /^สรุปรับจ่าย-(ต้นฉบับ|ประกาศ)-\d{4}-\d{2}-\d{2}\.pdf$/.test(sh.name) && sh.size > 1000, 'share button hands a real PDF file to the share sheet: ' + JSON.stringify(sh))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('notice-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
