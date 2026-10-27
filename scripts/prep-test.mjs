// เงินถวายกองทุนในสัปดาห์: รายรับหมุนเวียนไม่นับ · ขึ้นแถวรายจ่ายชื่อกองทุนเดียวกันทันที · ท้ายใบมีแถว "จำนวนที่ต้องเบิก": npm run build && node scripts/fundflow-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4198
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const add = async (type, cash) => {
  await page.locator('#mi-type').selectOption({ label: type })
  await page.locator('.entryrow .field', { hasText: 'เงินสด (บาท)' }).locator('input').fill(String(cash))
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
}
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await add('ประจำสัปดาห์', 1000)
  await add('กองทุนเพื่อที่ดินคริสตจักร', 500)
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click()
  // เตรียมเบิก
  await page.locator('.stepbtn--wd').click()
  const wd = (await page.getByLabel('เตรียมเบิกประจำสัปดาห์').innerText()).replace(/\s+/g, ' ')
  must(/รวมต้องเบิกสัปดาห์นี้ 500/.test(wd) && /หมุนเวียน 0/.test(wd) && /กองทุน 500/.test(wd), 'withdraw prep total 500 = circulating 0 + fund 500: ' + wd.slice(0, 300))
  must(/กองทุนเพื่อที่ดินคริสตจักร\s+500/.test(wd), 'fund row listed')
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click()
  // เตรียมนำฝาก
  await page.locator('.stepbtn--dep').click()
  const d0 = (await page.getByLabel('เตรียมนำฝากเข้าบัญชีกองทุน').innerText()).replace(/\s+/g, ' ')
  must(/ยังอยู่ระหว่างสะสม/.test(d0) && /500/.test(d0), 'deposit prep shows waiting 500: ' + d0.slice(0, 300))
  const bal = async () => (await page.getByLabel('เงินกองทุน ในบัญชี และเตรียมนำฝาก').locator('tfoot').innerText()).replace(/\s+/g, ' ')
  const t0 = await bal()
  must(/รวมทุกกองทุน.*500.*500/.test(t0), 'before deposit: in-account 0 / waiting 500 / total 500: ' + t0)
  page.on('dialog', (x) => x.accept())
  await page.getByRole('button', { name: /รอนำฝาก .* กดเมื่อฝากแล้ว/ }).first().click()
  const t1 = await bal()
  must(/รวมทุกกองทุน\s+500(\.00)?\s+(0(\.00)?|—)\s+500/.test(t1), 'after deposit: in-account 500, waiting 0, total unchanged 500: ' + t1)
  console.log('PREP OK')
} finally { await browser.close(); server.kill() }
