// ทดสอบซิงก์ 2 เครื่องกับ GitHub จำลอง: เพิ่มรายรับ → อีกเครื่องเห็น → แอดมินล้างข้อมูล → อีกเครื่องต้องว่างและข้อมูลเก่าไม่ผุดกลับ
// ใช้: npm run build && node scripts/sync-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'

const REPO = 'Cornerstone-church-huahin/church-accounting-data'
const PORT = 4174
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})

// เหมือน personIdOf ในแอป
function personIdOf(name) {
  const s = name.trim().toLowerCase().normalize('NFC')
  let h1 = 0xdeadbeef ^ s.length, h2 = 0x41c6ce57 ^ s.length
  for (let i = 0; i < s.length; i++) { const ch = s.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677) }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return `p${(h2 >>> 0).toString(36)}${(h1 >>> 0).toString(36)}`
}

// ---- GitHub จำลอง ----
const files = new Map() // path -> { text, sha }
let shaN = 0
const put = (path, obj) => files.set(path, { text: JSON.stringify(obj), sha: `sha${++shaN}` })
put('members.json', { items: [
  { id: personIdOf('แอดมิน เอ'), name: 'แอดมิน เอ', role: 'admin', joined: 1, status: 'active', updated: 1 },
  { id: personIdOf('บันทึก บี'), name: 'บันทึก บี', role: 'bookkeeper', joined: 2, status: 'active', updated: 1 },
] })
const fake = async (route) => {
  const url = new URL(route.request().url())
  const m = url.pathname.match(new RegExp(`^/repos/${REPO}(?:/contents/(.+))?$`))
  const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) })
  if (route.request().method() === 'OPTIONS') return json(204, {})
  if (!m) return json(404, {})
  if (!m[1]) return json(200, { private: true, permissions: { push: true } })
  const path = decodeURIComponent(m[1])
  if (route.request().method() === 'GET') {
    const f = files.get(path)
    return f ? json(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') }) : json(404, {})
  }
  if (route.request().method() === 'PUT') {
    const b = JSON.parse(route.request().postData())
    const f = files.get(path)
    if (f && b.sha !== f.sha) return json(409, {})
    if (!f && b.sha) return json(422, {})
    const text = Buffer.from(b.content, 'base64').toString('utf8')
    files.set(path, { text, sha: `sha${++shaN}` })
    return json(200, { content: { sha: files.get(path).sha } })
  }
  return json(404, {})
}

async function device(name) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } })
  await ctx.route('https://api.github.com/**', fake)
  await ctx.addInitScript((cfg) => { if (!localStorage.getItem('acct.sync.v1')) localStorage.setItem('acct.sync.v1', JSON.stringify(cfg)) }, { repo: REPO, token: 'fake', name })
  const page = await ctx.newPage()
  page.on('dialog', (d) => d.accept())
  return page
}
const ok = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const inc = () => JSON.parse(files.get('income-2026.json')?.text ?? '{"items":[]}')
const base = `http://localhost:${PORT}/#`

try {
  const A = await device('แอดมิน เอ')
  const B = await device('บันทึก บี')
  // A เพิ่มรายรับ
  await A.goto(base + '/income')
  await A.getByRole('button', { name: '＋ บันทึกรายรับ' }).click()
  await A.getByLabel('จำนวนเงิน (บาท)').fill('1500')
  await A.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await A.waitForFunction(() => true)
  for (let i = 0; i < 40 && inc().items.length < 1; i++) await A.waitForTimeout(250)
  ok(inc().items.length === 1, 'A pushed the income to the fake repo')
  // B เห็นรายการ
  await B.goto(base + '/income')
  await B.getByText('1,500.00').first().waitFor({ timeout: 10000 })
  // A ล้างข้อมูลปี (เฉพาะแอดมิน)
  await A.goto(base + '/settings')
  await A.evaluate(() => document.querySelectorAll('details.fold').forEach((d) => { d.open = true }))
  await A.locator('#cl-word').fill('ล้างข้อมูล')
  await A.getByRole('button', { name: /^ล้างข้อมูลปี/ }).click()
  await A.getByText(/ล้างข้อมูลปี .* เรียบร้อย/).waitFor({ timeout: 10000 })
  const f = inc()
  ok(f.items.length === 0 && f.epoch > 0, 'file emptied online with an epoch marker')
  // B ซิงก์ใหม่: ต้องว่างและไม่ส่งของเก่ากลับ
  await B.reload()
  await B.getByText('ยังไม่มีรายรับ').waitFor({ timeout: 10000 })
  await B.waitForTimeout(2500)
  ok(inc().items.length === 0, 'stale device did not resurrect the deleted income')
  // B ยังใช้งานต่อได้ตามปกติหลังรับการล้าง
  await B.getByRole('button', { name: '＋ บันทึกรายรับ' }).click()
  await B.getByLabel('จำนวนเงิน (บาท)').fill('200')
  await B.getByRole('button', { name: 'บันทึก', exact: true }).click()
  for (let i = 0; i < 40 && inc().items.length < 1; i++) await B.waitForTimeout(250)
  ok(inc().items.length === 1 && inc().items[0].amount === 20000, 'B can add new data after the reset')
  // ---- เชิญคนใหม่ด้วยลิงก์: ภรรยาเปิดลิงก์ → พิมพ์ชื่อ → ขอเข้าใช้ → แอดมินเห็นชื่อ → ให้สิทธิ์ผู้ตรวจสอบ + อนุมัติ → ภรรยาเข้าใช้ได้ ----
  const C = await (async () => {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } })
    await ctx.route('https://api.github.com/**', fake)
    const page = await ctx.newPage(); page.on('dialog', (d) => d.accept()); return page
  })()
  await C.goto(base + '/join?t=fake&role=bookkeeper&for=' + encodeURIComponent('ภรรยา'))
  await C.getByLabel('ชื่อของท่าน').fill('ภรรยา')
  await C.getByRole('button', { name: /ส่งคำขอร่วมใช้/ }).click()
  await C.getByText(/ส่งคำขอร่วมใช้แล้ว — รอแอดมินอนุมัติ/).waitFor({ timeout: 10000 })
  for (let i = 0; i < 40 && !files.get('members.json').text.includes('ภรรยา'); i++) await C.waitForTimeout(250)
  ok(JSON.parse(files.get('members.json').text).items.some((m) => m.name === 'ภรรยา' && m.status === 'pending'), 'wife request written as pending')
  // ก่อนอนุมัติ ภรรยาเข้าแอปไม่ได้
  ok((await C.getByRole('link', { name: 'รายรับ', exact: true }).count()) === 0, 'pending user cannot see the app')
  // แอดมินเห็นชื่อ ให้สิทธิ์ แล้วอนุมัติ
  await A.goto(base + '/settings')
  await A.evaluate(() => document.querySelectorAll('details.fold').forEach((d) => { d.open = true }))
  await A.reload()
  await A.getByText('ภรรยา', { exact: false }).first().waitFor({ timeout: 10000 })
  await A.getByLabel('สิทธิ์ที่จะให้ ภรรยา').selectOption({ label: 'ผู้ตรวจสอบ' })
  await A.getByRole('button', { name: '✓ อนุมัติ' }).click()
  await A.getByText(/อนุมัติ ภรรยา แล้ว/).waitFor({ timeout: 10000 })
  // แอดมินส่งขึ้นไฟล์ (หน่วง 0.6 วิ) แล้วภรรยาตรวจสถานะ → เข้าใช้ได้ตามสิทธิ์ผู้ตรวจสอบ
  for (let i = 0; i < 40 && !JSON.parse(files.get('members.json').text).items.some((m) => m.name === 'ภรรยา' && m.status === 'active'); i++) await A.waitForTimeout(250)
  await C.getByRole('button', { name: /ตรวจว่าอนุมัติแล้วหรือยัง/ }).click()
  await C.getByRole('link', { name: 'รายรับ', exact: true }).waitFor({ timeout: 10000 })
  await C.goto(base + '/income')
  await C.getByText('1,500.00').or(C.getByText('200.00')).first().waitFor({ timeout: 10000 })
  ok((await C.getByRole('button', { name: '＋ บันทึกรายรับ' }).count()) === 0, 'auditor can view but not add income')
  // รหัส Gemini ร่วม: แอดมินใส่ครั้งเดียว → ผู้ใช้อื่น (ผู้บันทึกบัญชี) ใช้ได้เลย
  await A.goto(base + '/settings')
  await A.evaluate(() => document.querySelectorAll('details.fold').forEach((d) => { d.open = true }))
  await A.getByLabel('รหัส Gemini API').fill('SHARED-KEY-9999')
  await A.getByRole('button', { name: 'บันทึกรหัส' }).click()
  await A.getByText(/แชร์ให้ผู้ใช้ร่วมทุกคน/).first().waitFor({ timeout: 10000 })
  ok(files.has('gemini-shared.json') && files.get('gemini-shared.json').text.includes('SHARED-KEY-9999'), 'shared key written to the data repo')
  await B.reload()
  await B.waitForFunction(() => (localStorage.getItem('acct.gemini.shared.v1') ?? '').includes('SHARED-KEY-9999'), null, { timeout: 15000 })
  ok(!(await B.evaluate(() => localStorage.getItem('acct.gemini.v1'))), 'B has no personal key yet uses the shared one')
  console.log('SYNC OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
