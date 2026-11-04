// ซิงก์ประหยัดโควตา: ถามครั้งเดียวว่า repo มี commit ใหม่ไหม · ไม่เปลี่ยน = ไม่ดึงไฟล์ · มีคนเปลี่ยน = ดึง · มาตรวัดโควตาแสดงค่า
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4251
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
let head = 'aaa111', remaining = 4000
const files = new Map()
const calls = { commits: 0, contents: 0, c304: 0, f304: 0, put: 0 }
const CORS = { 'access-control-allow-origin': '*', 'access-control-expose-headers': 'etag, x-ratelimit-limit, x-ratelimit-remaining, x-ratelimit-reset, x-ratelimit-used', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,PUT,POST,OPTIONS' }
await ctx.route('https://api.github.com/**', (r) => {
  const q = r.request(), u = q.url(), h = q.headers()
  if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: CORS })
  const rl = { 'x-ratelimit-limit': '5000', 'x-ratelimit-remaining': String(remaining), 'x-ratelimit-used': String(5000 - remaining), 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800) }
  if (u.includes('/rate_limit')) return r.fulfill({ status: 200, headers: CORS, contentType: 'application/json', body: JSON.stringify({ resources: { core: { limit: 5000, remaining, used: 5000 - remaining, reset: Math.floor(Date.now() / 1000) + 1800 } } }) })
  if (u.includes('/commits')) {
    calls.commits++
    const et = `"c-${head}"`
    if (h['if-none-match'] === et) { calls.c304++; return r.fulfill({ status: 304, headers: { ...CORS, ...rl, etag: et } }) }
    return r.fulfill({ status: 200, headers: { ...CORS, ...rl, etag: et }, contentType: 'application/json', body: JSON.stringify([{ sha: head }]) })
  }
  if (u.includes('/contents/') && q.method() === 'GET') {
    const name = u.split('/contents/')[1]
    const f = files.get(name) ?? { b64: Buffer.from(JSON.stringify({ items: [] })).toString('base64'), ver: 0 }
    const et = `"f-${name}-${f.ver}"`
    if (h['if-none-match'] === et) { calls.f304++; return r.fulfill({ status: 304, headers: { ...CORS, ...rl, etag: et } }) }
    calls.contents++
    return r.fulfill({ status: 200, headers: { ...CORS, ...rl, etag: et }, contentType: 'application/json', body: JSON.stringify({ sha: 'sha-' + name + f.ver, encoding: 'base64', content: f.b64 }) })
  }
  if (q.method() === 'PUT' && u.includes('/contents/')) {
    calls.put++
    const name = u.split('/contents/')[1]
    const body = JSON.parse(q.postData() || '{}')
    const prev = files.get(name)
    files.set(name, { b64: body.content, ver: (prev?.ver ?? 0) + 1 })
    head = 'bbb' + calls.put
    return r.fulfill({ status: 200, headers: { ...CORS, ...rl }, contentType: 'application/json', body: '{}' })
  }
  return r.fulfill({ status: 404, headers: CORS, body: '{}' })
})
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.clock.install()
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'tok', name: 'ทดสอบ' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/balance/own`); await page.reload()
  await page.clock.runFor(3000)
  const first = { ...calls }
  must(first.commits >= 1, 'checked repo head once: ' + JSON.stringify(first))
  // เงียบ 5 นาที (ไม่มีใครเปลี่ยน): ไม่ควรดึงไฟล์อีก และถามหัว repo ไม่เกินราว 1 ครั้ง/นาที
  for (let i = 0; i < 3; i++) await page.clock.runFor(60_000) // ให้ซิงก์รอบแรก/ส่งข้อมูลตั้งต้นเสร็จก่อน
  const before = { ...calls }
  for (let i = 0; i < 5; i++) await page.clock.runFor(60_000)
  const quiet = { contents: calls.contents - before.contents, f304: calls.f304 - before.f304, commits: calls.commits - before.commits }
  must(quiet.contents === 0 && quiet.f304 === 0, 'no file requests at all while nothing changed: ' + JSON.stringify(quiet))
  must(quiet.commits <= 6, 'head checks at most ~1/min: ' + JSON.stringify(quiet))
  // มีคนอื่นบันทึก (head เปลี่ยน): รอบถัดไปต้องดึงไฟล์
  files.set('settings.json', { b64: Buffer.from(JSON.stringify({ items: [{ id: 'x', updated: Date.now() + 5e9 }] })).toString('base64'), ver: 99 }); head = 'ccc999'
  const b2 = calls.contents
  for (let i = 0; i < 3; i++) await page.clock.runFor(60_000)
  must(calls.contents > b2, 'pulls files after someone else committed')
  // มาตรวัดโควตาในหน้าตั้งค่า/ปุ่มซิงก์
  await page.getByRole('button', { name: /ซิงก์|รีเฟรช|อัปเดต/ }).first().click()
  const meter = page.getByRole('region', { name: 'มาตรวัดโควตา GitHub' })
  await meter.waitFor({ timeout: 8000 })
  const t = (await meter.innerText()).replace(/\s+/g, ' ')
  must(/เหลือ 4,000 จาก 5,000/.test(t) && /เครื่องนี้เรียก GitHub/.test(t), 'quota meter shows remaining and local calls: ' + t)
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('syncquota-test OK', JSON.stringify(calls))
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
