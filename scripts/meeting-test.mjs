// โหมดประชุม: ไอคอนบนแถบหัวแอป → แท็บ 1–6 (ว่าง) → แต่ละแท็บเปิดหน้าว่าง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  must((await page.getByRole('link', { name: 'โหมดประชุม', exact: true }).count()) === 0 && (await page.getByRole('link', { name: 'ลงชื่อนมัสการ' }).count()) === 0, 'top bar has no meeting / members icons')
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('link', { name: /ห้องทำงาน/ }).click()
  const tiles = page.locator('nav[aria-label^="โหมดประชุม"] a.btile')
  must((await tiles.count()) === 12, 'twelve tabs: ' + await tiles.count())
  const texts = await tiles.allInnerTexts()
  must(['งานเลขา', 'งานทะเบียน', 'งานเหรัญญิก', 'งานอภิบาล', 'งานสุสาน', 'งานนมัสการ', 'งานต่างชาติ', 'งานรวี', 'งานอนุชน', 'งานสตรี'].every((n, i) => texts[i].includes(n)), 'tab names: ' + texts.join('|'))
  await page.screenshot({ path: '/tmp/meeting.png' })
  // งานเหรัญญิก = หน้าแรกบัญชีเต็ม ใช้งานได้จริง
  await tiles.nth(2).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).count() === 0, 'treasurer page is untouched; calendar is collapsed')
  must(await page.getByText('ขั้นตอนทำบัญชีประจำสัปดาห์').isVisible() && await page.locator('.balance-tiles .btile').count() === 6, 'treasurer tab shows the whole home page')
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).isVisible(), '📅 button at the top opens the calendar')
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  await page.getByRole('tab', { name: /รับ/ }).first().click()
  must(await page.getByText('ดาวน์โหลด PDF ไฟล์เปล่า').first().isVisible(), 'income step works inside the tab (sheet + download buttons)')
  // ปุ่มห้องทำงานบนหน้าแรก
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('link', { name: /ห้องทำงาน/ }).click()
  must((await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').count()) === 12, 'หน้าแรก › ห้องทำงาน opens the meeting page with the tabs')
  await page.goto(`http://localhost:${PORT}/#/balance/spare`); await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').first().waitFor({ timeout: 5000 }); must((await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').count()) === 12, 'old spare route also lands on the meeting page')
  await tiles.nth(2).click()
  // งานทะเบียน = หน้าสมาชิกเต็ม (เปิดที่ ลงชื่อ)
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await tiles.nth(1).click()
  await page.getByRole('tab', { name: /ตรวจสอบ/ }).first().waitFor({ timeout: 8000 })
  for (const t of ['ตรวจสอบ', 'ยอดผู้มา', 'ลงชื่อ', 'ทะเบียน', 'วันเกิด', 'เพศ']) must(await page.getByRole('tab', { name: new RegExp(t) }).first().isVisible(), 'registry tab ' + t)
  must(await page.getByText('ลงชื่อวันนี้แล้ว').first().isVisible(), 'check-in panel opens by default')
  await page.getByRole('tab', { name: /ทะเบียน/ }).click()
  must((await page.locator('.kpi').count()) > 0 || (await page.getByText(/ยังไม่มีสมาชิก/).count()) > 0, 'registry tab works inside งานทะเบียน')
  // แท็บอื่นยังว่าง
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await tiles.nth(0).click()
  must(await page.getByRole('heading', { name: 'งานเลขา', exact: true }).isVisible(), 'secretary heading has no "โหมดประชุม" prefix')
  must(await page.getByRole('heading', { name: 'งานเลขา', exact: true }).isVisible(), 'secretary heading has no "โหมดประชุม" prefix')
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).count() === 0 && await page.getByRole('button', { name: /ตารางงาน/ }).isVisible(), '📅 ตารางงาน button on top, collapsed')
  const sec = await page.getByRole('tablist', { name: 'หมวดงานเลขา' }).getByRole('tab').allInnerTexts()
  must(sec.map((x) => x.replace(/^\S+\s+/, '').trim()).join('|') === 'การประชุม|แท็บ 2|แท็บ 3|แท็บ 4|แท็บ 5|แท็บ 6', 'six secretary tabs: ' + sec.join('|'))
  await page.getByRole('tab', { name: 'แท็บ 5' }).click()
  must(/แท็บ 5 — ยังว่าง/.test(await page.locator('main').innerText()), 'tab content is empty for now')
  // งานอื่น: ปุ่มตารางงานบนสุด + แท็บ 1–6 ว่าง · ปุ่มตารางงานเปิดปฏิทินได้
  await page.goto(`http://localhost:${PORT}/#/meeting`); await tiles.nth(3).click()
  const tabs4 = await page.getByRole('tablist', { name: 'หมวดงานอภิบาล' }).getByRole('tab').allInnerTexts()
  must(tabs4.map((x) => x.replace(/^\S+\s+/, '').trim()).join('|') === 'แท็บ 1|แท็บ 2|แท็บ 3|แท็บ 4|แท็บ 5|แท็บ 6', 'six generic tabs: ' + tabs4.join('|'))
  must(await page.locator('.tiletabs button.btile').count() === 6, 'tabs are colored tiles like the home money tiles')
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).isVisible(), 'other work tabs open their own calendar from the top button')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('meeting-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
