// กระดิ่งข่าวจากแอดมิน: แอดมินส่งข่าวถึงงาน → กระดิ่งของงานนั้นเป็นสีแดงมีตัวเลข → เปิดอ่านแล้วกลับเป็นกระดิ่งธรรมดา · งานอื่นไม่ได้รับ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4188
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await page.getByRole('button', { name: 'ส่งข่าวถึงแต่ละงาน' }).click()
  const panel = page.getByRole('region', { name: 'ส่งข่าวถึงแต่ละงาน' })
  await panel.getByRole('button', { name: 'ส่งข่าว' }).click()
  must(/พิมพ์ข้อความก่อนส่ง/.test(await panel.innerText()), 'needs text')
  await panel.getByLabel('ข้อความ').fill('ประชุมกรรมการวันอาทิตย์หน้า')
  await panel.getByRole('button', { name: 'ส่งข่าว' }).click()
  must(/เลือกงานที่จะส่งถึง/.test(await panel.innerText()), 'needs a target')
  await panel.getByLabel('งานสุสาน').check()
  await panel.getByRole('button', { name: 'ส่งข่าว' }).click()
  must(/ประชุมกรรมการวันอาทิตย์หน้า/.test(await panel.locator('.bellpanel__list').innerText()) && /งานสุสาน/.test(await panel.locator('.bellpanel__list').innerText()), 'sent message listed with its target')
  // งานสุสาน (5): กระดิ่งแดง
  await page.goto(`http://localhost:${PORT}/#/meeting/5`)
  const bell = page.getByRole('button', { name: /ข่าวจากแอดมิน/ })
  must(/มีข้อความใหม่ 1/.test(await bell.getAttribute('aria-label')) && await page.locator('.bellbtn--new').count() === 1, 'work 5 bell is red with 1 new')
  await bell.click()
  must(/ประชุมกรรมการวันอาทิตย์หน้า/.test(await page.getByRole('region', { name: 'ข่าวจากแอดมิน' }).innerText()) && /ใหม่/.test(await page.locator('.bellpanel__list li.new').innerText()), 'opening shows the message marked new')
  await page.screenshot({ path: 'shots/bell-open.png' })
  await bell.click()
  must(await page.locator('.bellbtn--new').count() === 0 && !/ใหม่/.test(await bell.getAttribute('aria-label')), 'after reading the bell is normal')
  await page.reload(); await page.waitForLoadState('networkidle')
  must(await page.locator('.bellbtn--new').count() === 0, 'stays read after reload')
  // ข่าวที่อ่านแล้ว = แท็บเล็ก ๆ มีหัวข้อ · แตะเปิดอ่านซ้ำ/พับ · ปุ่ม ✕ ปิดแผง
  await page.getByRole('button', { name: /ข่าวจากแอดมิน/ }).click()
  const reg = page.getByRole('region', { name: 'ข่าวจากแอดมิน' })
  must(await reg.locator('li.bellpanel__chip').count() === 1 && await reg.locator('li.new').count() === 0, 'read news collapses to a small chip')
  must(/ประชุมกรรมการวันอาทิตย์หน้า/.test(await reg.locator('li.bellpanel__chip').innerText()), 'chip keeps the headline')
  await reg.getByRole('button', { name: /เปิดข่าวที่อ่านแล้ว/ }).click()
  must(await reg.locator('li.bellpanel__open').count() === 1 && await page.locator('.bellbtn--new').count() === 0, 'tapping the chip reopens it; bell stays calm')
  await reg.getByRole('button', { name: /พับข่าว/ }).click()
  must(await reg.locator('li.bellpanel__chip').count() === 1, 'fold back to chip')
  await reg.getByRole('button', { name: 'ปิดข่าว', exact: true }).click()
  must(await page.getByRole('region', { name: 'ข่าวจากแอดมิน' }).count() === 0, '✕ closes the panel')
  // งานอื่น ไม่ได้รับ
  await page.goto(`http://localhost:${PORT}/#/meeting/6`)
  must(await page.locator('.bellbtn--new').count() === 0, 'other works get nothing')
  // ส่งถึงทุกงาน
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await page.getByRole('button', { name: 'ส่งข่าวถึงแต่ละงาน' }).click()
  await panel.getByLabel('ข้อความ').fill('ขอบคุณทุกงาน')
  await panel.getByLabel('ทุกงาน').check()
  await panel.getByRole('button', { name: 'ส่งข่าว' }).click()
  for (const n of [6, 3]) { await page.goto(`http://localhost:${PORT}/#/meeting/${n}`); must(await page.locator('.bellbtn--new').count() === 1, `work ${n} gets the all-works news`) }
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('announce-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
