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
    { id: 'v1', no: `V-${Y}-001`, date: d4, requester: { id: 'a', name: 'ก' }, payee: 'การไฟฟ้า', purpose: 'ค่าไฟ', amount: 185000, lineId: 'b1', items: [{ desc: 'ค่าไฟ', amount: 185000, lineId: 'b1', method: 'transfer', catId: 'ei-3-1' }], status: 'paid', approvals: [], attachments: [], paid: { date: d4, method: 'transfer', by: 'ก' }, ...base },
    { id: 'v2', no: `V-${Y}-002`, date: d2, requester: { id: 'a', name: 'ก' }, payee: 'ร้านดอกไม้', purpose: 'ดอกไม้', amount: 60000, lineId: 'b2', items: [{ desc: 'ดอกไม้', amount: 60000, lineId: 'b2', method: 'cash', catId: 'ei-11-4' }], status: 'paid', approvals: [], attachments: [], paid: { date: d2, method: 'cash', by: 'ก' }, ...base },
    { id: 'v3', no: `V-${Y}-003`, date: d2, requester: { id: 'a', name: 'ก' }, payee: 'ร้านทั่วไป', purpose: 'อื่น ๆ', amount: 10000, lineId: 'b2', items: [{ desc: 'ของใช้', amount: 10000, lineId: 'b2', method: 'cash' }], status: 'paid', approvals: [], attachments: [], paid: { date: d2, method: 'cash', by: 'ก' }, ...base },
  ])
}, [S, Y, day(3), day(4), day(2)])
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.goto(`http://localhost:${PORT}/#/`); await page.reload()
  await page.getByRole('tab', { name: /สรุป/ }).click()
  await page.getByRole('tab', { name: /^1\s*สัปดาห์/ }).click()
  const t = (await page.locator('.a4page').innerText()).replace(/\n/g, ' ')
  must(/สรุปรับ-จ่ายประจำสัปดาห์/.test(t), 'title')
  must(/สิบลด\s+6\s+1,150\.00\s+1\s+169\.00\s+1,319\.00/.test(t), 'income row (6 envelopes + 1 transfer): ' + t)
  must(/รวมรายรับ\s+24\s+5,260\.00\s+1\s+169\.00\s+5,429\.00/.test(t), 'income total: ' + t)
  must(/ค่าสาธารณูปโภคและค่าเช่า\s+1\s+1,850\.00\s+1,850\.00/.test(t), 'expense group 3 (transfer): ' + t)
  must(/การนมัสการและการสอนพระคัมภีร์\s+1\s+600\.00\s+600\.00/.test(t), 'expense group 11 (cash)')
  must(/ยังไม่ระบุหมวด\s+1\s+100\.00\s+100\.00/.test(t), 'uncategorized row')
  must(!/เงินเดือนและค่าตอบแทน|ที่ดิน ก่อสร้าง ภาระชำระ/.test(t.split('รายจ่าย')[1] ?? ''), 'expense table lists only categories that actually occurred')
  must(/รวมรายจ่าย\s+2\s+700\.00\s+1\s+1,850\.00\s+0\.00\s+2,550\.00/.test(t), 'expense total: ' + t)
  // ปิดยอด: รับ 5,429 − จ่าย 2,550 = 2,879 (เงินสด 5,260−700=4,560 · โอน 169−1,850=−1,681)
  must(/คงเหลือ\s+4,560\.00\s+[-−]1,681\.00\s+0\.00\s+2,879\.00/.test(t), 'closing balance: ' + t)
  await page.screenshot({ path: 'shots/ledger.png', fullPage: true })
  // 4 ไอคอนช่วงเวลา: สัปดาห์ · เดือน · ไตรมาส · ทั้งปี
  for (const n of ['สัปดาห์', 'เดือน', 'ไตรมาส', 'ปี 2569']) must(await page.getByRole('tab', { name: new RegExp(n) }).first().isVisible(), 'summary period tab ' + n)
  await page.getByRole('tab', { name: /^2\s*เดือน/ }).click()
  must(/ประจำเดือน/.test(await page.locator('.a4page').first().innerText()), 'monthly summary')
  await page.getByRole('tab', { name: /^3\s*ไตรมาส/ }).click()
  must(/ประจำไตรมาส/.test(await page.locator('.a4page').first().innerText()), 'quarterly summary')
  await page.getByRole('tab', { name: /^4\s*ปี/ }).click()
  const yt = (await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ')
  must(/ประจำปี/.test(yt) && /รวมรายรับ\s+5,429/.test(yt) && /สิบลด\s+7\s+1,319\.00/.test(yt) && /รวมทั้งปี\s+5,260\.00\s+169\.00\s+5,429\.00/.test(yt) && (await page.locator('.a4page--land svg').count()) >= 3, 'yearly summary includes everything: ' + yt)
  must((await page.getByRole('button', { name: /ดาวน์โหลด PDF/ }).count()) === 0, 'no combined download button on multi-sheet tabs')
  must((await page.getByRole('button', { name: /^⬇️ ดาวน์โหลด$/ }).count()) === 2, 'each sheet has its own download button')
  const [dl2] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /^⬇️ ดาวน์โหลด$/ }).nth(1).click()])
  must(/sheet2\.pdf$/.test(dl2.suggestedFilename()), 'sheet 2 downloads alone: ' + dl2.suggestedFilename())
  await page.locator('.a4page').first().screenshot({ path: 'shots/sum-year-1.png' })
  await page.locator('.a4page--land').screenshot({ path: 'shots/sum-year-2.png' })
  await page.getByRole('tab', { name: /^1\s*สัปดาห์/ }).click()
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
  await dl.saveAs('shots/ledger.pdf')
  // ตั้งค่า: หมวดรายจ่าย 15 หมวด 150 รายการ · ใบเบิกเลือกหมวดได้
  await page.goto(`http://localhost:${PORT}/#/settings`)
  must(await page.getByText('🧾 หมวดรายจ่าย (15 หมวด · 150 รายการ)').isVisible(), 'settings shows 15 groups / 150 items')
  await page.goto(`http://localhost:${PORT}/#/vouchers`)
  await page.getByRole('button', { name: /ทำใบเบิก/ }).click()
  must((await page.locator('select[id^="v-c"] option').count()) === 166, 'voucher form lists 15 whole-group options + 150 items + blank')
  console.log('LEDGER OK')
} catch (e) { await page.screenshot({ path: 'shots/ledger-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
