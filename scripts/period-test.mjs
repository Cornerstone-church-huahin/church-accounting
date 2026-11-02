// แท็บ 2 สม่ำเสมอ: ช่วงเวลาเริ่มต้น 3 ปี · ตัวเลือกเขียนแบบ "ช่วง N ปี/เดือน"
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4203
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
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'a', name: 'สมาชิกทดสอบ', status: 'สมบูรณ์ ( 1 )', updated: 1 }]))
})
try {
  await page.goto('http://localhost:' + PORT + '/#/meeting/4/1'); await page.reload()
  await page.locator('.ptab').nth(1).click()
  const sel = page.locator('#pf-period')
  await sel.waitFor({ timeout: 8000 })
  must((await sel.inputValue()) === '3y', 'default is 3 years: ' + await sel.inputValue())
  const opts = await sel.locator('option').allInnerTexts()
  must(JSON.stringify(opts) === JSON.stringify(['ช่วง 3 ปี', 'ช่วง 2 ปี', 'ช่วง 1 ปี', 'ช่วง 6 เดือน', 'ช่วง 3 เดือน', 'ช่วง 2 เดือน', 'ช่วง 1 เดือน']), 'option labels: ' + opts.join('|'))
  console.log('period-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
