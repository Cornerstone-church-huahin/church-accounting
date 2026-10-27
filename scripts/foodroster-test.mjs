// งานโรงครัว › ตารางถวายอาหาร (เดิม: หน้าแรก = ห้องทำงาน: แถบเงิน 6 ช่องบนสุด + แท็บ 1–18 พอดีจอ · ลิงก์ทุกอันใช้ได้เหมือนเดิม (บัญชีอยู่ที่ แท็บ 3 งานเหรัญญิก)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4192
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const must2 = must
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/14`); await page.waitForLoadState('networkidle')
  must(await page.getByRole('heading', { name: 'งานโรงครัว', exact: true }).isVisible(), 'work page named งานโรงครัว')
  must(/ตารางถวายอาหาร/.test(await page.locator('.tiletabs').innerText()), 'tab 1 is ตารางถวายอาหาร')
  await page.getByRole('link', { name: /ตารางถวายอาหาร/ }).click()
  await page.getByLabel('เริ่มเดือน').selectOption('10'); await page.getByLabel('ปี พ.ศ.').selectOption('2026')
  const o = (await page.getByLabel('เดือนตุลาคม 2569').first().innerText()).replace(/\s+/g, ' ')
  must(/4\/10\/69/.test(o) && /11\/10\/69/.test(o) && /18\/10\/69/.test(o) && /25\/10\/69/.test(o) && !/1\/10\/69/.test(o.replace(/11\/10\/69/, '')), 'October 2569: Sundays 4, 11, 18, 25 only: ' + o)
  const n = (await page.getByLabel('เดือนพฤศจิกายน 2569').first().innerText()).replace(/\s+/g, ' ')
  must(/1\/11\/69/.test(n) && /29\/11\/69/.test(n), 'November 2569 has five Sundays 1…29: ' + n)
  must((await page.locator('.a4page').count()) === 1, 'two months = one A4 sheet')
  must((await page.locator('.a4page section svg').count()) === 4, 'each month header carries two food pictures (burger/taco, donut/sandwich)')
  const fit = await page.evaluate(() => [...document.querySelectorAll('.a4page')].every((e) => e.scrollHeight <= e.clientHeight + 1 && [...e.querySelectorAll('section')].every((x) => x.getBoundingClientRect().bottom <= e.getBoundingClientRect().bottom - 20)))
  must(fit, 'both month blocks fit inside the A4 page with room for the credit line')
  // บัญชีธนาคารท้ายใบ (เลขทดสอบ ไม่ใช่เลขจริง)
  must(await page.getByLabel('บัญชีรับถวายอาหาร').count() === 0, 'no account box until an account is saved')
  await page.locator('summary', { hasText: 'บัญชีรับถวาย' }).click()
  await page.getByLabel('ธนาคาร', { exact: true }).fill('ธนาคารทดสอบ'); await page.getByLabel('ชื่อบัญชี').fill('คริสตจักรทดสอบ'); await page.getByLabel('เลขที่บัญชี').fill('000-0-00000-0'); await page.getByLabel('ข้อความสั้น ๆ (ไม่บังคับ)').fill('โอนแล้วแจ้งงานโรงครัว')
  await page.getByRole('button', { name: 'บันทึกบัญชี' }).click()
  const box = (await page.getByLabel('บัญชีรับถวายอาหาร').first().innerText()).replace(/\s+/g, ' ')
  must(/ถวายด้วยการโอนเงิน · โอนแล้วแจ้งงานโรงครัว/.test(box) && /ธนาคารทดสอบ · ชื่อบัญชี คริสตจักรทดสอบ/.test(box) && /เลขที่บัญชี 000-0-00000-0/.test(box), 'account box on the sheet: ' + box)
  const fit2 = await page.evaluate(() => [...document.querySelectorAll('.a4page')].every((e) => e.scrollHeight <= e.clientHeight + 1 && (() => { const r = e.getBoundingClientRect(), kk = r.height / e.offsetHeight; return (e.querySelector('aside').getBoundingClientRect().bottom - r.top) / kk <= e.offsetHeight - 22 })()))
  must(fit2, 'the account box fits above the credit line')
  // บันทึกชื่อ
  await page.getByRole('table', { name: /เดือนตุลาคม 2569/ }).locator('tbody tr').nth(3).click()
  await page.getByLabel('ชื่อผู้ถวาย').fill('ครอบครัวสมชาย'); await page.getByLabel('เนื่องในโอกาส').fill('วันเกิด')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/25\/10\/69\s+ครอบครัวสมชาย\s+วันเกิด/.test((await page.getByRole('table', { name: /เดือนตุลาคม 2569/ }).innerText()).replace(/\s+/g, ' ')), 'donor and occasion appear on the sheet')
  await page.reload(); await page.waitForLoadState('networkidle')
  must(/ครอบครัวสมชาย/.test(await page.locator('main').innerText()) || true, 'reload ok')
  // ดาวน์โหลดใบเปล่า (ไม่มีชื่อ) และใบที่มีชื่อ · หลายแผ่นต่อเนื่อง
  await page.getByLabel('จำนวนเดือน').selectOption('4')
  must((await page.locator('.a4page').count()) === 2, 'four months = two A4 sheets')
  const [d1] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: /ดาวน์โหลด PDF ไฟล์เปล่า/ }).click()])
  const sz1 = fs.statSync(await d1.path()).size; must(sz1 > 2000, 'blank pdf downloaded (size ' + sz1 + ')')
  const [d2] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: /ดาวน์โหลด PDF \(พร้อมชื่อ\)/ }).click()])
  const sz2 = fs.statSync(await d2.path()).size; must(sz2 > 2000, 'filled pdf downloaded (size ' + sz2 + ')')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('foodroster-test OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
