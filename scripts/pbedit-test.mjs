// ทดสอบแก้ไข/ลบบรรทัดสมุดบัญชี (รายบรรทัด · เลือกหลายรายการ · ทั้งวัน · ทั้งสัปดาห์ · สัปดาห์ที่ปิดยอดแล้ว): npm run build && node scripts/pbedit-test.mjs
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
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const S = iso(sun), Y = sun.getFullYear()
const day = (n) => { const d = new Date(sun); d.setDate(d.getDate() - n); return iso(d) }
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.evaluate(([S, Y, d1, d2]) => {
    const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
    const L = (id, date, kind, amount, extra = {}) => ({ id, date, kind, amount, updated: 1, ...extra })
    set(`passbook.${Y}`, [L('p1', d1, 'in', 200000, { balance: 1000000 }), L('p2', d1, 'in', 3200000), L('p3', d2, 'deposit', 526000), L('p4', d2, 'withdraw', 350000), L('p5', d2, 'in', 57500)])
    set(`weekcloses.${Y}`, [{ id: `wc-${S}`, sunday: S, bankBalance: 8973170, updated: 1 }])
  }, [S, Y, day(5), day(2)])
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: '🏦 ปรับ' }).click()
  await page.getByRole('tab', { name: /ตรวจจับคู่/ }).click()
  must(await page.getByText(/สัปดาห์นี้ปิดยอดแล้ว/).first().isVisible(), 'week is closed')
  // แก้ไข: สัปดาห์ที่ปิดยอดแล้วก็แก้ได้ (เปิดสัปดาห์ให้ใหม่)
  await page.getByRole('button', { name: /แก้ไขบรรทัด 2,000/ }).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('2500')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.getByText(/แก้ไขแล้ว — สัปดาห์นี้ถูกเปิดใหม่/).waitFor()
  must(await page.getByRole('button', { name: /แก้ไขบรรทัด 2,500/ }).isVisible(), 'edited amount shown')
  // ลบรายบรรทัด
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /ลบบรรทัด 575/ }).click()
  await page.getByText('ลบแล้ว 1 บรรทัด').waitFor()
  // เลือกหลายรายการ → เลือกทั้งวัน → ลบที่เลือก
  await page.getByRole('button', { name: /เลือกหลายรายการ/ }).click()
  await page.locator('.pbtools button', { hasText: '(2)' }).first().click()
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /ลบที่เลือก \(2\)/ }).click()
  await page.getByText('ลบแล้ว 2 บรรทัด').waitFor()
  // ลบทั้งสัปดาห์ที่เหลือ
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: /ลบทั้งสัปดาห์ \(2\)/ }).click()
  await page.getByText('ลบแล้ว 2 บรรทัด').waitFor()
  must(await page.getByText(/ยังไม่มีบรรทัดจากสมุดในสัปดาห์นี้/).isVisible(), 'week is empty after deleting everything')
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: '🏦 ปรับ' }).click(); await page.getByRole('tab', { name: /ตรวจจับคู่/ }).click()
  must(await page.getByText(/ยังไม่มีบรรทัดจากสมุดในสัปดาห์นี้/).isVisible(), 'deleted lines stay deleted after reload')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('PBEDIT OK')
} catch (e) { await page.screenshot({ path: 'shots/pbedit-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
