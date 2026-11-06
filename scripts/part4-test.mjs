// บันทึกการประชุม ส่วนที่ 1: รายชื่อคณะธรรมกิจ ร่วม/ลา/ขาด + ผู้สังเกตการณ์ → ไปส่วนที่ 2 (วาระ)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4411
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
    localStorage.setItem('acct.meetings.v1', JSON.stringify([{ rosterDone: {at:1}, agendaDone: {at:1}, closeDone: {at:1}, id: 'mt1', name: 'ประชุมคณะธรรมกิจ', no: 1, year: 2026, type: 'ปกติ', date: '2026-11-01', time: '13:00', place: '', chair: '', secretary: '', people: [], agenda: [{ id: 'a1', title: 'กล่าวต้อนรับ', group: 'แจ้งเพื่อทราบ', purpose: 'ทราบ' }, { id: 'a1c', title: 'ทดสอบ', group: 'แจ้งเพื่อทราบ', purpose: 'ทราบ', parentId: 'a1' }], updated: 1 }]))
  })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4/6`); await p.reload()
  await p.getByRole('heading', { name: /ส่วนที่ 4/ }).waitFor({ timeout: 10000 })
  const n = await p.locator('.a4page').count()
  must(n >= 2, 'roster + minutes pages: ' + n)
  must(/ใบลงชื่อผู้ร่วมประชุม/.test(await p.locator('.a4page').first().innerText()), 'first sheet is the sign-in sheet')
  must(await p.getByRole('button', { name: /ดาวน์โหลด PDF รายงานการประชุมฉบับรวม/ }).count() === 1, 'pdf tools')
  must(errors.length === 0, 'no page errors ' + errors)
  console.log('OK pages', n)
  await b.close()
} finally { server.kill() }
