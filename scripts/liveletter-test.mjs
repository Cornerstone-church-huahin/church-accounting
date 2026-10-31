// สองเครื่อง (ผู้ดูแลงานเลขา + แอดมิน) แก้/ตรวจหนังสือเชิญฉบับเดียวกัน: เห็นสดภายใน ~10 วินาที · เปิดจากลิงก์ได้ฉบับล่าสุดทันที · ไม่ทับฉบับของอีกคน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const REPO = 'Cornerstone-church-huahin/church-accounting-data'
const PORT = 4394
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
put('members.json', { items: MEMBERS })
put('invite-letter.json', { items: [{ id: 'R', updated: 100, toName: 'นพพร', no: 'ศอ/จช.001', date: '2026-10-28', subject: 'ขอเชิญ', to: 'ท่านนพพร', attach: '', showAttach: false, body: 'ข้อความเก่า' }] })
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
  const admin = await device('ad1', 'แอดมิน'), helper = await device('lead1', 'หัวหน้าเลขา')
  const url = (h) => `http://localhost:${PORT}/#/meeting/1/4/invite-R`
  await admin.goto(url()); await body(admin).waitFor({ timeout: 15000 })
  must((await body(admin).inputValue()) === 'ข้อความเก่า', 'admin sees the old text first')
  await helper.goto(url()); await body(helper).waitFor({ timeout: 15000 })
  await body(helper).fill('ข้อความใหม่ที่น้องพิมพ์'); await helper.waitForTimeout(1500)
  // แอดมินเปิดหน้าค้างไว้ → เห็นสดเอง (ไม่ต้องรีเฟรช) ภายใน ~12 วินาที
  await admin.waitForFunction(() => document.querySelector('textarea')?.value.includes('น้องพิมพ์') || [...document.querySelectorAll('textarea')].some((t) => t.value.includes('น้องพิมพ์')), null, { timeout: 25000 })
  must((await body(admin).inputValue()) === 'ข้อความใหม่ที่น้องพิมพ์', 'admin sees the helper text live without reloading')
  must(/หัวหน้าเลขา/.test(await admin.locator('main').innerText()), 'shows who saved last')
  // ไม่ทับกลับ: รอรอบซิงก์ต่อไป ข้อความในระบบยังเป็นของน้อง
  await admin.waitForTimeout(12000)
  const remote = JSON.parse(files.get('invite-letter.json').text).items.find((x) => x.id === 'R')
  must(remote.body === 'ข้อความใหม่ที่น้องพิมพ์', 'remote keeps the helper text (not overwritten by the admin stale copy): ' + remote.body)
  // เปิดจากลิงก์ในหน้าใหม่: ได้ฉบับล่าสุดทันที (ไม่ใช่ฉบับเก่าในเครื่อง)
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/4/invite`); await admin.waitForTimeout(500)
  await body(helper).fill('ข้อความรอบสองของน้อง'); await helper.waitForTimeout(1500)
  await admin.goto(url()); await body(admin).waitFor({ timeout: 15000 })
  must((await body(admin).inputValue()) === 'ข้อความรอบสองของน้อง', 'opening the link shows the latest version immediately')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('liveletter-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
