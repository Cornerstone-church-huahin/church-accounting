// เงินยืม: ฟอร์มเพิ่มมีตัวเลือก ยืมเงิน / ใช้คืน — ใช้คืนเลือกจากชื่อผู้ให้ยืมที่ยังค้างอยู่ และหักลบยอดค้างคืน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
await page.goto(`http://localhost:${PORT}/#/meeting/3`)
await page.evaluate(() => localStorage.setItem('acct.loans.v1', JSON.stringify([
  { id: 'l1', updated: 1, lender: { kind: 'person', name: 'พี่ก' }, purpose: 'ทำสุสาน', borrower: 'tt8', date: '2026-10-01', principal: 5000000, repayments: [] },
  { id: 'l2', updated: 1, lender: { kind: 'person', name: 'พี่ข' }, purpose: '', borrower: 'own', date: '2026-10-02', principal: 1000000, repayments: [] },
  { id: 'l3', updated: 1, lender: { kind: 'fund', fundId: 'tt4' }, purpose: '', borrower: 'tt8', date: '2026-10-03', principal: 3000000, repayments: [] },
])))
try {
  await page.goto(`http://localhost:${PORT}/#/balance/debt`); await page.reload()
  await page.getByRole('button', { name: /บันทึกหนี้สินใหม่/ }).click()
  must(await page.getByRole('button', { name: /ใช้คืน/ }).isVisible() && await page.getByRole('button', { name: /ยืมเงิน/ }).isVisible(), 'mode switch present')
  await page.getByRole('button', { name: /ใช้คืน/ }).click()
  const opts = await page.locator('#rp-lender option').allInnerTexts()
  must(opts.some((t) => t.includes('พี่ก')) && opts.some((t) => t.includes('พี่ข')), 'lender options are the existing names: ' + opts.join('|'))
  await page.locator('#rp-lender').selectOption({ label: 'พี่ก' })
  must(/ค้างคืน 50,000\.00/.test(await page.locator('.pbdraft').last().innerText()), 'outstanding shown')
  await page.locator('.pbdraft').last().locator('input[inputmode="decimal"], input[inputmode="numeric"]').first().fill('20000')
  await page.getByRole('button', { name: 'บันทึกการใช้คืน' }).click()
  must(/ค้างคืน 30,000\.00/.test(await page.locator('body').innerText()), 'repayment reduces outstanding balance to 30,000')
  // ภายใน: กองทุนที่ดิน ให้ กองทุนสุสาน ยืม → คืนครบ
  await page.goto(`http://localhost:${PORT}/#/balance/indebt`)
  await page.getByRole('button', { name: /บันทึกเงินยืม/ }).last().click()
  await page.getByRole('button', { name: /ใช้คืน/ }).click()
  await page.locator('#rp-lender').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'บันทึกการใช้คืน' }).click()
  must(/คืนครบแล้ว/.test(await page.locator('body').innerText()), 'fund loan fully repaid')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('loanrepay-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
