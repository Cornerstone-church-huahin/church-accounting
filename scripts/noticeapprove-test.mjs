// หนังสือแจ้งการประชุม: แจ้งประธาน → รอตรวจสอบ → ประธานอนุมัติ → เลขาลงลายเซ็น → บันทึกเรียบร้อย + ดาวน์โหลด PDF / แชร์รูป / พิมพ์
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4394
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const p = await (await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)))
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.addInitScript(() => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    localStorage.setItem('acct.noticesettings.v1', JSON.stringify([{ id: 'settings', signImg: png, addr: '77110 หัวหิน', updated: 1 }]))
    localStorage.setItem('acct.noticeletter.v1', JSON.stringify([{ id: 'l1', toName: 'คณะธรรมกิจ', no: 'ศอ/จป.001', date: '2026-11-06', subject: 'แจ้งประชุม', to: 'คณะธรรมกิจ', body: 'ด้วยคณะธรรมกิจกำหนดประชุม', notified: { at: 5, by: 'เลขา' }, updated: 1 }]))
  })
  await p.goto('http://localhost:' + PORT + '/#/meeting/1/4/notice-l1'); await p.reload()
  await p.getByText('รอประธานตรวจสอบ').first().waitFor({ timeout: 10000 })
  must(await p.getByRole('button', { name: /ลงลายเซ็น/ }).count() === 0, 'no sign button before approval')
  must(await p.getByText('รอประธานอนุมัติก่อน').count() >= 1, 'sign step waits for approval')
  await p.getByRole('button', { name: /อนุมัติ \(ประธานตรวจแล้ว\)/ }).click()
  await p.getByText('ประธานอนุมัติแล้ว').first().waitFor({ timeout: 5000 })
  await p.getByRole('button', { name: /ลงลายเซ็น/ }).click()
  await p.getByRole('group', { name: /บันทึกเรียบร้อย/ }).waitFor({ timeout: 8000 })
  const g = p.getByRole('group', { name: /บันทึกเรียบร้อย/ })
  must(await g.getByRole('button', { name: 'ดาวน์โหลดเป็นไฟล์ PDF' }).count() === 1 && await g.getByRole('button', { name: 'แชร์เป็นรูปภาพ' }).count() === 1 && await g.getByRole('button', { name: 'พิมพ์หนังสือ' }).count() === 1, 'three output icons')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('noticeapprove-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
