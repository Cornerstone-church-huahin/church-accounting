// เลขที่หนังสือเชิญตามตัวย่อของหมวดในคลังเอกสาร · เปลี่ยนตัวย่อหมวด → เลขที่ฉบับเดิมตามไปด้วย
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4392
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  let ans = 'ศอ/จช'
  page.on('dialog', (d) => d.accept(ans))
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const L = (id, no) => ({ id, updated: 5, toName: id, subject: '', to: '', body: '', no, date: '2026-10-20' })
  await page.addInitScript(([l]) => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.doccats.v1', JSON.stringify([{ id: 'c1', updated: 1, name: 'หนังสือเชิญร่วมงาน', prefix: 'ศอ/จช' }]))
    localStorage.setItem('acct.inviteletter.v1', JSON.stringify(l))
  }, [[L('อ้าย', 'ศอช.001')]])
  await page.goto(`http://localhost:${PORT}/#/meeting/1/1/invite`)
  await page.getByRole('button', { name: /เพิ่ม/ }).first().click()
  await page.waitForURL(/invite-letter/)
  await page.waitForTimeout(800)
  const nos = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.inviteletter.v1')).map((x) => x.no).sort())
  must(JSON.stringify(nos) === JSON.stringify(['ศอ/จช.001', 'ศอ/จช.002']), 'old letter follows category prefix, new one runs on: ' + nos)
  // เปลี่ยนตัวย่อของหมวดในคลังเอกสาร → เลขที่ของทุกฉบับตามไปด้วย
  ans = 'นน'
  await page.goto(`http://localhost:${PORT}/#/meeting/1/2`); await page.waitForTimeout(600)
  await page.getByRole('button', { name: /จัดการหมวด/ }).click()
  await page.getByRole('button', { name: /ตัวย่อ/ }).first().click(); await page.waitForTimeout(500)
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.inviteletter.v1')).map((x) => x.no).sort())
  must(JSON.stringify(after) === JSON.stringify(['นน.001', 'นน.002']), 'changing the category prefix renumbers letters: ' + after)
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('invnum-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
