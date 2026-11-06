// แก้เลขที่ในแถบสีดำ → ชิ้นงานแทรกไปอยู่ลำดับนั้นจริง · ชิ้นอื่นเลื่อนตาม · “ครั้งที่” ของการประชุมตามไปด้วย
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4400
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
    const L = (n) => ({ id: 'l' + n, no: 'ศอ/จป.00' + n, toName: 'ชิ้น' + n, date: '2026-11-06', subject: 's', to: 't', body: 'b', updated: 1 })
    const M = (n) => ({ id: 'm' + n, name: 'ชิ้น' + n, no: n, year: 2026, type: 'ปกติ', date: '', time: '', place: '', chair: '', secretary: '', people: [], agenda: [], noticeLetterId: 'l' + n, updated: 1 })
    localStorage.setItem('acct.noticeletter.v1', JSON.stringify([1, 2, 3, 4].map(L)))
    localStorage.setItem('acct.meetings.v1', JSON.stringify([1, 2, 3, 4].map(M)))
  })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4/notice-l4`); await p.reload()
  await p.locator('output#il-no').waitFor({ timeout: 10000 })
  await p.getByRole('button', { name: 'แก้เลขที่หนังสือเอง' }).click()
  await p.locator('input#il-no').fill('ศอ/จป.002')
  await p.locator('input#il-no').blur()
  await p.waitForTimeout(800)
  const ls = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.noticeletter.v1')))
  const no = (id) => ls.find((x) => x.id === id).no
  must(no('l4') === 'ศอ/จป.002' && no('l2') === 'ศอ/จป.003' && no('l3') === 'ศอ/จป.004' && no('l1') === 'ศอ/จป.001', 'letters shifted: ' + JSON.stringify(ls.map((x) => [x.id, x.no])))
  const ms = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.meetings.v1')))
  const mn = (id) => ms.find((x) => x.id === id).no
  must(mn('m1') === 1 && mn('m4') === 2 && mn('m2') === 3 && mn('m3') === 4, 'meeting ครั้งที่ follow: ' + JSON.stringify(ms.map((x) => [x.id, x.no])))
  // รายการ: ชิ้น 4 อยู่ลำดับที่ 2
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4`)
  await p.getByRole('button', { name: '➕ เพิ่มลำดับงาน' }).click()
  await p.getByLabel('ชื่อลำดับงาน').fill('ประชุมธรรมกิจ'); await p.getByLabel(/ขั้นตอนตามลำดับ/).fill('x')
  await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await p.getByRole('link', { name: /^เปิด ประชุมธรรมกิจ/ }).click()
  const rows = p.getByRole('list', { name: 'รายการการประชุม' }).getByRole('listitem')
  await rows.first().waitFor({ timeout: 8000 })
  const texts = await rows.allInnerTexts()
  must(/ชิ้น4/.test(texts[1]) && /ชิ้น1/.test(texts[0]) && /ชิ้น2/.test(texts[2]), 'list order follows the edited number: ' + texts.map((t) => t.slice(0, 12)).join(' | '))
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('letterreorder-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
