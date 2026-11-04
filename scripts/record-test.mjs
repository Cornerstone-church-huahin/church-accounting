// บันทึก: รับ + จ่าย ในหน้าเดียว — ปุ่มใต้ขั้นตอน 1–6 · แถบสัปดาห์เดียวใช้ร่วมกัน · มีใบรายรับและใบรายจ่ายในหน้าเดียว
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4209
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  navigator.canShare = () => true
  window.__shares = []
  navigator.share = async (x) => { window.__shares.push({ name: x.files[0].name, type: x.files[0].type, size: x.files[0].size }) }
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  const t = new Date(), ls = new Date(t); ls.setDate(t.getDate() - t.getDay())   // อาทิตย์ล่าสุด = ใบของสัปดาห์ก่อนหน้า
  const d = `${ls.getFullYear()}-${String(ls.getMonth() + 1).padStart(2, '0')}-${String(ls.getDate()).padStart(2, '0')}`
  localStorage.setItem(`acct.income.${ls.getFullYear()}.v1`, JSON.stringify([{ id: 'i1', date: d, typeId: 'tt1', amount: 500000, method: 'cash', source: 'manual', updated: 1 }]))
  localStorage.setItem(`acct.expenses.${ls.getFullYear()}.v1`, JSON.stringify([{ id: 'e1', channel: 'manual', date: d, amount: 120000, desc: 'ค่าของทดสอบบอร์ด', catId: 'xq-1', status: 'paid', method: 'cash', updated: 2 }]))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.reload()
  const rec = page.getByRole('button', { name: 'บันทึก รับและจ่ายในหน้าเดียว' })
  await rec.waitFor({ timeout: 10000 })
  must(await page.locator('.stepbtn:not(.exttab)').count() === 6, 'six original step tiles intact')
  must((await page.locator('.exttab').count()) === 3, 'บันทึก · แดชบอร์ด · แท็บ 3 present')
  // ลำดับ: บันทึกเป็นอันดับ 1 · รับ/จ่ายอยู่ท้ายสุด ต่อจากแท็บ 3 · ทุกช่องขนาดเท่ากัน
  const names = await page.locator('.stepgrid .stepbtn').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').trim()))
  must(/บันทึก/.test(names[0]) && /^1 .*รับ/.test(names[7]) && /^2 .*จ่าย/.test(names[8]) && /แท็บ 3/.test(names[6]), 'tile order: บันทึก first, แท็บ 3 then รับ, จ่าย: ' + JSON.stringify(names))
  const sizes = await page.locator('.stepgrid .stepbtn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)] }))
  must(new Set(sizes.map((x) => x.join('x'))).size === 1, 'all nine tiles have the same size: ' + JSON.stringify(sizes))
  await rec.click()
  const inSec = page.getByRole('region', { name: 'บันทึกรายรับ' }), outSec = page.getByRole('region', { name: 'บันทึกรายจ่าย' })
  await inSec.waitFor({ timeout: 10000 })
  must(await outSec.count() === 1, 'expense section on the same page')
  await inSec.locator('table[aria-label^="ใบบันทึกการถวาย"]').first().waitFor({ timeout: 10000 })
  await outSec.locator('table[aria-label^="ใบเบิก-จ่ายเงินสด"]').first().waitFor({ timeout: 10000 })
  must(await page.locator('.weekbar').count() === 1, 'one shared week bar: ' + await page.locator('.weekbar').count())
  const heading = async () => (await page.locator('.weekbar__title').innerText()).replace(/\s+/g, ' ')
  const h0 = await heading()
  await page.getByRole('button', { name: 'สัปดาห์ก่อน' }).click()
  const h1 = await heading()
  must(h1 !== h0, 'week changed: ' + h0 + ' -> ' + h1)
  const sheetWeeks = await page.locator('.a4page').evaluateAll((els) => els.map((e) => (e.innerText.match(/ระหว่างวันที่[^\n]*/) || [''])[0]))
  must(new Set(sheetWeeks.filter(Boolean)).size === 1 && sheetWeeks.filter(Boolean).length >= 2, 'income and expense sheets both follow the shared week: ' + JSON.stringify(sheetWeeks))
  // ส่วนที่ 3: ข้อมูลก่อนติดบอร์ด (ละเอียด) · ส่วนที่ 4: สำหรับติดบอร์ดประกาศ (เป็นหมวด) — คำนวณจากรายการของสัปดาห์ที่เลือก
  const check = page.getByRole('region', { name: 'ข้อมูลก่อนติดบอร์ด' })
  const board = page.getByRole('region', { name: 'สำหรับติดบอร์ดประกาศ' })
  await check.waitFor({ timeout: 10000 })
  await board.waitFor({ timeout: 10000 })
  await check.getByText('สรุปรายรับ - รายจ่ายประจำสัปดาห์').first().waitFor({ timeout: 10000 })
  await board.getByText('สรุปรายรับ - รายจ่ายประจำสัปดาห์').first().waitFor({ timeout: 10000 })
  const bg = async (r) => await r.locator('.record__h').evaluate((e) => getComputedStyle(e).backgroundColor)
  must((await bg(check)) === 'rgb(194, 87, 10)' && (await bg(board)) === 'rgb(31, 95, 196)', 'heading colours: check = orange, board = blue: ' + await bg(check) + ' / ' + await bg(board))
  must(await check.getByText('ค่าของทดสอบบอร์ด').count() >= 1, 'detail sheet lists the expense line (linked to the selected week)')
  must(await board.getByText('ค่าของทดสอบบอร์ด').count() === 0, 'board sheet hides the detailed expense line')
  must(await board.getByText('ค่าน้ำมันออกเยี่ยมสมาชิก อ.กฤต').count() >= 1, 'board sheet shows the category instead')
  must(await board.getByRole('columnheader', { name: 'หมวดรายจ่าย' }).count() === 1 && await board.getByRole('columnheader', { name: 'ผู้วางบิล' }).count() === 0 && await board.getByRole('columnheader', { name: 'วันที่' }).count() === 0, 'board expense table has category columns only')
  const tot = async (r) => (await r.getByText(/รวมรายจ่ายเงินหมุนเวียน/).first().locator('xpath=..').innerText()).replace(/\s+/g, ' ')
  must((await tot(check)) === (await tot(board)), 'totals match between detail and category sheets: ' + await tot(check) + ' vs ' + await tot(board))
  must(await board.getByRole('button', { name: /ดาวน์โหลด PDF ใบสำหรับติดบอร์ด/ }).count() === 1 && await board.getByRole('button', { name: /แชร์ PDF ใบสำหรับติดบอร์ด/ }).count() === 1 && await board.getByRole('button', { name: /แชร์เป็นรูป/ }).count() === 1 && await board.getByRole('button', { name: /^พิมพ์/ }).count() === 1, 'board tools present (4 icons)')
  must(await check.getByRole('button', { name: /ดาวน์โหลด PDF ข้อมูลก่อนติดบอร์ด/ }).count() === 1, 'detail sheet tools present')
  await page.getByRole('button', { name: 'สัปดาห์ถัดไป' }).click()
  await page.waitForTimeout(600)
  must(await check.getByText('ค่าของทดสอบบอร์ด').count() === 0 && await board.getByText('ค่าน้ำมันออกเยี่ยมสมาชิก อ.กฤต').count() === 0, 'both sheets follow the shared week')
  await page.getByRole('button', { name: 'สัปดาห์ก่อน' }).click()
  // หัวงาน/ตารางงาน/แท็บขั้นตอน/แถบสลับยังตัดออก (เฉพาะหน้านี้) แต่ฟังก์ชันรับ/จ่ายครบเหมือนหน้าเดิม
  must(await page.getByRole('heading', { name: 'งานเหรัญญิก' }).count() === 0, 'room header removed')
  must(await page.getByRole('button', { name: /ตารางงาน/ }).count() === 0, 'calendar toggle removed')
  must(await page.locator('.fullbar, .home-tabs').count() === 0, 'step tab bar removed')
  must(await page.getByRole('tablist', { name: 'ไปส่วนรับหรือส่วนจ่าย' }).count() === 0, 'jump bar removed')
  // ส่วนที่ยังไม่ใช้ในหน้านี้ถูกเอาออก: ช่องบันทึก 1–4 · ปุ่มสแกน · รายการใต้ใบ
  must(await page.getByRole('tablist', { name: 'ช่องบันทึกเงินรับ' }).count() === 0 && await page.getByRole('tablist', { name: /ช่องบันทึกรายจ่าย/ }).count() === 0, 'entry-method buttons removed')
  must(await page.getByText(/สแกนใบ/).count() === 0 && await page.locator('input[aria-label^="สแกนใบ"]').count() === 0, 'scan button removed')
  must(await page.getByText('รายการในใบนี้').count() === 0, 'entry list removed')
  for (const [sec, dl] of [[inSec, 'ดาวน์โหลด PDF'], [outSec, 'ดาวน์โหลด PDF']]) {
    must(await sec.getByRole('button', { name: new RegExp(dl) }).count() === 1, 'download button kept')
    must(await sec.getByRole('button', { name: /^แชร์ PDF/ }).count() === 1 && await sec.getByRole('button', { name: /^แชร์เป็นรูป/ }).count() === 1 && await sec.getByRole('button', { name: /^พิมพ์/ }).count() === 1, 'share pdf + share image + print buttons present in each section')
  }
  await inSec.getByRole('button', { name: /^แชร์ PDF/ }).click()
  await page.waitForFunction(() => window.__shares.length === 1, null, { timeout: 40000 })
  await outSec.getByRole('button', { name: /^แชร์ PDF/ }).click()
  await page.waitForFunction(() => window.__shares.length === 2, null, { timeout: 40000 })
  const shares = await page.evaluate(() => window.__shares)
  must(shares.every((x) => x.type === 'application/pdf' && x.size > 1000) && shares[0].name !== shares[1].name, 'each section shares its own PDF: ' + JSON.stringify(shares))
  // ติ๊กเลือกแผ่นงานทุกแผ่น → แผงลอยมุมบนซ้าย
  for (const n of ['รายรับ', 'รายจ่าย', 'ข้อมูลก่อนติดบอร์ด', 'สำหรับติดบอร์ดประกาศ']) must(await page.getByRole('checkbox', { name: 'เลือก ' + n }).count() === 1, 'tick box on ' + n)
  await page.getByRole('checkbox', { name: 'เลือก ข้อมูลก่อนติดบอร์ด' }).check()
  const dock = page.getByRole('toolbar', { name: 'ส่งออกแผ่นงานที่เลือก' })
  await dock.waitFor({ timeout: 5000 })
  await page.getByRole('checkbox', { name: 'เลือก สำหรับติดบอร์ดประกาศ' }).check()
  must((await dock.innerText()).includes('เลือก 2 แผ่น'), 'dock counts picked sheets')
  await page.evaluate(() => { window.__shares.length = 0 })
  await dock.getByRole('button', { name: /^แชร์ PDF/ }).click()
  await page.waitForFunction(() => window.__shares.length === 1, null, { timeout: 40000 })
  must((await page.evaluate(() => window.__shares))[0].type === 'application/pdf', 'picked board sheets shared as PDF')
  await page.getByRole('button', { name: 'ล้างที่เลือก' }).click()
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  await page.getByRole('button', { name: 'กลับหน้างานเหรัญญิก' }).click()
  await page.locator('.stepbtn').first().waitFor({ timeout: 8000 })
  // แท็บ 2 แดชบอร์ด · แท็บ 3 ว่างไว้ก่อน
  await page.getByRole('button', { name: 'แดชบอร์ด', exact: true }).click()
  await page.getByRole('region', { name: 'รายรับ-รายจ่าย' }).waitFor({ timeout: 10000 })
  const dash = await page.locator('.dash').innerText()
  must(/สัปดาห์นี้/.test(dash) && /เดือนนี้/.test(dash) && /รวมเงินสด/.test(dash), 'dashboard shows balances and period totals: ' + dash.slice(0, 200))
  if (process.env.SHOT2) await page.screenshot({ path: process.env.SHOT2 })
  await page.getByRole('button', { name: 'กลับหน้างานเหรัญญิก' }).click()
  await page.getByRole('button', { name: 'แท็บ 3', exact: true }).click()
  await page.getByText('ว่างไว้ก่อน — รอกำหนดหน้าที่').waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'กลับหน้างานเหรัญญิก' }).click()
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('record-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
