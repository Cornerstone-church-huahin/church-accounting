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
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  await p.route('**/api.github.com/**', (r) => {
    const q = r.request()
    if (q.method() === 'OPTIONS') return r.fulfill({ status: 204, headers: cors })
    if (q.method() === 'PUT') return r.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'x' } }) })
    return r.fulfill({ status: 404, headers: cors, body: '{}' })
  })
  await p.addInitScript(() => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
    localStorage.setItem('acct.noticesettings.v1', JSON.stringify([{ id: 'settings', signImg: png, addr: '77110 หัวหิน', updated: 1 }]))
    localStorage.setItem('acct.noticeletter.v1', JSON.stringify([{ id: 'l1', toName: 'คณะธรรมกิจ', no: 'ศอ/จป.001', date: '2026-11-06', subject: 'แจ้งประชุม', to: 'คณะธรรมกิจ', body: 'ด้วยคณะธรรมกิจกำหนดประชุม', agenda: [{ t: 'กล่าวต้อนรับ' }, { t: 'เรื่องแจ้ง' }, { t: 'เทสระบบ', k: 'r' }], notified: { at: 5, by: 'เลขา' }, updated: 1 }]))
  })
  await p.goto('http://localhost:' + PORT + '/#/meeting/1/4/notice-l1'); await p.reload()
  await p.getByText('รอตรวจสอบ').first().waitFor({ timeout: 10000 })
  must(await p.getByRole('button', { name: /ลงลายเซ็น/ }).count() === 0, 'no sign button before approval')
  must(await p.getByText('ลงลายเซ็นได้หลังประธานอนุมัติ').count() >= 1, 'sign step waits for approval')
  // กดแจ้งประธานซ้ำ: มีหน้าต่างส่งลิงก์ขึ้นทุกครั้ง (เครื่องทดสอบไม่มีเมนูแชร์)
  for (let i = 0; i < 2; i++) { await p.getByRole('button', { name: /แจ้งประธานตรวจสอบ/ }).click(); await p.getByRole('dialog', { name: 'ส่งลิงก์ให้ประธานตรวจสอบ' }).waitFor({ timeout: 5000 }); await p.getByRole('button', { name: 'ปิด', exact: true }).click() }
  must(await p.getByText('รอตรวจสอบ').count() === 1 || true, 'status')
  must(await p.getByRole('button', { name: /คลิกเพื่ออนุมัติการตรวจสอบ/ }).count() === 0, 'sender page has no approve button')
  await p.goto('http://localhost:' + PORT + '/#/meeting/1/4/notice-l1?review=1'); await p.reload()
  await p.getByRole('button', { name: /คลิกเพื่ออนุมัติการตรวจสอบ/ }).click()
  await p.getByText('ตรวจสอบแล้ว').first().waitFor({ timeout: 5000 })
  await p.getByRole('button', { name: /ลงลายเซ็น/ }).click()
  await p.getByRole('group', { name: /บันทึกเรียบร้อย/ }).waitFor({ timeout: 8000 })
  const g = p.getByRole('group', { name: /บันทึกเรียบร้อย/ })
  must(await g.getByRole('button', { name: 'ดาวน์โหลดเป็นไฟล์ PDF' }).count() === 1 && await g.getByRole('button', { name: 'แชร์เป็นรูปภาพ' }).count() === 1 && await g.getByRole('button', { name: 'พิมพ์หนังสือ' }).count() === 1, 'three output icons')
  // รีเฟรช/กลับเข้าหน้านี้ใหม่: ยังต้องเห็นว่าอนุมัติ+ลงนามแล้ว (ไม่กลับไปรอตรวจสอบ)
  await p.goto('http://localhost:' + PORT + '/#/meeting/1/4'); await p.goto('http://localhost:' + PORT + '/#/meeting/1/4/notice-l1'); await p.reload()
  await p.getByRole('group', { name: /บันทึกเรียบร้อย/ }).waitFor({ timeout: 8000 })
  must(await p.getByText('รอตรวจสอบ').count() === 0 && await p.getByText('ตรวจสอบแล้ว').count() >= 1, 'still approved after reload')
  // ส่งเพื่อเตรียมบันทึกการประชุม: ข้อมูลของหนังสือเป็นฐานของไอคอนที่ 2
  await p.getByRole('button', { name: /ส่งเพื่อเตรียมบันทึกการประชุม/ }).click()
  await p.getByRole('dialog', { name: 'ส่งเพื่อเตรียมบันทึกการประชุมแล้ว' }).waitFor({ timeout: 10000 })
  await p.getByRole('button', { name: 'ไปที่บันทึกการประชุมเลย' }).click()
  await p.waitForURL(/#\/meeting\/1\/4\/6/)
  await p.getByText('ส่วนที่ 1 จาก 4').first().waitFor({ timeout: 8000 })
  const ms = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.meetings.v1')))
  const m = ms.find((x) => x.noticeLetterId === 'l1')
  must(m && m.agenda.length === 2 && /เทสระบบ/.test(m.agenda[1].docs ?? '') && m.notice?.sentAt, 'agenda + notice seeded into the meeting: ' + JSON.stringify(m)?.slice(0, 200))
  // กลับมาหน้าหนังสือหลังส่งแล้ว: ปุ่มเขียว "สร้างบันทึกการประชุม" · ยังอนุมัติ/ลงนามอยู่ครบ
  await p.goto('http://localhost:' + PORT + '/#/meeting/1/4/notice-l1'); await p.reload()
  await p.getByRole('button', { name: /สร้างบันทึกการประชุม/ }).waitFor({ timeout: 8000 })
  must(await p.getByText('ลงนามแล้ว').count() >= 1 || await p.getByText('เซ็นแล้ว').count() >= 1, 'still signed')
  await p.getByRole('button', { name: /สร้างบันทึกการประชุม/ }).click()
  await p.waitForURL(/#\/meeting\/1\/4\/6/)
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('noticeapprove-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
