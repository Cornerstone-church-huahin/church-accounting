// กองทุนโหมดกิจกรรม: การ์ดกิจกรรมก่อน (ใหม่อยู่บนสุด) · หมวดแยกตามกิจกรรม · โน้ตกิจกรรม · ปิดกิจกรรม + คะแนนประเมิน (การ์ดสีเทา) · ปิดแล้วบันทึกไม่ได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4207
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = [], dialogs = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept() })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const store = (prefix) => page.evaluate((p) => Object.keys(localStorage).filter((k) => k.startsWith(p) && !k.endsWith('.epoch')).flatMap((k) => JSON.parse(localStorage.getItem(k))), prefix)
const addIncome = async (amt) => {
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(0).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill(String(amt))
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(600)
}
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt9`); await page.waitForLoadState('networkidle')
  for (const n of ['พืชผัก', 'โต๊ะจีน']) { await page.getByLabel('ชื่อหมวดใหม่').fill(n); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click() }
  await addIncome(1000) // รายการเดิมในหมวด (ก่อนเปิดโหมดกิจกรรม)
  // เปิดโหมดกิจกรรม: หมวดเดิมย้ายเข้ากิจกรรมแรก
  await page.getByRole('button', { name: /แบ่งเป็นกิจกรรม/ }).click()
  await page.getByLabel('ชื่อกิจกรรมแรก').fill('วันขอบคุณพระเจ้า')
  await page.getByLabel('วันที่เริ่มกิจกรรมแรก').fill('2026-10-25')
  await page.getByRole('button', { name: 'เปิดโหมดกิจกรรม' }).click()
  await page.waitForTimeout(500)
  must(await page.getByRole('list', { name: 'กิจกรรมของกองทุน' }).count() === 1 && await page.getByRole('tablist', { name: /กองทุนนี้: รับ จ่าย/ }).count() === 0, 'activity cards come first (no tabs yet)')
  must(/10\.00|1,000/.test(await page.getByRole('button', { name: /กิจกรรม วันขอบคุณพระเจ้า/ }).innerText()), 'first activity card carries the existing money')
  // เพิ่มกิจกรรมที่สอง: ใหม่อยู่บนสุด
  await page.getByText('＋ เพิ่มกิจกรรมใหม่').click()
  await page.getByLabel('ชื่อกิจกรรมใหม่').fill('งานคริสต์มาส'); await page.getByLabel('วันที่เริ่มกิจกรรม').fill('2026-12-24'); await page.getByLabel('วันที่สิ้นสุดกิจกรรม').fill('2026-12-26')
  await page.getByRole('button', { name: 'เพิ่มกิจกรรม' }).click()
  await page.getByLabel('ชื่อกิจกรรมใหม่').fill('งานที่จบไปแล้ว'); await page.getByLabel('วันที่เริ่มกิจกรรม').fill('2026-01-10'); await page.getByLabel('วันที่สิ้นสุดกิจกรรม').fill('2026-01-11')
  await page.getByRole('button', { name: 'เพิ่มกิจกรรม' }).click()
  const names = await page.locator('.actcard__name').allInnerTexts()
  must(names[0] === 'งานคริสต์มาส' && names.includes('วันขอบคุณพระเจ้า') && names.at(-1) === 'งานที่จบไปแล้ว', 'newest activity on top: ' + names)
  must(/24 ธ.ค. 69 – 26 ธ.ค. 69 · 3 วัน/.test(await page.getByRole('button', { name: 'กิจกรรม งานคริสต์มาส' }).innerText()), 'card shows start–end and the number of days')
  must(await page.getByRole('button', { name: /กิจกรรม งานที่จบไปแล้ว \(สิ้นสุดแล้ว\)/ }).count() === 1, 'an activity past its end date is shown as ended (grey card)')
  // เข้ากิจกรรมคริสต์มาส: หมวดของกิจกรรมนี้แยกจากกิจกรรมอื่น
  await page.getByRole('button', { name: 'กิจกรรม งานคริสต์มาส' }).click()
  must(await page.getByRole('region', { name: /กิจกรรม งานคริสต์มาส/ }).first().innerText().then((t) => /เริ่มกิจกรรม/.test(t)), 'activity header with the start date')
  must(await page.getByText(/กิจกรรมนี้ยังไม่มีหมวด/).count() === 1, 'a new activity has no categories yet')
  await page.getByLabel('ชื่อหมวดใหม่').fill('อาหาร'); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click()
  must(!/พืชผัก|โต๊ะจีน/.test(await page.getByRole('region', { name: 'หมวดของกองทุน' }).innerText()), 'categories of other activities are not shown here')
  // ความคืบหน้า: โน้ตกิจกรรม + เป้าหมายของงาน
  must(await page.getByRole('tablist', { name: 'หมวดงานของกิจกรรม' }).getByRole('tab').allInnerTexts().then((t) => t.join('|').includes('ระบบบัญชี') && t.join('|').includes('ความคืบหน้า') && t.join('|').includes('ประเมินผล')), 'three tabs at the top of an activity')
  await page.getByRole('tab', { name: /ความคืบหน้า/ }).click()
  await page.getByRole('button', { name: /แก้โน้ตกิจกรรม/ }).click()
  await page.locator('#an-purpose').fill('ฉลองคริสต์มาสร่วมกัน'); await page.locator('#an-committee').fill('พี่ก พี่ข')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/ฉลองคริสต์มาสร่วมกัน/.test(await page.getByRole('region', { name: 'โน้ตกิจกรรม' }).innerText()), 'purpose note saved')
  for (const g of ['จองสถานที่', 'เตรียมอาหาร']) { await page.getByLabel('เป้าหมายใหม่').fill(g); await page.getByRole('button', { name: '＋ เพิ่ม', exact: true }).click() }
  await page.getByRole('checkbox').first().check()
  must(/ทำแล้ว 1 จาก 2/.test(await page.getByRole('region', { name: 'เป้าหมายของงาน' }).innerText()), 'goal progress 1 of 2')
  await page.getByRole('tab', { name: /ระบบบัญชี/ }).click()
  await addIncome(700)
  const opts = await page.evaluate(() => 0)
  void opts
  const inc = (await store('acct.income.')).filter((x) => x.typeId === 'tt9' && x.amount === 70000)
  must(inc.length === 1 && inc[0].subId, 'income saved in the activity category')
  // ประเมินผล + ปิดกิจกรรม
  await page.getByRole('tab', { name: /ประเมินผล/ }).click()
  await page.locator('#ev-score').fill('85'); await page.locator('#ev-pros').fill('คนมาร่วมมาก'); await page.locator('#ev-cons').fill('ที่จอดรถไม่พอ'); await page.locator('#ev-sum').fill('ภาพรวมดี')
  await page.getByRole('button', { name: 'บันทึกการประเมิน' }).click()
  await page.getByRole('button', { name: '✔ ปิดกิจกรรม' }).click()
  must(await page.getByRole('meter').count() >= 1, 'satisfaction gauge on the evaluation tab')
  await page.getByRole('tab', { name: /ระบบบัญชี/ }).click()
  dialogs.length = 0
  // แถวที่ 1 มีรายการแล้ว → แถวว่างแถวถัดไป (แถวที่ 2)
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(1).click()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('300')
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(600)
  must(dialogs.some((d) => /ปิดแล้ว/.test(d)) && (await store('acct.income.')).filter((x) => x.typeId === 'tt9' && x.amount === 30000).length === 0, 'closed activity refuses new entries: ' + dialogs.join('|'))
  await page.locator('.sheet').getByRole('button', { name: 'ปิด' }).click().catch(() => {})
  await page.getByRole('button', { name: '‹ ทุกกิจกรรม' }).click()
  const xm = page.getByRole('button', { name: 'กิจกรรม งานคริสต์มาส (ปิดแล้ว)' })
  must(await xm.count() === 1 && /actcard--closed/.test(await xm.getAttribute('class')), 'a closed activity is a grey card')
  const ct = await xm.innerText()
  must(await xm.getByRole('meter', { name: /ความพึงพอใจ 85/ }).count() === 1 && /ภาพรวมดี/.test(ct) && /เป้าหมาย 1\/2/.test(ct), 'closed card shows the 0-100 satisfaction gauge, the summary and the goal progress: ' + ct)
  // เปิดกิจกรรมอีกครั้ง
  await page.getByRole('button', { name: /กิจกรรม งานคริสต์มาส/ }).click()
  await page.getByRole('tab', { name: /ประเมินผล/ }).click()
  await page.getByRole('button', { name: /เปิดกิจกรรมอีกครั้ง/ }).click()
  await page.getByRole('button', { name: '‹ ทุกกิจกรรม' }).click()
  must(/actcard--open/.test(await page.getByRole('button', { name: 'กิจกรรม งานคริสต์มาส' }).getAttribute('class')), 'a reopened activity (end date in the future) is blue again')
  // รายงานพิมพ์/PDF/แชร์ของแต่ละขั้นตอน + เครดิตผู้พัฒนา
  await page.getByRole('button', { name: /กิจกรรม งานคริสต์มาส/ }).click()
  for (const [tab, btn, title] of [[/ระบบบัญชี/, /รายงานบัญชีกิจกรรม/, 'รายงานบัญชีกิจกรรม'], [/ความคืบหน้า/, /รายงานความคืบหน้า/, 'รายงานความคืบหน้ากิจกรรม'], [/ประเมินผล/, /รายงานการประเมินผล/, 'รายงานการประเมินผลกิจกรรม']]) {
    await page.getByRole('tab', { name: tab }).click()
    await page.getByRole('button', { name: btn }).click()
    const t = (await page.locator('.a4page').allInnerTexts()).join('\n')
    must(t.includes(title) && /งานคริสต์มาส/.test(t) && /ออกแบบและพัฒนาโดย มน\.สมเจต เสมาทอง/.test(t) && /อนุกรรมการผู้รับผิดชอบกิจกรรม/.test(t), `${title}: A4 report with signatures and the developer credit: ` + t.slice(0, 160))
    await page.getByRole('button', { name: '‹ กลับ' }).click()
  }
  await page.getByRole('button', { name: /รายงานสรุปกิจกรรม/ }).click()
  await page.evaluate(() => { window.__shared = null; navigator.canShare = () => true; navigator.share = async (d) => { window.__shared = { n: d.files.length, type: d.files[0].type, size: d.files[0].size } } })
  await page.getByRole('button', { name: 'แชร์รายงานกิจกรรมเป็น PDF' }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 60000 })
  const sh = await page.evaluate(() => window.__shared)
  must(sh.type === 'application/pdf' && sh.size > 1000, 'the combined report is shared as a PDF: ' + JSON.stringify(sh))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundact-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
