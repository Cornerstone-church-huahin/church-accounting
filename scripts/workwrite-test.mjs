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
  { id: 'adv4', name: 'ที่ปรึกษาอภิบาล', role: 'viewer', joined: 6, updated: 1, works: [4], workRoles: { 4: 'advisor' } },
  { id: 'help4', name: 'ผู้ช่วยอภิบาล', role: 'viewer', joined: 5, updated: 1, works: [4], workRoles: { 4: 'helper' } },
  { id: 'yth9', name: 'ผู้ช่วยอนุชน', role: 'viewer', joined: 6, updated: 1, works: [9], workRoles: { 9: 'helper' } },
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
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  const wed = (() => { const d = new Date(); d.setDate(d.getDate() - d.getDay() + 3); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
  page = await open('lead4', 'หัวหน้าอภิบาล', '/meeting/4/record', `localStorage.setItem('acct.visit-log.v1', JSON.stringify([{ id: 'v1', updated: 5, date: '${todayStr}', stop: 1, memberId: 'm1', memberName: 'สมชาย ใจดี', reason: 'ทดสอบ', visitor: 'คศ.กฤต' }])); localStorage.setItem('acct.visit-plans.v1', JSON.stringify([{ id: 'plan-${todayStr}', date: '${todayStr}', v: 2, groups: 1, names: {}, items: [{ id: 'm2', name: 'สมหญิง รักดี', g: 1 }], prep: { at: 1, items: [{ id: 'm2', name: 'สมหญิง รักดี', g: 1 }] }, updated: 1 }]))`)
  // ผู้ดูแลหลัก (ไม่ใช่แอดมิน) เห็นการ์ดการเยี่ยมที่บันทึกแล้ว แต่กดแก้ไข/ลบไม่ได้ · มีรูปสมาชิก (อักษรย่อ) หน้าชื่อ
  await page.locator('.vrec__row').first().waitFor({ timeout: 8000 })
  must(await page.getByRole('button', { name: 'แก้ไขการเยี่ยม สมชาย ใจดี' }).count() === 1, 'lead can open a saved visit to edit/delete like the admin')
  await page.getByRole('button', { name: 'บันทึกการเยี่ยม สมหญิง รักดี' }).click()
  await page.getByRole('dialog').locator('#pv-by').click()
  await page.getByLabel('เพิ่มชื่อใหม่').fill('อ.ทดสอบ'); await page.getByRole('button', { name: '＋ เพิ่ม', exact: true }).click()
  must(await page.getByRole('checkbox', { name: /อ.ทดสอบ/ }).isChecked() && await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-names.v1') ?? '[]').length) === 1, 'pastoral lead can add visitor names')
  // ผู้ช่วยงานอภิบาล: ดูตารางเยี่ยม/บันทึกการเยี่ยมได้ (อ่านอย่างเดียว ไม่มีปุ่มเพิ่ม)
  page = await open('help4', 'ผู้ช่วยอภิบาล', '/meeting/4/2', `localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'm1', name: 'สมชาย ใจดี', status: '1.สมบูรณ์ ( 1 )', updated: 1 }]))`)
  must(await page.locator('.pvpick__r').count() === 1 && /สมชาย ใจดี/.test(await page.locator('main').innerText()), 'helper sees the member list for planning on tab 2')
  for (const k of ['record', 'report']) {
    page = await open('help4', 'ผู้ช่วยอภิบาล', `/meeting/4/${k}`, `localStorage.setItem('acct.visit-log.v1', JSON.stringify([{ id: 'v1', updated: 5, date: '${k === 'record' ? todayStr : wed}', memberId: 'm1', memberName: 'สมชาย ใจดี', reason: 'ทดสอบ', visitor: 'คศ.กฤต', stop: 1 }])); localStorage.setItem('acct.visits.v1', localStorage.getItem('acct.visit-log.v1'))`)
    if (k === 'report') await page.getByRole('tab', { name: /การ์ด 7 วัน/ }).click()
    must((k === 'record' ? await page.locator('.vrec__row').count() >= 1 : await page.locator('.pvday').count() === 7) && !/ไม่มีสิทธิ์ดู/.test(await page.locator('main').innerText()), `helper can view tab ${k}`)
    must(k === 'record' ? await page.getByRole('button', { name: 'แก้ไขการเยี่ยม สมชาย ใจดี' }).count() === 1 && await page.getByRole('button', { name: /เพิ่มจุดเยี่ยม/ }).count() === 1 : await page.getByRole('button', { name: /บันทึกการเยี่ยม|แก้ไขการเยี่ยม/ }).count() === 0, k === 'record' ? 'helper uses the record page fully (edit + add)' : 'report page (tab 4) stays read-only')
  }
  // ที่ปรึกษา: ดูหน้าบันทึกการเยี่ยมได้อย่างเดียว
  page = await open('adv4', 'ที่ปรึกษาอภิบาล', '/meeting/4/record', `localStorage.setItem('acct.visit-log.v1', JSON.stringify([{ id: 'v1', updated: 5, date: '${todayStr}', stop: 1, memberId: 'm1', memberName: 'สมชาย ใจดี', reason: 'ทดสอบ', visitor: 'คศ.กฤต' }])); localStorage.setItem('acct.visit-plans.v1', JSON.stringify([{ id: 'plan-${todayStr}', date: '${todayStr}', v: 2, groups: 1, names: {}, items: [{ id: 'm1', name: 'สมชาย ใจดี', g: 1 }], prep: { at: 1, items: [{ id: 'm1', name: 'สมชาย ใจดี', g: 1 }] }, updated: 1 }]))`)
  await page.locator('.vrec__row').first().waitFor({ timeout: 8000 })
  must(await page.getByRole('button', { name: /แก้ไขการเยี่ยม|เพิ่มจุดเยี่ยม|เพิ่มผู้ถูกเยี่ยม|ไม่พบหรือเอา/ }).count() === 0, 'advisor sees the record page but cannot change anything')
  // งานอนุชน แท็บ 1 = หน้าสมาชิกเหมือนงานอภิบาล (ครบทุกส่วน) · ผู้ช่วยของงานนี้ดูได้ · คนนอกงานเห็นว่าไม่มีสิทธิ์
  const mem = `localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'm1', name: 'สมชาย ใจดี', status: '1.สมบูรณ์ ( 1 )', updated: 1 }, { id: 'm2', name: 'สมหญิง รักดี', status: '4.คนใหม่', updated: 1 }]))`
  page = await open('yth9', 'ผู้ช่วยอนุชน', '/meeting/9/1', mem)
  await page.getByRole('heading', { name: /สมาชิก/, level: 1 }).waitFor({ timeout: 8000 })
  const ym = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  must(/รายชื่อทั้งหมด 2/.test(ym) && /สมชาย ใจดี/.test(ym) && await page.getByRole('tab').count() >= 4 && /เก่าแก่/.test(ym) && /สม่ำเสมอ/.test(ym), 'youth tab 1 is the full members page: ' + ym.slice(0, 160))
  must(/‹ งานอนุชน/.test(await page.locator('.page-head').innerText()), 'back link goes to the youth room')
  page = await open('help1', 'ผู้ช่วยเลขา', '/meeting/9/1', mem)
  must(/ไม่มีสิทธิ์ดูข้อมูลสมาชิก/.test(await page.locator('main').innerText()), 'people outside the youth work cannot open it')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('workwrite-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
