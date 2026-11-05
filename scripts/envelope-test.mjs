// หนังสือแจ้งการประชุม: อยู่ในตัวเลือกสร้างเอกสาร · สร้างใหม่/เปิดฉบับเดิมได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const REPO = 'Cornerstone-church-huahin/church-accounting-data'
const PORT = 4261
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
const files = new Map(); let shaN = 0
const put = (path, obj) => files.set(path, { text: JSON.stringify(obj), sha: `sha${++shaN}` })
const MEMBERS = [
  { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, status: 'active', updated: 1 },
  { id: 'lead1', name: 'หัวหน้าเลขา', role: 'viewer', joined: 2, status: 'active', updated: 1, works: [1], workRoles: { 1: 'lead' } },
]
put('doc-categories.json', { items: [{ id: 'c1', updated: 1, name: 'จดหมายขอบคุณ', prefix: 'ศอ/จข' }, { id: 'c2', updated: 1, name: 'หนังสือแจ้งประชุมธรรมกิจ ประจำเดือน', prefix: 'ศอ/ปธ' }, { id: 'c3', updated: 1, name: 'หนังสือเชิญร่วมงาน', prefix: 'ศอ/จช' }] })
put('members.json', { items: MEMBERS })
put('notice-letter.json', { items: [{ id: 'R', updated: 100, toName: 'นพพร', no: 'ศอ/จช.001', date: '2026-10-28', subject: 'ขอเชิญ', to: 'ท่านนพพร', attach: '', showAttach: false, body: 'ข้อความเก่า' }] })
const fake = async (route) => {
  const url = new URL(route.request().url())
  const m = url.pathname.match(new RegExp(`^/repos/${REPO}(?:/contents/(.+))?$`))
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) })
  if (route.request().method() === 'OPTIONS') return json(204, {})
  if (!m) return json(404, {})
  if (!m[1]) return json(200, { private: true, permissions: { push: true } })
  const path = decodeURIComponent(m[1])
  if (route.request().method() === 'GET') { const f = files.get(path); return f ? json(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') }) : json(404, {}) }
  if (route.request().method() === 'PUT') {
    const b = JSON.parse(route.request().postData()); const f = files.get(path)
    if (f && b.sha !== f.sha) return json(409, {})
    files.set(path, { text: Buffer.from(b.content, 'base64').toString('utf8'), sha: `sha${++shaN}` })
    return json(200, { content: { sha: files.get(path).sha } })
  }
  return json(404, {})
}
async function device(meId, name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  await ctx.route('https://api.github.com/**', fake)
  await ctx.addInitScript(([id, n, members, repo]) => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo, token: 'fake', name: n }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, [meId, name, MEMBERS, REPO])
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e)))
  return page
}
const body = (page) => page.getByLabel(/ข้อความในหนังสือ/)
try {
  const admin = await device('ad1', 'แอดมิน')
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/4/invite`)
  await admin.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click()
  await body(admin).waitFor({ timeout: 15000 })
  await admin.getByRole('button', { name: 'พิมพ์หน้าซองจดหมาย' }).click()
  const sheet = admin.getByRole('dialog', { name: /พิมพ์หน้าซอง/ })
  await sheet.waitFor({ timeout: 8000 })
  // ทิศทางตายตัว: ไม่มีตัวเลือกแนวตั้ง/แนวนอน ไม่มีตัวเลือกขนาดตัวอักษร
  must(await sheet.getByRole('radio').count() === 0, 'no orientation options')
  must(await sheet.getByLabel('ขนาดตัวอักษรชื่อผู้รับ').count() === 0, 'no font-size slider (fixed 10 pt)')
  must(await sheet.getByLabel('ขนาดซอง').inputValue() === 'mine', 'default envelope = measured 110×228')
  const prev = sheet.getByLabel('ตัวอย่างหน้าซอง')      // สำเนาส่งออก (หน้านอน)
  await admin.waitForTimeout(400)
  const vis = sheet.getByLabel('ตัวอย่างหน้าที่ส่งให้เครื่องพิมพ์'), vb = await vis.boundingBox()
  must(vb.height > vb.width * 1.9, 'preview is the portrait page: ' + JSON.stringify(vb))
  const vh = await vis.locator('img').first().boundingBox()
  must(vh.x - vb.x > vb.width * 0.5 && vh.y - vb.y < vb.height * 0.25, 'letterhead at top-right of the portrait page: ' + JSON.stringify({ vh, vb }))
  must((await prev.innerText()).includes('คริสตจักรศิลาเอก ภาค 7') && (await prev.innerText()).includes('77110'), 'envelope carries the letter header (names + address)')
  // ชื่อผู้รับ 2 บรรทัดกลางซอง ตัวอักษร 10 pt (≈13.3 px)
  await sheet.getByLabel('บรรทัดที่ 1 — ชื่อผู้รับ').fill('คุณอำนวย สุดกระแสร์')
  await sheet.getByLabel('บรรทัดที่ 2 — ตำแหน่ง/ที่อยู่').fill('ที่ปรึกษารัฐมนตรีช่วยว่าการกระทรวงมหาดไทย')
  const fs1 = await prev.getByText('คุณอำนวย สุดกระแสร์').evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  must(Math.abs(fs1 - 13.33) < 0.1, 'recipient font is 10 pt: ' + fs1)
  const l1 = await prev.getByText('คุณอำนวย สุดกระแสร์').boundingBox(), l2 = await prev.getByText('ที่ปรึกษารัฐมนตรีช่วยว่าการกระทรวงมหาดไทย').boundingBox(), pb = await prev.boundingBox()
  must(l2.y > l1.y && Math.abs((l1.x + l1.width / 2) - (pb.x + pb.width / 2)) < pb.width * 0.04, 'two centred lines')
  // ปรับชดเชย: ย่อ 80% หัวเล็กลง · เลื่อน → ตำแหน่งขยับ · คืนค่า
  const hImg = prev.locator('img').first(), h0 = await hImg.boundingBox()
  await sheet.getByLabel('ย่อขยายทั้งหน้า เปอร์เซ็นต์').fill('80')
  must((await hImg.boundingBox()).width < h0.width * 0.9, 'page scale shrinks the letterhead')
  await sheet.getByLabel('ย่อขยายทั้งหน้า เปอร์เซ็นต์').fill('100')
  await sheet.getByLabel('เลื่อนไปทางขวา มม.').fill('-10')
  const h2 = await hImg.boundingBox(); must(Math.abs(h2.y - h0.y) > 1 || Math.abs(h2.x - h0.x) > 1, 'shift moves the letterhead')
  await sheet.getByRole('button', { name: /คืนค่าปรับ/ }).click()
  // ชื่อยาวเกินซอง → ย่อให้พอดี
  await sheet.getByLabel('บรรทัดที่ 2 — ตำแหน่ง/ที่อยู่').fill('ที่ปรึกษารัฐมนตรีช่วยว่าการกระทรวงมหาดไทย สำนักงานปลัดกระทรวง ถนนราชดำเนินนอก เขตดุสิต กรุงเทพมหานคร 10300 ประเทศไทย ' .repeat(2))
  const lng = await prev.getByText(/ที่ปรึกษารัฐมนตรีช่วยว่าการ/).boundingBox()
  must(lng.x >= pb.x - 2 && lng.x + lng.width <= pb.x + pb.width + 2, 'very long line is shrunk to fit')
  await sheet.getByLabel('บรรทัดที่ 2 — ตำแหน่ง/ที่อยู่').fill('ที่ปรึกษารัฐมนตรีช่วยว่าการกระทรวงมหาดไทย')
  // ดาวน์โหลด: หน้าแนวตั้ง 110×228 มม. · โหมดทดสอบมีกรอบ+ไม้บรรทัด
  const [dl] = await Promise.all([admin.waitForEvent('download'), sheet.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
  const mb = fs.readFileSync(await dl.path()).toString('latin1').match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
  must(mb && Math.abs(Number(mb[1]) * 25.4 / 72 - 110) < 1 && Math.abs(Number(mb[2]) * 25.4 / 72 - 228) < 1, 'PDF is portrait 110×228: ' + (mb && mb.slice(1).join('x')))
  await sheet.getByLabel(/โหมดทดสอบ/).check()
  must(await prev.getByLabel('กรอบทดสอบ').count() === 1, 'test frame shown')
  must(await sheet.getByRole('button', { name: /^🖨/ }).count() === 0, 'no direct-print button')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('envelope-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
