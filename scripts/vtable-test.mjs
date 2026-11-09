// ตารางเยี่ยมรายสัปดาห์: แผนมีภาค → ขึ้นในตาราง (รายงาน › ตาราง)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4521
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)))
  const d = new Date(); const t = d.toISOString().slice(0, 10)
  await p.addInitScript(([t]) => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
    // วันอังคารของสัปดาห์นี้หรือถัดไป: ใช้วันนี้ถ้าเป็นวันเยี่ยม
    localStorage.setItem('acct.visit-plans.v1', JSON.stringify([{ id: 'plan-' + t, date: t, v: 2, groups: 1, names: {}, items: [{ id: 'm1', name: 'คุณสมชาย', g: 1, slot: 'เช้า' }, { id: 'm2', name: 'คุณสมหญิง', g: 2, slot: 'ค่ำ' }], slotNotes: { ค่ำ: 'เตรียมสถานที่งาน' }, updated: 1 }]))
  }, [t])
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/4/2`); await p.reload()
  const tb = p.getByRole('table', { name: 'ตารางเยี่ยมเยียน' })
  await tb.waitFor({ timeout: 15000 })
  const txt = await tb.innerText()
  const dow = d.getDay()
  if (dow >= 2) { must(/คุณสมชาย/.test(txt) && /คุณสมหญิง/.test(txt) && /เตรียมสถานที่งาน/.test(txt), 'plan shown in table: ' + txt.slice(0, 200)) }
  must(/ภาคเช้า/.test(txt) && /ภาคบ่าย/.test(txt) && /ภาคค่ำ/.test(txt), 'slot headers')
  must(errors.length === 0, 'errors ' + errors)
  console.log('OK vtable', dow)
  await b.close()
} finally { server.kill() }
