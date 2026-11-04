// ป๊อปอัพดูรูปแนบ (ใบรับ + ใบจ่าย): แถบไอคอน 4 ปุ่ม ดาวน์โหลด PDF · แชร์ PDF · แชร์เป็นรูป · พิมพ์ ทำงานกับรูปจริง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4241
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const png = fs.readFileSync('public/icon-192.png')
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH', acceptDownloads: true })
await ctx.route('**/api.github.com/**', (r) => (r.request().url().includes('attachments') ? r.fulfill({ status: 200, contentType: 'image/png', body: png }) : r.fulfill({ status: 404, body: '{}' })))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  const d = new Date(); const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'x', name: 't' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem(`acct.expenses.${d.getFullYear()}.v1`, JSON.stringify([{ id: 'e1', channel: 'manual', date: t, amount: 40000, desc: 'ค่าล้างรถตู้', status: 'paid', method: 'cash', file: { path: 'attachments/2026/exp-a.png', name: 'bill1.png' }, updated: 1 }]))
  localStorage.setItem(`acct.income.${d.getFullYear()}.v1`, JSON.stringify([{ id: 'i1', date: t, typeId: 'tt1', amount: 500000, method: 'transfer', source: 'manual', slip: { path: 'attachments/2026/inc-a.png', name: 'slip1.png' }, updated: 1 }]))
  window.__shared = null; window.__prints = 0
  navigator.canShare = () => true
  navigator.share = async (x) => { window.__shared = (x.files || []).map((f) => f.name + ':' + f.type + ':' + f.size) }
  window.print = () => { window.__prints++ }
})
try {
  await page.goto('http://localhost:' + PORT + '/#/balance/own'); await page.reload()
  const exercise = async (open, label) => {
    await open()
    const dlg = page.getByRole('dialog').filter({ has: page.getByRole('toolbar', { name: /เครื่องมือรูปแนบ/ }) })
    const tb = dlg.getByRole('toolbar', { name: /เครื่องมือรูปแนบ/ })
    await tb.waitFor({ timeout: 10000 })
    must(await tb.getByRole('button').count() === 4, label + ': four icons')
    await dlg.locator('img').first().waitFor({ timeout: 10000 })
    await page.evaluate(() => { window.__shared = null })
    await tb.getByRole('button', { name: /^แชร์ PDF/ }).click()
    await page.waitForFunction(() => window.__shared, null, { timeout: 30000 })
    must(/application\/pdf/.test(JSON.stringify(await page.evaluate(() => window.__shared))), label + ': share PDF')
    await page.evaluate(() => { window.__shared = null })
    await tb.getByRole('button', { name: /^แชร์เป็นรูป/ }).click()
    await page.waitForFunction(() => window.__shared, null, { timeout: 30000 })
    must(/\.png:image\/png/.test(JSON.stringify(await page.evaluate(() => window.__shared))), label + ': share as image')
    const [dl] = await Promise.all([page.waitForEvent('download'), tb.getByRole('button', { name: /^ดาวน์โหลด PDF/ }).click()])
    must(/\.pdf$/.test(dl.suggestedFilename()), label + ': download pdf ' + dl.suggestedFilename())
    await tb.getByRole('button', { name: /^พิมพ์/ }).click()
    await page.waitForFunction(() => document.querySelectorAll('iframe').length >= 1, null, { timeout: 10000 })
    await page.evaluate(() => document.querySelectorAll('iframe').forEach((f) => f.remove()))
    return dlg
  }
  // ใบจ่าย (ImageViewer เต็มจอ)
  let dlg = await exercise(() => page.getByRole('region', { name: 'บันทึกรายจ่าย' }).getByLabel(/ดูไฟล์แนบ/).first().click(), 'expense viewer')
  await dlg.getByRole('button', { name: 'ปิดรูป' }).click()
  // ใบรับ (AttachViewer)
  dlg = await exercise(async () => { await page.getByRole('region', { name: 'บันทึกรายรับ' }).getByLabel(/ดูไฟล์แนบ/).first().click() }, 'income viewer')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('imgtools-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
