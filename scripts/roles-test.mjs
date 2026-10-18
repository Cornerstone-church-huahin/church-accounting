// หลายสิทธิ์ต่อคน: แอดมินอนุมัติคำขอด้วยหลายสิทธิ์ + เครื่องที่มีหลายสิทธิ์เห็นและทำได้ตามรวมกัน — npm run build && node scripts/roles-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4192
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
async function open(me, members) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(([me, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: me.name }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: me.id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'm1', name: 'นายสมชาย ตัวอย่าง', tel: '0812345678', status: '1.สมบูรณ์ ( 1 )', since: '2005-03-06', updated: 1 }]))
    localStorage.setItem('acct.recorders.v1', JSON.stringify([{ id: 'rc1', name: 'ผู้ช่วย ก', updated: 1 }]))
  }, [me, members])
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForTimeout(1200)
  return page
}
try {
  const admin = { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }
  // 1) แอดมินอนุมัติคำขอด้วยหลายสิทธิ์
  let page = await open({ id: 'ad1', name: 'แอดมิน' }, [admin, { id: 'pd1', name: 'ปิ๋ม', role: 'viewer', status: 'pending', joined: 2, updated: 1 }])
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForTimeout(500)
  if (!(await page.getByRole('button', { name: /สิทธิ์ที่จะให้ ปิ๋ม/ }).isVisible().catch(() => false))) await page.getByText('ผู้ใช้ร่วมและสิทธิ์').first().click()
  await page.getByRole('button', { name: /สิทธิ์ที่จะให้ ปิ๋ม/ }).click()
  const dlg = page.getByRole('dialog', { name: /สิทธิ์ที่จะให้ ปิ๋ม/ })
  await dlg.getByRole('checkbox', { name: /^ผู้บันทึกบัญชี/ }).check()
  await dlg.getByRole('checkbox', { name: /^ผู้บันทึกการนมัสการ/ }).check()
  must(await dlg.getByRole('checkbox', { name: /^ดูอย่างเดียว/ }).isChecked() === false, 'viewer is dropped when real roles are chosen')
  await dlg.getByRole('checkbox', { name: /^แอดมิน/ }).check()
  must(await dlg.getByRole('checkbox', { name: /^ผู้บันทึกการนมัสการ/ }).isChecked() === false, 'admin is exclusive')
  await dlg.getByRole('button', { name: 'ยกเลิก' }).click() // เลิกตัวเลือกแอดมิน แล้วเปิดใหม่
  await page.getByRole('button', { name: /สิทธิ์ที่จะให้ ปิ๋ม/ }).click()
  await dlg.getByRole('checkbox', { name: /^ผู้บันทึกบัญชี/ }).check(); await dlg.getByRole('checkbox', { name: /^ผู้บันทึกการนมัสการ/ }).check()
  await dlg.getByRole('button', { name: 'ตกลง' }).click()
  await page.getByRole('button', { name: '✓ อนุมัติ' }).click()
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((m) => m.id === 'pd1'))
  must(saved.status === 'active' && saved.role === 'bookkeeper' && JSON.stringify(saved.roles) === JSON.stringify(['bookkeeper', 'worship']), 'approved with two roles: ' + JSON.stringify(saved))
  await page.close()
  // 2) ผู้ตรวจสอบ + ผู้บันทึกการนมัสการ: เห็นบัญชีแบบผู้ตรวจสอบ และลงชื่อนมัสการได้ด้วย
  page = await open({ id: 'au1', name: 'ผู้ตรวจ' }, [admin, { id: 'au1', name: 'ผู้ตรวจ', role: 'auditor', roles: ['auditor', 'worship'], status: 'active', joined: 2, updated: 1 }])
  const nav = (await page.locator('.bottomnav a').allInnerTexts()).join('|')
  must(nav.includes('รายรับ') && nav.includes('สมาชิก'), 'auditor+worship sees the full menu incl. members: ' + nav)
  await page.goto(`http://localhost:${PORT}/#/members`); await page.waitForTimeout(500)
  await page.getByRole('tab', { name: 'ลงชื่อ', exact: true }).click()
  await page.getByLabel('ค้นหาชื่อ').fill('สมชาย')
  const rec = page.getByRole('button', { name: /^ลงทะเบียน นายสมชาย/ })
  await rec.click()
  await page.locator('.doneList li', { hasText: 'นายสมชาย' }).waitFor({ timeout: 8000 })
  must(true, 'a user with worship as a second role can record check-ins')
  await page.close()
  // 3) ผู้ตรวจสอบอย่างเดียวลงชื่อไม่ได้ (ยืนยันว่าสิทธิ์เสริมมีผลจริง)
  page = await open({ id: 'au2', name: 'ผู้ตรวจ2' }, [admin, { id: 'au2', name: 'ผู้ตรวจ2', role: 'auditor', status: 'active', joined: 2, updated: 1 }])
  await page.goto(`http://localhost:${PORT}/#/members`); await page.waitForTimeout(500)
  await page.getByRole('tab', { name: 'ลงชื่อ', exact: true }).click()
  must(await page.getByText(/ลงชื่อนมัสการได้เฉพาะ/).count() === 1, 'auditor alone cannot record check-ins')
  must(errors.length === 0, 'no JS errors: ' + errors.join(' | '))
  console.log('roles-test OK')
} catch (e) { console.error(String(e)); process.exitCode = 1 } finally { await browser.close(); server.kill() }
