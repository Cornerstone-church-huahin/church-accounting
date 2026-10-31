// หน้าลงชื่อ/ยอดผู้มา: ตัวเลื่อนอาทิตย์ · รูป+เลขลำดับที่มา คนล่าสุดอยู่บน — npm run build && node scripts/attorder-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4192
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem('acct.church-members.v1', JSON.stringify([
    { id: 'a', name: 'คนที่หนึ่ง', status: 'สมบูรณ์ ( 1 )', updated: 1 }, { id: 'b', name: 'คนที่สอง', status: 'สมบูรณ์ ( 1 )', updated: 1 }, { id: 'c', name: 'คนที่สาม', status: 'สมบูรณ์ ( 1 )', updated: 1 }, { id: 'd', name: 'คนอีกสัปดาห์', status: 'สมบูรณ์ ( 1 )', updated: 1 },
  ]))
  localStorage.setItem('acct.attendance.2026.v1', JSON.stringify([
    { id: 'ck1', date: '2026-10-25', mid: 'a', tm: '09:00', rec: 'ก', updated: 1000 },
    { id: 'ck2', date: '2026-10-25', mid: 'b', tm: '09:10', rec: 'ก', updated: 2000 },
    { id: 'ck3', date: '2026-10-25', mid: 'c', tm: '09:20', rec: 'ข', updated: 3000 },
    { id: 'ck4', date: '2026-10-18', mid: 'd', tm: '09:05', rec: 'ก', updated: 500 },
  ]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/members`)
  await page.reload()
  await page.getByRole('tab', { name: 'ยอดผู้มา' }).click()
  await page.getByRole('group', { name: 'เลือกอาทิตย์' }).waitFor({ timeout: 8000 })
  must(/25 ตุลาคม 2569/.test(await page.getByRole('group', { name: 'เลือกอาทิตย์' }).innerText()), 'stats: latest recorded day selected')
  const names = await page.locator('.doneList .mrow__name').allInnerTexts()
  must(names.join('|') === 'คนที่สาม|คนที่สอง|คนที่หนึ่ง', 'newest recorded on top: ' + names.join('|'))
  const nos = await page.locator('.doneNo').allInnerTexts()
  must(nos.join(',') === '3,2,1', 'numbers = arrival order: ' + nos.join(','))
  const h = (await page.getByRole('group', { name: 'เลือกอาทิตย์' }).boundingBox()).height
  must(h < 50, 'week stepper is short: ' + h)
  await page.getByRole('button', { name: 'อาทิตย์ก่อนหน้า' }).click()
  must(/18 ตุลาคม 2569/.test(await page.getByRole('group', { name: 'เลือกอาทิตย์' }).innerText()) && (await page.locator('.doneList .mrow__name').allInnerTexts()).join('|') === 'คนอีกสัปดาห์', 'previous week shows that day only')
  must(await page.getByRole('button', { name: /^(เพิ่ม|เปลี่ยน)รูป/ }).count() >= 1, 'admin can tap the photo to add/change it')
  await page.getByRole('tab', { name: 'ลงชื่อ' }).click()
  await page.getByRole('group', { name: 'เลือกอาทิตย์' }).waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: 'อาทิตย์ก่อนหน้า' }).click()
  must(/อาทิตย์|วัน/.test(await page.locator('#ck-date').inputValue().catch(() => '')) || (await page.locator('#ck-date').inputValue()).length > 0, 'check-in page has the stepper and a date')
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('attorder-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
