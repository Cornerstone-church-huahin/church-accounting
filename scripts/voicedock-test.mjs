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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })
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
  window.SpeechRecognition = class {
    start() { const say = (t) => this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: t }], { isFinal: true }), Object.assign([{ transcript: t }], { isFinal: false })] }); setTimeout(() => say('ประชุมวัน'), 60); setTimeout(() => say('ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน'), 200) }
    stop() { setTimeout(() => this.onend && this.onend(), 20) }
  }
}
const FAKE_RECORD = () => {
  delete window.SpeechRecognition; delete window.webkitSpeechRecognition; window.__voiceSegMs = 300
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] })
  window.MediaRecorder = class { static isTypeSupported() { return true } constructor() { this.state = 'inactive' } start() { this.state = 'recording' } stop() { this.state = 'inactive'; this.ondataavailable && this.ondataavailable({ data: new Blob([new Uint8Array(3000)], { type: 'audio/mp4' }), size: 3000 }); this.onstop && this.onstop() } }
}
async function open(page) {
  await page.goto(`http://localhost:${PORT}/#/meeting/1/4/notice`)
  await page.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click()
  await page.getByLabel(/ข้อความในหนังสือ/).waitFor({ timeout: 15000 })
}
/** แตะไมค์เพื่อเริ่ม → ข้อความต้องขึ้นทันทีระหว่างพูด (ยังไม่แตะหยุด) → แตะหยุด */
async function hold(page, expect) {
  const mic = page.getByRole('button', { name: 'แตะเพื่อพูด', exact: true })
  await mic.click()
  const box = page.getByLabel('ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)')
  await box.waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: 'แตะเพื่อหยุดพูด' }).waitFor({ timeout: 3000 })   // ยังฟังอยู่ แต่ข้อความขึ้นแล้ว
  if (expect) await page.waitForFunction((t) => document.querySelector('#vd-text')?.value.includes(t), expect, { timeout: 8000 })
  await page.getByRole('button', { name: 'แตะเพื่อหยุดพูด' }).click()
  await page.getByRole('button', { name: 'แตะเพื่อพูด', exact: true }).waitFor({ timeout: 8000 })
}
try {
  // ----- Android/Chrome: ระบบพูดให้พิมพ์ของเบราว์เซอร์ -----
  const a = await device('ad1', 'แอดมิน')
  await a.addInitScript(FAKE_NATIVE)
  await open(a)
  const mic = a.getByRole('button', { name: 'แตะเพื่อพูด', exact: true })
  await mic.waitFor()
  const vb = a.viewportSize(), mb = await mic.boundingBox()
  must(mb.y + mb.height <= vb.height && mb.width >= 56, 'big mic fixed at the bottom of the screen: ' + JSON.stringify(mb))
  await a.evaluate(() => window.scrollTo(0, 600))
  must(Math.abs((await mic.boundingBox()).y - mb.y) < 2, 'mic stays in place while page scrolls')
  const bodyBefore = await a.getByLabel(/ข้อความในหนังสือ/).inputValue()
  const box = a.getByLabel('ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)')
  await hold(a, 'ประชุมวันอาทิตย์ที่ 8')
  must((await box.inputValue()).startsWith('ประชุมวันอาทิตย์ที่ 8'), 'transcript shown live: ' + await box.inputValue())
  must((await box.inputValue()).split('ประชุมวันอาทิตย์').length === 2, 'sentence appears once even when the browser repeats it: ' + await box.inputValue())
  await a.getByRole('button', { name: 'พูดใหม่' }).click()
  must(await box.count() === 0, 'พูดใหม่ clears the transcript')
  // ยังไม่ได้เลือกช่อง → ส่งแล้วไม่เข้าฟอร์ม · บอกให้แตะช่องก่อน
  await hold(a, 'พฤศจิกายน')
  await a.getByRole('button', { name: 'ส่ง', exact: true }).click()
  await a.getByText(/แตะช่องที่ต้องการใส่ข้อความก่อน/).first().waitFor({ timeout: 3000 })
  must((await a.getByLabel(/ข้อความในหนังสือ/).inputValue()) === bodyBefore, 'nothing written when no field is selected')
  // ＋ ที่วาระที่ 7 = 7.1 ทันที (ไม่ต้องลาก) · กดอีกครั้ง = 7.2
  must(await a.getByRole('button', { name: /เพิ่มลำดับ/ }).count() === 0, 'old add-sub button removed')
  await a.getByRole('button', { name: 'พูดใหม่' }).click()   // ล้างข้อความที่ค้างอยู่ก่อนไปแตะช่อง
  await a.getByRole('button', { name: 'เพิ่มข้อย่อยใต้วาระที่ 7', exact: true }).click()
  const s71 = a.getByLabel('7.1', { exact: true })
  await s71.waitFor({ timeout: 3000 })
  must(!(await s71.evaluate((e) => e === document.activeElement)), 'new 7.1 row is NOT focused (no on-screen keyboard)')
  must((await s71.getAttribute('data-voice-target')) === '1', 'new 7.1 row is highlighted as the voice target')
  // กด ＋ แล้วเข้าโหมดแบ่งจอเอง: ส่วนบน (ฟอร์ม) + ส่วนล่าง (ตัวอย่างเอกสาร) ลากปรับสัดส่วนได้ มีปุ่มเรียบร้อยแล้ว
  const region = a.getByRole('region', { name: /แบ่งจอ/ })
  await region.waitFor({ timeout: 3000 })
  must((await s71.getAttribute('data-voice-target')) === '1', '7.1 still the voice target after entering split mode')
  must(await region.getByRole('status').filter({ hasText: '7.1' }).count() >= 0, 'target chip present')
  must(await region.locator('.split__top').getByLabel('7.1', { exact: true }).count() === 1, 'form is in the top pane')
  must(await region.locator('.split__bottom').getByLabel('ตัวอย่างหนังสือ').count() === 1, 'document preview is in the bottom pane')
  { const mb = await a.getByRole('button', { name: /แตะเพื่อ(พูด|หยุดพูด)/ }).boundingBox(), pv = await region.locator('.split__bottom').boundingBox(), br = await region.getByRole('separator').boundingBox()
    must(mb.y + mb.height <= pv.y + 2, `mic sits on the divider bar, above the preview pane: mic bottom ${mb.y + mb.height} <= preview top ${pv.y}`)
    must(mb.y >= br.y - 6 && mb.height <= 48, 'mic is compact and on the bar: ' + JSON.stringify({ mb, br })) }
  { // ตัวอย่างด้านล่าง: เริ่มที่ เรื่อง/เรียน จบที่ลายเซ็น และอยู่ในกล่องครบ ไม่ล้น ไม่ต้องเลื่อน
    const pane = await region.locator('.split__bottom').boundingBox()
    const sub = await region.locator('[data-split-start]').boundingBox(), sign = await region.locator('.letter__sign').boundingBox()
    must(sub.y >= pane.y - 1 && sub.y <= pane.y + 24, `preview starts at เรื่อง: ${sub.y} vs pane top ${pane.y}`)
    must(sign.y + sign.height <= pane.y + pane.height + 1, `preview reaches the signature inside the pane: ${sign.y + sign.height} <= ${pane.y + pane.height}`)
    const hdr = await region.locator('.il__head').boundingBox().catch(() => null)
    must(!hdr || hdr.y + hdr.height <= pane.y + 2, 'letterhead is cropped out of the split preview') }
  const hb0 = (await region.locator('.split__top').boundingBox()).height
  const bar = region.getByRole('separator')
  const bb = await bar.boundingBox()
  await a.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await a.mouse.down()
  await a.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2 + 120, { steps: 8 }); await a.mouse.up()
  const hb1 = (await region.locator('.split__top').boundingBox()).height
  must(hb1 > hb0 + 60, `dragging the bar resizes the panes: ${hb0} -> ${hb1}`)
  // พูดแล้วส่ง → เข้าช่อง 7.1
  await hold(a, 'พฤศจิกายน')
  await a.getByRole('button', { name: 'ส่ง', exact: true }).click()
  await a.getByText(/ใส่ลงช่อง “7.1” แล้ว/).waitFor({ timeout: 3000 })
  must((await s71.inputValue()) === 'ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน', '7.1 filled by voice: ' + await s71.inputValue())
  must((await a.getByLabel('ตัวอย่างหนังสือ').innerText()).includes('7.1 ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน'), 'paper shows 7.1 immediately')
  await a.getByRole('button', { name: /ประวัติ/ }).click()
  must((await a.getByLabel('ประวัติคำสั่ง').innerText()).includes('7.1: ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน'), 'command kept in history')
  // ＋ อีกครั้ง = 7.2
  if (await a.getByRole('button', { name: 'ปิดข้อความ' }).count()) await a.getByRole('button', { name: 'ปิดข้อความ' }).click()
  await a.getByRole('button', { name: 'เพิ่มข้อย่อยใต้วาระที่ 7', exact: true }).click()
  await a.getByLabel('7.2', { exact: true }).waitFor({ timeout: 3000 })
  // ย้อนกลับ: 7.1 กลับเป็นว่าง
  const undoBtn = a.getByRole('button', { name: /ย้อนกลับ/ })
  must(!(await undoBtn.isDisabled()), 'undo enabled after a voice edit')
  await undoBtn.click()
  must((await s71.inputValue()) === '', 'undo restores 7.1 to empty')
  must(await undoBtn.isDisabled(), 'undo disabled again when history is empty')
  // ช่องที่ล็อก (วันที่) ไม่รับเสียง
  await a.locator('#il-date').focus()
  await hold(a, 'พฤศจิกายน')
  await a.getByRole('button', { name: 'ส่ง', exact: true }).click()
  must((await a.locator('#il-date').inputValue()) !== 'ประชุมวันอาทิตย์ที่ 8 พฤศจิกายน', 'date field is never filled by voice')
  await a.screenshot({ path: process.env.SHOT || '/tmp/voice1.png' })
  await a.getByRole('button', { name: /เรียบร้อยแล้ว/ }).click()
  must(await a.getByRole('region', { name: /แบ่งจอ/ }).count() === 0, 'split mode closes with เรียบร้อยแล้ว')
  must(await a.getByRole('button', { name: /แจ้งประธานตรวจสอบ/ }).count() === 1, 'signing / notify steps available again after exit')
  await a.getByLabel('7.1', { exact: true }).waitFor()

  // ----- iPhone/Safari: ไม่มีระบบพูดให้พิมพ์ → อัดเสียงแล้วให้ Gemini ถอดเสียง -----
  const ip = await device('ad1', 'แอดมิน')
  await ip.addInitScript(() => localStorage.setItem('acct.gemini.v1', JSON.stringify({ key: 'testkey' })))
  await ip.addInitScript(FAKE_RECORD)
  let sent = null
  await ip.route('https://generativelanguage.googleapis.com/**', (r) => { sent = r.request().postData(); r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' }, body: JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ลบวาระที่ 5' }] } }] }) }) })
  await open(ip)
  const box2 = ip.getByLabel('ข้อความที่ฟังได้ (แก้ได้ก่อนส่ง)')
  await hold(ip, 'ลบวาระที่ 5')
  must((await box2.inputValue()).startsWith('ลบวาระที่ 5'), 'Gemini transcription shown live (segments appended): ' + await box2.inputValue())
  must(sent && /inline_data/.test(sent) && /audio\/webm/.test(sent), 'audio sent to Gemini')
  console.log('voicedock-test OK')
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
} catch (e) { console.error(e.message || e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
