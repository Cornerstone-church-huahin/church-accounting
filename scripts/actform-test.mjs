// กองทุนโหมดกิจกรรม: การ์ดกิจกรรมก่อน (ใหม่อยู่บนสุด) · หมวดแยกตามกิจกรรม · โน้ตกิจกรรม · ปิดกิจกรรม + คะแนนประเมิน (การ์ดสีเทา) · ปิดแล้วบันทึกไม่ได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4193
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
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.evaluate(() => {
    localStorage.setItem('acct.types.v1', JSON.stringify([{ id: 'tt9', name: 'กองทุนศึกษา', order: 9, active: true, fund: true, updated: 9e15, actMode: true,
      activities: [{ id: 'a1', name: 'วันขอบคุณพระเจ้า', date: '2026-10-25' }, { id: 'a2', name: 'งานคริสต์มาส', date: '2026-12-24' }],
      subs: [{ id: 's1', name: 'ผัก ผลไม้', active: true, order: 1, actId: 'a1' }, { id: 's2', name: 'โต๊ะจีน', active: true, order: 2, actId: 'a1' }, { id: 's3', name: 'อาหาร', active: true, order: 3, actId: 'a2' }] }]))
  })
  await page.goto(`http://localhost:${PORT}/#/funds/tt9`); await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /กิจกรรม วันขอบคุณพระเจ้า/ }).click()
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(0).click()
  const opts = async (sel) => page.locator(sel + ' option').allInnerTexts()
  const acts = await opts('#ire-sub-act')
  must(acts.length === 2 && /วันขอบคุณพระเจ้า/.test(acts.join('|')) && /งานคริสต์มาส/.test(acts.join('|')), 'activity select lists the activity names: ' + acts.join('|'))
  must(JSON.stringify(await opts('#ire-sub')) === JSON.stringify(['ผัก ผลไม้', 'โต๊ะจีน']), 'categories are those of the selected activity: ' + (await opts('#ire-sub')).join('|'))
  await page.locator('#ire-sub-act').selectOption({ label: acts.find((x) => /คริสต์มาส/.test(x)) })
  must(JSON.stringify(await opts('#ire-sub')) === JSON.stringify(['อาหาร']), 'switching activity switches the categories: ' + (await opts('#ire-sub')).join('|'))
  await page.locator('#ire-sub-act').selectOption({ label: acts.find((x) => /ขอบคุณ/.test(x)) })
  await page.locator('#ire-sub').selectOption({ label: 'โต๊ะจีน' })
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('1000')
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(600)
  const inc = (await store('acct.income.')).filter((x) => x.typeId === 'tt9')
  must(inc.length === 1 && inc[0].subId === 's2' && inc[0].amount === 100000, 'saved under the chosen activity category (โต๊ะจีน): ' + JSON.stringify(inc))
  // เลือกกิจกรรมที่ยังไม่มีหมวดไม่ได้ → ต้องเพิ่มหมวดก่อน
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('actform-test OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
