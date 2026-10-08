// ทดสอบหน้าแรก โหมด "รับ": ช่อง 1 มือ · 2 สลิป · 3 ใบถวาย → ใบสรุป (4): npm run build && node scripts/receive-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4174
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE:', m.text().slice(0, 300)))
page.on('dialog', (d) => { if (!/ลบ/.test(d.message())) console.log('DIALOG:', d.message()) })
page.on('pageerror', (e) => errors.push(String(e)))
const sunStr = (() => { const d = new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  must(await page.getByRole('tab', { name: 'บันทึกด้วยมือ' }).count() === 0, 'sub tabs hidden before clicking รับ')
  await page.getByRole('tab', { name: '💚 รับ' }).click()
  for (const n of ['บันทึกด้วยมือ', 'บันทึกสลิป', 'ใบบันทึกการถวาย']) must(await page.getByRole('tab', { name: new RegExp(n) }).isVisible(), 'sub tab ' + n)
  must(await page.getByRole('tab', { name: /รวมรับ/ }).isVisible(), 'total tab (4) exists')
  // 1 บันทึกด้วยมือ: ค่าเช่า 10,000 เงินสด
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByRole('button', { name: '＋ บันทึก' }).click()
  await page.locator('#i-amt').fill('10000')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  // 2 สลิป: เลือกรูป → ระบบอ่านเอง → ฟอร์มถูกใส่ค่าให้ (ใช้สลิปจริงจาก SLIP_FIXTURE ถ้ามี — ไม่เก็บสลิปจริงใน repo)
  await page.getByRole('tab', { name: /บันทึกสลิป/ }).click()
  await page.getByRole('button', { name: '＋ แนบสลิป' }).click()
  must(await page.getByText('เลือกรูปสลิป').first().isVisible(), 'slip flow asks only for a photo first')
  must(await page.locator('#i-amt').count() === 0, 'no fields before choosing a photo')
  if (process.env.SLIP_FIXTURE) {
    await page.getByLabel('เลือกรูปสลิป').setInputFiles(process.env.SLIP_FIXTURE)
    await page.locator('#i-amt').waitFor({ timeout: 90000 })
    must((await page.locator('#i-date').inputValue()) === process.env.SLIP_DATE, 'date read from slip: ' + (await page.locator('#i-date').inputValue()))
    must((await page.locator('#i-amt').inputValue()).replace(/[^\d.]/g, '') === process.env.SLIP_AMOUNT, 'amount read from slip: ' + (await page.locator('#i-amt').inputValue()))
    const ys = []
    for (const q of ['#i-date', '#i-amt', '#i-ref', '#i-type', '#i-mem']) ys.push((await page.locator(q).boundingBox()).y)
    must(ys.every((y, i) => i === 0 || y > ys[i - 1]), 'slip form order: date+time, amount, ref, then purpose and member no. at the bottom ' + ys.join(','))
    must((await page.locator('#i-time').inputValue()) === process.env.SLIP_TIME, 'time shown beside date: ' + (await page.locator('#i-time').inputValue()))
    must((await page.locator('#i-note').count()) === 0 && (await page.locator('#i-slip').count()) === 0, 'no note / file inputs in slip form')
    await page.screenshot({ path: 'shots/slip-confirm.png', fullPage: true })
  }
  await page.keyboard.press('Escape')
  await page.goto(`http://localhost:${PORT}/#/`); await page.getByRole('tab', { name: '💚 รับ' }).click()
  const rep = page.locator('.a4page')
  const readTotal = async () => { await page.getByRole('tab', { name: /รวมรับ/ }).click(); return (await rep.innerText()).replace(/\n/g, ' ') }
  const txt = await readTotal()
  must(/ได้รับการถวายประจำสัปดาห์/.test(txt) && /สิบลด\s+1\s+10,000\.00\s+10,000\.00[\s\S]*รวมทั้งสิ้น\s+1\s+10,000\.00\s+0\s+0\.00\s+10,000\.00/.test(txt), 'summary page shows only the per-type table with totals :: ' + txt)
  must(!/ใบสรุปเงินรับ|รายการที่บันทึก/.test(txt), 'no extra tables in tab 4')
  must(/ผู้ตรวจสอบ/.test(txt), 'signature block shown')
  // การ์ดแสดงจำนวนรายการ + รวม · ใบสรุปสลับ ทั้งปี ได้ · ทุกสัปดาห์
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  must(await page.getByText('1 รายการ · รวม 10,000.00').isVisible(), 'card header shows count and sum')
  await readTotal()
  await page.getByRole('button', { name: /^ทั้งปี/ }).click()
  must(/ประจำปี[\s\S]*10,000\.00/.test(await readTotal()), 'year scope includes the entry')
  await page.getByRole('button', { name: 'สัปดาห์ที่เลือก' }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  // แก้ไข / ลบ รายการที่บันทึกแล้ว
  await page.getByRole('button', { name: '✎ แก้ไข' }).first().click()
  await page.locator('#i-amt').fill('12000')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/12,000\.00/.test(await readTotal()), 'edited entry updates the report')
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑️ ลบ' }).first().click()
  await page.waitForTimeout(300)
  must(/รวมทั้งสิ้น\s+0\s+0\.00\s+0\s+0\.00\s+0\.00/.test((await readTotal())), 'deleted entry leaves the report')
  // ตั้งค่า: ใส่รหัส Gemini ที่หน้าตั้งค่า
  await page.goto(`http://localhost:${PORT}/#/settings`)
  await page.getByLabel('รหัส Gemini API').fill('TEST-KEY-1234')
  await page.getByRole('button', { name: 'บันทึกรหัส' }).click()
  must(await page.getByText('…1234').isVisible(), 'settings shows saved gemini key (last 4)')
  await page.goto(`http://localhost:${PORT}/#/`); await page.getByRole('tab', { name: '💚 รับ' }).click()
  // 3 ใบบันทึกการถวาย: ให้ Gemini อ่าน (จำลองคำตอบด้วยค่าจากใบจริงของท่าน) → ตรวจ → ยืนยัน → เข้าใบสรุป 4
  let gcalls = 0
  await page.route('**/generativelanguage.googleapis.com/**', (route) => ++gcalls === 1 ? route.fulfill({ status: 503, contentType: 'application/json', body: '{"error":{"message":"overloaded"}}' }) : route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify({ date: sunStr, cashTotal: 5260, rows: [
      { label: 'สิบลด', envelopes: 6, amount: 1150 }, { label: 'ประจำสัปดาห์', envelopes: 7, amount: 2040 }, { label: 'ขอบพระคุณ', envelopes: 10, amount: 1970 }, { label: 'กองทุนเพื่ออาหาร', envelopes: 1, amount: 100 }] }) }] } }] }),
  }))
  await page.getByRole('tab', { name: /ใบบันทึกการถวาย/ }).click()
  {
    const [bl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /เปล่า \(PDF\)/ }).click()])
    must((await import('node:fs')).default.readFileSync(await bl.path()).subarray(0, 5).toString() === '%PDF-', 'blank sheet PDF downloads')
    await bl.saveAs('shots/blank-sheet.pdf')
    const [b2] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /ใบบันทึกการถวายเปล่า 2 ใบต่อแผ่น/ }).click()])
    must((await import('node:fs')).default.readFileSync(await b2.path()).subarray(0, 5).toString() === '%PDF-', 'two-up blank PDF downloads')
    await b2.saveAs('shots/blank-2up.pdf')
  }
  await page.getByRole('button', { name: '＋ แนบไฟล์' }).click()
  await page.getByLabel('เลือกรูปใบบันทึกการถวาย').setInputFiles(process.env.SHEET_FIXTURE ?? process.env.SLIP_FIXTURE ?? 'public/icon-512.png')
  await page.getByRole('button', { name: 'ยืนยันและบันทึก' }).waitFor({ timeout: 30000 })
  must(await page.getByText(/ตรงกับยอด/).isVisible(), 'sum matches written total (after a 503 retry)')
  must(gcalls >= 2, 'retried after 503')
  must((await page.locator('#sf-date').inputValue()) === sunStr && await page.getByText('อ่านจากใบ').first().isVisible(), 'date is read from the sheet automatically')
  for (let i = 1; i <= 5; i++) must(await page.getByLabel(`ชื่อแถว ${i}`).isVisible(), 'all 5 printed rows are shown: ' + i)
  must((await page.getByLabel('ชื่อแถว 4').inputValue()).includes('ที่ดิน'), 'blank land-fund row is still shown')
  await page.screenshot({ path: 'shots/sheet-review.png', fullPage: true })
  must((await page.getByLabel('ชื่อแถว 3').inputValue()) === 'ขอบพระคุณ', 'rows read')
  await page.getByRole('button', { name: 'ยืนยันและบันทึก' }).click()
  const t2 = (await readTotal())
  must(/สิบลด\s+6\s+1,150\.00\s+1,150\.00[\s\S]*รวมทั้งสิ้น\s+24\s+5,260\.00\s+0\s+0\.00\s+5,260\.00/.test(t2), 'sheet cash flows into the summary: ' + t2)
  must(/ขอบพระคุณ\s+10\s+1,970\.00/.test(t2), 'per-type rows from the sheet')
  // รวมทุกช่อง: เพิ่มรายการช่อง 1 (สิบลด 1,000) → ใบสรุป 4 รวมกับใบถวาย: สิบลด 6 ซอง + 1 รายการ = 7 · ยอดรวม 6,260
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByRole('button', { name: '＋ บันทึก' }).click()
  await page.locator('#i-amt').fill('1000')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  const t3 = (await readTotal())
  await page.screenshot({ path: 'shots/total.png', fullPage: true })
  // ดาวน์โหลด PDF
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
  const pdfPath = await dl.path()
  const head = (await import('node:fs')).default.readFileSync(pdfPath).subarray(0, 5).toString()
  must(head === '%PDF-' && /\.pdf$/.test(dl.suggestedFilename()), 'PDF downloaded: ' + dl.suggestedFilename() + ' ' + head)
  await dl.saveAs('shots/total.pdf')
  must(/6,260\.00/.test(t3), 'sources are combined in the summary: ' + t3)
  must(/สิบลด\s+7\s+2,150\.00\s+2,150\.00/.test(t3), 'type row combines sheet envelopes + hand entry (6+1=7): ' + t3)
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑️ ลบ' }).first().click()
  // กรณีของผู้ใช้: ใบถวายสิบลด 6 ซอง 1,150 + โอน 1 รายการ 169 → แถวสิบลด: 6 | 1,150.00 | 1 | 169.00 | 1,319.00
  await page.getByRole('button', { name: '＋ บันทึก' }).click()
  await page.getByRole('button', { name: 'โอนเงิน' }).click()
  await page.locator('#i-amt').fill('169')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  const t4 = await readTotal()
  must(/สิบลด\s+6\s+1,150\.00\s+1\s+169\.00\s+1,319\.00/.test(t4), 'row shows 6 envelopes 1,150 + 1 transfer 169 = 1,319: ' + t4)
  must(/รวมทั้งสิ้น\s+24\s+5,260\.00\s+1\s+169\.00\s+5,429\.00/.test(t4), 'grand total row: ' + t4)
  {
    const [d2] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
    await d2.saveAs('shots/total-user.pdf')
  }
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑️ ลบ' }).first().click()
  await page.getByRole('tab', { name: /ใบบันทึกการถวาย/ }).click()
  // แก้ไขไฟล์ที่แนบ: เปลี่ยนยอดแล้วใบสรุปเปลี่ยนตาม · ลบไฟล์แล้วยอดในใบนับหายไป
  await page.getByRole('button', { name: '✎ แก้ไข' }).first().click()
  await page.locator('#sr-amt-0').fill('1200')
  await page.getByRole('button', { name: 'ยืนยันและบันทึก' }).click()
  must(/5,310\.00/.test(await readTotal()), 'edited sheet updates the report')
  await page.getByRole('tab', { name: /ใบบันทึกการถวาย/ }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑️ ลบ' }).first().click()
  await page.waitForTimeout(300)
  must(/รวมทั้งสิ้น\s+0\s+0\.00\s+0\s+0\.00\s+0\.00/.test((await readTotal())), 'deleting the sheet removes its cash')
  await page.getByRole('tab', { name: '🔴 จ่าย' }).click()
  must(await page.getByRole('tab', { name: /รวมจ่าย/ }).isVisible(), 'pay mode shows its 4 tabs')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('RECEIVE OK')
} catch (e) { await page.screenshot({ path: 'shots/receive-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
