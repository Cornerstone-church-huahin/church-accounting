// แฟ้มประจำสัปดาห์: ใบรับ + ใบเบิก-จ่าย + ภาพหลักฐานที่แนบ (หน้าละ 6 รูป เฉพาะรายการที่มีรูป) เป็น PDF ไฟล์เดียว
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
const Y = sun.getFullYear()
await page.goto(`http://localhost:${PORT}/#/`)
await page.evaluate(async ([Y, a]) => {
  const png = await new Promise((res) => { const c = document.createElement('canvas'); c.width = 60; c.height = 40; const g = c.getContext('2d'); g.fillStyle = '#c33'; g.fillRect(0, 0, 60, 40); c.toBlob(res, 'image/png') })
  const db = await new Promise((res, rej) => { const r = indexedDB.open('acct-images', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
  await new Promise((res) => { const t = db.transaction('img', 'readwrite'); for (let i = 0; i < 7; i++) t.objectStore('img').put(png, `attachments/p${i}.png`); t.oncomplete = res })
  localStorage.setItem('acct.loans.v1', JSON.stringify([{ id: 'ln1', lender: { kind: 'own' }, borrower: 'tt4', purpose: 'จ่าย สวัสดิการ อ.พิชิต แทนกองทุนสวัสดิการ', date: a, principal: 500000, repayments: [], updated: 1 }]))
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([{ id: 'i1', date: a, typeId: 'tt1', amount: 285500, method: 'cash', source: 'manual', updated: 1, photos: [{ path: 'attachments/p0.png', name: 'a.png' }] }]))
  localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify([
    ...Array.from({ length: 7 }, (_, i) => ({ id: 'e' + i, channel: 'manual', date: a, amount: 100000 + i, desc: 'ค่าของ ' + (i + 1), status: 'paid', method: 'cash', updated: 10 + i, file: { path: `attachments/p${i}.png`, name: 'p.png' } })),
    { id: 'n1', channel: 'manual', date: a, amount: 5000, desc: 'ไม่มีรูปแนบ', status: 'paid', method: 'cash', updated: 99 },
  ]))
}, [Y, iso(d2)])
try {
  await page.reload()
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  await page.getByRole('tab', { name: /แฟ้มประจำสัปดาห์/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('figure img').length === 8, null, { timeout: 15000 })
  const cover = await page.locator('.a4page').first().innerText()
  must(/แฟ้มรับ - จ่ายประจำสัปดาห์/.test(cover) && /เลขที่แฟ้ม/.test(cover) && /\d{4}-W\d{2}/.test(cover) && /สัปดาห์ที่ \d+ ของปี/.test(cover) && /สารบัญ/.test(cover), 'cover page has file no., week and contents: ' + cover.slice(0, 200))
  must(await page.locator('.a4page').first().evaluate((e) => e.scrollHeight <= e.clientHeight + 1), 'cover fits on one A4 page: ' + await page.locator('.a4page').first().evaluate((e) => e.scrollHeight + '/' + e.clientHeight))
  must(/ผู้ตรวจสอบ/.test(cover) && /เหรัญญิก/.test(cover) && /ลงชื่อ/.test(cover), 'cover has signature blocks')
  must(/ออกแบบและพัฒนาโดย มน\.สมเจต เสมาทอง/.test(cover), 'cover carries the developer credit')
  for (const l of ['หมุนเวียน', 'กองทุน', 'รวมเงินสด', 'หนี้ภายใน', 'หนี้ภายนอก', 'ภาระที่ดิน']) must(cover.includes(l), 'cover tile ' + l)
  const coverVals = (await page.locator('.a4page').first().locator('[aria-label="เงินคริสตจักร 6 ช่อง"] > div').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click(); await page.waitForTimeout(800)
  const home = (await page.locator('.balance-tiles .btile').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  must(JSON.stringify(coverVals) === JSON.stringify(home), 'cover tiles equal the real home tiles: ' + JSON.stringify(coverVals) + ' vs ' + JSON.stringify(home))
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
  await page.getByRole('tab', { name: /แฟ้มประจำสัปดาห์/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('figure img').length === 8, null, { timeout: 15000 })
  must(await page.locator('.a4page').count() === 5, 'cover 1 + income 1 + voucher 1 + 2 photo pages (8 photos): ' + await page.locator('.a4page').count())
  must(await page.locator('.a4page--land').count() === 1, 'income sheet is the landscape one')
  const cap = (await page.locator('figcaption').allInnerTexts()).join('\n')
  must(/ลำดับที่ 1 · ค่าของ 1/.test(cap) && /ลำดับที่ 7 · ค่าของ 7/.test(cap) && !/ไม่มีรูปแนบ/.test(cap), 'captions cross-reference voucher rows and skip entries without a photo: ' + cap)
  const vt = (await page.locator('.a4page').allInnerTexts()).join('\n')
  must(/ให้.+ยืมจากเงินหมุนเวียน \(จ่าย สวัสดิการ อ\.พิชิต/.test(vt) && /5,000/.test(vt), 'loan out shows under ต้องเบิก: ' + vt.slice(-400))
  must(/หัก ให้กองทุนยืมค้าง\s+−5,000/.test(vt), 'reconciling line for money lent out')
  must(/รวมจ่ายเป็นเงินทั้งสิ้น[\s\S]{0,20}7,050/.test(vt) || /รวมจ่ายเป็นเงินทั้งสิ้น/.test(vt) && !/รวมจ่ายเป็นเงินทั้งสิ้น[\s\S]{0,20}12,050/.test(vt), 'loan is not counted in total expenses')
  must(await page.locator('figure').count() === 8 && /รายรับ/.test(cap), '7 expense photos + 1 income photo (labelled รายรับ)')
  const fits = await page.locator('figure').evaluateAll((fs) => fs.every((f) => { const b = f.querySelector('div').getBoundingClientRect(), i = f.querySelector('img').getBoundingClientRect(); return i.width <= b.width + 1 && i.height <= b.height + 1 }))
  must(fits, 'every photo is scaled to fit its cell (never cropped)')
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { n: d.files.length, name: d.files[0].name, type: d.files[0].type, size: d.files[0].size } } })
  await page.getByRole('button', { name: 'แชร์แฟ้มประจำสัปดาห์เป็น PDF' }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 60000 })
  const sh = await page.evaluate(() => window.__shared)
  must(sh.type === 'application/pdf' && /^แฟ้มประจำสัปดาห์-\d{4}-\d{2}-\d{2}\.pdf$/.test(sh.name) && sh.size > 5000, 'one PDF handed to the share sheet: ' + JSON.stringify(sh))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('weekfile-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
