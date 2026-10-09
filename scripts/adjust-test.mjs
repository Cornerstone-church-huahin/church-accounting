// ทดสอบแท็บ ปรับ: ถ่ายรูปสมุด (จำลอง Gemini) → ตรวจยอดคงเหลือ → จับคู่สลิป → ลงรายรับที่ไม่มีสลิป → ปิดสัปดาห์ → ใบสรุปแสดงตรวจแล้ว
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const S = iso(sun), Y = sun.getFullYear()
const day = (n) => { const d = new Date(sun); d.setDate(d.getDate() - n); return iso(d) }
await page.goto(`http://localhost:${PORT}/#/`)
await page.evaluate(([S, Y, d3]) => {
  const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
  set(`rounds.${Y}`, [{ id: `rd-${S}`, date: S, lines: { tt1: 115000, tt2: 204000, tt3: 197000, tt5: 10000 }, envelopes: { tt1: 6, tt2: 7, tt3: 10, tt5: 1 }, denoms: {}, status: 'verified', counter: { id: 'a', name: 'ก' }, updated: 1 }])
  set(`income.${Y}`, [{ id: 'in1', date: d3, typeId: 'tt1', amount: 16900, method: 'transfer', source: 'slip', ref: 'X', updated: 1 }])
  localStorage.setItem('acct.gemini.v1', JSON.stringify({ key: 'TEST', model: 'gemini-flash-latest' }))
}, [S, Y, day(3)])
await page.route('**/generativelanguage.googleapis.com/**', (route) => route.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ rows: [
    { date: day(9), code: 'DEP', amount: 3000, balance: 4000 },
    { date: day(3), code: 'TRD', amount: 169, balance: 4169 },
    { date: day(2), code: 'TRD', amount: 555, balance: 4724 },
    { date: S, code: 'NBD', amount: 5260, balance: 10000 },
  ] }) }] } }] }),
}))
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.goto(`http://localhost:${PORT}/#/`); await page.reload()
  const names = await page.getByRole('tab').allInnerTexts()
  must(['รับ', 'จ่าย', 'ปรับ', 'สรุป'].every((n) => names.some((t) => t.includes(n))), 'four home tabs: ' + names.join('|'))
  await page.getByRole('tab', { name: /ปรับ/ }).first().click()
  must(await page.getByText(/ต้องเตรียมเบิก/).first().isVisible(), 'step 1 shows amount to prepare for withdrawal')
  await page.getByRole('tab', { name: /ถ่ายรูปสมุด/ }).click()
  must((await page.getByLabel('ถ่ายรูปหน้าสมุด').getAttribute('capture')) === 'environment', 'camera button for passbook')
  await page.getByLabel('แนบไฟล์หน้าสมุด').setInputFiles('public/icon-512.png')
  await page.getByLabel('รายการ บรรทัด 4').waitFor({ timeout: 20000 })
  must(await page.getByRole('alert').filter({ hasText: /ไม่ลงตัว/ }).count() === 1, 'chain check flags the broken balance row (4724 + 5260 ≠ 10000)')
  must(await page.getByRole('button', { name: /เพิ่มบรรทัดที่ตกหล่น/ }).count() === 1, 'gap helper offered for the broken row')
  // แก้ยอดคงเหลือให้ลงตัว (5724 + 5260 = 10984)
  await page.locator('.pbdraft').nth(3).locator('input').nth(4).fill('9984')
  await page.getByRole('button', { name: 'บันทึกและไปตรวจจับคู่' }).click()
  must(await page.locator('.weekchips .mini').count() === 2, 'lines split into two weeks by date (' + await page.locator('.weekchips .mini').count() + ')')
  await page.getByText(/ตรงกันทั้งหมด|ตรงกัน ✓/).first().waitFor({ timeout: 10000 })
  must(await page.getByText(/ตรงสลิป/).count() === 1, 'one transfer matched a slip')
  must(await page.getByText(/ไม่มีสลิป/).first().isVisible() || await page.getByRole('button', { name: 'ลงเป็นรายรับ' }).count() === 1, 'one transfer has no slip')
  await page.locator('.weekchips .mini').nth(1).click()
  must(await page.getByText(/3,000\.00/).first().isVisible(), 'previous week shows its own deposit line')
  await page.locator('.weekchips .mini').nth(0).click()
  // เงินเข้าสมุดที่ไม่มีสลิปต้องเข้าใบสรุปเป็น "ไม่ทราบที่มา" ทันที (ยังไม่ต้องลงเป็นรายรับเอง)
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  const unk = (await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ')
  must(/ไม่ทราบที่มา \(Unknown\)[^0-9]*1\s+555\.00/.test(unk) || /ไม่ทราบที่มา \(Unknown\)[^0-9]*1\s+0\s+0\.00\s+1\s+555\.00/.test(unk) || /ไม่ทราบที่มา \(Unknown\)/.test(unk) && /555\.00/.test(unk), 'unknown bank income shows in the weekly summary: ' + unk.slice(0, 400))
  await page.getByRole('tab', { name: /ปรับ/ }).first().click()
  await page.getByRole('tab', { name: /ตรวจจับคู่/ }).click()
  await page.getByRole('button', { name: 'ลงเป็นรายรับ' }).click()
  await page.getByRole('button', { name: 'ลงรายรับ', exact: true }).click()
  await page.getByText(/ตรงสลิป/).nth(1).waitFor({ timeout: 10000 })
  // ถ่ายหน้าเดิมซ้ำ: ทุกบรรทัดซ้ำ ไม่ถูกบันทึกซ้ำ
  await page.getByRole('tab', { name: /ถ่ายรูปสมุด/ }).click()
  await page.getByLabel('แนบไฟล์หน้าสมุด').setInputFiles('public/icon-512.png')
  await page.getByText(/มีอยู่แล้ว \(ถ่ายหน้าเดิมทับกัน\)/).waitFor({ timeout: 20000 })
  await page.locator('.pbdraft').nth(3).locator('input').nth(4).fill('9984')
  must(await page.getByText('✓ มีอยู่แล้ว — จะไม่บันทึกซ้ำ').count() === 4, 'all four rows flagged as duplicates')
  await page.getByRole('button', { name: 'บันทึกและไปตรวจจับคู่' }).click()
  must(await page.getByText(/ไม่ได้บันทึกซ้ำ/).isVisible(), 'duplicate-only scan saves nothing')
  must(await page.locator('.weekchips .mini').count() === 2, 'still exactly two weeks of lines')
  await page.getByRole('tab', { name: /ปิดสัปดาห์/ }).click()
  await page.getByRole('button', { name: /ยืนยันปิดสัปดาห์/ }).click()
  must(await page.getByText(/สัปดาห์นี้ปิดยอดแล้ว/).isVisible(), 'week closed')
  await page.screenshot({ path: 'shots/adjust-close.png', fullPage: true })
  await page.getByRole('tab', { name: /สรุป/ }).first().click()
  must(await page.getByText('✓ ตรวจกับสมุดบัญชีแล้ว').first().isVisible(), 'summary shows the week was checked against the passbook')
  const paperTxt = (await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ')
  must(!/สมุดบัญชีธนาคาร \(เงินเข้า-ออกสัปดาห์นี้\)/.test(paperTxt) && /ฝากเงินสด 5,260\.00 \(นับแล้วในใบถวาย\)/.test(paperTxt) && /รหัสในสมุด: DEP\/NBD = ฝากเงินสด/.test(paperTxt), 'bank movements are a footnote, not a separate table: ' + paperTxt.slice(-500))
  must(/ตรวจกับสมุดบัญชีธนาคารแล้ว.*9,984/.test((await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ')), 'paper note shows the bank balance: ' + (await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ').slice(-400))
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('ADJUST OK')
} catch (e) { await page.screenshot({ path: 'shots/adjust-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
