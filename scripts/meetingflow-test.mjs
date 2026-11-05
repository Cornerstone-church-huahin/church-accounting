// ลำดับงานประชุม: ค้นหา + ＋ สร้างการประชุม · แถวละการประชุม 3 ไอคอน (แจ้ง → บันทึก → รายงาน) ปลดล็อกตามลำดับ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4393
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
  await p.addInitScript(() => { localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' })); localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' })); localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }])) })
  await p.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)))
  await p.goto(`http://localhost:${PORT}/#/meeting/1/4`)
  await p.getByRole('button', { name: '➕ เพิ่มลำดับงาน' }).click()
  await p.getByLabel('ชื่อลำดับงาน').fill('ประชุมธรรมกิจ'); await p.getByLabel(/ขั้นตอนตามลำดับ/).fill('ตั้งคณะทำงาน')
  await p.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await p.getByRole('link', { name: /^เปิด ประชุมธรรมกิจ/ }).click()
  await p.getByLabel('ค้นหาเอกสารการประชุม').waitFor({ timeout: 8000 })
  must(await p.getByRole('checkbox').count() === 0, 'old checklist is gone')
  p.once('dialog', (d) => d.accept('ประชุมประจำเดือนพฤศจิกายน'))
  await p.getByRole('button', { name: 'สร้างเอกสารการประชุมใหม่' }).click()
  const row = p.getByRole('list', { name: 'รายการการประชุม' }).getByRole('listitem').first()
  await row.waitFor({ timeout: 5000 })
  must(/ประชุมประจำเดือนพฤศจิกายน/.test(await row.innerText()), 'row shows the meeting name')
  must(await row.getByRole('button').count() === 3, 'three icons per row')
  must(await row.getByRole('button', { name: /^บันทึกการประชุม/ }).isDisabled() && await row.getByRole('button', { name: /^รายงานการประชุม/ }).isDisabled(), 'minutes and report locked until the notice is done')
  await p.getByLabel('ค้นหาเอกสารการประชุม').fill('ไม่มีชื่อนี้')
  must(await p.getByText('ไม่พบเอกสาร').isVisible(), 'search filters')
  await p.getByLabel('ค้นหาเอกสารการประชุม').fill('พฤศจิกายน')
  await row.getByRole('button', { name: /^หนังสือแจ้งประชุม/ }).click()
  await p.waitForURL(/#\/meeting\/1\/4\/notice-letter/)
  const url1 = p.url()
  must(await p.locator('output#il-no').count() === 1, 'opens the existing notice-letter page (numbered letter)')
  await p.goBack(); await row.getByRole('button', { name: /^หนังสือแจ้งประชุม/ }).click()
  await p.waitForURL(/#\/meeting\/1\/4\/notice-letter/)
  must(p.url() === url1, 'second click reopens the same letter linked to the meeting')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close(); console.log('meetingflow-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 700)); process.exitCode = 1 } finally { server.kill() }
