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
  const seed = (auto) => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    if (!auto) localStorage.setItem('acct.settings.v1', JSON.stringify([{ id: 'settings', ageAuto: false, updated: 1 }]))
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
      { id: 'k1', updated: 1, name: 'เด็กยังไม่มีกลุ่ม', status: S, group: '7.ไม่มีกลุ่ม', birth: '2016-05-01' },
      { id: 'y1', updated: 1, name: 'วัยยี่สิบเจ็ด', status: S, group: '5.วัยทำงาน', gender: 'ชาย', birth: '1999-05-05' },
      { id: 'm4', updated: 1, name: 'กลุ่มพิเศษ', status: S, group: '9.คณะกรรมการ', gender: 'ชาย', birth: '2008-01-01' },
    ]))
  }
  await ctx.addInitScript(seed, false)
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/#/meeting/2?tab=roster`); await page.reload()
  await page.getByRole('button', { name: /เมนูสมาชิก/ }).click()
  await page.getByRole('tab', { name: /ทะเบียน/ }).first().click()
  await page.getByRole('button', { name: /จัดกลุ่มตามอายุ/ }).click()
  const list = page.getByRole('list', { name: 'คนที่กลุ่มไม่ตรงอายุ' })
  await list.waitFor({ timeout: 10000 })
  must(await list.getByRole('listitem').count() === 3, 'three proposals (ดารา, น้องเอ, เด็กยังไม่มีกลุ่ม): ' + await list.innerText())
  must(/ดารา ผลจันทร์[\s\S]*4\.สตรี[\s\S]*2\.อนุชน/.test(await list.innerText()) && /น้องเอ[\s\S]*3\.บุรุษ[\s\S]*1\.เด็กรวี/.test(await list.innerText()), 'from → to shown')
  must(!/ไม่มีวันเกิด|กลุ่มพิเศษ/.test(await list.innerText()), 'no birth / special group untouched')
  must(/เด็กยังไม่มีกลุ่ม[\s\S]*7\.ไม่มีกลุ่ม[\s\S]*1\.เด็กรวี/.test(await list.innerText()), '“7.ไม่มีกลุ่ม” is treated as no group and gets proposed')
  await page.getByRole('checkbox', { name: 'ย้าย เด็กยังไม่มีกลุ่ม' }).uncheck()
  await page.getByRole('checkbox', { name: 'ย้าย น้องเอ' }).uncheck()
  await page.getByRole('button', { name: /ย้ายกลุ่ม \(1 คน\)/ }).click()
  const ms = await page.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('acct.church-members.v1')).map((x) => [x.id, x.group])))
  must(ms.m1 === '2.อนุชน' && ms.m2 === '3.บุรุษ' && ms.k1 === '7.ไม่มีกลุ่ม' && ms.m3 === '4.สตรี' && ms.m4 === '9.คณะกรรมการ', 'only the ticked person moved: ' + JSON.stringify(ms))
  // รายละเอียด: แถวอายุ + เตือนกลุ่มไม่ตรง
  await page.getByRole('button', { name: /^ปิด$/ }).first().click().catch(() => {})
  await page.getByText('น้องเอ').first().click()
  await page.getByText(/อายุ \(อัปเดตเองทุกวัน\)/).waitFor({ timeout: 8000 })
  must(await page.getByText(/ควรอยู่กลุ่ม/).count() === 1 && await page.getByText(/1\.เด็กรวี/).count() >= 1, 'detail shows age row + group mismatch hint')
  await page.getByRole('button', { name: /ย้ายเลย/ }).click()
  const m2 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.church-members.v1')).find((x) => x.id === 'm2').group)
  must(m2 === '1.เด็กรวี', 'quick move from detail')
  // โหมดอัตโนมัติ (ค่าตั้งต้น): เปิดแอปแล้วย้ายเอง + แจ้งผล + คืนกลุ่มเดิมได้
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  // GitHub จำลองให้ดึงข้อมูลสำเร็จ (ระบบรอดึงข้อมูลล่าสุดก่อนย้ายอัตโนมัติ)
  const files = new Map(); let n = 0
  await ctx2.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const m = url.pathname.match(/^\/repos\/x\/y(?:\/contents\/(.+))?$/)
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) })
    if (route.request().method() === 'OPTIONS') return json(204, {})
    if (!m) return json(404, {})
    if (!m[1]) return json(200, { private: true, permissions: { push: true } })
    const path = decodeURIComponent(m[1])
    if (route.request().method() === 'GET') { const f = files.get(path); return f ? json(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') }) : json(404, {}) }
    if (route.request().method() === 'PUT') { const b = JSON.parse(route.request().postData()); files.set(path, { text: Buffer.from(b.content, 'base64').toString('utf8'), sha: `s${++n}` }); return json(200, { content: { sha: `s${n}` } }) }
    return json(404, {})
  })

  await ctx2.addInitScript(seed, true)
  const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errors.push(String(e)))
  await p2.goto(`http://localhost:${PORT}/#/meeting/2?tab=roster`)
  await p2.getByText(/ปรับข้อมูลทะเบียนอัตโนมัติ/).waitFor({ timeout: 15000 })
  must(await p2.getByText(/3 คน/).count() >= 1, 'banner shows how many were moved automatically')
  const auto = await p2.evaluate(() => Object.fromEntries(JSON.parse(localStorage.getItem('acct.church-members.v1')).map((x) => [x.id, x.group + '|' + (x.groupMoved?.from ?? '')])))
  must(auto.m1 === '2.อนุชน|4.สตรี' && auto.m2 === '1.เด็กรวี|3.บุรุษ' && auto.k1 === '1.เด็กรวี|7.ไม่มีกลุ่ม' && auto.m3 === '4.สตรี|' && auto.m4 === '9.คณะกรรมการ|', 'auto moved the mismatched, left the rest: ' + JSON.stringify(auto))
  // คืนกลุ่มเดิม (ล็อกกันย้ายซ้ำ)
  await p2.getByRole('button', { name: /เมนูสมาชิก/ }).click()
  await p2.getByRole('tab', { name: /ทะเบียน/ }).first().click()
  await p2.getByText('ดารา ผลจันทร์').first().click()
  await p2.getByText(/ย้ายกลุ่มอัตโนมัติ$/).waitFor({ timeout: 8000 })
  await p2.getByRole('button', { name: /คืนกลุ่มเดิม/ }).click()
  await p2.waitForTimeout(800)
  const back = await p2.evaluate(() => JSON.parse(localStorage.getItem('acct.church-members.v1')).find((x) => x.id === 'm1'))
  must(back.group === '4.สตรี' && back.groupLock === true, 'undo restores the old group and locks it: ' + JSON.stringify(back))
  // แก้เกณฑ์อายุ → เตือนซ้อนทับ → แก้ให้ถูก → บันทึกแล้วทุกคนถูกปรับทันที
  await p2.keyboard.press('Escape'); await p2.waitForTimeout(300)
  await p2.getByRole('button', { name: /จัดกลุ่มตามอายุ/ }).click()
  await p2.getByRole('button', { name: /ดู\/แก้กติกา/ }).click()
  await p2.getByLabel('2.อนุชน อายุถึง').fill('30')
  must(await p2.getByText(/ซ้อนกับ/).count() >= 1, 'overlap warning shown')
  await p2.getByLabel('5.วัยทำงาน อายุตั้งแต่').fill('31')
  await p2.getByText(/ซ้อนกับ/).waitFor({ state: 'detached', timeout: 5000 })
  must(await p2.getByText(/ซ้อนกับ/).count() === 0 && await p2.getByText(/ถ้าบันทึกกติกานี้ จะมี/).count() === 1, 'no warning once fixed; preview count shown: ')
  await p2.getByRole('button', { name: /บันทึกกติกา/ }).click()
  await p2.getByText(/ย้ายกลุ่ม \d+ คนให้ตรงกติกาใหม่ทันที/).waitFor({ timeout: 8000 })
  const y1 = await p2.evaluate(() => JSON.parse(localStorage.getItem('acct.church-members.v1')).find((x) => x.id === 'y1'))
  must(y1.group === '2.อนุชน' && y1.groupMoved?.from === '5.วัยทำงาน', 'new criteria applied to everyone immediately: ' + JSON.stringify(y1))
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('agegroup-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
