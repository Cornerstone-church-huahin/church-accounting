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
  const prev = sheet.getByLabel('ตัวอย่างหน้าซอง')
  const pb = await prev.boundingBox()
  must(Math.abs(pb.width / pb.height - 2) < 0.05, 'DL envelope preview is 2:1: ' + JSON.stringify(pb))
  // หัวจดหมายอยู่มุมซ้ายบน
  const hb = await prev.locator('img').first().boundingBox()
  must(hb.x - pb.x < pb.width * 0.15 && hb.y - pb.y < pb.height * 0.25, 'letterhead sits at top-left: ' + JSON.stringify({ hb, pb }))
  must((await prev.innerText()).includes('คริสตจักรศิลาเอก ภาค 7') && (await prev.innerText()).includes('Cornerstone Church 7th District') && (await prev.innerText()).includes('77110'), 'envelope carries the letter header text (names + address)')
  await admin.screenshot({ path: '/tmp/claude-0/-home-user/40071fdd-6ce1-5923-b9bf-7ff374fad5f4/scratchpad/env.png' })
  // เปลี่ยนขนาดซองเอง
  await sheet.getByLabel('ขนาดซอง').selectOption('custom')
  await sheet.getByLabel('ความสูงซอง มม.').fill('98'); await sheet.getByLabel('ความยาวซอง มม.').fill('225')
  const pb2 = await prev.boundingBox()
  must(Math.abs(pb2.width / pb2.height - 225 / 98) < 0.05, 'custom size follows: ' + JSON.stringify(pb2))
  // ชื่อผู้รับ 2 บรรทัด กลางซอง
  await sheet.getByLabel('บรรทัดที่ 1 — ชื่อผู้รับ').fill('เรียน ท่านนพพร วุฒิกุล')
  await sheet.getByLabel('บรรทัดที่ 2 — ตำแหน่ง/ที่อยู่').fill('นายกเทศมนตรีนครหัวหิน')
  const pb3 = await prev.boundingBox()
  const l1 = await prev.getByText('เรียน ท่านนพพร วุฒิกุล').boundingBox(), l2 = await prev.getByText('นายกเทศมนตรีนครหัวหิน').boundingBox()
  must(l2.y > l1.y, 'two lines, second below the first')
  must(Math.abs((l1.x + l1.width / 2) - (pb3.x + pb3.width / 2)) < pb3.width * 0.04, 'recipient centred horizontally')
  const midY = (l1.y + l2.y + l2.height) / 2
  must(Math.abs(midY - (pb3.y + pb3.height / 2)) < pb3.height * 0.1, 'recipient centred vertically: ' + JSON.stringify({ midY, mid: pb3.y + pb3.height / 2 }))
  await admin.screenshot({ path: '/tmp/claude-0/-home-user/40071fdd-6ce1-5923-b9bf-7ff374fad5f4/scratchpad/env2.png' })
  // ดาวน์โหลด PDF ขนาดเท่าซอง
  const [dl] = await Promise.all([admin.waitForEvent('download'), sheet.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
  const path = await dl.path(); const buf = fs.readFileSync(path).toString('latin1')
  const mb = buf.match(/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)\s*\]/)
  must(mb && Math.abs(Number(mb[1]) * 25.4 / 72 - 225) < 1 && Math.abs(Number(mb[2]) * 25.4 / 72 - 98) < 1, 'PDF page size equals the envelope: ' + (mb && mb.slice(1).join('x')))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('envelope-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
