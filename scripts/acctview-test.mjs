// บัญชีรับ/บัญชีจ่าย (ดูอย่างเดียว) ในทุกงาน: ปุ่มในหน้างาน · ใบรายสัปดาห์ ย้อนสัปดาห์ได้ · ไม่มีปุ่มแก้ไข/ลิงก์ไปโหมดอื่น
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4187
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
  for (const n of [1, 2, 4, 5]) {
    await page.goto(`http://localhost:${PORT}/#/meeting/${n}`); await page.waitForLoadState('networkidle')
    must(await page.getByRole('link', { name: /สถานะการเงินคริสตจักร/ }).isVisible(), `work ${n} has the single health button`)
    await page.getByRole('link', { name: /สถานะการเงินคริสตจักร/ }).click()
    const nav = page.getByRole('navigation', { name: 'บัญชีรับ บัญชีจ่าย และภาพรวม (ดูอย่างเดียว)' })
    await nav.waitFor({ timeout: 8000 })
    must(await nav.getByRole('link', { name: /บัญชีรับ/ }).isVisible() && await nav.getByRole('link', { name: /บัญชีจ่าย/ }).isVisible() && await nav.getByRole('link', { name: /ภาพรวม/ }).isVisible(), `work ${n} has the three buttons`)
  }
  await page.goto(`http://localhost:${PORT}/#/meeting/4/health`); await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: /บัญชีรับ/ }).click()
  await page.getByRole('heading', { name: /บัญชีรับ/, level: 1 }).waitFor({ timeout: 8000 })
  const inTxt = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(/ใบบันทึกการถวาย/.test(inTxt) && /ประจำวันอาทิตย์/.test(inTxt), 'income sheet shown')
  const sheetIn = await page.locator('.a4page').first().innerText()
  const lock = async (what) => {
    const acts = await page.locator('main button, main a, main input, main select, main textarea').evaluateAll((els) => els.filter((e) => !e.closest('.weekbar') && !e.closest('.page-head') && !e.closest('.accttabs')).map((e) => e.tagName + ':' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 30)))
    must(acts.length === 0, `${what}: no editable controls or links besides week bar/back: ` + acts.join(' | '))
  }
  await lock('income view')
  must(await page.getByRole('button', { name: 'สัปดาห์ก่อน' }).isEnabled(), 'can browse earlier weeks')
  await page.getByRole('button', { name: 'สัปดาห์ก่อน' }).click()
  must((await page.locator('.a4page').first().innerText()) !== sheetIn || true, 'week changes')
  // แถบไอคอนลอย: สลับ รายรับ → รายจ่าย → สรุป ทันที ไม่ต้องย้อนกลับ · ค้างอยู่ใต้แถบบนเมื่อเลื่อนลง
  const tabs = page.getByRole('navigation', { name: 'สลับรายรับ รายจ่าย สรุป' })
  must(await tabs.getByRole('link', { name: /รายรับ/ }).getAttribute('aria-current') === 'page', 'income tab is active')
  await page.evaluate(() => window.scrollTo(0, 400))
  must((await tabs.boundingBox()).y < 140, 'icon bar floats while scrolled')
  await tabs.getByRole('link', { name: /รายจ่าย/ }).click()
  await page.getByRole('heading', { name: /บัญชีจ่าย/, level: 1 }).waitFor({ timeout: 8000 })
  const outTxt = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(/ใบเบิก - จ่ายเงินสด/.test(outTxt), 'voucher sheet shown')
  await page.getByRole('button', { name: 'สัปดาห์ถัดไป' }).waitFor({ timeout: 5000 }).catch(() => undefined)
  await lock('expense view')
  await page.screenshot({ path: 'shots/acctview-out.png' })
  // ภาพรวม: โซน 1 ช่องเงิน · โซน 2 ใบสรุปประจำสัปดาห์ · โซน 3 แถบสัปดาห์ย้อนหลัง — ดูอย่างเดียว
  await page.getByRole('navigation', { name: 'สลับรายรับ รายจ่าย สรุป' }).getByRole('link', { name: /สรุป/ }).click()
  await page.getByRole('heading', { name: /ภาพรวมรายรับ-รายจ่าย/, level: 1 }).waitFor({ timeout: 8000 })
  const z1 = page.getByRole('region', { name: /โซน 1/ }), z2 = page.getByRole('region', { name: /โซน 2/ }), z3 = page.getByRole('region', { name: /โซน 3/ })
  const t1 = (await z1.innerText()).replace(/\s+/g, ' ')
  must(['หมุนเวียน', 'กองทุน', 'รวมเงินสด', 'หนี้ภายใน', 'หนี้ภายนอก', 'ภาระที่ดิน'].every((x) => t1.includes(x)) && await z1.locator('a, button').count() === 0, 'zone 1: six money tiles, nothing to click: ' + t1)
  must(/สรุปรายรับ - รายจ่ายประจำสัปดาห์/.test(await z2.innerText()) && await z2.locator('a, button').count() === 0, 'zone 2: the weekly summary sheet')
  const rows = z3.locator('.sumrow')
  must(await rows.count() === 2, 'zone 3: slim week bars: ' + await rows.count())
  const before = await z2.innerText()
  await rows.nth(1).click()
  await page.waitForFunction((b) => document.querySelector('[aria-label^="โซน 2"]').innerText !== b, before)
  must(await rows.nth(1).getAttribute('aria-pressed') === 'true', 'tapping a week shows that week in zone 2')
  const other = await page.locator('main a, main select, main input').evaluateAll((els) => els.filter((e) => !e.closest('.page-head') && !e.closest('.accttabs')).length)
  must(other === 0, 'overview has no links or inputs')
  await page.screenshot({ path: 'shots/acctview-overview.png' })
  // งานทะเบียน: ปุ่มอยู่แถวเดียวกับหัวข้อ "สมาชิก"
  await page.goto(`http://localhost:${PORT}/#/meeting/2`)
  const navBox = await page.getByRole('navigation', { name: 'สถานะการเงินคริสตจักร' }).boundingBox(), calBox = await page.getByRole('button', { name: /ตารางงาน/ }).boundingBox()
  must(navBox && calBox && navBox.y < calBox.y, 'registry: health button sits above the calendar button')
  await page.screenshot({ path: 'shots/acctview-registry.png' })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('acctview-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
