// สิทธิ์ "ผู้บันทึกการนมัสการ" และ "พักสิทธิ์" (ข้อมูลสมมติ) — npm run build && node scripts/worship-role-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4188
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
async function open(paused) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  await page.addInitScript((paused) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ผู้ช่วยทดสอบ' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'pw1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([
      { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
      { id: 'pw1', name: 'ผู้ช่วยทดสอบ', role: 'worship', joined: 2, updated: 1, ...(paused ? { paused: true } : {}) },
    ]))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([
      { id: 'm1', name: 'นายสมชาย ตัวอย่าง', nick: 'ชาย', code: '001', group: 'ผู้ใหญ่', tel: '0812345678', birth: '1980-03-15', status: '1.สมบูรณ์ ( 1 )', since: '2005-03-06', updated: 1 },
    ]))
    localStorage.setItem('acct.recorders.v1', JSON.stringify([{ id: 'rc1', name: 'ผู้ช่วย ก', updated: 1 }]))
  }, paused)
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForTimeout(1200)
  return page
}
try {
  let page = await open(false)
  must(page.url().includes('#/members'), 'ผู้บันทึกการนมัสการต้องถูกพามาหน้าสมาชิก: ' + page.url())
  const nav = await page.locator('.bottomnav a').allInnerTexts()
  must(nav.length === 1 && nav[0].includes('สมาชิก'), 'แถบล่างต้องมีเมนูสมาชิกเมนูเดียว: ' + nav.join('|'))
  await page.goto(`http://localhost:${PORT}/#/income`)
  await page.waitForTimeout(500)
  must(page.url().includes('#/members'), 'เข้าหน้ารายรับตรง ๆ ต้องถูกพากลับ')
  // ผู้บันทึกการนมัสการลงชื่อ แก้ไข และลบการลงชื่อได้เหมือนแอดมิน (ไม่เห็นเบอร์/วันเกิด ไม่มีปุ่มลบสมาชิก)
  await page.getByLabel('ค้นหาชื่อ').fill('สมชาย')
  await page.getByRole('button', { name: /^ลงทะเบียน นายสมชาย/ }).click()
  await page.locator('.doneList li', { hasText: 'นายสมชาย' }).waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: /^แก้ไขข้อมูล นายสมชาย/ }).click()
  const ef = await page.locator('[role=dialog]').innerText()
  must(!ef.includes('โทรศัพท์') && !ef.includes('วันเกิด') && !/(^|\n)ลบ(\n|$)/.test(ef), 'edit from check-in hides phone/birth and has no delete-member')
  await page.locator('[role=dialog]').getByRole('button', { name: 'ปิด' }).click()
  await page.getByRole('button', { name: /^ลบการลงชื่อของ นายสมชาย/ }).click()
  await page.getByRole('dialog', { name: 'ลบการลงชื่อนี้?' }).getByRole('button', { name: 'ลบ', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'ลบการลงชื่อของ' }).waitFor({ timeout: 5000 })
  const tabs = await page.locator('[role=tab]').allInnerTexts()
  must(tabs.join(',') === 'ลงชื่อ,ยอดผู้มา,ทะเบียน', 'แท็บต้องมี 3 อัน: ' + tabs.join(','))
  await page.getByRole('tab', { name: 'ทะเบียน' }).click()
  const body = await page.locator('main').innerText()
  must(!body.includes('0812345678') && !body.includes('อายุ') && !body.includes('นำเข้า'), 'ห้ามเห็นเบอร์/อายุ/ปุ่มนำเข้า')
  await page.getByRole('button', { name: /ดูข้อมูล นายสมชาย/ }).click()
  const sheet = await page.locator('[role=dialog]').innerText()
  must(!sheet.includes('0812345678') && !sheet.includes('วันเกิด') && !sheet.includes('โทรศัพท์') && !sheet.includes('สถานะในทะเบียน'), 'หน้ารายละเอียดต้องไม่มีเบอร์/วันเกิด/สถานะ')
  await page.getByRole('button', { name: 'แก้ไขข้อมูล' }).click()
  const form = await page.locator('[role=dialog]').innerText()
  must(!form.includes('โทรศัพท์') && !form.includes('วันเกิด') && !/(^|\n)ลบ(\n|$)/.test(form), 'ฟอร์มแก้ไขต้องไม่มีเบอร์/วันเกิด/ปุ่มลบ: ' + form)
  await page.close()

  page = await open(true)
  const t = await page.locator('main').innerText()
  must(t.includes('ติดต่อแอดมิน') && t.includes('พัก'), 'ผู้ถูกพักสิทธิ์ต้องเห็นข้อความติดต่อแอดมิน: ' + t.slice(0, 120))
  must(!(await page.locator('main').innerText()).includes('นายสมชาย'), 'ผู้ถูกพักสิทธิ์ต้องไม่เห็นรายชื่อ')
  must(errors.length === 0, 'JS errors: ' + errors.join(' | '))
  console.log('worship-role-test OK')
} catch (e) { console.error(String(e)); process.exitCode = 1 } finally { await browser.close(); server.kill() }
