// ปฏิทินงาน: งานเลขา > ตารางงาน = เดือน แบบ Google · แตะวันเพื่อเพิ่ม/แก้/ลบ · เลื่อนย้อนหลังได้ · แท็บอื่นบันทึกแล้วแสดงในปฏิทินรวมของงานเลขา
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4179
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const U = `http://localhost:${PORT}/#`
try {
  await page.goto(`${U}/meeting/1`)
  const cal = page.getByRole('region', { name: 'ปฏิทินงาน' })
  must(await cal.isVisible(), 'secretary → ตารางงาน shows the calendar')
  must((await cal.getByRole('columnheader').allInnerTexts()).join(',') === 'อา.,จ.,อ.,พ.,พฤ.,ศ.,ส.', 'week header starts on Sunday')
  const cells = await cal.getByRole('gridcell').count()
  must(cells === 35 || cells === 42 || cells === 28, 'whole weeks: ' + cells)
  // เพิ่มกิจกรรมในวันที่ 15 ของเดือนนี้ (ทั่วไป)
  await cal.getByRole('gridcell', { name: /^วัน\S+ที่ 15 / }).first().click()
  must(await page.getByText('ยังไม่มีกิจกรรมในวันนี้').isVisible(), 'day sheet opens empty')
  await page.getByLabel('ชื่อกิจกรรม').fill('ประชุมคณะกรรมการ'); await page.getByLabel('เวลา (ไม่บังคับ)').fill('18:30')
  await page.getByRole('button', { name: '＋ เพิ่ม' }).click()
  must(await page.getByText('ประชุมคณะกรรมการ').first().isVisible() && await page.getByText(/18:30/).first().isVisible(), 'event listed in the sheet')
  await page.getByRole('button', { name: 'ปิด' }).click()
  must(await cal.locator('.wcal__chip', { hasText: 'ประชุมคณะกรรมการ' }).count() === 1, 'chip shows on the day cell')
  await page.screenshot({ path: '/tmp/calendar.png' })
  // แก้ไข + ลบ
  await cal.getByRole('gridcell', { name: /^วัน\S+ที่ 15 / }).first().click()
  await page.getByRole('button', { name: 'แก้ไข ประชุมคณะกรรมการ' }).click()
  await page.getByLabel('ชื่อกิจกรรม').fill('ประชุมกรรมการ'); await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.getByRole('button', { name: 'ปิด' }).click()
  must(await cal.locator('.wcal__chip', { hasText: 'ประชุมกรรมการ' }).count() === 1, 'edit applies')
  // เลื่อนย้อนหลัง: เดือนก่อนหน้า ไม่มีชิป แล้วกลับ "วันนี้"
  await cal.getByRole('button', { name: 'เดือนก่อนหน้า' }).click()
  must(await cal.locator('.wcal__chip').count() === 0, 'previous month has none')
  await cal.getByRole('button', { name: 'เลือกเดือนและปี' }).click()
  await page.getByLabel('ปี', { exact: true }).selectOption({ index: 0 })
  await cal.getByRole('button', { name: 'วันนี้' }).click()
  must(await cal.locator('.wcal__chip', { hasText: 'ประชุมกรรมการ' }).count() === 1, 'วันนี้ returns to this month')
  // งานอื่น (งานอนุชน = แท็บ 9) บันทึกของตัวเอง → โผล่ในปฏิทินรวมของงานเลขา พร้อมสีและตัวกรอง
  await page.goto(`${U}/meeting/9`)
  const cal9 = page.getByRole('region', { name: 'ปฏิทินงาน' })
  must(await cal9.locator('.wcal__chip', { hasText: 'ประชุมกรรมการ' }).count() === 1 && await page.getByLabel('แสดง').count() === 0, 'tab 9 calendar sees the secretary events too (no filter)')
  await cal9.getByRole('gridcell', { name: /^วัน\S+ที่ 20 / }).first().click()
  await page.getByLabel('ชื่อกิจกรรม').fill('ประชุมอนุชน'); await page.getByRole('button', { name: '＋ เพิ่ม' }).click(); await page.getByRole('button', { name: 'ปิด' }).click()
  await page.goto(`${U}/meeting/4`)
  const cal4 = page.getByRole('region', { name: 'ปฏิทินงาน' })
  must(await cal4.locator('.wcal__chip', { hasText: 'ประชุมกรรมการ' }).count() === 1 && await cal4.locator('.wcal__chip', { hasText: 'ประชุมอนุชน' }).count() === 0, 'another work sees the secretary events but not the youth ones')
  // งานอนุชนบันทึกในนามงานเลขาได้ (สองทาง) · ตัวเลือกงานมีแค่ตัวเองกับงานเลขา
  await page.goto(`${U}/meeting/9`)
  await cal9.getByRole('gridcell', { name: /^วัน\S+ที่ 22 / }).first().click()
  must((await page.getByLabel('งาน', { exact: true }).locator('option').allInnerTexts()).join('|') === 'งานเลขา|งานอนุชน', 'owner options: secretary + itself')
  await page.getByLabel('ชื่อกิจกรรม').fill('นัดเลขาจากอนุชน'); await page.getByLabel('งาน', { exact: true }).selectOption({ label: 'งานเลขา' }); await page.getByRole('button', { name: '＋ เพิ่ม' }).click(); await page.getByRole('button', { name: 'ปิด' }).click()
  await page.goto(`${U}/meeting/1`)
  must(await cal.locator('.wcal__chip', { hasText: 'นัดเลขาจากอนุชน' }).count() === 1, 'event recorded from a work tab on behalf of the secretary shows in the secretary calendar')
  must(await cal.locator('.wcal__chip', { hasText: 'ประชุมอนุชน' }).count() === 1, 'youth event appears in the secretary calendar')
  must(await page.locator('.wcal__legend').innerText().then((t) => t.includes('งานอนุชน') && t.includes('งานเลขา')), 'legend names the works present')
  await page.getByLabel('แสดง').selectOption({ label: 'งานอนุชน' })
  must(await cal.locator('.wcal__chip').count() === 1, 'filter by work')
  await page.getByLabel('แสดง').selectOption('all')
  await page.goto(`${U}/meeting/1`); must(await cal.locator('.wcal__chip').count() === 3, 'persisted after reload')
  await cal.getByRole('gridcell', { name: /^วัน\S+ที่ 15 / }).first().click()
  await page.getByRole('button', { name: 'ลบ ประชุมกรรมการ' }).click()
  await page.getByRole('button', { name: 'ปิด' }).click()
  must(await cal.locator('.wcal__chip', { hasText: 'ประชุมกรรมการ' }).count() === 0, 'delete removes the event')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('calendar-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
