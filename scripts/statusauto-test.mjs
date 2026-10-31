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
    const lastSun = new Date(); lastSun.setUTCDate(lastSun.getUTCDate() - lastSun.getUTCDay())
    const sun = (w) => iso(new Date(lastSun.getTime() - w * 7 * 86400000))
    const who = { l1: (w) => w < 14, o1: (w) => w === 5, n1: (w) => w < 14, n2: (w) => w >= 20 && w < 25, n3: (w) => w < 6, w1: (w) => w % 2 === 0 && w < 80, w2: (w) => w % 2 === 0 && w < 80 }
    const byYear = {}
    for (let w = 0; w < 100; w++) {
      const date = sun(w), ids = ['other', ...Object.entries(who).filter(([, f]) => f(w)).map(([id]) => id)]
      ;(byYear[date.slice(0, 4)] ??= []).push({ id: `a-${date}`, updated: 1, date, ids })
    }
    for (const [y, items] of Object.entries(byYear)) localStorage.setItem(`acct.attendance.${y}.v1`, JSON.stringify(items))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([
      { id: 'n1', updated: 1, name: 'คนใหม่มา 4 เดือน', status: '5.คนใหม่' },
      { id: 'n2', updated: 1, name: 'คนใหม่ไม่มาแล้ว', status: 'คนใหม่' },
      { id: 'n3', updated: 1, name: 'คนใหม่มาไม่ถึง 3 เดือน', status: '4.คนใหม่' },
      { id: 'w1', updated: 1, name: 'ผู้ร่วมต่อเนื่อง', status: '4.ผู้ร่วมนมัสการ' },
      { id: 'w2', updated: 1, name: 'ผู้ร่วมเพิ่งเปลี่ยน', status: 'ผู้ร่วมนมัสการ', statusAt: ago(60) },
      { id: 'l1', updated: 1, name: 'คนใหม่ที่ล็อก', status: 'คนใหม่', statusLock: { why: 'แขกประจำ' } },
      { id: 'o1', updated: 1, name: 'ถูกย้ายด้วยเกณฑ์เก่า', status: 'ผู้ร่วมนมัสการ', statusMoved: { from: 'คนใหม่', at: Date.now(), why: 'มานมัสการมา 19 เดือน (ตั้งแต่ 2025-03-23)' } },
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
  must(st.l1 === 'คนใหม่' && st.o1 === 'ผู้ร่วมนมัสการ', 'locked person is not moved; the old-rule move is untouched until reviewed: ' + JSON.stringify(st))
  must(st.f1 === 'สมบูรณ์ ( 1 )', 'legacy number removed from every status: ' + st.f1)
  await page.getByRole('button', { name: /ดูรายการ/ }).click()
  must(await page.getByText(/คนใหม่ → ผู้ร่วมนมัสการ/).count() >= 1, 'banner lists the automatic status changes')
  // หน้ารายละเอียดไม่มีเลขนำหน้า
  await page.getByRole('button', { name: /เมนูสมาชิก/ }).click()
  await page.getByRole('tab', { name: /ทะเบียน/ }).first().click()
  await page.locator('ul.list').getByText('สมาชิกสมบูรณ์').first().click()
  await page.getByText('สถานะในทะเบียน', { exact: true }).waitFor({ timeout: 8000 })
  const dd = await page.getByRole('dialog').innerText()
  must(/สถานะในทะเบียน\s*สมบูรณ์ \( 1 \)/.test(dd) && !/\d\.สมบูรณ์/.test(dd), 'detail shows status without a number: ' + dd.slice(0, 300))
  // กำหนดสถานะเอง (ล็อก) รายบุคคล + ยกเว้นการตรวจการนมัสการ (หน้ารายละเอียดของ “สมาชิกสมบูรณ์” เปิดอยู่)
  await page.getByRole('button', { name: /กำหนดสถานะเอง/ }).click()
  await page.getByLabel('เหตุผล (ไม่บังคับ)').fill('ศิษยาภิบาล')
  await page.getByRole('checkbox', { name: 'ยกเว้นการตรวจการนมัสการ' }).check()
  await page.getByRole('button', { name: /^🔒 บันทึก$/ }).click()
  const f1 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.church-members.v1')).find((x) => x.id === 'f1'))
  must(f1.statusLock?.why === 'ศิษยาภิบาล' && f1.statusLock.skipAudit === true && f1.status === 'สมบูรณ์ ( 1 )', 'lock saved: ' + JSON.stringify(f1))
  must(await page.getByText(/🔒 กำหนดสถานะเอง · ศิษยาภิบาล/).count() >= 1, 'lock reason shown on the detail page')
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  // เกณฑ์ปรับได้: เปิดหน้าเกณฑ์สถานะ → เห็นเหตุผล → แก้เกณฑ์แล้วบันทึก → ปรับทันที
  await page.keyboard.press('Escape'); await page.waitForTimeout(300)
  await page.getByRole('button', { name: /เกณฑ์สถานะ/ }).click()
  must(await page.getByLabel('มาอย่างน้อย').count() === 2, 'criteria inputs shown (new + worship)')
  await page.getByRole('spinbutton', { name: 'มาอย่างน้อย' }).first().fill('99')
  await page.getByText(/เข้าเกณฑ์ตอนนี้ 0 คน/).waitFor({ timeout: 5000 })
  must(await page.getByText(/ถ้าบันทึก จะเปลี่ยนสถานะ/).count() === 1, 'preview line when criteria edited')
  // ตรวจรายการที่ระบบเปลี่ยนไปแล้ว → ❌ ไม่เข้าเกณฑ์ปัจจุบัน → คืนสถานะเดิม
  const rl = page.getByRole('list', { name: 'รายการที่ระบบเปลี่ยนสถานะไปแล้ว' })
  await rl.waitFor({ timeout: 5000 })
  must(/❌[\s\S]*ถูกย้ายด้วยเกณฑ์เก่า/.test(await rl.innerText()), 'old-rule move flagged as not fitting the current criteria: ' + await rl.innerText())
  must(await page.getByRole('list', { name: 'คนที่ล็อกสถานะ' }).getByText(/คนใหม่ที่ล็อก/).count() === 1, 'locked list shown')
  await page.getByRole('button', { name: /คืนสถานะเดิมที่เลือก \(\d+ คน\)/ }).click()
  await page.waitForTimeout(500)
  const o1 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.church-members.v1')).find((x) => x.id === 'o1').status)
  must(o1 === 'คนใหม่', 'reverted to the old status: ' + o1)
  await page.getByRole('button', { name: /↺ คืนค่าตั้งต้น/ }).click()
  must(true, 'reset')
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('statusauto-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
