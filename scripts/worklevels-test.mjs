// ตำแหน่งต่อห้องงาน: ผู้ดูแลหลัก (แก้ได้ทุกอย่าง) · ผู้ช่วย (ลงปฏิทิน+แชท ที่เหลือดูอย่างเดียว) · ที่ปรึกษา (แชท ที่เหลือดูอย่างเดียว) · แอดมินตั้ง/เปลี่ยนตำแหน่งได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4207
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
const members = [
  { id: 'me1', name: 'แอดมิน', role: 'admin', status: 'active', joined: 1, updated: 1 },
  { id: 'u1', name: 'ผู้ดูแลโรงครัว', role: 'viewer', status: 'active', joined: 1, updated: 1, works: [14] }, // ข้อมูลเดิม (ไม่ระบุตำแหน่ง) = ผู้ดูแลหลัก
  { id: 'u2', name: 'ผู้ช่วยโรงครัว', role: 'viewer', status: 'active', joined: 1, updated: 1, works: [14], workRoles: { 14: 'helper' } },
  { id: 'u3', name: 'ที่ปรึกษาโรงครัว', role: 'viewer', status: 'active', joined: 1, updated: 1, works: [14], workRoles: { 14: 'advisor' } },
]
const open = async (meId, hash) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  await page.addInitScript(([meId, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'tok', name: meId }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: meId }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, [meId, members])
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  await page.goto(`http://localhost:${PORT}/#${hash}`); await page.waitForLoadState('networkidle')
  return page
}
const canEditFood = async (p) => /แตะแถวในตารางเพื่อบันทึกชื่อผู้ถวาย/.test(await p.locator('main').innerText())
const calendarAddForm = async (p) => {
  await p.getByRole('button', { name: /ตารางงาน/ }).click()
  await p.getByRole('region', { name: 'ปฏิทินงาน' }).waitFor()
  await p.locator('.wcal__day.today').click()
  await p.getByRole('dialog').waitFor()
  return (await p.locator('#ce-t').count()) > 0
}
try {
  for (const [id, label, edits, cal, badge] of [['u1', 'ผู้ดูแลหลัก', true, true, 'ผู้ดูแลหลัก'], ['u2', 'ผู้ช่วย', false, true, 'ผู้ช่วย'], ['u3', 'ที่ปรึกษา', false, false, 'ที่ปรึกษา']]) {
    const p = await open(id, '/meeting/14/1')
    must(await canEditFood(p) === edits, `${label}: can edit the room data = ${edits}`)
    await p.goto(`http://localhost:${PORT}/#/meeting/14`); await p.waitForLoadState('networkidle')
    must(new RegExp(`ตำแหน่งของคุณ: ${badge}`).test(await p.locator('main').innerText()), `${label}: sees own position badge`)
    must(await calendarAddForm(p) === cal, `${label}: calendar add form = ${cal}`)
    if (!cal) must(/ดูอย่างเดียว/.test(await p.getByRole('dialog').innerText()), 'advisor sees the read-only note')
  }
  // แอดมินเปลี่ยนตำแหน่งในตั้งค่า
  const a = await open('me1', '/settings')
  await a.getByText(/ผู้ใช้ร่วมและสิทธิ์/).first().click()
  const sel = a.getByLabel('ตำแหน่งของ ผู้ช่วยโรงครัว ใน งานโรงครัว')
  await a.getByText(/ตำแหน่งในงาน: งานโรงครัว/).first().waitFor()
  await a.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  await sel.selectOption('advisor')
  const saved = await a.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((m) => m.id === 'u2').workRoles)
  must(saved['14'] === 'advisor', 'admin changed the position: ' + JSON.stringify(saved))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('worklevels-test OK')
} finally { await browser.close(); server.kill() }
