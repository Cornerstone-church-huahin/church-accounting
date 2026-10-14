// แตะช่องหมายเหตุ/รูปของแถวที่แนบรูป → ป๊อปอัพเต็มจอ มีปุ่ม พิมพ์ · แชร์ · บันทึก: npm run build && node scripts/imageview-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4186
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.addInitScript(() => {
    const d = new Date(); const iso = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
    const t = iso(d)
    localStorage.setItem(`acct.expenses.${d.getFullYear()}.v1`, JSON.stringify([
      { id: 'e1', channel: 'manual', date: t, amount: 40000, desc: 'ค่าล้างรถตู้', status: 'paid', method: 'cash', file: { path: '', name: 'bill1.jpg' }, updated: 1 },
      { id: 'e2', channel: 'manual', date: t, amount: 10000, desc: 'ค่าน้ำมัน', status: 'paid', method: 'cash', updated: 2 },
    ]))
  })
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  const sheet = page.getByLabel('ใบเบิก-จ่ายเงินสด (A4)').first()
  must(await sheet.getByLabel('ดูรูปแนบ').count() === 1, 'only the row with a picture is tappable')
  await sheet.getByLabel('ดูรูปแนบ').click()
  const dlg = page.getByRole('dialog', { name: /ดูรูปแนบ/ })
  await dlg.waitFor()
  for (const n of ['🖨 พิมพ์', '📤 แชร์', '💾 บันทึก']) must(await dlg.getByRole('button', { name: n }).count() === 1, 'viewer has button ' + n)
  const box = await dlg.boundingBox()
  must(box && box.width >= 389 && box.height >= 899, 'viewer covers the full screen: ' + JSON.stringify(box))
  must(await page.getByRole('dialog', { name: /แก้ไขรายการ/ }).count() === 0, 'tapping the picture does not open the row editor')
  await dlg.getByRole('button', { name: 'ปิดรูป' }).click()
  must(await dlg.count() === 0, 'viewer closes')
  // มีรูปจริง (จำลองการดึงจาก repo): รูปขึ้นเต็มจอ · บันทึก = ดาวน์โหลดไฟล์ · แชร์ = เรียก share · พิมพ์ = สร้าง iframe พิมพ์
  const png = fs.readFileSync('public/icon-192.png')
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH', acceptDownloads: true })
  await ctx2.route('**/api.github.com/**', (r) => (r.request().url().includes('attachments') ? r.fulfill({ status: 200, contentType: 'image/png', body: png }) : r.fulfill({ status: 404, body: '{}' })))
  const p2 = await ctx2.newPage()
  await p2.addInitScript(() => {
    const d = new Date(); const t = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'x', name: 't' }))
    localStorage.setItem(`acct.expenses.${d.getFullYear()}.v1`, JSON.stringify([{ id: 'e1', channel: 'manual', date: t, amount: 40000, desc: 'ค่าล้างรถตู้', status: 'paid', method: 'cash', file: { path: 'attachments/2026/exp-a.png', name: 'bill1.png' }, updated: 1 }]))
    window.__shared = null
    navigator.canShare = () => true
    navigator.share = async (x) => { window.__shared = { files: (x.files || []).map((f) => f.name + ':' + f.type) } }
  })
  await p2.goto(`http://localhost:${PORT}/#/`); await p2.waitForLoadState('networkidle')
  await p2.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await p2.getByLabel('ดูรูปแนบ').click()
  const dlg2 = p2.getByRole('dialog', { name: /ดูรูปแนบ/ })
  await dlg2.locator('img').waitFor({ timeout: 10000 })
  must(await dlg2.getByRole('button', { name: '💾 บันทึก' }).isEnabled(), 'buttons enabled once the picture loaded')
  const [dl] = await Promise.all([p2.waitForEvent('download'), dlg2.getByRole('button', { name: '💾 บันทึก' }).click()])
  must(dl.suggestedFilename() === 'bill1.png', 'save downloads the picture with its own name: ' + dl.suggestedFilename())
  await dlg2.getByRole('button', { name: '📤 แชร์' }).click()
  must(/bill1\.png:image\/png/.test(JSON.stringify(await p2.evaluate(() => window.__shared))), 'share sends the picture file: ' + JSON.stringify(await p2.evaluate(() => window.__shared)))
  await p2.evaluate(() => { window.print = () => undefined })
  await dlg2.getByRole('button', { name: '🖨 พิมพ์' }).click()
  must(await p2.locator('iframe').count() === 1, 'print prepares a print frame with the picture')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('IMAGEVIEW OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
