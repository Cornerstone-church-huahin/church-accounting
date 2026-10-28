// สมุดส่วนตัวแอดมิน: ไอคอนในหัวงาน (เห็นเฉพาะแอดมิน) · เพิ่ม/แก้/ลบรายการ · แถบ % ถ่วงน้ำหนัก · ชั่วโมงที่ประหยัด · บันทึกอิสระ · ภาพรวมทุกงาน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4219
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const MEMBERS = [
  { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
  { id: 'sec1', name: 'เลขาธิการ', role: 'bookkeeper', joined: 2, updated: 1, works: [1] },
]
async function open(meId, meName, path) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(([id, name, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, [meId, meName, MEMBERS])
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await page.goto(`http://localhost:${PORT}/#/${path}`)
  await page.waitForTimeout(1000)
  return page
}
try {
  // เลขา: ไม่เห็นไอคอน และเข้าตรง ๆ ไม่ได้
  const sec = await open('sec1', 'เลขาธิการ', 'meeting/1')
  await sec.getByRole('heading', { name: 'งานเลขา', exact: true }).waitFor({ timeout: 5000 })
  must(await sec.getByRole('link', { name: 'สมุดส่วนตัวแอดมิน' }).count() === 0, 'secretary does not see the notebook icon')
  await sec.goto(`http://localhost:${PORT}/#/meeting/1/admin`); await sec.waitForTimeout(600)
  must(await sec.getByText('สมุดส่วนตัว').count() === 0 && await sec.getByLabel('สรุปที่แบ่งเบา').count() === 0, 'secretary cannot open the notebook by URL')
  // แอดมิน
  const p = await open('ad1', 'แอดมิน', 'meeting/1')
  await p.getByRole('link', { name: 'สมุดส่วนตัวแอดมิน' }).click()
  await p.getByRole('heading', { name: /สมุดส่วนตัว · งานเลขา/, level: 1 }).waitFor({ timeout: 5000 })
  // ตั้งรหัสครั้งแรก
  must(await p.getByText(/ถ้าลืมรหัส กู้ข้อมูลในสมุดคืนไม่ได้/).count() === 1, 'first time: warns that a forgotten passcode cannot be recovered')
  await p.getByLabel(/^รหัสผ่าน/).fill('abc'); await p.getByLabel('พิมพ์รหัสผ่านอีกครั้ง').fill('abc'); await p.getByRole('button', { name: 'ตั้งรหัสและเปิดสมุด' }).click()
  must(await p.getByRole('alert').filter({ hasText: 'อย่างน้อย 6 ตัว' }).count() >= 1 && await p.getByLabel('สรุปที่แบ่งเบา').count() === 0, 'too short passcode refused')
  await p.getByLabel(/^รหัสผ่าน/).fill('secret-123'); await p.getByLabel('พิมพ์รหัสผ่านอีกครั้ง').fill('secret-124'); await p.getByRole('button', { name: 'ตั้งรหัสและเปิดสมุด' }).click()
  must(await p.getByRole('alert').filter({ hasText: 'รหัสผ่านสองช่องไม่ตรงกัน' }).count() >= 1, 'mismatching confirmation refused')
  await p.getByLabel('พิมพ์รหัสผ่านอีกครั้ง').fill('secret-123'); await p.getByRole('button', { name: 'ตั้งรหัสและเปิดสมุด' }).click()
  await p.getByLabel('สรุปที่แบ่งเบา').waitFor({ timeout: 8000 })
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '0', 'empty = 0%')
  const add = async (title, weight, hours, status) => {
    await p.getByRole('button', { name: '➕ เพิ่มรายการ' }).click()
    await p.getByLabel('ชื่อรายการ').fill(title); await p.getByLabel(/^รายละเอียด/).fill('เดิมประธานทำเอง → ตอนนี้เลขาทำ')
    await p.getByLabel(/^น้ำหนัก/).selectOption(String(weight)); await p.getByLabel(/^ชม./).fill(String(hours)); await p.getByLabel('สถานะ', { exact: true }).selectOption(status)
    await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
  }
  await add('ส่งเอกสารเทศบาล', 5, 4, 'done')
  await add('ทำหนังสือเชิญ', 5, 2, 'part')
  await add('จัดการประชุม', 10, 10, 'todo')
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '38', 'weighted percent 38%')
  must((await p.getByLabel('สรุปที่แบ่งเบา').innerText()).includes('5 จาก 16 ชม.'), 'hours saved shown')
  await p.getByRole('button', { name: /^ส่งเอกสารเทศบาล: แบ่งเบาแล้ว/ }).click()
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '13', 'cycling status updates percent (done → todo)')
  await p.getByRole('button', { name: 'แก้ ทำหนังสือเชิญ' }).click(); await p.getByLabel('สถานะ', { exact: true }).selectOption('done'); await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '25', 'edit status to done')
  p.once('dialog', (d) => d.accept()); await p.getByRole('button', { name: 'ลบ จัดการประชุม' }).click()
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '50' && await p.getByRole('list', { name: 'รายการที่แบ่งเบา' }).locator('li').count() === 2, 'delete removes the item from the percent')
  // บันทึกอิสระ
  await p.getByRole('button', { name: '➕ เพิ่มบันทึก' }).click(); await p.getByLabel('บันทึก', { exact: true }).fill('วันนี้เลขาไปส่งเอกสารเองครั้งแรก'); await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must((await p.getByRole('list', { name: 'บันทึกอิสระ' }).innerText()).includes('เลขาไปส่งเอกสารเอง'), 'free note saved')
  // ไฟล์ที่เก็บ/ซิงก์ต้องไม่มีข้อความจริง
  const raw = await p.evaluate(() => localStorage.getItem('acct.adminnotes.v1'))
  must(raw && raw.includes('"enc"') && !raw.includes('เทศบาล') && !raw.includes('เลขาไปส่งเอกสารเอง') && !raw.includes('ทำหนังสือเชิญ'), 'stored data is encrypted (no readable text)')
  // ภาพรวม + ค้างหลังรีโหลด
  must(await p.getByLabel('ภาพรวมทุกงาน').count() === 1, 'overview of works with items')
  await p.reload(); await p.getByLabel('สรุปที่แบ่งเบา').waitFor({ timeout: 5000 })
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '50', 'data persists')
  // เครื่องอื่นของแอดมิน: ข้อมูลชุดเดียวกัน แต่ต้องใส่รหัส
  const other = await open('ad1', 'แอดมิน', 'meeting/1/admin')
  await other.evaluate((v) => { localStorage.setItem('acct.adminnotes.v1', v) }, raw)
  await other.reload(); await other.getByLabel('ปลดล็อกสมุดส่วนตัว').waitFor({ timeout: 8000 })
  must(await other.getByLabel('สรุปที่แบ่งเบา').count() === 0, 'another device starts locked')
  await other.getByLabel(/^รหัสผ่าน/).fill('wrong-pass'); await other.getByRole('button', { name: 'ปลดล็อก' }).click()
  await other.getByText('รหัสผ่านไม่ถูกต้อง').first().waitFor({ timeout: 8000 })
  await other.getByLabel(/^รหัสผ่าน/).fill('secret-123'); await other.getByRole('button', { name: 'ปลดล็อก' }).click()
  await other.getByLabel('สรุปที่แบ่งเบา').waitFor({ timeout: 8000 })
  must((await other.getByRole('meter').first().getAttribute('aria-valuenow')) === '50', 'right passcode opens the same notebook on another device')
  await other.getByRole('button', { name: /ล็อกสมุด/ }).click()
  await other.getByLabel('ปลดล็อกสมุดส่วนตัว').waitFor({ timeout: 5000 })
  // งานอื่นแยกกัน
  await p.goto(`http://localhost:${PORT}/#/meeting/9/admin`)
  await p.getByRole('heading', { name: /สมุดส่วนตัว · งานอนุชน/ }).waitFor({ timeout: 5000 })
  must((await p.getByRole('meter').first().getAttribute('aria-valuenow')) === '0', 'each work has its own notebook')
  // ข้อมูลรุ่นก่อนเข้ารหัส (ตัวอักษรปกติ) → ถูกเข้ารหัสให้เมื่อตั้งรหัส
  const old = await open('ad1', 'แอดมิน', 'meeting/1/admin')
  await old.evaluate(() => localStorage.setItem('acct.adminnotes.v1', JSON.stringify([{ id: 'an-old', updated: 5, work: 1, kind: 'gain', title: 'รายการเก่าไม่เข้ารหัส', weight: 5, status: 'done' }])))
  await old.reload(); await old.getByLabel('ตั้งรหัสสมุดส่วนตัว').waitFor({ timeout: 8000 })
  await old.getByLabel(/^รหัสผ่าน/).fill('legacy-pass'); await old.getByLabel('พิมพ์รหัสผ่านอีกครั้ง').fill('legacy-pass'); await old.getByRole('button', { name: 'ตั้งรหัสและเปิดสมุด' }).click()
  await old.getByLabel('สรุปที่แบ่งเบา').waitFor({ timeout: 8000 })
  must((await old.getByRole('meter').first().getAttribute('aria-valuenow')) === '100' && (await old.getByRole('list', { name: 'รายการที่แบ่งเบา' }).innerText()).includes('รายการเก่าไม่เข้ารหัส'), 'legacy item still visible after setting the passcode')
  must(!(await old.evaluate(() => localStorage.getItem('acct.adminnotes.v1'))).includes('รายการเก่าไม่เข้ารหัส'), 'legacy plaintext was encrypted')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('adminnotes-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
