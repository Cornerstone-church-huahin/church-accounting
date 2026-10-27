// สรุปและรายงาน: 3 แท็บ (รายสัปดาห์ · รายเดือน · ภาพรวมปี) คำนวณจากข้อมูลจริง เจาะ ปี → เดือน → สัปดาห์ → รายการ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4186
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
    ...Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, channel: 'manual', date: a, amount: 1000, desc: 'รายการย่อย ' + (i + 1), status: 'paid', method: 'cash', updated: 1 })),
  ]))
}, [Y, iso(d2), iso(old)])
try {
  await page.reload()
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  must(await page.getByRole('heading', { name: /สรุปและรายงาน/ }).isVisible(), 'heading renamed')
  const tabs = page.getByRole('tablist', { name: 'ระดับรายงาน' }).getByRole('tab')
  must((await tabs.allInnerTexts()).join('|') === 'รายสัปดาห์|รายเดือน|ภาพรวมปี' && await tabs.first().getAttribute('aria-selected') === 'true', 'three tabs, weekly first')
  const kp = async (label) => (await page.locator('.rkpi', { hasText: label }).first().locator('b').innerText()).trim()
  must(/ยังไม่ยืนยันความครบถ้วน/.test(await page.locator('.rstatus').innerText()), 'status line is honest about completeness')
  const wkIn = await kp('รายรับหมุนเวียน'), wkOut = await kp('เงินจ่ายออก')
  must(wkIn === '3,155' && /^[\d,.]+$/.test(wkOut), 'weekly KPIs from real data: ' + wkIn + ' / ' + wkOut)
  must(/เงินถวายเข้ากองทุน/.test(await page.locator('main').innerText()), 'fund donation KPI is separate')
  must(await page.getByRole('list', { name: 'รายรับแยกประเภท' }).locator('li').count() >= 2, 'income bars from real types')
  // แตะหมวด → รายการ
  await page.getByRole('list', { name: 'ค่าใช้จ่ายแยกหมวด' }).getByRole('button').first().click()
  must(await page.getByRole('table', { name: 'รายการจ่ายของหมวด' }).isVisible(), 'tap a category → its items')
  must(/ยังไม่ระบุหมวด/.test(await page.getByRole('region', { name: 'รายการต้องติดตาม' }).innerText()) && /สำรองจ่าย/.test(await page.getByRole('region', { name: 'รายการต้องติดตาม' }).innerText()), 'follow-ups come from real statuses')
  await page.screenshot({ path: 'shots/report-week.png', fullPage: true })
  // ใบประกาศเดิมยังเปิดได้ และยอดตรงกัน
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  const all = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(all.includes(wkIn) && all.includes(wkOut), 'notice paper shows the same totals as the dashboard')
  await page.getByRole('button', { name: /‹ สรุปและรายงาน/ }).click()
  // รายเดือน
  await page.getByRole('tab', { name: 'รายเดือน' }).click()
  must(await page.getByRole('group', { name: 'รับ-จ่ายรายสัปดาห์' }).isVisible(), 'monthly paired bars')
  const mIn = await kp('รายรับหมุนเวียนรวมเดือน')
  must(/^[\d,.]+$/.test(mIn), 'monthly KPI ' + mIn)
  await page.getByRole('group', { name: 'รับ-จ่ายรายสัปดาห์' }).locator('g[role=button][aria-label*="รับ 3,155"]').first().click()
  await page.getByRole('button', { name: /เปิดรายงานสัปดาห์เต็ม/ }).waitFor({ timeout: 5000 })
  await page.screenshot({ path: 'shots/report-month.png', fullPage: true })
  await page.getByRole('button', { name: /เปิดรายงานสัปดาห์เต็ม/ }).click()
  must(await page.getByRole('tab', { name: 'รายสัปดาห์' }).getAttribute('aria-selected') === 'true' && await kp('รายรับหมุนเวียน') === '3,155', 'drill month → full week')
  // ภาพรวมปี
  await page.getByRole('tab', { name: 'ภาพรวมปี' }).click()
  must(/ภาพรวมปีถึงวันที่/.test(await page.locator('main').innerText()), 'ongoing year is titled "ถึงวันที่"')
  must(await page.getByRole('group', { name: 'แนวโน้มรายเดือน' }).isVisible(), 'line chart')
  const tbl = await page.getByRole('table', { name: 'ตารางรายเดือน' }).innerText()
  must(/ยังไม่มีข้อมูล/.test(tbl) && /ข้อมูลบางส่วน|มีข้อมูล/.test(tbl), 'months without data are marked, not zero: ' + tbl.slice(0, 120))
  must(/เงินหมุนเวียนคงเหลือ/.test(await page.locator('main').innerText()) && /เงินสดและเงินฝากรวม/.test(await page.locator('main').innerText()), 'balance KPIs as of the reference date')
  await page.screenshot({ path: 'shots/report-year.png', fullPage: true })
  await page.getByRole('table', { name: 'ตารางรายเดือน' }).getByRole('button').first().click()
  must(await page.getByRole('tab', { name: 'รายเดือน' }).getAttribute('aria-selected') === 'true', 'drill year → month')
  for (const t of ['รายสัปดาห์', 'รายเดือน', 'ภาพรวมปี']) {
    await page.getByRole('tab', { name: t }).click()
    must(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow: ' + t)
  }
  await page.setViewportSize({ width: 320, height: 700 })
  for (const t of ['รายสัปดาห์', 'รายเดือน', 'ภาพรวมปี']) {
    await page.getByRole('tab', { name: t }).click()
    const bad = await page.evaluate(() => [...document.querySelectorAll('section[aria-label="สรุปและรายงาน"] *')].filter((e) => !e.closest('.rtblwrap') && e.getBoundingClientRect().right > document.documentElement.clientWidth + 1).slice(0, 4).map((e) => e.tagName + '.' + e.className + ':' + Math.round(e.getBoundingClientRect().right)).join(' '))
    must(bad === '', 'report content fits at 320: ' + t + ' ' + bad)
  }
  must(await page.locator('[data-credit="app"]').count() === 1, 'app credit kept')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('report-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
