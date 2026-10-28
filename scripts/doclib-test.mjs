// งานเลขา › คลังเอกสาร: สร้างเอกสาร (ร่าง) → ออกเป็นเอกสารจริง (A4 แก้ไม่ได้) → ออกฉบับใหม่เก็บฉบับเก่า · หมวด ค้นหา เรียงเก่า→ใหม่ · PDF
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4202
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH', acceptDownloads: true })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const make = async (title, cat, date, kind, body) => {
  await page.getByRole('button', { name: /เอกสารใหม่/ }).click()
  await page.locator('#dd-title').fill(title); await page.locator('#dd-cat').fill(cat); await page.locator('#dd-date').fill(date)
  if (kind) await page.locator('#dd-kind').selectOption(kind)
  await page.locator('#dd-body').fill(body)
  await page.getByRole('button', { name: /บันทึกร่าง/ }).click()
  await page.getByText('บันทึกร่างแล้ว').waitFor()
}
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/1`); await page.waitForLoadState('networkidle')
  must(/คลังเอกสาร/.test(await page.locator('.tiletabs').innerText()), 'secretary tab 3 = คลังเอกสาร')
  await page.getByRole('link', { name: /คลังเอกสาร/ }).click()
  must(await page.getByText(/ยังไม่มีเอกสาร/).isVisible(), 'empty library')
  await make('เชิญประชุมกรรมการ ครั้งที่ 2', 'ประชุมกรรมการ', '2026-03-10', 'เชิญประชุม', 'วาระ 1 เรื่องแจ้งเพื่อทราบ')
  await page.getByRole('button', { name: /คลังเอกสาร/ }).first().click()
  await make('เชิญประชุมกรรมการ ครั้งที่ 1', 'ประชุมกรรมการ', '2026-01-05', 'เชิญประชุม', 'ฉบับแรก')
  // ใส่แบบฟอร์มตามประเภท
  await page.getByRole('button', { name: /ใส่แบบฟอร์ม/ }).click()
  must(/วาระการประชุม/.test(await page.locator('#dd-body').inputValue()), 'template inserted')
  await page.getByRole('button', { name: /บันทึกร่าง/ }).click()
  // ออกเป็นเอกสารจริง
  await page.getByRole('button', { name: /ออกเป็นเอกสารจริง/ }).click()
  await page.getByRole('region', { name: 'เอกสารจริง' }).waitFor()
  const a4 = (await page.locator('.a4page').first().innerText()).replace(/\s+/g, ' ')
  must(/ที่ 002\/2569|ที่ 001\/2569/.test(a4) && /เชิญประชุมกรรมการ ครั้งที่ 1/.test(a4) && /วาระการประชุม/.test(a4), 'A4 final shows number, title, body: ' + a4)
  must(/แก้ไขไม่ได้/.test(await page.getByRole('region', { name: 'เอกสารจริง' }).innerText() + await page.locator('main').innerText()), 'final is read-only evidence')
  // แก้ร่างแล้วออกฉบับใหม่ ฉบับเก่าเก็บไว้
  await page.getByRole('tab', { name: /ร่างเอกสาร/ }).click()
  await page.locator('#dd-body').fill('เนื้อหาแก้ไขฉบับที่ 2')
  await page.getByRole('button', { name: /ออกเป็นเอกสารจริง/ }).click()
  await page.getByLabel('ดูฉบับ').waitFor()
  must(/เนื้อหาแก้ไขฉบับที่ 2/.test(await page.locator('.a4page').first().innerText()), 'v2 shown')
  await page.getByLabel('ดูฉบับ').selectOption('1')
  must(/วาระการประชุม/.test(await page.locator('.a4page').first().innerText()), 'v1 kept as evidence')
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ดาวน์โหลด PDF/ }).click()])
  must(fs.statSync(await dl.path()).size > 3000, 'pdf downloaded')
  // รายการ: หมวด · เรียงเก่า→ใหม่ · ค้นหา
  await page.getByRole('button', { name: /คลังเอกสาร/ }).first().click()
  const items = await page.locator('.doclink b').allInnerTexts()
  must(items.join('|') === 'เชิญประชุมกรรมการ ครั้งที่ 1|เชิญประชุมกรรมการ ครั้งที่ 2', 'sorted old→new: ' + items.join('|'))
  must(await page.getByRole('region', { name: 'หมวด ประชุมกรรมการ' }).count() === 1, 'grouped by category')
  await page.locator('#dl-q').fill('ครั้งที่ 002')
  must(await page.locator('.doclink').count() === 1, 'search narrows to 1')
  await page.locator('#dl-q').fill('ไม่มีแน่นอน')
  must(await page.getByText('ไม่พบเอกสารที่ค้นหา').isVisible(), 'no match message')
  await page.screenshot({ path: 'shots/doclib.png' })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('doclib-test OK')
} finally { await browser.close(); server.kill() }
