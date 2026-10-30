// หนังสือแจ้งการประชุม: อยู่ในตัวเลือกสร้างเอกสาร · สร้างใหม่/เปิดฉบับเดิมได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const REPO = 'Cornerstone-church-huahin/church-accounting-data'
const PORT = 4398
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
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1`)
  await admin.getByLabel('เลือกเรียกเฉพาะการ์ด').waitFor({ timeout: 15000 })
  const opts = await admin.locator('#wf-pick option').allTextContents()
  must(opts.some((o) => o.includes('จดหมายขอบคุณ')), 'category card in dropdown: ' + opts.join('|'))
    must(opts.some((o) => o.includes('หนังสือแจ้งประชุมธรรมกิจ ประจำเดือน')) && opts.some((o) => o.includes('หนังสือเชิญร่วมงาน')), 'dedicated kinds shown by library names: ' + opts.join('|'))
  must(!opts.some((o) => o.includes('คณะธรรมกิจ') || o.includes('ประชุมธรรมกิจ') && !o.includes('แจ้ง')), 'no card without library category: ' + opts.join('|'))
  must(await admin.getByLabel('ลบการ์ด จดหมายขอบคุณ').count() === 0, 'no delete button on library cards')
  // การ์ดหมวด → รายการ → สร้างฉบับ เลขตามตัวย่อหมวด
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1/cat-${encodeURIComponent('จดหมายขอบคุณ')}`)
  await admin.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click()
  await body(admin).waitFor({ timeout: 15000 })
  const paper = await admin.getByLabel('ตัวอย่างหนังสือ').innerText()
  must(paper.includes('ศอ/จข.001'), 'general letter numbered by category prefix: ' + paper.slice(0, 300))
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1/notice`)
  await admin.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click()
  await body(admin).waitFor({ timeout: 15000 })
  const bt = await body(admin).inputValue(), tn = await admin.locator('#il-tn').inputValue()
  must(/ประจำเดือน\S+ ในวันอาทิตย์ที่ \d{1,2} \S+ พ\.ศ\. 25\d\d เวลา 13\.00 น\. ณ ห้องประชุมธรรมกิจ/.test(bt), 'auto first-Sunday text: ' + bt)
  must(/^แจ้งประชุมคณะธรรมกิจ ประจำเดือน\S+$/.test(await admin.locator('#il-sub').inputValue()), 'auto subject')
  must(/^\d{1,2}\/\d{1,2}\/\d{4} แจ้งการประชุมประจำเดือนธรรมกิจ$/.test(tn), 'auto numeric date in to-name: ' + tn)
  await admin.getByRole('button', { name: /เพิ่มวาระ/ }).click()
  await admin.getByLabel('วาระที่ 5', { exact: true }).fill('ข้อห้า')
  must(await admin.getByLabel('เลื่อนวาระที่ 5 ขึ้น').count() === 0, 'no up/down buttons')
  const g = await admin.getByLabel('ลากเพื่อเลื่อนวาระที่ 5').boundingBox(), t = await admin.getByLabel('วาระที่ 1', { exact: true }).boundingBox()
  await admin.mouse.move(g.x + g.width / 2, g.y + g.height / 2); await admin.mouse.down()
  await admin.mouse.move(g.x + g.width / 2, t.y + 5, { steps: 12 }); await admin.mouse.up()
  must((await admin.getByLabel('วาระที่ 1', { exact: true }).inputValue()) === 'ข้อห้า', 'agenda drag to first = วาระที่ 1')
  await admin.getByRole('button', { name: /เพิ่มเรื่อง/ }).click()
  await admin.getByLabel('เรื่องที่ 1', { exact: true }).fill('เรื่องทดสอบ')
  const pp = await admin.getByLabel('ตัวอย่างหนังสือ').innerText()
  must(pp.includes('เรื่องที่ 1') && pp.includes('วาระที่ 1') && pp.includes('ข้อห้า'), 'paper shows วาระที่/เรื่องที่ labels: ' + pp)
  // หนังสือแจ้งการประชุม: เลขตามหมวดในคลัง ศอ/ปธ
  await admin.goto(`http://localhost:${PORT}/#/meeting/1/1/notice`)
  await admin.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click()
  await body(admin).waitFor({ timeout: 15000 })
  const p2 = await admin.getByLabel('ตัวอย่างหนังสือ').innerText()
  must(/ศอ\/ปธ\.00\d/.test(p2) && p2.includes('13.00 น.') && p2.includes('มน.หนึ่งฤทัย'), 'notice uses library prefix: ' + p2.slice(0, 400))
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('noticeletter-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
