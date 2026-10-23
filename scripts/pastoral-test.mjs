// งานอภิบาล › สมาชิก: 5 ส่วน อ่านอย่างเดียว (ตัวเลขสำคัญ · สถานะ · ช่วงวัย/เพศ · กลุ่ม/ปีที่เข้า · แผนที่บ้าน) · บันทึกพิกัดบ้านที่งานทะเบียนแล้วหมุดขึ้นบนแผนที่ (ข้อมูลสมมติเท่านั้น)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4183
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 412, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const now = new Date(), Y = now.getFullYear()
const sundays = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 7) % 7) - i * 7); return iso(d) }) // ใหม่ → เก่า
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.evaluate(([Y, sundays]) => {
    const st = ['1.สมบูรณ์  ( 1 )', '2.สมบูรณ์  ( 2 )', '3.สมาชิกสำรอง', '4.ผู้ร่วมนมัสการ', '5.คนใหม่', '7.เสียชีวิต']
    const grp = ['4.สตรี', '2.อนุชน', '5.บรุษ', '7.ไม่มีกลุ่ม', '1.เด็กรวี', '3.วัยทำงาน']
    const members = Array.from({ length: 24 }, (_, i) => ({
      id: `t${i}`, name: `ทดสอบ${i} สมมติ`, status: st[i % 6], gender: i % 5 === 4 ? undefined : i % 2 ? 'ชาย' : 'หญิง', group: grp[i % 6],
      since: `${2022 + (i % 4)}-03-01`, ...(i % 3 === 0 ? { birth: `${1950 + i * 2}-05-05` } : {}), updated: 1,
    }))
    localStorage.setItem('acct.church-members.v1', JSON.stringify(members))
  }, [Y, sundays])
  await page.goto(`http://localhost:${PORT}/#/meeting/4/1`); await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: /สมาชิก/, level: 1 }).waitFor({ timeout: 8000 })
  for (const h of ['1 · ตัวเลขสำคัญ', '2 · สถานะสมาชิก', '3 · ช่วงวัยและเพศ', '4 · กลุ่มและปีที่เข้าเป็นสมาชิก', '5 · แผนที่บ้านสมาชิก']) must(await page.getByRole('heading', { name: h }).isVisible(), 'section ' + h)
  const kpi = (await page.locator('.pkpi').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  must(kpi[0] === 'รายชื่อทั้งหมด 24' && kpi[1].includes('สมาชิกสมบูรณ์ (1+2) 8') && kpi.length === 6, 'headline numbers: ' + kpi.join(' | '))
  must(await page.locator('.pbar--btn').count() === 5, 'five status bars')
  must(await page.locator('.pbar[role=img]').count() >= 5, 'age/group bars are shown')
  must(/ทราบวันเกิด 8 จาก 24 คน/.test(await page.locator('#pm-3').locator('xpath=..').innerText()), 'birth coverage note')
  await page.screenshot({ path: '/tmp/pastoral-full.png', fullPage: true })
  // กรองสถานะ: สมาชิกสมบูรณ์ → ส่วน 3–5 อิงเฉพาะกลุ่มนั้น
  await page.locator('.pbar--btn', { hasText: 'สมาชิกสมบูรณ์' }).click()
  must(/กำลังดูเฉพาะ สมาชิกสมบูรณ์ \(8 คน\)/.test(await page.locator('#pm-2').locator('xpath=..').innerText()), 'status filter applies')
  must(/ทราบวันเกิด \d+ จาก 8 คน/.test(await page.locator('#pm-3').locator('xpath=..').innerText()), 'age section follows the filter')
  await page.getByRole('button', { name: 'ดูทุกสถานะ' }).click()
  // ไม่มีส่วนการติดตามในหน้านี้ (แยกเป็นไอคอนต่อไป)
  must(!/ควรติดตาม/.test(await page.locator('main').innerText()), 'no follow-up list on the read-only members page')
  must(/ยังไม่มีพิกัดบ้านของสมาชิก/.test(await page.locator('#pm-5').locator('xpath=..').innerText()) && await page.locator('.leafletbox').count() === 0, 'map section is empty until coordinates are recorded')
  // บันทึกพิกัดบ้านที่งานทะเบียน (เพิ่มสมาชิกใหม่พร้อมพิกัด) → หมุดขึ้นที่หน้าสมาชิกของอภิบาล
  await page.goto(`http://localhost:${PORT}/#/meeting/2`)
  await page.getByRole('tab', { name: /ทะเบียน/ }).first().click()
  await page.getByRole('button', { name: '＋ เพิ่มสมาชิก' }).click()
  await page.getByLabel('ชื่อ-สกุล').fill('บ้านมีพิกัด ทดสอบ')
  await page.getByLabel(/พิกัดบ้าน/).fill('หัวหิน')
  await page.getByRole('dialog').getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/พิกัดบ้านอ่านไม่ได้/.test(await page.getByRole('alert').innerText()), 'bad coordinate text is rejected')
  await page.getByLabel(/พิกัดบ้าน/).fill('https://www.google.com/maps/place/x/@12.5684,99.9577,17z')
  must(/บันทึกพิกัด 12\.568400, 99\.957700/.test(await page.getByRole('dialog').innerText()), 'Google Maps link is parsed')
  await page.getByRole('button', { name: /เลือกบนแผนที่/ }).click()
  await page.locator('.leafletbox').waitFor({ timeout: 8000 })
  must(await page.locator('.leaflet-marker-icon').count() === 1, 'picker map shows the pin')
  await page.getByRole('dialog').getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.getByRole('button', { name: '‹ เมนูสมาชิก' }).click().catch(() => undefined)
  await page.goto(`http://localhost:${PORT}/#/meeting/4/1`)
  await page.locator('.leafletbox').waitFor({ timeout: 8000 })
  must(await page.locator('.leafletbox').getAttribute('data-pins') === '1' && await page.locator('.leaflet-marker-icon').count() === 1, 'the recorded home appears as a pin on the map')
  must(/บันทึกพิกัดบ้านแล้ว 1 จาก 25 คน/.test(await page.locator('#pm-5').locator('xpath=..').innerText()), 'map summary')
  await page.screenshot({ path: '/tmp/pastoral-map.png' })
  // กรองสถานะที่ไม่มีหมุด → แผนที่หาย
  await page.locator('.pbar--btn', { hasText: 'สมาชิกสำรอง' }).click()
  must(/ยังไม่มีพิกัดบ้านของสมาชิก/.test(await page.locator('#pm-5').locator('xpath=..').innerText()), 'filter without pins shows the empty hint')
  const links = await page.locator('main a, main button').evaluateAll((els) => els.filter((e) => !e.closest('.page-head')).map((e) => e.tagName === 'A' ? 'a:' + e.getAttribute('href') : '').filter(Boolean))
  must(links.length === 0, 'pastoral members page has no links out (registry/other works/external): ' + links.join(','))
  must(await page.locator('.leaflet-control-attribution a').count() === 0, 'map attribution is plain text, no outbound link')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('pastoral-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
