// สถานะไม่มีเลขนำหน้า (แปลงข้อมูลเดิมให้) + เปลี่ยนสถานะอัตโนมัติ: คนใหม่มา ≥ 3 เดือน → ผู้ร่วมนมัสการ · ผู้ร่วมนมัสการต่อเนื่อง > 1 ปี → สมาชิกสำรอง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4415
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const files = new Map(); let n = 0
  await ctx.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const m = url.pathname.match(/^\/repos\/x\/y(?:\/contents\/(.+))?$/)
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) })
    if (route.request().method() === 'OPTIONS') return json(204, {})
    if (!m) return json(404, {})
    if (!m[1]) return json(200, { private: true, permissions: { push: true } })
    const path = decodeURIComponent(m[1])
    if (route.request().method() === 'GET') { const f = files.get(path); return f ? json(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') }) : json(404, {}) }
    if (route.request().method() === 'PUT') { const b = JSON.parse(route.request().postData()); files.set(path, { text: Buffer.from(b.content, 'base64').toString('utf8'), sha: `s${++n}` }); return json(200, { content: { sha: `s${n}` } }) }
    return json(404, {})
  })
  await ctx.addInitScript(() => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, status: 'active', updated: 1 }]))
    localStorage.setItem('acct.settings.v1', JSON.stringify([{ id: 'settings', ageAuto: false, updated: 1 }]))   // ปิดย้ายกลุ่ม ให้ทดสอบสถานะล้วนๆ
    const iso = (d) => d.toISOString().slice(0, 10)
    const ago = (days) => iso(new Date(Date.now() - days * 86400000))
    const byYear = {}
    const add = (date, ...ids) => { const y = date.slice(0, 4); (byYear[y] ??= []).push({ id: `a-${date}-${ids[0]}`, updated: 1, date, ids }) }
    add(ago(120), 'n1', 'n2', 'w1', 'w2'); add(ago(40), 'n3'); add(ago(7), 'n1', 'n3', 'w1', 'w2')
    add(ago(500), 'w1', 'w2')   // ครั้งแรกเมื่อ ~16 เดือนก่อน → ผู้ร่วมนมัสการ w1 เกิน 1 ปีแล้ว
    for (const [y, items] of Object.entries(byYear)) localStorage.setItem(`acct.attendance.${y}.v1`, JSON.stringify(items))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([
      { id: 'n1', updated: 1, name: 'คนใหม่มา 4 เดือน', status: '5.คนใหม่' },
      { id: 'n2', updated: 1, name: 'คนใหม่ไม่มาแล้ว', status: 'คนใหม่' },
      { id: 'n3', updated: 1, name: 'คนใหม่มาไม่ถึง 3 เดือน', status: '4.คนใหม่', firstWorship: ago(40) },
      { id: 'w1', updated: 1, name: 'ผู้ร่วมต่อเนื่อง', status: '4.ผู้ร่วมนมัสการ' },
      { id: 'w2', updated: 1, name: 'ผู้ร่วมเพิ่งเปลี่ยน', status: 'ผู้ร่วมนมัสการ', statusAt: ago(60) },
      { id: 'f1', updated: 1, name: 'สมาชิกสมบูรณ์', status: '1.สมบูรณ์  ( 1 )' },
    ]))
  })
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/#/meeting/2?tab=roster`)
  await page.getByText(/ปรับข้อมูลทะเบียนอัตโนมัติ/).waitFor({ timeout: 15000 })
  const st = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('acct.church-members.v1')).map((x) => [x.id, x.status])))
  must(st.n1 === 'ผู้ร่วมนมัสการ', 'newcomer 4 months, still attending → ผู้ร่วมนมัสการ: ' + JSON.stringify(st))
  must(st.n2 === 'คนใหม่' && st.n3 === 'คนใหม่', 'inactive / under 3 months stay as newcomer (numbers stripped): ' + JSON.stringify(st))
  must(st.w1 === 'สมาชิกสำรอง' && st.w2 === 'ผู้ร่วมนมัสการ', 'continuous > 1 year → สมาชิกสำรอง; recently changed stays: ' + JSON.stringify(st))
  must(st.f1 === 'สมบูรณ์ ( 1 )', 'legacy number removed from every status: ' + st.f1)
  await page.getByRole('button', { name: /ดูรายการ/ }).click()
  must(await page.getByText(/คนใหม่ → ผู้ร่วมนมัสการ/).count() >= 1, 'banner lists the automatic status changes')
  // หน้ารายละเอียดไม่มีเลขนำหน้า
  await page.getByRole('button', { name: /เมนูสมาชิก/ }).click()
  await page.getByRole('tab', { name: /ทะเบียน/ }).first().click()
  await page.getByText('สมาชิกสมบูรณ์').first().click()
  await page.getByText('สถานะในทะเบียน', { exact: true }).waitFor({ timeout: 8000 })
  const dd = await page.getByRole('dialog').innerText()
  must(/สถานะในทะเบียน\s*สมบูรณ์ \( 1 \)/.test(dd) && !/\d\.สมบูรณ์/.test(dd), 'detail shows status without a number: ' + dd.slice(0, 300))
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('statusauto-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
