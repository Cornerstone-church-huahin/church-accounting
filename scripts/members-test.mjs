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
    const mk = (id, name, extra) => ({ id, name, updated: 1, status: '1.สมบูรณ์ ( 1 )', ...extra })
    const people = [
      mk('m1', 'นายสมชาย ตัวอย่าง', { nick: 'ชาย', code: '001', group: 'ผู้ใหญ่', since: '2005-03-06' }),
      mk('m2', 'นางสมหญิง ทดสอบ', { nick: 'หญิง', code: '002', group: 'ผู้ใหญ่', since: '2010-01-03' }),
      mk('m3', 'นายสมศักดิ์ ขาดไป', { code: '003', group: 'ผู้ใหญ่', since: '2012-05-06' }),
      mk('m4', 'นางสาวใหม่ เพิ่งมา', { status: '5.คนใหม่', code: '004', group: 'เยาวชน', since: iso(new Date(Date.now() - 90 * 864e5)) }),
      mk('m5', 'นายผู้ล่วงลับ ตัวอย่าง', { code: '005', status: '7.เสียชีวิต', since: '1999-01-03' }),
      mk('m6', 'นางสมพร กลับมาแล้ว', { status: '2.สมบูรณ์ ( 2 )', code: '006', since: '2008-02-03' }),
    ]
    function iso(x) { return x.toISOString().slice(0, 10) }
    localStorage.setItem('acct.church-members.v1', JSON.stringify(people))
    const att = {}
    const add = (date, ...ids) => { const y = date.slice(0, 4); (att[y] ??= []).push({ id: date, date, ids, updated: 1 }) }
    sundays.forEach((s, i) => { add(s, ...['m1', ...(i % 2 ? ['m2'] : []), ...(i < 10 ? ['m4'] : []), ...(i > 30 ? ['m3'] : []), ...(i < 5 ? ['m6'] : [])]) })
    for (const [y, rows] of Object.entries(att)) localStorage.setItem(`acct.attendance.${y}.v1`, JSON.stringify(rows))
  })
  await page.goto(`http://localhost:${PORT}/#/members`); await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: 'สมาชิก' }).waitFor()
  const body = () => page.locator('main, body').first().innerText()
  const row = (n) => page.locator('li', { hasText: n })
  // จำนวนตามสถานะในทะเบียน (ตรงกับทะเบียนเดิม ไม่ใช่ค่าที่แอปคำนวณเอง)
  const chips = (await page.getByLabel('จำนวนตามสถานะในทะเบียน').innerText()).replace(/\s+/g, ' ')
  must(/1\.สมบูรณ์ \( 1 \) · 3/.test(chips) && /2\.สมบูรณ์ \( 2 \) · 1/.test(chips) && /5\.คนใหม่ · 1/.test(chips) && /7\.เสียชีวิต · 1/.test(chips), 'registry status counts: ' + chips)
  must((await row('สมชาย').innerText()).includes('1.สมบูรณ์ ( 1 )') && !(await row('สมชาย').innerText()).includes('ควรเป็น'), 'regular attender consistent with registry')
  must((await row('สมศักดิ์').innerText()).includes('ควรเป็น สมบูรณ์ 2'), 'registry says complete-1 but long absent → suggest complete-2')
  must((await row('กลับมาแล้ว').innerText()).includes('ควรกลับเป็น สมบูรณ์ 1'), 'registry says complete-2 but attends again → suggest complete-1')
  must(!(await row('เพิ่งมา').innerText()).includes('ควร'), 'new member is not judged')
  await snap('1-audit')
  // เปลี่ยนสถานะในทะเบียน
  await row('สมศักดิ์').getByRole('button', { name: /1\.สมบูรณ์/ }).click()
  await page.getByRole('menuitem', { name: '2.สมบูรณ์ ( 2 )' }).click()
  must((await row('สมศักดิ์').innerText()).includes('2.สมบูรณ์ ( 2 )') && !(await row('สมศักดิ์').innerText()).includes('ควรเป็น'), 'status change applies and clears the suggestion')
  await page.reload(); await page.waitForLoadState('networkidle')
  must((await row('สมศักดิ์').innerText()).includes('2.สมบูรณ์ ( 2 )'), 'status change persists')
  // กรอง
  await page.getByLabel('กรอง', { exact: true }).selectOption('st:1.สมบูรณ์ ( 1 )')
  must(await page.locator('li', { hasText: 'สมหญิง' }).count() === 1 && await page.locator('li', { hasText: 'สมศักดิ์' }).count() === 0, 'filter by registry status')
  // ยอดผู้มา
  await page.getByRole('tab', { name: 'ยอดผู้มา' }).click()
  must(await page.locator('table.tbl tbody tr').count() >= 40, 'stats table lists every service: ' + await page.locator('table.tbl tbody tr').count())
  await page.locator('table.tbl tbody tr').first().click()
  must(/สมชาย/.test(await page.locator('table.tbl').innerText()), 'expanding a service lists who came')
  await snap('1b-stats')
  // ลงชื่อนมัสการ
  await page.getByRole('tab', { name: 'ลงชื่อ', exact: true }).click()
  const cb = page.getByRole('checkbox')
  must(await cb.count() === 5, 'check-in lists living members only: ' + await cb.count())
  await page.getByRole('checkbox').nth(0).check()
  await page.getByRole('button', { name: 'บันทึกการลงชื่อ' }).click()
  must(await page.getByRole('status').filter({ hasText: /บันทึกแล้ว/ }).count() === 1, 'check-in saved')
  // คนใหม่ที่ยังไม่อยู่ในทะเบียน: เพิ่มจากหน้าลงชื่อได้เลย (สถานะ 5.คนใหม่) · ชื่อซ้ำไม่เพิ่มซ้ำ
  await page.getByLabel('ชื่อคนใหม่', { exact: true }).fill('คนใหม่ ทดสอบ')
  await page.getByRole('button', { name: /เพิ่มคนใหม่/ }).click()
  await page.getByRole('status').filter({ hasText: 'เพิ่ม “คนใหม่ ทดสอบ” เป็นคนใหม่แล้ว' }).waitFor({ timeout: 5000 })
  await page.getByRole('button', { name: 'บันทึกการลงชื่อ' }).click()
  await page.getByLabel('ชื่อคนใหม่', { exact: true }).fill('คนใหม่  ทดสอบ')
  await page.getByRole('button', { name: /เพิ่มคนใหม่/ }).click()
  await page.getByRole('status').filter({ hasText: 'อยู่แล้ว' }).waitFor({ timeout: 5000 })
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
  must(await page.locator('section.card li').count() === 608, 'bulk import keeps everyone once: ' + await page.locator('section.card li').count())
  // รูปสมาชิก: จับคู่จากชื่อไฟล์ · ชื่อที่ไม่รู้จักไม่เดา · โหมดทดลองเก็บในเครื่อง
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  await page.locator('input[aria-label="ไฟล์รูป"]').setInputFiles([{ name: 'นายสมชาย ตัวอย่าง.Image.123456.png', mimeType: 'image/png', buffer: png }, { name: 'ไม่มี ใคร.png', mimeType: 'image/png', buffer: png }])
  await page.getByRole('status').filter({ hasText: 'ใส่ให้สมาชิกแล้ว 1 คน' }).waitFor({ timeout: 10000 })
  must(/จับคู่ชื่อไม่ได้ 1 ไฟล์/.test(await page.getByRole('status').filter({ hasText: 'ใส่ให้สมาชิกแล้ว' }).innerText()), 'unknown photo file reported, not guessed')
  const av = page.locator('li', { hasText: 'สมชาย' }).first().locator('img')
  await av.waitFor({ timeout: 10000 })
  must(await av.evaluate((i) => i.naturalWidth > 0), 'roster row shows the member photo')
  await page.locator('li', { hasText: 'สมชาย' }).first().click()
  await page.locator('[role=dialog] img').waitFor({ timeout: 10000 })
  await snap('4-photo')
  // ลบรูปอย่างเดียว (ชื่อยังอยู่)
  await page.getByRole('button', { name: 'ลบรูป' }).click()
  await page.locator('[role=dialog] img').waitFor({ state: 'detached', timeout: 5000 })
  await page.keyboard.press('Escape')
  must(!(await page.locator('li', { hasText: 'สมชาย' }).first().innerText()).includes('📷'), 'photo removed, name stays')
  must((await page.locator('li', { hasText: 'คนใหม่ ทดสอบ' }).first().innerText()).includes('5.คนใหม่'), 'quick-added person is in the registry as new')
  await page.keyboard.press('Escape')
  await snap('3-roster')
  must(errors.length === 0, 'no page errors: ' + errors.join(' | '))
  console.log('members-test OK')
} catch (e) {
  console.error(String(e)); await snap('fail'); process.exitCode = 1
} finally { await browser.close(); server.kill() }
