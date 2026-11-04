// ใบกองทุน: มีปุ่มแชร์ข้างดาวน์โหลดและพิมพ์ · กดแล้วเปิดเมนูแชร์พร้อมไฟล์ PDF
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4205
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const Y = sun.getFullYear()
await page.addInitScript(([Y, d]) => {
  navigator.canShare = () => true
  navigator.share = async (x) => { window.__shared = { name: x.files[0].name, type: x.files[0].type, size: x.files[0].size } }
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([{ id: 'f1', date: d, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 }]))
}, [Y, iso(sun)])
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt4`); await page.reload()
  must(await page.getByRole('tab', { name: /ใบกองทุน/ }).count() === 0, 'tab row removed')
  for (const n of ['เครื่องมือใบบันทึกการถวาย', 'เครื่องมือใบเบิก-จ่ายเงินสด', 'เครื่องมือใบกองทุน']) {
    const t = page.getByRole('toolbar', { name: n })
    await t.waitFor({ timeout: 10000 })
    must(await t.getByRole('button').count() === 4, n + ' has four icons')
  }
  const tin = page.getByRole('toolbar', { name: 'เครื่องมือใบกองทุน' })
  const sb = tin.getByRole('button', { name: /^แชร์ PDF/ })
  must(await sb.isVisible() && await tin.getByRole('button', { name: /^แชร์เป็นรูป/ }).isVisible(), 'share pdf + share image buttons visible')
  if (process.env.SHOT) { await sb.scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.SHOT }) }
  await sb.click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 40000 })
  const sh = await page.evaluate(() => window.__shared)
  must(sh.type === 'application/pdf' && /^fund-.*\.pdf$/.test(sh.name) && sh.size > 1000, 'device share sheet opened with the fund PDF: ' + JSON.stringify(sh))
  await page.evaluate(() => { window.__shared = null })
  await tin.getByRole('button', { name: /^แชร์เป็นรูป/ }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 40000 })
  const shi = await page.evaluate(() => window.__shared)
  must(shi.type === 'image/png' && shi.size > 1000, 'image share opened with a PNG: ' + JSON.stringify(shi))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundshare-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
