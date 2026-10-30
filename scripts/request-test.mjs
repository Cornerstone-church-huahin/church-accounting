// ตั้งค่า › คำขอที่รออนุมัติ: เห็นว่าขอเมื่อไร ทางไหน อุปกรณ์ สิทธิ์ ห้องงาน/ตำแหน่ง · แอดมินกำหนดห้องงาน+ตำแหน่งตอนอนุมัติได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4396
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const MEMBERS = [
    { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, status: 'active', updated: 1 },
    { id: 'p1', name: 'หนึ่งฤทัย', role: 'viewer', joined: Date.UTC(2026, 9, 29, 9, 30), status: 'pending', invitedFor: 'หนึ่งฤทัย', invitedWork: { n: 1, level: 'lead' }, device: 'Android · แอปที่ติดตั้ง', updated: 1 },
    { id: 'p2', name: 'มน.สายฝน', role: 'viewer', joined: Date.UTC(2026, 9, 29, 10, 0), status: 'pending', device: 'iPhone/iPad · เบราว์เซอร์', updated: 1 },
  ]
  await page.addInitScript((members) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, MEMBERS)
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForLoadState('networkidle')
  const c1 = (await page.getByLabel('รายละเอียดคำขอของ หนึ่งฤทัย').innerText()).replace(/\s+/g, ' ')
  must(/ขอเมื่อ/.test(c1) && /ลิงก์เชิญ ที่ส่งให้ “หนึ่งฤทัย”/.test(c1) && /Android · แอปที่ติดตั้ง/.test(c1) && /ห้องงานที่ขอ.*งานเลขา.*ผู้ดูแลหลัก/.test(c1), 'request with a work shows room + position + device: ' + c1)
  const c2 = (await page.getByLabel('รายละเอียดคำขอของ มน.สายฝน').innerText()).replace(/\s+/g, ' ')
  must(/ไม่ได้ระบุชื่อผู้รับ/.test(c2) && /iPhone\/iPad · เบราว์เซอร์/.test(c2) && /ลิงก์นี้ไม่ได้ระบุห้องงาน/.test(c2), 'request without a work says so clearly: ' + c2)
  // แอดมินกำหนดห้องงาน + ตำแหน่งให้ผู้ขอที่ลิงก์ไม่ได้ระบุงาน แล้วอนุมัติ
  await page.locator('#rw-p2').selectOption({ label: 'งานอภิบาล' })
  await page.locator('#rl-p2').selectOption({ label: 'ผู้ช่วย' })
  must(/จะให้เป็น ผู้ช่วย ของ งานอภิบาล/.test((await page.getByLabel('รายละเอียดคำขอของ มน.สายฝน').locator('xpath=..').innerText()).replace(/\s+/g, ' ')), 'summary line follows the pickers')
  await page.locator('li', { hasText: 'มน.สายฝน' }).first().getByRole('button', { name: /อนุมัติ/ }).click()
  await page.waitForTimeout(500)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((m) => m.id === 'p2'))
  must(saved.status === 'active' && JSON.stringify(saved.works) === '[4]' && saved.workRoles['4'] === 'helper', 'approved with the room and position set by the admin: ' + JSON.stringify(saved))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('request-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
