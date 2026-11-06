// แก้เลขที่ในแถบสีดำเป็นเลขที่ชนกับชิ้นอื่น: ชิ้นนี้ได้เลขนั้น+ครั้งที่ตามเลข · ชิ้นที่ชนขยับไปเลขถัดไป · ชิ้นที่ไม่ชนไม่ถูกแตะ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4401
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
    const L = (id, n) => ({ id, no: 'ศอ/จป.00' + n, toName: 'ชิ้น' + id, date: '2026-11-06', subject: 's', to: 't', body: 'b', updated: 1 })
    const M = (id, no) => ({ id: 'm' + id, name: 'ชิ้น' + id, no, year: 2026, type: 'ปกติ', date: '', time: '', place: '', chair: '', secretary: '', people: [], agenda: [], noticeLetterId: id, updated: 1 })
    localStorage.setItem('acct.noticeletter.v1', JSON.stringify([L('a', 1), L('b', 2), L('c', 4), L('d', 3)]))
    localStorage.setItem('acct.meetings.v1', JSON.stringify([M('a', 1), M('b', 3), M('c', 4), M('d', 2)]))
  })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4/notice-c`); await p.reload()
  await p.locator('output#il-no').waitFor({ timeout: 10000 })
  await p.getByRole('button', { name: 'แก้เลขที่หนังสือเอง' }).click()
  await p.locator('input#il-no').fill('ศอ/จป.002'); await p.locator('input#il-no').blur()
  await p.waitForTimeout(800)
  const ls = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.noticeletter.v1')))
  const no = (id) => ls.find((x) => x.id === id).no
  must(no('c') === 'ศอ/จป.002' && no('b') === 'ศอ/จป.003' && no('d') === 'ศอ/จป.004' && no('a') === 'ศอ/จป.001', 'letters: ' + JSON.stringify(ls.map((x) => [x.id, x.no])))
  const ms = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.meetings.v1')))
  const mn = (id) => ms.find((x) => x.id === 'm' + id).no
  must(mn('a') === 1 && mn('c') === 2 && mn('b') === 3 && mn('d') === 4, 'ครั้งที่ follow the number: ' + JSON.stringify(ms.map((x) => [x.id, x.no])))
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('letterreorder-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
