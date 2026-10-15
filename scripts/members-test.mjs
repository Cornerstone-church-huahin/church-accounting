// ทะเบียนสมาชิก: ตรวจคุณสมบัติ · ลงชื่อนมัสการ · นำเข้า CSV · กำหนดผลตรวจเอง (ข้อมูลสมมติ) — npm run build && node scripts/members-test.mjs [โฟลเดอร์เก็บภาพหน้าจอ]
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4187
const shots = process.argv[2]
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const snap = async (n) => shots && page.screenshot({ path: `${shots}/${n}.png`, fullPage: true })
const iso = (d) => d.toISOString().slice(0, 10)
try {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    const sundays = []
    const d = new Date(); d.setDate(d.getDate() - d.getDay())
    for (let i = 0; i < 40; i++) { sundays.push(d.toISOString().slice(0, 10)); d.setDate(d.getDate() - 7) }
    const mk = (id, name, extra) => ({ id, name, updated: 1, status: 'สมาชิกสมบูรณ์', ...extra })
    const people = [
      mk('m1', 'นายสมชาย ตัวอย่าง', { nick: 'ชาย', code: '001', group: 'ผู้ใหญ่', since: '2005-03-06' }),
      mk('m2', 'นางสมหญิง ทดสอบ', { nick: 'หญิง', code: '002', group: 'ผู้ใหญ่', since: '2010-01-03' }),
      mk('m3', 'นายสมศักดิ์ ขาดไป', { code: '003', group: 'ผู้ใหญ่', since: '2012-05-06' }),
      mk('m4', 'นางสาวใหม่ เพิ่งมา', { code: '004', group: 'เยาวชน', since: iso(new Date(Date.now() - 90 * 864e5)) }),
      mk('m5', 'นายผู้ล่วงลับ ตัวอย่าง', { code: '005', status: 'เสียชีวิต', since: '1999-01-03' }),
    ]
    function iso(x) { return x.toISOString().slice(0, 10) }
    localStorage.setItem('acct.church-members.v1', JSON.stringify(people))
    const att = {}
    const add = (date, ...ids) => { const y = date.slice(0, 4); (att[y] ??= []).push({ id: date, date, ids, updated: 1 }) }
    sundays.forEach((s, i) => { add(s, ...['m1', ...(i % 2 ? ['m2'] : []), ...(i < 10 ? ['m4'] : []), ...(i > 30 ? ['m3'] : [])]) })
    for (const [y, rows] of Object.entries(att)) localStorage.setItem(`acct.attendance.${y}.v1`, JSON.stringify(rows))
  })
  await page.goto(`http://localhost:${PORT}/#/members`); await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: 'สมาชิก' }).waitFor()
  const body = () => page.locator('main, body').first().innerText()
  let t = await body()
  must(/สมบูรณ์ 1\s*\n?\s*2/.test(t) || t.includes('สมาชิกสมบูรณ์ 1'), 'audit summary renders')
  const row = (n) => page.locator('li', { hasText: n })
  must((await row('สมชาย').innerText()).includes('สมาชิกสมบูรณ์ 1'), 'regular attender is complete-1')
  must((await row('สมศักดิ์').innerText()).includes('สมาชิกสมบูรณ์ 2'), 'long-absent member is complete-2')
  must((await row('เพิ่งมา').innerText()).includes('ยังไม่ครบเกณฑ์'), 'new member under 1 year is pending')
  must((await row('ผู้ล่วงลับ').innerText()).includes('เสียชีวิต'), 'deceased status → deceased tier')
  await snap('1-audit')
  // กำหนดผลตรวจเอง
  await row('สมศักดิ์').getByRole('button', { name: /สมาชิกสมบูรณ์ 2/ }).click()
  await page.getByRole('menuitem', { name: 'ลาออก' }).click()
  must((await row('สมศักดิ์').innerText()).includes('ลาออก'), 'override applies')
  await page.reload(); await page.waitForLoadState('networkidle')
  must((await row('สมศักดิ์').innerText()).includes('ลาออก'), 'override persists')
  // กรอง
  await page.getByLabel('กรองตามผลตรวจ').selectOption('0')
  must(await page.locator('li', { hasText: 'สมหญิง' }).count() === 1 && await page.locator('li', { hasText: 'สมศักดิ์' }).count() === 0, 'filter by tier')
  // ลงชื่อนมัสการ
  await page.getByRole('tab', { name: 'ลงชื่อนมัสการ' }).click()
  const cb = page.getByRole('checkbox')
  must(await cb.count() === 3, 'check-in lists living, non-overridden members only: ' + await cb.count())
  await page.getByRole('checkbox').nth(0).check()
  await page.getByRole('button', { name: 'บันทึกการลงชื่อ' }).click()
  must(await page.getByRole('status').filter({ hasText: /บันทึกแล้ว/ }).count() === 1, 'check-in saved')
  await snap('2-checkin')
  // ทะเบียน + นำเข้า
  await page.getByRole('tab', { name: 'ทะเบียน' }).click()
  fs.writeFileSync('/tmp/members-demo.csv', 'ชื่อ-สกุล,ชื่อเล่น,รหัส,กลุ่ม,สถานะ,เข้าเป็นสมาชิก\nนางนำเข้า สมมติ,นำ,101,ผู้ใหญ่,สมาชิกสมบูรณ์,1/1/2560\nนายสมชาย ตัวอย่าง,ชาย,001,ผู้ใหญ่,สมาชิกสมบูรณ์,6/3/2548\n')
  await page.locator('input[aria-label="ไฟล์รายชื่อ"]').setInputFiles('/tmp/members-demo.csv')
  await page.getByRole('status').filter({ hasText: 'เพิ่มใหม่ 1 · อัปเดตคนเดิม 1' }).waitFor({ timeout: 5000 })
  must(await page.locator('li', { hasText: 'สมชาย' }).count() === 1, 'reimport does not duplicate')
  // นำเข้าจำนวนมาก (รวมชื่อซ้ำ) ต้องไม่มีใครหายหรือซ้ำเมื่อนำเข้าอีกรอบ
  const big = ['ชื่อ-สกุล,รหัส'].concat(Array.from({ length: 600 }, (_, i) => `คนทดสอบ ${i % 599},${i < 300 ? 2000 + i : ''}`)).join('\n')
  fs.writeFileSync('/tmp/members-big.csv', big)
  for (let k = 0; k < 2; k++) {
    await page.locator('input[aria-label="ไฟล์รายชื่อ"]').setInputFiles('/tmp/members-big.csv')
    await page.getByRole('status').filter({ hasText: k ? 'เพิ่มใหม่ 0 · อัปเดตคนเดิม 600' : 'เพิ่มใหม่ 600' }).waitFor({ timeout: 15000 })
  }
  must(await page.locator('section.card li').count() === 606, 'bulk import keeps everyone once: ' + await page.locator('section.card li').count())
  await snap('3-roster')
  must(errors.length === 0, 'no page errors: ' + errors.join(' | '))
  console.log('members-test OK')
} catch (e) {
  console.error(String(e)); await snap('fail'); process.exitCode = 1
} finally { await browser.close(); server.kill() }
