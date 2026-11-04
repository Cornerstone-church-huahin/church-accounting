// เตรียมนำฝาก: แยก “ถอนแล้ว (เบิกอัตโนมัติ)” กับ “ยังไม่ถอน (บันทึกตรงในหน้ากองทุน)” · กดถอนแล้ว+วันที่ → รอนำฝาก + เข้าใบเบิก-จ่ายสัปดาห์ที่ถอน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4231
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('dialog', (d) => d.accept())
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const t = new Date(), ls = new Date(t); ls.setDate(t.getDate() - t.getDay())   // อาทิตย์ล่าสุด
const sunday = iso(ls), Y = ls.getFullYear()
await page.addInitScript(([Y, d]) => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([
    { id: 'a1', date: d, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 },              // มากับรายรับสัปดาห์ = ถอนแล้วอัตโนมัติ
    { id: 'd1', date: d, typeId: 'tt8', amount: 500000, method: 'cash', source: 'manual', fz: true, updated: 1 },   // บันทึกตรงในหน้ากองทุน = ยังไม่ถอน
  ]))
}, [Y, sunday])
try {
  await page.goto(`http://localhost:${PORT}/#/balance/fund`); await page.reload()
  const fs = page.getByRole('status', { name: /เงินกองทุนทั้งหมด แยก/ })
  await fs.waitFor({ timeout: 10000 })
  const ft = (await fs.innerText()).replace(/\s+/g, ' ')
  must((await fs.boundingBox()).height < 70, 'split strip is one compact row: ' + (await fs.boundingBox()).height)
  must(/รวมทุกกองทุน 5,120/.test(ft) && /ในบัญชีกองทุน 0/.test(ft) && /ถอนแล้ว รอนำฝาก 120/.test(ft) && /ยังไม่ถอน 5,000/.test(ft), 'main fund card splits total into account / withdrawn / not withdrawn: ' + ft)
  must(await page.locator('.fundbar__chip--no').filter({ hasText: '5,000' }).count() === 1 && await page.locator('.fundbar__chip--out').filter({ hasText: '120' }).count() === 1, 'per-fund rows show their own withdrawn / not-withdrawn chips')
  await page.getByRole('button', { name: /เตรียมนำฝาก/ }).first().click()
  const sum = page.getByRole('status', { name: /สรุปเงินกองทุนที่ถอนแล้ว/ })
  await sum.waitFor({ timeout: 10000 })
  const txt = async () => (await sum.innerText()).replace(/\s+/g, ' ')
  must(/ถอนแล้ว · เงินสดรอนำฝาก 120/.test(await txt()) && /ยังไม่ถอน 5,000/.test(await txt()) && /รวม 5,120/.test(await txt()), 'summary splits withdrawn vs not withdrawn: ' + await txt())
  const rows = page.locator('.fundpend__tbl tbody tr')
  must(await rows.count() === 2, 'two rows: ' + await rows.count())
  must(await page.locator('.fundpend__tr--no').count() === 1, 'one not-withdrawn row')
  must(/เบิกอัตโนมัติ/.test(await page.locator('.fundpend__tr--wait').first().innerText()), 'auto row labelled เบิกอัตโนมัติ')
  // ฝากแล้วทั้งหมดที่รอ ต้องไม่แตะรายการยังไม่ถอน
  await page.locator('.fundpend__tr--wait').getByRole('button', { name: /รอนำฝาก/ }).click()
  must(/ถอนแล้ว · เงินสดรอนำฝาก 0/.test(await txt()) && /ยังไม่ถอน 5,000/.test(await txt()), 'depositing auto row leaves not-withdrawn untouched: ' + await txt())
  // กดถอนแล้ว + วันที่
  await page.getByRole('button', { name: /ยังไม่ถอน .* กดเมื่อถอนแล้ว/ }).click()
  await page.getByLabel('วันที่ถอน').fill(sunday)
  await page.getByRole('button', { name: /ยืนยันถอน/ }).click()
  must(/ถอนแล้ว · เงินสดรอนำฝาก 5,000/.test(await txt()) && /ยังไม่ถอน 0/.test(await txt()), 'ticked → moves to withdrawn/waiting: ' + await txt())
  must(await page.locator('.fundpend__tr--no').count() === 0 && /ถอน /.test(await page.locator('.fundpend__tr--wait').first().innerText()), 'row now shows withdrawal date')
  // ใบเบิก-จ่ายสัปดาห์ที่ถอน: ยอดถอนเงินกองทุนที่บันทึกตรงขึ้นในช่อง ต้องเบิก
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.reload()
  await page.getByRole('button', { name: 'บันทึก รับและจ่ายในหน้าเดียว' }).click()
  await page.getByRole('button', { name: 'สัปดาห์ก่อน' }).click()
  await page.waitForTimeout(1500)
  const body = (await page.locator('.record').innerText()).replace(/\s+/g, ' ')
  must(/ถอนเงินที่บันทึกในหน้ากองทุน/.test(body) && /5,000/.test(body), 'withdrawn direct money appears in the week withdrawal note')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundwithdraw-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
