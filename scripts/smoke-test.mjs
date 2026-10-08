// ทดสอบวิ่งใช้งานจริงบนมือถือ (โหมดทดลองในเครื่อง): npm run build && node scripts/smoke-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const PORT = 4173
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && !/fonts\.g|ERR_|Failed to load resource/.test(m.text()) && errors.push(m.text()))
const base = `http://localhost:${PORT}/`
const shot = (n) => page.screenshot({ path: `shots/${n}.png`, fullPage: true })
const go = async (hash) => { await page.goto(base + '#' + hash); await page.waitForLoadState('networkidle') }
const must = async (cond, msg) => { if (!cond) throw new Error('FAIL: ' + msg) }

const today = new Date()
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sunday = new Date(today); sunday.setDate(today.getDate() - today.getDay())
const sun = iso(sunday)
const dmY = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear() + 543}`

await go('/')
await must(await page.getByText('โหมดทดลองคนเดียว').isVisible(), 'solo banner')
await shot('01-home-empty')

// ตั้งค่า: บัญชี + ประเภทถวาย
await go('/settings')
await page.getByLabel('ชื่อบัญชี').fill('บัญชีหลัก')
await page.getByLabel('ธนาคาร', { exact: true }).fill('กสิกรไทย')
await page.getByLabel('เลขท้าย 4 ตัว').fill('1234')
await page.getByRole('button', { name: 'เพิ่มบัญชี' }).click()
await page.getByLabel('ชื่อประเภทถวายใหม่').fill('ถวายค่าไฟ')
await page.getByRole('button', { name: 'เพิ่ม', exact: true }).click()
await must(await page.getByText('ถวายค่าไฟ').first().isVisible(), 'custom income type')
await shot('02-settings')

// รายรับโอน
await go('/income')
await page.getByRole('button', { name: '＋ บันทึกรายรับ' }).click()
await page.getByLabel('จำนวนเงิน (บาท)').fill('1500')
await page.getByLabel('เลขอ้างอิงการโอน').fill('REF123456')
await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
await must(await page.getByText('อ้างอิง REF123456').isVisible(), 'income transfer saved with ref')
await shot('03-income')

// งบประมาณ
await go('/budget')
await page.getByRole('button', { name: 'สร้างหมวดงบมาตรฐาน (แก้ได้)' }).click()
await page.getByRole('button', { name: '🚨 เพิ่มงบฉุกเฉิน' }).click()
await page.getByLabel('จำนวนเงิน (บาท)').fill('50000')
await page.getByLabel(/เหตุผล/).fill('มติที่ประชุม')
await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
await page.getByText('ประวัติการปรับงบ (1)').waitFor()
await page.getByRole('button', { name: '± ปรับงบ' }).click()
await page.getByLabel('หมวด', { exact: true }).selectOption({ label: /ซ่อมแซม/ }).catch(async () => { await page.getByLabel('หมวด', { exact: true }).selectOption({ index: 2 }) })
await page.getByLabel('จำนวนเงิน (บาท)').fill('20000')
await page.getByLabel(/เหตุผล/).fill('ตั้งงบซ่อมแซม')
await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
await page.getByText('ประวัติการปรับงบ (2)').waitFor()
await shot('04-budget')

// รอบอาทิตย์
await go(`/rounds/${sun}`)
await page.getByLabel('ถวายทั่วไป').fill('3000')
await page.getByLabel('ทศางค์').fill('2000')
await page.getByText('จำนวนธนบัตร/เหรียญ').click()
await page.getByLabel('ธนบัตร 1000').fill('3'); await page.getByLabel('ธนบัตร 500').fill('4')
await page.getByRole('button', { name: 'บันทึกยอดนับ' }).click()
await page.getByRole('button', { name: /ฉันนับซ้ำแล้ว/ }).waitFor()
await page.getByRole('button', { name: /ฉันนับซ้ำแล้ว/ }).click()
await page.getByText('ยืนยันแล้วโดย').waitFor()
await page.getByLabel('ยอดที่ฝาก (บาท)', { exact: false }).fill('5000')
await page.getByRole('button', { name: 'บันทึกการนำฝาก' }).click()
await must(await page.getByText('ยอดฝากตรงกับยอดนับ').isVisible(), 'deposit matches')
await shot('05-round')
await go('/income')
await must(await page.getByText('รอบนับ').first().isVisible(), 'round income appears in income list')

// สเตตเมนต์
const csv = `วันที่,รายการ,ถอน,ฝาก,ยอดคงเหลือ\n${dmY(sunday)},ฝากเงินสด,,"5,000.00","5,000.00"\n${dmY(sunday)},โอนเข้า REF123456,,"1,500.00","6,500.00"\n${dmY(sunday)},ค่าธรรมเนียม,10.00,,"6,490.00"\n`
fs.mkdirSync('shots', { recursive: true }); fs.writeFileSync('shots/stmt.csv', csv)
await go('/rounds/statement')
await page.getByRole('button', { name: '⬆️ อัปโหลดสเตตเมนต์' }).click()
await page.getByLabel(/ไฟล์ \(CSV/).setInputFiles('shots/stmt.csv')
await page.getByText('อ่านได้ 3 รายการ').waitFor()
await shot('06-upload')
await page.getByRole('button', { name: 'นำเข้า 3 รายการ' }).click()
await page.getByText(/นำเข้า 3 รายการใหม่/).waitFor()
await page.getByRole('button', { name: 'ปิด' }).click()
await page.getByRole('button', { name: 'ยอมรับทั้งหมด' }).click()
await page.getByRole('button', { name: 'ทั้งหมด' }).click()
await page.getByText('ฝากเงินสด รอบ').first().waitFor()
await page.getByRole('button', { name: 'ยังไม่จับคู่' }).click()
await shot('07-statement-matched')
await page.getByRole('button', { name: 'จับคู่เอง…' }).click()
await page.getByLabel('คำอธิบาย').fill('ค่าธรรมเนียมธนาคาร')
await page.getByRole('button', { name: 'บันทึกว่าเป็นรายการอื่น' }).click()
await must(await page.getByText('จับคู่ครบทุกรายการแล้ว').isVisible(), 'all matched')

// ใบเบิก (เกินเกณฑ์ 2,000 → 2 ขั้น)
await go('/vouchers')
await page.getByRole('button', { name: '＋ ทำใบเบิก' }).click()
await page.getByLabel('จ่ายให้ (ผู้รับเงิน/ร้านค้า)').fill('ร้านไฟฟ้า')
await page.getByLabel('รายการที่เบิก').fill('ซื้อหลอดไฟ')
await page.getByLabel('จำนวนเงิน (บาท)').fill('3000')
await page.getByLabel('หมวดงบประมาณ').selectOption({ index: 2 })
await page.getByRole('button', { name: 'ยื่นใบเบิก' }).click()
await page.getByText('ร้านไฟฟ้า').first().click()
page.once('dialog', (d) => d.accept(''))
await page.getByRole('button', { name: '✓ อนุมัติ' }).click()
await page.getByText('การอนุมัติ (1/2)').waitFor()
page.once('dialog', (d) => d.accept(''))
await page.getByRole('button', { name: '✓ อนุมัติ' }).click()
await page.getByText('การอนุมัติ (2/2)').waitFor()
await page.getByRole('button', { name: '💸 บันทึกการจ่ายเงิน' }).click()
await page.getByRole('button', { name: 'บันทึกการจ่าย', exact: true }).click()
await page.getByText('จ่ายแล้ว รอใบเสร็จ').first().waitFor()
await shot('08-voucher')
await go('/vouchers')
await must(await page.getByText('จ่ายแล้ว รอใบเสร็จ').first().isVisible(), 'weekly summary shows stage')
await shot('09-vouchers')

// รายงาน
await go('/reports')
await page.getByRole('button', { name: 'รายปี' }).click()
await page.getByText('รายรับแยกตามประเภทถวาย').first().waitFor()
await must((await page.locator('figure.chart svg').count()) >= 3, 'charts rendered')
await shot('10-report-year')
await page.emulateMedia({ media: 'print' })
await page.pdf({ path: 'shots/report.pdf', format: 'A4' })
await page.emulateMedia({ media: 'screen' })
await go('/')
await shot('11-home')
await page.setViewportSize({ width: 390, height: 800 })
// ความกว้างล้นจอ
const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
await must(!overflow, 'no horizontal overflow on home')

await browser.close(); server.kill()
if (errors.length) { console.error('console errors:\n' + errors.join('\n')); process.exit(1) }
console.log('SMOKE OK')
