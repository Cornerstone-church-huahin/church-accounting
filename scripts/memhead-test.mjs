// รายชื่อผู้ใช้ร่วมในตั้งค่า: ชื่อตัวใหญ่ สีเด่น
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4197
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([
    { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
    { id: 'u2', name: 'อ.สายฝน เผ่าดี', role: 'viewer', works: [9], workRoles: { 9: 'lead' }, joined: 1761696000000, updated: 1 },
  ]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.reload()
  await page.getByText(/ผู้ใช้ร่วมและสิทธิ์/).first().click()
  const name = page.locator('.memhead__name', { hasText: 'อ.สายฝน เผ่าดี' })
  await name.waitFor({ timeout: 8000 })
  const fs0 = await name.evaluate((e) => parseFloat(getComputedStyle(e).fontSize))
  must(fs0 >= 20, 'name font size >= 20px: ' + fs0)
  const color = await name.evaluate((e) => getComputedStyle(e).color)
  must(color !== 'rgb(0, 0, 0)', 'name has accent color: ' + color)
  if (process.env.SHOT) await name.scrollIntoViewIfNeeded(), await page.screenshot({ path: process.env.SHOT })
  console.log('memhead-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
