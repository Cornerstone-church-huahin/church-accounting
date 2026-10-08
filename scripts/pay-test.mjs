// ทดสอบโหมดจ่าย: 1 บันทึกด้วยมือ · 2 วางบิล · 3 สำรองจ่าย · 4 รวมจ่าย → สรุปหักลบอัตโนมัติ: npm run build && node scripts/pay-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4177
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH', acceptDownloads: true })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: '🔴 จ่าย' }).click()
  for (const n of ['บันทึกด้วยมือ', 'วางบิล', 'สำรองจ่าย', 'รวมจ่าย']) must(await page.getByRole('tab', { name: new RegExp(n) }).isVisible(), 'pay sub tab ' + n)
  const total = async () => { await page.getByRole('tab', { name: /รวมจ่าย/ }).click(); return (await page.locator('section.paper').innerText()).replace(/\n/g, ' ') }
  const save = () => page.getByRole('button', { name: 'บันทึก', exact: true }).click()

  // 1 บันทึกด้วยมือ: ค่าไฟฟ้า 1,850 โอน (หมวด 3.1)
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByRole('button', { name: '＋ บันทึก' }).click()
  await page.locator('#e-cat').selectOption('ei-3-1')
  must((await page.locator('#e-desc').inputValue()) === 'ค่าไฟฟ้าอาคารคริสตจักร', 'desc auto-filled from the category')
  await page.locator('#e-amt').fill('1850')
  await page.getByRole('button', { name: 'โอนเงิน' }).click()
  await save()
  must(await page.getByText('1 รายการ · รวม 1,850.00').isVisible(), 'manual card header')

  // 2 วางบิล: ยังไม่จ่าย 2,000 → ยังไม่นับในรวมจ่าย → กด จ่ายแล้ว → นับ
  await page.getByRole('tab', { name: /วางบิล/ }).click()
  await page.getByRole('button', { name: '＋ วางบิล' }).click()
  await page.locator('#e-cat').selectOption('ei-3-3')
  await page.locator('#e-amt').fill('2000')
  await page.locator('#e-who').fill('การประปา')
  await save()
  must(await page.getByText('ค้างจ่าย').first().isVisible(), 'open bill shows as pending')
  let t = await total()
  must(/รวมทั้งสิ้น\s+0\s+0\.00\s+1\s+1,850\.00\s+1,850\.00/.test(t), 'open bill is not counted yet: ' + t)
  must(await page.getByText(/ยังไม่นับรวม: วางบิลค้างจ่าย 1 รายการ/).isVisible(), 'pending note')
  await page.getByRole('tab', { name: /วางบิล/ }).click()
  await page.getByRole('button', { name: '✓ จ่ายแล้ว' }).click()
  await page.getByRole('button', { name: 'ยืนยัน' }).click()
  t = await total()
  must(/ค่าสาธารณูปโภคและค่าเช่า\s+1\s+2,000\.00\s+1\s+1,850\.00\s+3,850\.00/.test(t), 'paid bill counted (cash 2,000 + transfer 1,850): ' + t)

  // 3 สำรองจ่าย: ผู้สำรองจ่าย คืนเงินแล้ว 600 เงินสด (หมวด 11.4)
  await page.getByRole('tab', { name: /สำรองจ่าย/ }).click()
  await page.getByRole('button', { name: '＋ สำรองจ่าย' }).click()
  await page.locator('#e-cat').selectOption('ei-11-4')
  await page.locator('#e-amt').fill('600')
  await page.locator('#e-who').fill('สมเจต')
  await page.locator('#e-status').selectOption('paid')
  await save()
  t = await total()
  must(/รวมทั้งสิ้น\s+2\s+2,600\.00\s+1\s+1,850\.00\s+4,450\.00/.test(t), 'grand total (3 channels): ' + t)

  await page.getByRole('tab', { name: /วางบิล/ }).click()
  await page.screenshot({ path: 'shots/pay.png', fullPage: true })
  // แก้ไข / ลบ
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByRole('button', { name: '✎ แก้ไข' }).first().click()
  await page.locator('#e-amt').fill('1900')
  await save()
  must(/4,500\.00/.test(await total()), 'edit updates the total')
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: '🗑️ ลบ' }).first().click()
  await page.waitForTimeout(300)
  must(/รวมทั้งสิ้น\s+2\s+2,600\.00\s+0\s+0\.00\s+2,600\.00/.test(await total()), 'delete removes it from the total')

  // สรุป: หักลบกับรายรับอัตโนมัติ (ไม่มีรายรับ → คงเหลือติดลบเท่ารายจ่าย)
  await page.getByRole('tab', { name: /สรุป/ }).click()
  await page.getByRole('button', { name: /^ทั้งปี/ }).click()
  const st = (await page.locator('.a4page').innerText()).replace(/\n/g, ' ')
  must(/รวมรายจ่าย\s+2\s+2,600\.00\s+0\s+0\.00\s+2,600\.00/.test(st), 'summary shows expenses from the pay tabs: ' + st)
  must(/คงเหลือ\s+[-−]2,600\.00\s+0\.00\s+[-−]2,600\.00/.test(st), 'summary balance deducts expenses: ' + st)
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('PAY OK')
} catch (e) { await page.screenshot({ path: 'shots/pay-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
