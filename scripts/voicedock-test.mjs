// อยู่ในตัวเลือกสร้างเอกสาร · สร้างใหม่/เปิดฉบับเดิมได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const REPO = 'Cornerstone-church-huahin/church-accounting-data'
const PORT = 4399
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

// ระยะ 1 พูดสั่งงาน: ปุ่มไมค์ติดล่าง กดค้างพูด → เห็นข้อความ → ส่ง/พูดใหม่ · ไม่แตะฟอร์ม
const FAKE_NATIVE = () => {
  window.SpeechRecognition = class { constructor() { this.n = 0 } start() { setTimeout(() => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: 'ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน' }], { isFinal: true })] }), 60) } stop() { setTimeout(() => this.onend && this.onend(), 20) } }
}
const FAKE_RECORD = () => {
  delete window.SpeechRecognition; delete window.webkitSpeechRecognition
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] })
  window.MediaRecorder = class { static isTypeSupported() { return true } constructor() { this.state = 'inactive' } start() { this.state = 'recording' } stop() { this.state = 'inactive'; this.ondataavailable && this.ondataavailable({ data: new Blob([new Uint8Array(3000)], { type: 'audio/mp4' }), size: 3000 }); this.onstop && this.onstop() } }
}
async function open(page) {
  await page.goto(`http://localhost:${PORT}/#/meeting/1/4/notice`)
  await page.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click()
  await page.getByLabel(/ข้อความในหนังสือ/).waitFor({ timeout: 15000 })
}
async function hold(page, ms = 250) {
  const mic = page.getByRole('button', { name: 'กดค้างเพื่อพูด' })
  const b = await mic.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down(); await page.waitForTimeout(ms); await page.mouse.up()
}
try {
  // ----- Android/Chrome: ระบบพูดให้พิมพ์ของเบราว์เซอร์ -----
  const a = await device('ad1', 'แอดมิน')
  await a.addInitScript(FAKE_NATIVE)
  await open(a)
  const mic = a.getByRole('button', { name: 'กดค้างเพื่อพูด' })
  await mic.waitFor()
  const vb = a.viewportSize(), mb = await mic.boundingBox()
  must(mb.y + mb.height <= vb.height && mb.width >= 56, 'big mic fixed at the bottom of the screen: ' + JSON.stringify(mb))
  await a.evaluate(() => window.scrollTo(0, 600))
  must(Math.abs((await mic.boundingBox()).y - mb.y) < 2, 'mic stays in place while page scrolls')
  const subjectBefore = await a.getByLabel(/^.*เรื่อง/).first().inputValue().catch(() => '')
  const bodyBefore = await a.getByLabel(/ข้อความในหนังสือ/).inputValue()
  await hold(a)
  const box = a.getByLabel('ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)')
  await box.waitFor({ timeout: 5000 })
  must((await box.inputValue()) === 'ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน', 'transcript shown for review: ' + await box.inputValue())
  await a.getByRole('button', { name: 'พูดใหม่' }).click()
  must(await box.count() === 0, 'พูดใหม่ clears the transcript')
  await hold(a)
  await box.waitFor({ timeout: 5000 })
  await a.getByRole('button', { name: 'ส่ง', exact: true }).click()
  await a.getByText(/บันทึกคำสั่งไว้แล้ว/).waitFor({ timeout: 3000 })
  await a.getByRole('button', { name: /ประวัติ/ }).click()
  must((await a.getByLabel('ประวัติคำสั่ง').innerText()).includes('ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน'), 'command kept in history')
  must(await a.getByRole('button', { name: /ย้อนกลับ/ }).isDisabled(), 'undo disabled while nothing to undo')
  must((await a.getByLabel(/ข้อความในหนังสือ/).inputValue()) === bodyBefore, 'letter body untouched in phase 1')
  must((await a.getByLabel(/^.*เรื่อง/).first().inputValue().catch(() => '')) === subjectBefore, 'subject untouched in phase 1')
  await a.screenshot({ path: process.env.SHOT || '/tmp/voice1.png' })

  // ----- iPhone/Safari: ไม่มีระบบพูดให้พิมพ์ → อัดเสียงแล้วให้ Gemini ถอดเสียง -----
  const ip = await device('ad1', 'แอดมิน')
  await ip.addInitScript(() => localStorage.setItem('acct.gemini.v1', JSON.stringify({ key: 'testkey' })))
  await ip.addInitScript(FAKE_RECORD)
  let sent = null
  await ip.route('https://generativelanguage.googleapis.com/**', (r) => { sent = r.request().postData(); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ลบวาระที่ 5' }] } }] }) }) })
  await open(ip)
  await hold(ip)
  const box2 = ip.getByLabel('ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)')
  await box2.waitFor({ timeout: 8000 })
  must((await box2.inputValue()) === 'ลบวาระที่ 5', 'Gemini transcription shown: ' + await box2.inputValue())
  must(sent && /inline_data/.test(sent) && /audio\/webm/.test(sent), 'audio sent to Gemini')
  console.log('voicedock-test OK')
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
} catch (e) { console.error(e.message || e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
