// การ์ดประชุมสามัญ/วิสามัญแยกกัน: การประชุมที่สร้าง/ลบในการ์ดหนึ่ง ไม่โผล่/หายในอีกการ์ด
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4396
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
  await p.addInitScript(() => { localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' })); localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' })); localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }])) })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4`)
  for (const t of ['ประชุมธรรมกิจ สามัญ', 'ประชุมธรรมกิจ วิสามัญ']) {
    await p.getByRole('button', { name: '➕ เพิ่มลำดับงาน' }).click()
    await p.getByLabel('ชื่อลำดับงาน').fill(t); await p.getByLabel(/ขั้นตอนตามลำดับ/).fill('ตั้งคณะทำงาน')
    await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
    await p.waitForTimeout(300)
  }
  const open = async (t) => { await p.goto(`http://localhost:${PORT}/#/meeting/1/4`); await p.getByRole('link', { name: new RegExp('^เปิด ' + t) }).click(); await p.getByLabel('ค้นหาเอกสารการประชุม').waitFor({ timeout: 8000 }) }
  const rows = () => p.getByRole('list', { name: 'รายการการประชุม' }).getByRole('listitem')
  await open('ประชุมธรรมกิจ สามัญ')
  p.once('dialog', (d) => d.accept('ประชุมเดือนพฤศจิกายน'))
  await p.getByRole('button', { name: 'สร้างเอกสารการประชุมใหม่' }).click()
  await rows().first().waitFor({ timeout: 5000 })
  await open('ประชุมธรรมกิจ วิสามัญ')
  must(await rows().count() === 0, 'วิสามัญ does not show the สามัญ meeting')
  p.once('dialog', (d) => d.accept('ประชุมเร่งด่วน'))
  await p.getByRole('button', { name: 'สร้างเอกสารการประชุมใหม่' }).click()
  await rows().first().waitFor({ timeout: 5000 })
  must(/เร่งด่วน/.test(await rows().first().innerText()) && await rows().count() === 1, 'วิสามัญ shows only its own')
  p.once('dialog', (d) => d.accept())
  await p.getByRole('button', { name: /^ลบ ประชุมเร่งด่วน/ }).click()
  await p.waitForTimeout(500)
  await open('ประชุมธรรมกิจ สามัญ')
  must(await rows().count() === 1 && /พฤศจิกายน/.test(await rows().first().innerText()), 'deleting in วิสามัญ leaves สามัญ intact')
  await b.close(); console.log('meetingflow2-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
