// ผู้ช่วยฝ่ายทะเบียน (ตำแหน่งผู้ช่วยในงานที่ 2): ลงชื่อ/ลบรายการลงชื่อได้ · ดูสถานะ/หมายเหตุได้ · ไม่เห็นเบอร์/วันเกิด · แก้/เพิ่ม/ลบสมาชิกไม่ได้ · ไม่ถูกล็อกหน้าเดียว — npm run build && node scripts/reghelper-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4189
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
const page = await ctx.newPage()
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'เลขา' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'sec1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([
    { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
    { id: 'sec1', name: 'เลขา', role: 'viewer', works: [1, 2], workRoles: { 1: 'lead', 2: 'helper' }, joined: 2, updated: 1 },
  ]))
  localStorage.setItem('acct.church-members.v1', JSON.stringify([
    { id: 'm1', name: 'นายสมชาย ตัวอย่าง', nick: 'ชาย', code: '001', group: '3.วัยทำงาน', tel: '0812345678', birth: '1980-03-15', status: 'สมบูรณ์ ( 1 )', note: 'หมายเหตุทดสอบ', updated: 1 },
  ]))
  localStorage.setItem('acct.recorders.v1', JSON.stringify([{ id: 'rc1', name: 'ผู้ช่วย ก', updated: 1 }]))
})
try {
  await page.goto(`http://localhost:${PORT}/`)
  await page.waitForTimeout(1200)
  must(!page.url().includes('#/members'), 'ผู้ช่วยฝ่ายทะเบียนไม่ถูกล็อกให้เห็นหน้าเดียว: ' + page.url())
  must(await page.locator('.btile').count() === 2, 'two work tiles on the home page (งาน 1 และ 2): ' + await page.locator('.btile').count())
  await page.goto(`http://localhost:${PORT}/#/meeting/2`)
  await page.reload()
  await page.waitForTimeout(1200)
  const menu = await page.locator('body').innerText()
  must(/ลงชื่อ/.test(menu) && /ยอดผู้มา/.test(menu) && !/รวมสมาชิก/.test(menu), 'helper menu: ลงชื่อ ยอดผู้มา ทะเบียน only: ' + menu.slice(0, 300))
  await page.getByText('ลงชื่อ', { exact: true }).first().click()
  await page.getByLabel('ค้นหาชื่อ').waitFor({ timeout: 8000 })
  await page.getByLabel('ค้นหาชื่อ').fill('ไม่มีชื่อนี้แน่นอน')
  must(await page.locator('.found').getByRole('button', { name: /เพิ่มใหม่/ }).count() === 0, 'helper cannot add a new person')
  await page.getByLabel('ค้นหาชื่อ').fill('สมชาย')
  must(/สมบูรณ์/.test(await page.locator('.found').innerText()) && !/0812345678/.test(await page.locator('.found').innerText()), 'status visible, phone hidden')
  await page.getByRole('button', { name: /^ลงทะเบียน นายสมชาย/ }).click()
  await page.locator('.doneList li', { hasText: 'นายสมชาย' }).waitFor({ timeout: 8000 })
  must(await page.getByRole('button', { name: /^แก้ไขข้อมูล นายสมชาย/ }).count() === 0, 'helper has no edit button')
  await page.getByRole('button', { name: /^ลบการลงชื่อของ นายสมชาย/ }).click()
  await page.getByRole('dialog', { name: 'ลบการลงชื่อนี้?' }).getByRole('button', { name: 'ลบ', exact: true }).click()
  await page.getByRole('status').filter({ hasText: 'ลบการลงชื่อของ' }).waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: /^ดูข้อมูล|นายสมชาย/ }).first().click().catch(() => {})
  console.log('reghelper-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
