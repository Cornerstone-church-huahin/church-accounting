// โครงมาตรฐานของห้องงานที่ยังไม่พัฒนา: วาระ + ตารางงาน + รวมสมาชิก (ช่องแรก) + แท็บ 2–6
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4195
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'a', name: 'สมาชิกทดสอบ', status: 'สมบูรณ์ ( 1 )', updated: 1 }]))
})
try {
  for (const n of [5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 18]) {
    await page.goto(`http://localhost:${PORT}/#/meeting/${n}`); await page.reload()
    const nav = page.locator('nav.tiletabs')
    await nav.waitFor({ timeout: 8000 })
    const labels = await nav.locator('b').allInnerTexts()
    must(labels.length === 6 && labels[0] === 'รวมสมาชิก' && labels[1] === 'แท็บ 2', `room ${n} tiles: ${labels}`)
    must(await page.getByLabel(/^วาระ/).count() === 1, `room ${n} term`)
    must(await page.getByRole('button', { name: /ตารางงาน/ }).count() === 1, `room ${n} calendar`)
  }
  await page.goto(`http://localhost:${PORT}/#/meeting/10`); await page.reload()
  await page.locator('nav.tiletabs').getByText('รวมสมาชิก').click()
  await page.getByText('สมาชิกทดสอบ').first().waitFor({ timeout: 8000 })
  await page.goto(`http://localhost:${PORT}/#/meeting/14`); await page.reload()
  const l14 = await page.locator('nav.tiletabs b').allInnerTexts()
  must(l14[0] === 'ตารางถวายอาหาร' && l14[1] === 'รวมสมาชิก', 'room 14: ' + l14)
  must(!errors.length, errors.join('|'))
  console.log('worktiles-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
