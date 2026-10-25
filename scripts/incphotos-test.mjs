// ใบบันทึกการถวาย: แนบรูปหลักฐานได้หลายรูปต่อรายการ เปิดดูได้ แก้/เอาออกได้ และขึ้นในแฟ้มประจำสัปดาห์
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4199
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const png = (c) => page.evaluate(async (c) => { const cv = document.createElement('canvas'); cv.width = 80; cv.height = 60; const g = cv.getContext('2d'); g.fillStyle = c; g.fillRect(0, 0, 80, 60); const b = await new Promise((r) => cv.toBlob(r, 'image/png')); return [...new Uint8Array(await b.arrayBuffer())] }, c)
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  const inc = page.getByRole('table', { name: /ใบบันทึกการถวาย \(A4 แนวนอน\)/ })
  await inc.waitFor()
  await inc.locator('tbody tr').nth(0).click()
  await page.locator('#ire-photos').waitFor()
  must(await page.locator('#ire-photos').getAttribute('multiple') !== null, 'file input accepts multiple files')
  for (const c of ['#c33', '#3c3', '#33c']) await page.setInputFiles('#ire-photos', { name: 'p.png', mimeType: 'image/png', buffer: Buffer.from(await png(c)) })
  must(await page.getByRole('button', { name: /ไม่เอารูปนี้/ }).count() === 3, 'three pictures staged')
  await page.getByRole('button', { name: /ไม่เอารูปนี้/ }).first().click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('1750')
  await page.getByRole('button', { name: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(1500)
  const stored = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('acct.income.')).flatMap((k) => JSON.parse(localStorage.getItem(k))).flatMap((x) => x.photos ?? []).length)
  must(stored === 2, 'two photos saved on the entry: ' + stored)
  // เปิดแถวเดิม: เห็นรูปที่เก็บไว้ 2 รูป เอาออก 1 รูป แล้วบันทึก
  await inc.locator('tbody tr').nth(0).click()
  await page.locator('#ire-photos').waitFor()
  await page.waitForFunction(() => document.querySelectorAll('.sheet img, [role="dialog"] img').length >= 2 || document.querySelectorAll('img[alt^="รูปหลักฐาน"]').length >= 2, null, { timeout: 8000 })
  await page.getByRole('button', { name: /เอารูปนี้ออก/ }).first().click()
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.waitForTimeout(800)
  const after = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('acct.income.')).flatMap((k) => JSON.parse(localStorage.getItem(k))).flatMap((x) => x.photos ?? []).length)
  must(after === 1, 'one photo left after removing one: ' + after)
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('incphotos-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
