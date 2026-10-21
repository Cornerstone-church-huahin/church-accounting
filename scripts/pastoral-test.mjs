// งานอภิบาล › สมาชิก: 5 ส่วน (ตัวเลขสำคัญ · สถานะ · ช่วงวัย/เพศ · กลุ่ม/ปีที่เข้า · การเข้าร่วม/ติดตาม) จากทะเบียนและบันทึกลงชื่อ (ข้อมูลสมมติเท่านั้น)
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
    // t0 มาทุกอาทิตย์ · t1 มาเมื่อ 10 สัปดาห์ก่อนแล้วหายไป · t2 มา 5 สัปดาห์ก่อน
    const ck = (m, d) => ({ id: `${d}_${m}`, date: d, mid: m, updated: 1 })
    const items = [...sundays.slice(0, 12).map((d) => ck('t0', d)), ck('t1', sundays[10]), ck('t2', sundays[5]), ck('t3', sundays[0])]
    localStorage.setItem(`acct.attendance.${Y}.v1`, JSON.stringify(items.filter((x) => x.date.startsWith(String(Y)))))
    localStorage.setItem(`acct.attendance.${Y - 1}.v1`, JSON.stringify(items.filter((x) => x.date.startsWith(String(Y - 1)))))
  }, [Y, sundays])
  await page.goto(`http://localhost:${PORT}/#/meeting/4/1`); await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: /สมาชิก/, level: 1 }).waitFor({ timeout: 8000 })
  for (const h of ['1 · ตัวเลขสำคัญ', '2 · สถานะสมาชิก', '3 · ช่วงวัยและเพศ', '4 · กลุ่มและปีที่เข้าเป็นสมาชิก', '5 · การเข้าร่วมนมัสการและการติดตาม']) must(await page.getByRole('heading', { name: h }).isVisible(), 'section ' + h)
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
  // ติดตาม: t1 (หายไป 10 สัปดาห์) ขึ้นเมื่อเลือก 8 สัปดาห์ · เปลี่ยนเป็น 12 → ไม่ขึ้น
  await page.getByLabel(/ไม่ได้มานมัสการเกิน/).selectOption('8')
  const fl = await page.getByRole('list', { name: 'รายชื่อที่ควรติดตาม' }).innerText()
  must(fl.includes('ทดสอบ1 สมมติ') && !fl.includes('ทดสอบ0 สมมติ'), 'follow-up lists the member absent > 8 weeks: ' + fl)
  await page.getByLabel(/ไม่ได้มานมัสการเกิน/).selectOption('12')
  must(await page.getByRole('list', { name: 'รายชื่อที่ควรติดตาม' }).count() === 0, 'nobody absent > 12 weeks')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('pastoral-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
