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
// สถานะ = ป๊อปอัพติ๊กได้หลายสถานะ: ล้างก่อน แล้วติ๊กตามชื่อที่ให้ ([] = ทุกสถานะ)
const setStatus = async (page, labels) => {
  await page.locator('#pf-status').click()
  const pop = page.getByRole('dialog', { name: 'สถานะ', exact: true })
  if (await pop.getByRole('button', { name: 'ล้าง' }).count()) await pop.getByRole('button', { name: 'ล้าง' }).click()
  for (const l of labels) await pop.getByRole('checkbox', { name: l }).check()
  await pop.getByRole('button', { name: 'เสร็จ' }).click()
}
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const now = new Date(), Y = now.getFullYear()
const sundays = Array.from({ length: 14 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() - ((d.getDay() + 7) % 7) - i * 7); return iso(d) }) // ใหม่ → เก่า
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/3`)
  await page.evaluate(([Y, sundays]) => {
    const st = ['1.สมบูรณ์  ( 1 )', '2.สมบูรณ์  ( 2 )', '3.สมาชิกสำรอง', '4.ผู้ร่วมนมัสการ', '5.คนใหม่', '7.เสียชีวิต']
    const grp = ['4.สตรี', '2.อนุชน', '5.บรุษ', '7.ไม่มีกลุ่ม', '1.เด็กรวี', '3.วัยทำงาน']
    const members = Array.from({ length: 24 }, (_, i) => ({
      id: `t${i}`, name: `ทดสอบ${i} สมมติ`, status: st[i % 6], gender: i % 5 === 4 ? undefined : i % 2 ? 'ชาย' : 'หญิง', group: grp[i % 6],
      since: `${2022 + (i % 4)}-03-01`, ...(i % 3 === 0 ? { birth: `${1950 + i * 2}-05-05` } : {}), updated: 1,
    }))
    localStorage.setItem('acct.church-members.v1', JSON.stringify(members))
    localStorage.setItem(`acct.attendance.${Y}.v1`, JSON.stringify(sundays.map((d, j) => ({ id: d, date: d, ids: members.filter((m, i) => i % 7 !== 6 && (i + j) % (i % 5 + 1) === 0).map((m) => m.id), updated: 1 }))))
  }, [Y, sundays])
  await page.goto(`http://localhost:${PORT}/#/meeting/4/1`); await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: /สมาชิก/, level: 1 }).waitFor({ timeout: 8000 })
  // โซน 2: ตัวเลขเป็นตัวอักษร 2 แถว (ไม่ใช่การ์ด) · โซน 3: รูปสมาชิกทันที ดูอย่างเดียว
  const counts = (await page.locator('.pcounts').innerText()).replace(/\s+/g, ' ')
  must(/รายชื่อทั้งหมด 24/.test(counts) && /สมาชิกสมบูรณ์ \(1\+2\) 8/.test(counts) && /สิ้นสภาพสมาชิก 0/.test(counts) && /เสียชีวิต 4/.test(counts), 'headline counts as text: ' + counts)
  must(await page.locator('.pkpi').count() === 0, 'no KPI cards')
  must(await page.locator('.pcard').count() === 24, 'zone 3 shows every member as a long card')
  must(await page.locator('.pcard a, .pcard button').count() === 0 && (await page.locator('.pcard').first().evaluate((e) => getComputedStyle(e).pointerEvents)) === 'none', 'faces are not clickable')
  const cards = await page.locator('.pcard').evaluateAll((els) => els.map((e) => ({ t: e.querySelector('.pcard__l2 b')?.textContent ?? '', abs: e.querySelector('.pcard__abs')?.textContent ?? '', color: e.querySelector('.pcard__abs') ? getComputedStyle(e.querySelector('.pcard__abs')).color : '', rows: e.querySelectorAll('.pcard__l1, .pcard__l2').length })))
  must(cards.length === 24 && cards.every((c) => c.rows === 2), 'every card has exactly two rows')
  const months = (t) => { const y = /(\d+) ปี/.exec(t), m = /(\d+) เดือน/.exec(t); return (y ? +y[1] * 12 : 0) + (m ? +m[1] : 0) }
  const ten = cards.map((c) => months(c.t))
  must(ten.every((v, i) => i === 0 || ten[i - 1] >= v) && ten[0] > ten[23], 'tab 1 default: longest-standing members first: ' + ten.join(','))
  must(cards.some((c) => c.abs && c.color === 'rgb(192, 38, 27)'), 'absence label is red: ' + JSON.stringify(cards.filter((c) => c.abs).slice(0, 3)))
  const tops = await page.locator('.pcard').evaluateAll((els) => els.slice(0, 5).map((e) => Math.round(e.getBoundingClientRect().top)))
  must(new Set(tops).size === 5, 'one card per row: ' + tops.join(','))
  const c0 = (await page.locator('.pcard').first().innerText()).replace(/\s+/g, ' ')
  must(/ทดสอบ\d+ สมมติ/.test(c0) && /สมาชิกมา/.test(c0) && /กลุ่ม /.test(c0) && /สมบูรณ์|สำรอง|นมัสการ|คนใหม่|สิ้นสภาพ|เสียชีวิต/.test(c0), 'card shows name, visits, status, group: ' + c0)
  await setStatus(page, ['สมาชิกสมบูรณ์'])
  must(await page.locator('.pcard').count() === 8, 'status option filters the faces')
  await setStatus(page, ['เสียชีวิต'])
  await page.waitForFunction(() => document.querySelectorAll('.pcard').length === 4)
  must(/เสียชีวิต/.test(await page.locator('.pcard').first().innerText()), 'deceased filter')
  await setStatus(page, ['สิ้นสภาพสมาชิก'])
  await page.waitForFunction(() => document.querySelectorAll('.pcard').length === 0)
  must(true, 'resigned filter is separate from deceased')
  await setStatus(page, ['สมาชิกสมบูรณ์', 'เสียชีวิต']) // เลือกหลายสถานะพร้อมกัน = รวมกัน
  await page.waitForFunction(() => document.querySelectorAll('.pcard').length === 12)
  must(await page.locator('#pf-status').innerText().then((t) => /สมาชิกสมบูรณ์, เสียชีวิต/.test(t)), 'multi-status filter shows both and lists the union (8 + 4)')
  await setStatus(page, [])
  await page.getByLabel('เรียงลำดับ').selectOption('name')
  const names = await page.locator('.pcard').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label')))
  must(JSON.stringify(names) === JSON.stringify([...names].sort((a, b) => a.localeCompare(b, 'th'))), 'name order applies to the faces')
  await page.getByLabel('เรียงลำดับ').selectOption('old')
  await page.locator('.pmore > summary').click() // การ์ดสรุปเดิมอยู่ในส่วนพับ
  for (const h of ['2 · สถานะสมาชิก', '3 · ช่วงวัยและเพศ', '4 · กลุ่มและปีที่เข้าเป็นสมาชิก', '5 · แผนที่บ้านสมาชิก']) must(await page.getByRole('heading', { name: h }).isVisible(), 'section ' + h)
  must(await page.locator('.pbar--btn').count() === 6, 'six status bars (สิ้นสภาพสมาชิก and เสียชีวิต are separate)')
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
  await page.locator('details.regtools').first().evaluate((el) => { el.open = true })
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
  await page.locator('.pmore > summary').click()
  await page.locator('.leafletbox').waitFor({ timeout: 8000 })
  must(await page.locator('.leafletbox').getAttribute('data-pins') === '1' && await page.locator('.leaflet-marker-icon').count() === 1, 'the recorded home appears as a pin on the map')
  must(/บันทึกพิกัดบ้านแล้ว 1 จาก 25 คน/.test(await page.locator('#pm-5').locator('xpath=..').innerText()), 'map summary')
  await page.screenshot({ path: '/tmp/pastoral-map.png' })
  // กรองสถานะที่ไม่มีหมุด → แผนที่หาย
  await page.locator('.pbar--btn', { hasText: 'สมาชิกสำรอง' }).click()
  must(/ยังไม่มีพิกัดบ้านของสมาชิก/.test(await page.locator('#pm-5').locator('xpath=..').innerText()), 'filter without pins shows the empty hint')
  const zt = page.getByRole('tablist', { name: 'แท็บสมาชิก' }).getByRole('tab')
  must(await zt.count() === 4 && await zt.first().getAttribute('aria-selected') === 'true', 'zone 1 has four numbered tabs, first selected')
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: 'shots/pastoral-zones.png', fullPage: false })
  // แท็บ 2: ความสม่ำเสมอ — เปอร์เซ็นต์การมา สูง → ต่ำ
  await setStatus(page, [])
  await zt.nth(1).click()
  must(/สม่ำเสมอ/.test(await zt.nth(1).innerText()) && await page.getByLabel('เรียงลำดับ').inputValue() === 'pct', 'tab 2 = consistency, default high → low')
  const pcts = (await page.locator('.pcard__pct').allInnerTexts()).map((t) => parseInt(t, 10))
  must(pcts.length === 25 && pcts.every((v, i) => i === 0 || pcts[i - 1] >= v), 'tab 2 sorted by attendance percentage: ' + pcts.join(','))
  await page.getByLabel('เรียงลำดับ').selectOption('pctAsc')
  const pcts2 = (await page.locator('.pcard__pct').allInnerTexts()).map((t) => parseInt(t, 10))
  must(pcts2.every((v, i) => i === 0 || pcts2[i - 1] <= v), 'tab 2 reversed')
  // แท็บ 3: สถานะ — นับแต่ละสถานะเรียงจากดีที่สุด
  await zt.nth(2).click()
  const sl = (await page.locator('.pstat li').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  must(sl.length >= 5 && /^1\./.test(sl[0]) && sl.reduce((a, t) => a + Number(/(\d+)\s*$/.exec(t)?.[1] ?? 0), 0) === 25, 'tab 3 status counts from best, total 25: ' + sl.join(' | '))
  must(await page.locator('.pstat__sec').count() === sl.length, 'a section per status')
  // แท็บ 4: เพศ
  await zt.nth(3).click()
  const big = (await page.locator('.psexbig__c b').allInnerTexts()).map(Number)
  must(big.length === 3 && big.reduce((a, b) => a + b, 0) === 25 && await page.getByRole('table', { name: 'เพศแยกตามสถานะ' }).isVisible(), 'tab 4 male/female/unknown counts add up: ' + big.join(','))
  await setStatus(page, ['สมาชิกสมบูรณ์'])
  must((await page.locator('.psexbig__c b').allInnerTexts()).map(Number).reduce((a, b) => a + b, 0) === 8, 'tab 4 follows the status filter')
  await zt.first().click()
  const links = await page.locator('main a, main button').evaluateAll((els) => els.filter((e) => !e.closest('.page-head')).map((e) => e.tagName === 'A' ? 'a:' + e.getAttribute('href') : '').filter(Boolean))
  must(links.length === 0, 'pastoral members page has no links out (registry/other works/external): ' + links.join(','))
  must(await page.locator('.leaflet-control-attribution a').count() === 0, 'map attribution is plain text, no outbound link')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('pastoral-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
