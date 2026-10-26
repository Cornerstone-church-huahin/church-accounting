// ใบบันทึกการถวาย/ใบเบิก-จ่ายเงินสดอยู่ใต้แถบสัปดาห์ทันที และแตะแถวเพื่อแก้ไข/เพิ่ม/ลบได้: npm run build && node scripts/sheetedit-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4177
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const sheetText = async (name) => (await page.getByRole('table', { name }).innerText()).replace(/\s+/g, ' ')
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  // รับ: ใบอยู่ใต้แถบสัปดาห์ทันที (ยังไม่ต้องกดแท็บย่อย)
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  const inc = page.getByRole('table', { name: /ใบบันทึกการถวาย (?:รายรับเงินหมุนเวียน )?\(A4(?: แนวนอน)?\)/ })
  await inc.waitFor()
  must(await page.getByLabel('สัปดาห์ถัดไป').isVisible(), 'week bar above the sheet')
  must(/อาทิตย์ที่ \d ของเดือน\S+ \d{4}\s+ระหว่างวันที่ \d+(–| [^\s]+ – )\d+ \S+ \d{2}/.test((await page.locator('.weekbar').first().innerText()).replace(/\n/g, ' ')), 'week bar reads: อาทิตย์ที่ N ของเดือน … ระหว่างวันที่ …')
  await page.screenshot({ path: 'shots/weekbar-title.png' })
  must(await page.locator('.a4page .sheet-hint').first().isVisible() && /แตะแถวว่างเพื่อบันทึกข้อมูล/.test(await page.locator('.sheet-hint').first().innerText()), 'faint usage hint is shown on the editable sheet')
  await page.emulateMedia({ media: 'print' })
  must(!(await page.locator('.sheet-hint').first().isVisible()), 'usage hint is hidden when printing')
  await page.emulateMedia({ media: 'screen' })
  // แตะแถวว่างเพื่อเพิ่ม
  await inc.locator('tbody tr').nth(0).click()
  await page.locator('#ire-count').fill('3')
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('1234')
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('1,234'))
  // แตะแถวเดิมเพื่อแก้ตัวเลข
  await inc.locator('tbody tr').nth(0).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('2000')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('2,000'))
  must(!/1,234/.test(await sheetText(/ใบบันทึกการถวาย (?:รายรับเงินหมุนเวียน )?\(A4(?: แนวนอน)?\)/)), 'edited number replaced')
  // เพิ่มรายการที่ 2 ย้อนวัน (จันทร์) → ระบบเรียงตามวันที่ให้ (จันทร์อยู่ก่อน) · แต่ละรายการมีปุ่มแก้ไข/ลบของตัวเอง
  const sunD = new Date(); sunD.setDate(sunD.getDate() + ((7 - sunD.getDay()) % 7))
  const monD = new Date(sunD); monD.setDate(monD.getDate() - 6)
  const monISO = `${monD.getFullYear()}-${String(monD.getMonth() + 1).padStart(2, '0')}-${String(monD.getDate()).padStart(2, '0')}`
  await inc.locator('tbody tr').nth(1).click()
  await page.locator('#ire-date').fill(monISO)
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('999')
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('999'))
  const firstRow = (await inc.locator('tbody tr').nth(0).innerText()).replace(/\s+/g, ' ')
  must(/999/.test(firstRow), 'earlier date sorts first on the sheet: ' + firstRow)
  const list = page.getByRole('region', { name: /รายการในใบนี้/ })
  const items = await list.locator('li').allInnerTexts()
  must(items.length === 2 && /999/.test(items[0]) && /2,000/.test(items[1]), 'list is date-ordered: ' + items.join(' | '))
  page.once('dialog', (d) => d.accept())
  await list.locator('li').nth(0).getByRole('button', { name: /^ลบ / }).click()
  await page.waitForFunction(() => !document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('999'))
  await list.locator('li').nth(0).getByRole('button', { name: /^แก้ไข / }).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('2500')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('2,500'))
  // เลื่อนสัปดาห์ → ใบเปลี่ยนตาม (สัปดาห์ถัดไปไม่มีรายการ)
  const head = (await page.locator('.a4page').first().innerText()).replace(/\s+/g, ' ')
  await page.getByLabel('สัปดาห์ถัดไป').click()
  const head2 = (await page.locator('.a4page').first().innerText()).replace(/\s+/g, ' ')
  must(head !== head2 && !/2,500/.test(head2), 'sheet follows the selected week')
  await page.getByLabel('สัปดาห์ก่อน').click()
  // ลบจากหน้าต่างแก้ไข
  await inc.locator('tbody tr').nth(0).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑 ลบ' }).click()
  await page.waitForFunction(() => !document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('2,500'))

  // ปุ่มดาวน์โหลดใต้ใบ: ไฟล์เปล่า + ไฟล์ข้อมูล
  for (const [name, re] of [['ไฟล์เปล่า', /blank\.pdf$/], ['ข้อมูล', /offering-sheet\.pdf$/]]) {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: new RegExp('ดาวน์โหลด PDF ' + name) }).click()])
    must(fs.readFileSync(await d.path()).subarray(0, 5).toString() === '%PDF-' && (name !== 'ข้อมูล' ? /blank/.test(d.suggestedFilename()) : re.test(d.suggestedFilename())), 'income ' + name + ' PDF downloads: ' + d.suggestedFilename())
  }

  // จ่าย: ใบเบิก-จ่ายเงินสดอยู่ใต้แถบสัปดาห์ทันที
  await page.getByRole('tab', { name: '🔴 จ่าย' }).click()
  const exp = page.getByRole('table', { name: /ใบเบิก-จ่ายเงินสด \(A4\)/ })
  await exp.waitFor()
  await exp.locator('tbody tr').nth(0).click()
  await page.locator('#ere-item').selectOption({ label: 'ค่าไฟ' })
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('500')
  await page.locator('#ere-note').fill('มน.เสาวคน สำรองจ่าย')
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  await page.waitForFunction(() => /ค่าไฟ.*500.*มน.เสาวคน สำรองจ่าย/.test(document.querySelector('table[aria-label*="ใบเบิก-จ่ายเงินสด"]')?.textContent?.replace(/\s+/g, ' ') ?? ''))
  await exp.locator('tbody tr').nth(0).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('750')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบเบิก-จ่ายเงินสด"]')?.textContent?.includes('750'))
  for (const name of ['ไฟล์เปล่า', 'ข้อมูล']) {
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.getByRole('button', { name: new RegExp('ดาวน์โหลด PDF ' + name) }).click()])
    must(fs.readFileSync(await d.path()).subarray(0, 5).toString() === '%PDF-', 'expense ' + name + ' PDF downloads: ' + d.suggestedFilename())
  }
  await page.screenshot({ path: 'shots/sheetedit-pay.png' })
  await exp.locator('tbody tr').nth(0).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑 ลบ' }).click()
  await page.waitForFunction(() => !document.querySelector('table[aria-label*="ใบเบิก-จ่ายเงินสด"]')?.textContent?.includes('750'))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('SHEETEDIT OK')
} catch (e) { await page.screenshot({ path: 'shots/sheetedit-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
