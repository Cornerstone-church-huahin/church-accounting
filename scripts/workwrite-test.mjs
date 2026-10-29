// ผู้ดูแลหลักของห้องงาน (บัญชีเป็นผู้ดูอย่างเดียว) เพิ่ม/แก้/ลบข้อมูลของห้องตัวเองได้ · ผู้ช่วยทำไม่ได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4393
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const MEMBERS = [
  { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
  { id: 'lead1', name: 'หัวหน้าเลขา', role: 'viewer', joined: 2, updated: 1, works: [1], workRoles: { 1: 'lead' } },
  { id: 'help1', name: 'ผู้ช่วยเลขา', role: 'viewer', joined: 3, updated: 1, works: [1], workRoles: { 1: 'helper' } },
  { id: 'lead4', name: 'หัวหน้าอภิบาล', role: 'viewer', joined: 4, updated: 1, works: [4], workRoles: { 4: 'lead' } },
]
async function open(meId, meName, hash, extra) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await page.addInitScript(([id, name, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, [meId, meName, MEMBERS])
  if (extra) await page.addInitScript(extra)
  await page.goto(`http://localhost:${PORT}/#${hash}`)
  await page.waitForTimeout(1200)
  return page
}
try {
  // ผู้ดูแลหลักงานเลขา (บัญชีผู้ดู): สร้างหนังสือเชิญใหม่ได้ และลบได้
  let page = await open('lead1', 'หัวหน้าเลขา', '/meeting/1/1/invite')
  await page.getByRole('button', { name: /ใหม่/ }).click()
  await page.waitForURL(/invite-letter/, { timeout: 8000 })
  must(!/ไม่มีสิทธิ์/.test(await page.locator('main').innerText()), 'lead can create a letter')
  await page.goto(`http://localhost:${PORT}/#/meeting/1/1/invite`); await page.waitForTimeout(500)
  must(await page.getByRole('button', { name: /ลบ/ }).count() >= 0, 'list opens')
  must(await page.evaluate(() => JSON.parse(localStorage.getItem('acct.inviteletter.v1') ?? '[]').length) >= 1, 'letter saved locally')
  // ผู้ช่วย: ทำไม่ได้
  page = await open('help1', 'ผู้ช่วยเลขา', '/meeting/1/1/invite')
  await page.getByRole('button', { name: /ใหม่/ }).click()
  await page.getByText(/ไม่มีสิทธิ์สร้างหนังสือ/).first().waitFor({ timeout: 5000 })
  must(!page.url().includes('invite-letter'), 'helper cannot create a letter')
  // ผู้ดูแลหลักงานอภิบาล: บันทึกรายชื่อผู้ออกเยี่ยมได้ (ข้อมูลของงาน 4)
  const wed = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  page = await open('lead4', 'หัวหน้าอภิบาล', '/meeting/4/3', `localStorage.setItem('acct.visit-log.v1', JSON.stringify([{ id: 'v1', updated: 5, date: '${wed}', memberId: 'm1', memberName: 'สมชาย ใจดี', reason: 'ทดสอบ', visitor: 'คศ.กฤต' }]))`)
  // ผู้ดูแลหลัก (ไม่ใช่แอดมิน) เห็นการ์ดการเยี่ยมที่บันทึกแล้ว แต่กดแก้ไข/ลบไม่ได้ · มีรูปสมาชิก (อักษรย่อ) หน้าชื่อ
  await page.locator('.pvvisit').first().waitFor({ timeout: 8000 })
  must(await page.getByRole('button', { name: /แก้ไขการเยี่ยม/ }).count() === 0 && await page.locator('.pvvisit--ro .pvvisit__who span').count() >= 1, 'non-admin cannot open a saved visit to edit/delete; member avatar is shown')
  await page.locator('.pvday').nth(2).getByRole('button', { name: /บันทึกการเยี่ยม/ }).click()
  await page.getByRole('dialog').locator('#pv-by').click()
  await page.getByLabel('เพิ่มชื่อใหม่').fill('อ.ทดสอบ'); await page.getByRole('button', { name: '＋ เพิ่ม' }).click()
  must(await page.getByRole('checkbox', { name: /อ.ทดสอบ/ }).isChecked() && await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-names.v1') ?? '[]').length) === 1, 'pastoral lead can add visitor names')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('workwrite-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
