// ฝ่ายทะเบียน: จัดกลุ่มตามอายุ+เพศ (เสนอ → ติ๊กตรวจ → ย้าย) · หน้ารายละเอียดมีแถวอายุและเตือนกลุ่มไม่ตรง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4414
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  await ctx.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await ctx.addInitScript(() => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, status: 'active', updated: 1 }]))
    const S = '1.สมบูรณ์ ( 1 )'
    localStorage.setItem('acct.church-members.v1', JSON.stringify([
      { id: 'g1', updated: 1, name: 'เด็กตัวอย่าง', status: S, group: '1.เด็กรวี', gender: 'ชาย', birth: '2018-01-01' },
      { id: 'g2', updated: 1, name: 'เยาวชนตัวอย่าง', status: S, group: '2.อนุชน', gender: 'หญิง', birth: '2008-01-01' },
      { id: 'g3', updated: 1, name: 'บุรุษตัวอย่าง', status: S, group: '3.บุรุษ', gender: 'ชาย', birth: '1980-01-01' },
      { id: 'g5', updated: 1, name: 'วัยทำงานตัวอย่าง', status: S, group: '5.วัยทำงาน', gender: 'ชาย', birth: '1995-01-01' },
      { id: 'g4', updated: 1, name: 'สตรีตัวอย่าง', status: S, group: '4.สตรี', gender: 'หญิง', birth: '1975-01-01' },
      { id: 'm1', updated: 1, name: 'ดารา ผลจันทร์', status: S, group: '4.สตรี', gender: 'หญิง', birth: '2008-09-09' },
      { id: 'm2', updated: 1, name: 'น้องเอ', status: S, group: '3.บุรุษ', gender: 'ชาย', birth: '2018-05-05' },
      { id: 'm3', updated: 1, name: 'ไม่มีวันเกิด', status: S, group: '4.สตรี', gender: 'หญิง' },
      { id: 'm4', updated: 1, name: 'กลุ่มพิเศษ', status: S, group: '9.คณะกรรมการ', gender: 'ชาย', birth: '2008-01-01' },
    ]))
  })
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/#/meeting/2?tab=roster`); await page.reload()
  await page.getByRole('button', { name: /เมนูสมาชิก/ }).click()
  await page.getByRole('tab', { name: /ทะเบียน/ }).first().click()
  await page.getByRole('button', { name: /จัดกลุ่มตามอายุ/ }).click()
  const list = page.getByRole('list', { name: 'คนที่กลุ่มไม่ตรงอายุ' })
  await list.waitFor({ timeout: 10000 })
  must(await list.getByRole('listitem').count() === 2, 'two proposals (ดารา → อนุชน, น้องเอ → เด็ก): ' + await list.innerText())
  must(/ดารา ผลจันทร์[\s\S]*4\.สตรี[\s\S]*2\.อนุชน/.test(await list.innerText()) && /น้องเอ[\s\S]*3\.บุรุษ[\s\S]*1\.เด็กรวี/.test(await list.innerText()), 'from → to shown')
  must(!/ไม่มีวันเกิด|กลุ่มพิเศษ/.test(await list.innerText()), 'no birth / special group untouched')
  await page.getByRole('checkbox', { name: 'ย้าย น้องเอ' }).uncheck()
  await page.getByRole('button', { name: /ย้ายกลุ่ม \(1 คน\)/ }).click()
  const ms = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('acct.church-members.v1')).map((x) => [x.id, x.group])))
  must(ms.m1 === '2.อนุชน' && ms.m2 === '3.บุรุษ' && ms.m3 === '4.สตรี' && ms.m4 === '9.คณะกรรมการ', 'only the ticked person moved: ' + JSON.stringify(ms))
  // รายละเอียด: แถวอายุ + เตือนกลุ่มไม่ตรง
  await page.getByRole('button', { name: /^ปิด$/ }).first().click().catch(() => {})
  await page.getByText('น้องเอ').first().click()
  await page.getByText(/อายุ \(อัปเดตเองทุกวัน\)/).waitFor({ timeout: 8000 })
  must(await page.getByText(/ควรอยู่กลุ่ม/).count() === 1 && await page.getByText(/1\.เด็กรวี/).count() >= 1, 'detail shows age row + group mismatch hint')
  await page.getByRole('button', { name: /ย้ายเลย/ }).click()
  const m2 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.church-members.v1')).find((x) => x.id === 'm2').group)
  must(m2 === '1.เด็กรวี', 'quick move from detail')
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('agegroup-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
