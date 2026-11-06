// บันทึกการประชุม ส่วนที่ 1: รายชื่อคณะธรรมกิจ ร่วม/ลา/ขาด + ผู้สังเกตการณ์ → ไปส่วนที่ 2 (วาระ)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4397
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)))
  await p.addInitScript(() => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
    localStorage.setItem('acct.mc.cur', 'mt1')
    localStorage.setItem('acct.committee.v1', JSON.stringify(Array.from({ length: 12 }, (_, i) => ({ id: 'c' + i, name: 'กรรมการ' + (i + 1), role: i === 0 ? 'ประธาน' : 'กรรมการ', order: i, updated: 1 }))))
    localStorage.setItem('acct.meetings.v1', JSON.stringify([{ id: 'mt1', name: 'ประชุมคณะธรรมกิจ', no: 1, year: 2026, type: 'ปกติ', date: '2026-11-01', time: '13:00', place: '', chair: '', secretary: '', people: [], agenda: [{ id: 'a1', title: 'กล่าวต้อนรับ', group: 'แจ้งเพื่อทราบ', purpose: 'ทราบ' }], updated: 1 }]))
  })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4/6`); await p.reload()
  const list = p.getByRole('list', { name: 'รายชื่อคณะธรรมกิจ' })
  await list.waitFor({ timeout: 10000 })
  must(await list.getByRole('listitem').count() === 12, '12 committee members seeded from the standing roster')
  must(/ประธาน/.test(await list.getByRole('listitem').first().innerText() + await list.getByRole('listitem').first().locator('input').nth(1).inputValue()), 'position shown')
  const go = p.getByRole('button', { name: /เสร็จส่วนที่ 1/ })
  must(await go.isDisabled(), 'cannot continue until everyone is marked')
  await p.getByRole('button', { name: /ติ๊ก “ร่วม” ให้ทุกคน/ }).click()
  await list.getByRole('listitem').nth(1).getByRole('button', { name: 'ลา', exact: true }).click()
  await list.getByRole('listitem').nth(2).getByRole('button', { name: 'ขาด', exact: true }).click()
  await p.getByRole('button', { name: /เพิ่มผู้เข้าร่วม \/ ผู้สังเกตการณ์/ }).click()
  await p.getByRole('list', { name: /ผู้เข้าร่วมประชุมและผู้สังเกตการณ์/ }).getByRole('listitem').first().waitFor()
  must(await go.isEnabled(), 'enabled when all marked')
  await go.click()
  await p.getByText('ส่วนที่ 2 · วาระการประชุม').waitFor({ timeout: 5000 })
  must(await p.getByText('กล่าวต้อนรับ').count() >= 1, 'part 2 shows agenda minutes')
  const ms = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.meetings.v1')))
  const pe = ms[0].people
  must(pe.filter((x) => x.kind === 'กรรมการ').length === 12 && pe.filter((x) => x.att === 'ลา').length === 1 && pe.filter((x) => x.att === 'ไม่มา').length === 1, 'attendance saved onto the meeting')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('roster-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
