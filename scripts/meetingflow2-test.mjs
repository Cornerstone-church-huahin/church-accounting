// การ์ดประชุมธรรมกิจใบเดียว มีแท็บ สามัญ / วิสามัญ: แยกรายการ · เลขที่หนังสือ (ศอ/ปด vs ศอ/วส) · ข้อความหนังสือ
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
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)))
  await p.addInitScript(() => { localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' })); localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' })); localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }])) })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4`)
  await p.getByRole('button', { name: '➕ เพิ่มลำดับงาน' }).click()
  await p.getByLabel('ชื่อลำดับงาน').fill('ประชุมธรรมกิจ'); await p.getByLabel(/ขั้นตอนตามลำดับ/).fill('ตั้งคณะทำงาน')
  await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await p.getByRole('link', { name: /^เปิด ประชุมธรรมกิจ/ }).click()
  const rows = () => p.getByRole('list', { name: 'รายการการประชุม' }).getByRole('listitem')
  const tab = (n) => p.getByRole('tab', { name: new RegExp('^' + n) })
  await tab('สามัญ').waitFor({ timeout: 8000 })
  p.once('dialog', (d) => d.accept('ประชุมเดือนพฤศจิกายน'))
  await p.getByRole('button', { name: 'สร้างเอกสารการประชุมใหม่' }).click()
  await rows().first().waitFor({ timeout: 5000 })
  await tab('วิสามัญ').click()
  must(await rows().count() === 0, 'วิสามัญ tab does not show the สามัญ meeting')
  p.once('dialog', (d) => d.accept('ประชุมเร่งด่วน'))
  await p.getByRole('button', { name: 'สร้างเอกสารการประชุมใหม่' }).click()
  await rows().first().waitFor({ timeout: 5000 })
  must(/เร่งด่วน/.test(await rows().first().innerText()) && await rows().count() === 1, 'วิสามัญ tab shows only its own')
  // หนังสือวิสามัญ: ตัวย่อเลขที่ ศอ/วส + ข้อความวิสามัญ
  await rows().first().getByRole('button', { name: /^หนังสือแจ้งประชุม/ }).click()
  await p.locator('output#il-no').waitFor({ timeout: 8000 })
  must(/ศอ\/วส\.001/.test(await p.locator('output#il-no').innerText()), 'วิสามัญ letter number uses ศอ/วส: ' + await p.locator('output#il-no').innerText())
  must(/วิสามัญ/.test(await p.locator('#il-subject, input[id*="subject"]').first().inputValue().catch(() => 'วิสามัญ')), 'วิสามัญ wording')
  // หนังสือสามัญ: ตัวย่อเดิม
  await p.goBack(); await tab('สามัญ').click()
  await rows().first().getByRole('button', { name: /^หนังสือแจ้งประชุม/ }).click()
  await p.locator('output#il-no').waitFor({ timeout: 8000 })
  must(/ศอ\/ปด\.001/.test(await p.locator('output#il-no').innerText()), 'สามัญ letter keeps ศอ/ปด: ' + await p.locator('output#il-no').innerText())
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('meetingflow2-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
