// ทดสอบแท็บ 4 (สรุปรับ-จ่าย): ใส่ข้อมูลรับ + ใบเบิกที่จ่ายแล้วลง localStorage แล้วดูว่าปิดยอดถูก + ออก PDF ตัวอย่าง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4176
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH', acceptDownloads: true })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERR', String(e).slice(0, 300)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const S = iso(sun), Y = sun.getFullYear()
const day = (n) => { const d = new Date(sun); d.setDate(d.getDate() - n); return iso(d) }
await page.goto(`http://localhost:${PORT}/#/`)
// ใส่ข้อมูลทดสอบลงในเครื่อง (รับ: ใบถวาย+โอน · จ่าย: ใบเบิกที่จ่ายแล้ว 2 ใบ)
await page.evaluate(([S, Y, d3, d4, d2]) => {
  const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
  const base = { updated: 1 }
  set(`rounds.${Y}`, [{ id: `rd-${S}`, date: S, lines: { tt1: 115000, tt2: 204000, tt3: 197000, tt5: 10000 }, envelopes: { tt1: 6, tt2: 7, tt3: 10, tt5: 1 }, denoms: {}, status: 'verified', counter: { id: 'a', name: 'ก' }, ...base }])
  set(`income.${Y}`, [{ id: 'in1', date: d3, typeId: 'tt1', amount: 16900, method: 'transfer', source: 'slip', ref: 'X', ...base }])
  set(`budget.${Y}`, [{ id: 'b1', year: Y, name: 'ค่าสาธารณูปโภค', base: 5000000, order: 0, ...base }, { id: 'b2', year: Y, name: 'งานดูแลสมาชิก', base: 3000000, order: 1, ...base }])
  set(`vouchers.${Y}`, [
    { id: 'v1', no: `V-${Y}-001`, date: d4, requester: { id: 'a', name: 'ก' }, payee: 'การไฟฟ้า', purpose: 'ค่าไฟ', amount: 185000, lineId: 'b1', items: [{ desc: 'ค่าไฟ', amount: 185000, lineId: 'b1', method: 'transfer' }], status: 'paid', approvals: [], attachments: [], paid: { date: d4, method: 'transfer', by: 'ก' }, ...base },
    { id: 'v2', no: `V-${Y}-002`, date: d2, requester: { id: 'a', name: 'ก' }, payee: 'ร้านดอกไม้', purpose: 'ดอกไม้', amount: 60000, lineId: 'b2', items: [{ desc: 'ดอกไม้', amount: 60000, lineId: 'b2', method: 'cash' }], status: 'paid', approvals: [], attachments: [], paid: { date: d2, method: 'cash', by: 'ก' }, ...base },
  ])
}, [S, Y, day(3), day(4), day(2)])
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.goto(`http://localhost:${PORT}/#/`); await page.reload()
  await page.getByRole('tab', { name: '💚 รับ' }).click()
  await page.getByRole('tab', { name: /ผลรวม/ }).click()
  await page.getByRole('button', { name: 'สัปดาห์ที่เลือก' }).click()
  const t = (await page.locator('section.paper').innerText()).replace(/\n/g, ' ')
  must(/สรุปรับ-จ่ายประจำสัปดาห์/.test(t), 'title')
  must(/สิบลด\s+6\s+1,150\.00\s+1\s+169\.00\s+1,319\.00/.test(t), 'income row (6 envelopes + 1 transfer): ' + t)
  must(/รวมรายรับ\s+24\s+5,260\.00\s+1\s+169\.00\s+5,429\.00/.test(t), 'income total: ' + t)
  must(/ค่าสาธารณูปโภค\s+1\s+1\s+1,850\.00\s+1,850\.00/.test(t) || /ค่าสาธารณูปโภค[\s\S]{0,30}1,850\.00/.test(t), 'expense row utilities')
  must(/รวมรายจ่าย\s+1\s+600\.00\s+1\s+1,850\.00\s+2,450\.00/.test(t), 'expense total: ' + t)
  // ปิดยอด: รับ 5,429 - จ่าย 2,450 = 2,979 (เงินสด 5,260-600=4,660 · โอน 169-1,850=-1,681)
  must(/คงเหลือ\s+4,660\.00\s+[-−]1,681\.00\s+2,979\.00/.test(t), 'closing balance: ' + t)
  await page.screenshot({ path: 'shots/ledger.png', fullPage: true })
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
  await dl.saveAs('shots/ledger.pdf')
  console.log('LEDGER OK')
} catch (e) { await page.screenshot({ path: 'shots/ledger-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
