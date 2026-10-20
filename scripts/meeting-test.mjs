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
  const ico = page.getByRole('link', { name: 'โหมดประชุม' })
  must(await ico.isVisible(), 'meeting icon in the top bar')
  const members = await page.getByRole('link', { name: 'ลงชื่อนมัสการ' }).boundingBox(), mb = await ico.boundingBox()
  must(mb.x + mb.width <= members.x + 1, 'meeting icon sits to the left of the members icon')
  await ico.click()
  const tiles = page.locator('nav[aria-label^="โหมดประชุม"] a.btile')
  must((await tiles.count()) === 6, 'six tabs: ' + await tiles.count())
  const texts = await tiles.allInnerTexts()
  must(['งานเลขา', 'งานทะเบียน', 'งานเหรัญญิก', 'งานอภิบาล', 'งานสุสาน'].every((n, i) => texts[i].includes(n)), 'tab names: ' + texts.join('|'))
  await page.screenshot({ path: '/tmp/meeting.png' })
  await tiles.nth(2).click()
  must(/งานเหรัญญิก — ยังว่าง/.test(await page.locator('main').innerText()), 'tab 3 is an empty page')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('meeting-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
