// หนังสือแจ้งการประชุม: อยู่ในตัวเลือกสร้างเอกสาร · สร้างใหม่/เปิดฉบับเดิมได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const REPO = 'Cornerstone-church-huahin/church-accounting-data'
const PORT = 4397
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
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1`)
  await admin.getByLabel('เลือกเรียกเฉพาะการ์ด').waitFor({ timeout: 15000 })
  const opts = await admin.locator('#wf-pick option').allTextContents()
  must(opts.some((o) => o.includes('หนังสือแจ้งการประชุมคณะธรรมกิจ')), 'dropdown lists notice: ' + opts.join('|'))
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1/notice`)
  await admin.getByRole('button', { name: /เพิ่ม|สร้าง/ }).first().click()
  await body(admin).waitFor({ timeout: 15000 })
  must((await body(admin).inputValue()).length > 20, 'new notice has template body')
  must(await admin.getByLabel('วาระที่ 4', { exact: true }).count() === 1, 'default agenda has 4 items')
  await admin.getByLabel('วาระที่ 1', { exact: true }).fill('วาระทดสอบ')
  await admin.getByRole('button', { name: /เพิ่มวาระ/ }).click()
  await admin.getByLabel('วาระที่ 5', { exact: true }).fill('ข้อห้า')
  await admin.getByLabel('เลื่อนวาระที่ 5 ขึ้น').click()
  must((await admin.getByLabel('วาระที่ 4', { exact: true }).inputValue()) === 'ข้อห้า', 'agenda reorder')
  const paper = await admin.getByLabel('ตัวอย่างหนังสือ').innerText()
  must(paper.includes('วาระทดสอบ') && paper.includes('มน.หนึ่งฤทัย') && paper.includes('เลขานุการคริสตจักร'), 'paper has agenda + secretary signature: ' + paper)
  must(await admin.getByRole('button', { name: /ลงลายเซ็น/ }).count() > 0, 'sign button available')
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1/notice-R`)
  await body(admin).waitFor({ timeout: 15000 })
  must((await body(admin).inputValue()) === 'ข้อความเก่า', 'opens existing notice')
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('noticeletter-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
