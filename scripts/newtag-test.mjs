// รายการลงชื่อ: คนที่ลงชื่อครั้งแรกในวันนั้นมีป้าย NEW + ตัวเลขสีต่าง · คนเก่าไม่มี
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4201
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem('acct.church-members.v1', JSON.stringify([
    { id: 'a', name: 'คนเก่าหนึ่ง', status: 'สมบูรณ์ ( 1 )', since: '2015-01-01', updated: 1 },
    { id: 'b', name: 'คนใหม่สอง', status: 'คนใหม่', since: new Date().toISOString().slice(0, 10), updated: 1 },
    { id: 'c', name: 'คนเก่าสาม', status: 'สมบูรณ์ ( 1 )', since: '2015-01-01', updated: 1 },
  ]))
  const d = new Date(), p2 = (n) => String(n).padStart(2, '0')
  const iso = (x) => `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`
  const today = iso(d), prev = iso(new Date(d.getTime() - 7 * 864e5))
  localStorage.setItem(`acct.attendance.${d.getFullYear()}.v1`, JSON.stringify([
    { id: 'k0', date: prev, mid: 'a', tm: '09:00', rec: 'ก', updated: 900 },
    { id: 'k1', date: today, mid: 'a', tm: '09:00', rec: 'ก', updated: 1000 },
    { id: 'k2', date: today, mid: 'b', tm: '09:10', rec: 'ก', updated: 2000 },
    { id: 'k3', date: today, mid: 'c', tm: '09:20', rec: 'ก', updated: 3000 },
  ]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/members`); await page.reload()
  await page.getByRole('tab', { name: 'ลงชื่อ' }).click()
  await page.locator('.doneList').waitFor({ timeout: 8000 })
  const rows = page.locator('.doneList li')
  const n = await rows.count()
  const out = []
  for (let i = 0; i < n; i++) out.push({ t: await rows.nth(i).innerText(), isNew: await rows.nth(i).locator('.newTag').count() })
  const neu = out.filter((x) => x.isNew)
  must(neu.length === 1 && /คนใหม่สอง/.test(neu[0].t) && /NEW/.test(neu[0].t), 'exactly one NEW (the first-timer): ' + JSON.stringify(out))
  must(await page.locator('.doneNo--new').count() === 1, 'one coloured number badge')
  if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
  console.log('newtag-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
