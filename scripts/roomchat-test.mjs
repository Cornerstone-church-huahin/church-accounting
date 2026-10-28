// แชทห้องงาน ↔ แอดมิน ในปุ่มกระดิ่ง: ห้องเห็นข่าว+ข้อความจากแอดมิน ตอบกลับได้ · แอดมินเห็นว่าห้องไหนมีข้อความ (เลขแยกห้อง) ตอบได้ · ห้องอื่นเขียนไม่ได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4206
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
const now = Date.now()
const members = [{ id: 'me1', name: 'แอดมิน', role: 'admin', status: 'active', joined: 1, updated: 1 }, { id: 'u4', name: 'ผู้ช่วยอภิบาล', role: 'viewer', status: 'active', joined: 1, updated: 1, works: [4] }, { id: 'u5', name: 'คนงานสุสาน', role: 'viewer', status: 'active', joined: 1, updated: 1, works: [5] }]
const msg = (id, n, at, fromAdmin, text) => ({ id, updated: at, n, text, at, fromAdmin, byId: fromAdmin ? 'me1' : 'u4', by: fromAdmin ? 'แอดมิน' : 'ผู้ช่วยอภิบาล' })
const chatSeed = [msg('m1', 4, now - 5000, true, 'ช่วยส่งรายงานเยี่ยมสัปดาห์นี้ด้วย'), msg('m2', 1, now - 4000, false, 'ขอห้องประชุมวันเสาร์')]
const open = async (meId) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(([meId, members, chat]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'tok', name: meId }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: meId }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
    localStorage.setItem('acct.roomchat.v1', JSON.stringify(chat))
  }, [meId, members, chatSeed])
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  return page
}
try {
  // ผู้ช่วยห้องอภิบาล (งาน 4)
  let p = await open('u4')
  await p.goto(`http://localhost:${PORT}/#/meeting/4`); await p.waitForLoadState('networkidle')
  const bell = p.getByRole('button', { name: /ข่าวจากแอดมิน/ })
  must(/มีข้อความใหม่ 1/.test(await bell.getAttribute('aria-label')), 'room bell shows the admin message as new')
  await bell.click()
  const panel = p.getByRole('region', { name: 'ข่าวจากแอดมิน' })
  must(/ช่วยส่งรายงานเยี่ยม/.test(await panel.innerText()), 'room sees the admin message in the bell')
  must(!/ขอห้องประชุม/.test(await panel.innerText()), 'room does not see other rooms')
  await panel.getByLabel('เขียนถึงแอดมิน').fill('รับทราบ จะส่งวันศุกร์')
  await panel.getByRole('button', { name: /ส่ง$/ }).click()
  await panel.getByText('รับทราบ จะส่งวันศุกร์').waitFor()
  must(await p.evaluate(() => JSON.parse(localStorage.getItem('acct.roomchat.v1')).some((m) => m.n === 4 && !m.fromAdmin && m.text.includes('รับทราบ'))), 'reply stored as a room message')
  await panel.getByRole('button', { name: 'ปิดข่าว' }).click()
  must(!/มีข้อความใหม่/.test(await bell.getAttribute('aria-label')), 'read → bell calm')
  // ห้องอื่น (สุสาน งาน 5) เข้าห้อง 4 → เขียนไม่ได้
  p = await open('u5')
  await p.goto(`http://localhost:${PORT}/#/meeting/4`); await p.waitForLoadState('networkidle')
  await p.getByRole('button', { name: /ข่าวจากแอดมิน/ }).click()
  must(await p.getByLabel('เขียนถึงแอดมิน').count() === 0, 'member of another room cannot write here')
  // แอดมิน: กระดิ่งหน้าห้องทำงานบอกห้องที่มีข้อความ
  p = await open('me1')
  await p.goto(`http://localhost:${PORT}/#/`); await p.waitForLoadState('networkidle')
  const ab = p.getByRole('button', { name: /ส่งข่าวถึงแต่ละงาน/ })
  must(/มีข้อความจากห้องงาน 1/.test(await ab.getAttribute('aria-label')), 'admin bell counts unread room messages: ' + await ab.getAttribute('aria-label'))
  await ab.click()
  const rooms = p.getByRole('region', { name: 'ข้อความจากห้องงาน' })
  must(/งานเลขา/.test(await rooms.innerText()) && /ขอห้องประชุม/.test(await rooms.innerText()), 'admin sees which room wrote')
  await rooms.getByRole('button', { name: /ห้อง งานเลขา/ }).click()
  await rooms.getByLabel('ตอบห้องนี้').fill('ได้ครับ จองให้แล้ว')
  await rooms.getByRole('button', { name: /ส่ง$/ }).click()
  await rooms.locator('.roomchat__msg', { hasText: 'ได้ครับ จองให้แล้ว' }).waitFor()
  must(await p.evaluate(() => JSON.parse(localStorage.getItem('acct.roomchat.v1')).some((m) => m.n === 1 && m.fromAdmin && m.text.includes('จองให้แล้ว'))), 'admin reply stored as admin message')
  await p.getByRole('region', { name: 'ส่งข่าวถึงแต่ละงาน' }).getByRole('button', { name: 'ส่งข่าว', exact: true }).waitFor()
  await p.screenshot({ path: 'shots/roomchat-admin.png' })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('roomchat-test OK')
} finally { await browser.close(); server.kill() }
