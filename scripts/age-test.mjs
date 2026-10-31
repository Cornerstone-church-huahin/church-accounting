// แท็บ “อายุ”: ตัวเลข/แผนภูมิ/แตะช่วงวัยดูรายชื่อ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4193
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 1300 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  const y = new Date().getFullYear()
  localStorage.setItem('acct.church-members.v1', JSON.stringify([
    { id: 'a', name: 'เด็กหนึ่ง', status: 'สมบูรณ์ ( 1 )', gender: 'ชาย', birth: `${y - 8}-01-01`, updated: 1 },
    { id: 'b', name: 'วัยทำงานสอง', status: 'สมบูรณ์ ( 1 )', gender: 'หญิง', birth: `${y - 30}-01-01`, updated: 1 },
    { id: 'c', name: 'ผู้สูงวัยสาม', status: 'สมบูรณ์ ( 1 )', gender: 'หญิง', birth: `${y - 70}-01-01`, updated: 1 },
    { id: 'd', name: 'ไม่มีวันเกิด', status: 'สมบูรณ์ ( 1 )', updated: 1 },
  ]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/members`)
  await page.reload()
  await page.getByRole('tab', { name: 'อายุ' }).click()
  await page.getByRole('region', { name: 'ภาพรวมอายุ' }).waitFor({ timeout: 8000 })
  const t = await page.getByRole('region', { name: 'ภาพรวมอายุ' }).innerText()
  must(/ทราบวันเกิด 3 จาก 4 คน/.test(t) && /ไม่ทราบ 1 คน/.test(t), 'known/unknown: ' + t)
  must(await page.getByRole('img', { name: /ปิรามิดอายุ/ }).count() === 1, 'pyramid')
  await page.getByRole('button', { name: /ผู้สูงวัย/ }).click()
  must(await page.getByRole('region', { name: /รายชื่อ ผู้สูงวัย/ }).getByText('ผู้สูงวัยสาม').count() === 1, 'band list')
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  must(!errors.length, errors.join('|'))
  console.log('age-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
