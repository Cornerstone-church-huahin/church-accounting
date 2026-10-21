// หน้าแรก: ช่อง ภาระที่ดิน (6,000,000 ตัวอย่าง) → หน้าภาระที่ดิน (เงินสะสมเชื่อมกองทุนที่ดินจริง) · ปุ่มห้องทำงานอยู่ด้านบนของหน้าแรก
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4181
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 360, height: 780 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const noOverflow = async (m) => must(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow: ' + m)
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  const tiles = page.locator('nav[aria-label^="เงินคริสตจักร"] a.btile')
  must((await tiles.count()) === 6, 'six tiles')
  const t = await tiles.allInnerTexts()
  must(t[0].includes('หมุนเวียน') && t[1].includes('กองทุน') && t[2].includes('รวมเงินสด') && t[3].includes('หนี้ภายใน') && t[4].includes('หนี้ภายนอก'), 'other tiles unchanged: ' + t.join('|'))
  must(t[5].includes('ภาระที่ดิน') && t[5].includes('6,000,000') && !t.join().includes('รวมงาน'), 'sixth tile = ภาระที่ดิน 6,000,000: ' + t[5])
  const bs = await tiles.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height))
  must(Math.max(...bs) - Math.min(...bs) < 2, 'same tile size: ' + bs.join(','))
  await noOverflow('home'); await page.screenshot({ path: '/tmp/land-home.png' })
  // เตรียมข้อมูลกองทุนที่ดิน: ตั้งต้น 5,000 + ถวายเพิ่ม 1,000 − จ่ายออก 300 = 5,700
  const now = new Date(), iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const o = new Date(now); o.setDate(o.getDate() - 20)
  await page.evaluate(([T, Y, O]) => {
    const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
    set('opening', [{ id: 'opening', updated: 1, date: O, accounts: {}, cash: 0, unmoved: {}, funds: { tt4: 500000 }, own: 0 }])
    set(`income.${Y}`, [{ id: 'i1', date: T, typeId: 'tt4', amount: 100000, method: 'cash', source: 'manual', updated: 1 }])
    set(`expenses.${Y}`, [{ id: 'e1', channel: 'manual', date: T, amount: 30000, desc: 'ค่าสำรวจที่ดิน', catId: 'xq-6', fundId: 'tt4', status: 'paid', paidDate: T, method: 'cash', updated: 1 }])
  }, [iso(now), now.getFullYear(), iso(o)])
  await page.reload(); await page.waitForLoadState('networkidle')
  await tiles.nth(5).click()
  await page.getByRole('heading', { name: /ภาระที่ดิน/, level: 1 }).waitFor({ timeout: 5000 })
  must(await page.getByRole('heading', { name: /ภาระที่ดิน/, level: 1 }).isVisible() && await page.getByText(/หน้าต้นแบบ — เงินสะสมเชื่อมกองทุนที่ดินแล้ว/).isVisible(), 'prototype page header')
  const txt = await page.locator('.landpage').innerText()
  for (const k of ['ยอดภาระตั้งต้น', '6,000,000 บาท', 'ชำระแล้ว', 'ภาระคงเหลือ', 'วันที่อ้างอิง', 'เงินกองทุนที่ดินคงเหลือ', 'เงินถวายเพิ่มเติม', 'เงินสะสมและยอดชำระเป็นคนละส่วนกัน', 'เจ้าหนี้หรือคู่สัญญา', 'เอกสารอ้างอิง', 'เงื่อนไขการชำระ', 'กำหนดชำระ', 'หมายเหตุ', 'ประวัติการถวายและการชำระ']) must(txt.includes(k), 'page has ' + k)
  const row = (k) => page.locator('.landrow', { hasText: k }).innerText().then((t) => t.replace(/\s+/g, ' '))
  must(/5,700\.00 บาท/.test(await row('เงินกองทุนที่ดินคงเหลือ')), 'land fund balance 5,700: ' + await row('เงินกองทุนที่ดินคงเหลือ'))
  must(/1,000\.00 บาท/.test(await row('เงินถวายเพิ่มเติม')), 'additional offerings 1,000')
  const fl = await page.getByRole('list', { name: 'กองทุนที่ดินแต่ละกองทุน' }).innerText()
  must(fl.includes('กองทุนเพื่อที่ดินคริสตจักร') && fl.includes('5,700.00') && fl.includes('ถวายเพิ่ม 1,000.00'), 'per-fund line: ' + fl)
  const hist = await page.getByRole('list', { name: 'รายการล่าสุดของกองทุนที่ดิน' }).innerText()
  must(hist.includes('ค่าสำรวจที่ดิน') && hist.includes('−300.00') && hist.includes('+1,000.00'), 'history lists the movements: ' + hist)
  must((await page.locator('.landrow', { hasText: 'ชำระแล้ว' }).innerText()).includes('—') && /6,000,000 บาท/.test(await row('ยอดภาระตั้งต้น')), 'burden stays sample / unconnected')
  must((txt.match(/ยังไม่ระบุ/g) ?? []).length === 5, 'five "ยังไม่ระบุ" in the agreement section')
  must(await page.locator('.landpage input, .landpage textarea, .landpage button').count() === 0, 'no forms or action buttons')
  await noOverflow('land'); await page.screenshot({ path: '/tmp/land-page.png', fullPage: true })
  await page.getByRole('link', { name: /กองทุนเพื่อที่ดินคริสตจักร/ }).click()
  await page.getByText('เงินคงเหลือของกองทุนนี้').waitFor({ timeout: 5000 })
  await page.goBack(); await page.getByRole('heading', { name: /ภาระที่ดิน/, level: 1 }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: '‹ หน้าแรก' }).click()
  must(await page.getByText('เงินคริสตจักร ณ วันนี้').isVisible(), 'back to home')
  const work = page.getByRole('link', { name: /ห้องทำงาน/ })
  must(await work.isVisible(), 'ปุ่มห้องทำงาน at the top of home')
  const y = await work.boundingBox(), ty = await tiles.first().boundingBox()
  must(y.y < ty.y, 'work-room button sits above the money tiles')
  await page.screenshot({ path: '/tmp/land-home2.png' })
  await work.click()
  await page.getByRole('heading', { name: /ห้องทำงาน/ }).waitFor({ timeout: 5000 })
  await page.goto(`http://localhost:${PORT}/#/meeting/3`)
  await page.getByText('เงินคริสตจักร ณ วันนี้').waitFor({ timeout: 5000 })
  must(await page.getByRole('link', { name: /ห้องทำงาน/ }).count() === 0, 'no work-room button repeated inside the treasurer page of the work room')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('land-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
