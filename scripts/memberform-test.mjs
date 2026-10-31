// ฝ่ายทะเบียนคัดลอกลิงก์ให้สมาชิกกรอกเอง → สมาชิกเปิดลิงก์ (ไม่เชื่อมต่อ/ไม่ล็อกอิน) กรอก → ข้อความส่งกลับอ่านออก · ปุ่มคัดลอกมีเฉพาะในห้องงานฝ่ายทะเบียน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4413
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH', permissions: ['clipboard-read', 'clipboard-write', 'geolocation'], geolocation: { latitude: 12.5684, longitude: 99.9577 } })
  await ctx.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await ctx.addInitScript(() => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, status: 'active', updated: 1 }]))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'm1', updated: 1, name: 'ดารา ผลจันทร์', nick: 'ดารา', code: '1329', tel: '0818896490', gender: 'หญิง', birth: '2008-09-09', status: '1.สมบูรณ์ ( 1 )', group: '4.สตรี' }]))
  })
  const page = await ctx.newPage(); page.on('pageerror', (e) => errors.push(String(e)))
  // นอกห้องฝ่ายทะเบียน (/members) ไม่มีปุ่มคัดลอกลิงก์
  await page.goto(`http://localhost:${PORT}/#/members?tab=roster`)
  await page.getByText('ดารา ผลจันทร์').first().click()
  await page.getByRole('dialog').waitFor({ timeout: 10000 })
  must(await page.getByRole('button', { name: /คัดลอกลิงก์/ }).count() === 0, 'no copy-link button outside registry room')
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: /^ปิด$/ }).click().catch(() => {})
  // ในห้องงานฝ่ายทะเบียน (งาน 2) มีปุ่ม
  await page.goto(`http://localhost:${PORT}/#/meeting/2?tab=roster`); await page.reload()
  await page.getByText('ดารา ผลจันทร์').first().click()
  await page.getByRole('button', { name: /คัดลอกลิงก์/ }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: /คัดลอกลิงก์/ }).click()
  const link = await page.evaluate(() => navigator.clipboard.readText())
  must(/#\/form\?d=/.test(link), 'copied link: ' + link)
  // สมาชิก: เครื่องใหม่ ไม่เชื่อมต่ออะไรเลย
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH', permissions: ['clipboard-read', 'clipboard-write', 'geolocation'], geolocation: { latitude: 12.5684, longitude: 99.9577 } })
  const p2 = await ctx2.newPage(); p2.on('pageerror', (e) => errors.push(String(e)))
  await p2.goto(link.replace(/^https?:\/\/[^/]+/, `http://localhost:${PORT}`))
  await p2.getByLabel('ชื่อ-สกุล').waitFor({ timeout: 10000 })
  must((await p2.getByLabel('ชื่อ-สกุล').inputValue()) === 'ดารา ผลจันทร์' && (await p2.getByLabel('โทรศัพท์').inputValue()) === '0818896490', 'prefilled from link')
  must(await p2.getByText('คริสตจักรศิลาเอก').first().isVisible() && await p2.getByText(/เชื่อมต่อ|วางลิงก์เชิญ/).count() === 0, 'standalone page (no connect gate)')
  if (process.env.SHOT) { await p2.setViewportSize({ width: 390, height: 1700 }); await p2.screenshot({ path: process.env.SHOT }) }
  await p2.getByLabel('โทรศัพท์').fill('0899999999')
  must(await p2.getByText(/รหัสสมาชิก/).count() === 0 && await p2.getByText(/พิกัดบ้าน/).count() === 0, 'no member code / no coordinates on form')
  await p2.getByLabel('LINE ID').fill('dara_l')
  await p2.getByLabel(/^Facebook/).fill('ดารา ผลจันทร์')
  await p2.getByLabel(/ที่มาร่วมนมัสการครั้งแรก/).fill('2012-05-06')
  await p2.getByLabel(/อาชีพ \/ ความสามารถ/).fill('พยาบาล')
  const yFirst = (await p2.getByLabel(/ที่มาร่วมนมัสการครั้งแรก/).boundingBox()).y, yServe = (await p2.getByRole('button', { name: /เลือกงานรับใช้/ }).boundingBox()).y
  must(yFirst < yServe, 'first-visit date is above the serve popup button')
  must(await p2.getByRole('checkbox', { name: /ครัว/ }).count() === 0, 'serve options are not inline on the form')
  await p2.getByRole('button', { name: /เลือกงานรับใช้/ }).click()
  await p2.getByRole('checkbox', { name: /ครัว/ }).click()
  await p2.getByRole('checkbox', { name: /^อื่นๆ/ }).click()
  await p2.getByLabel('งานรับใช้อื่นๆ').fill('ตัดผมให้เด็ก')
  await p2.getByRole('button', { name: /เสร็จ/ }).click()
  must(await p2.getByText(/อื่นๆ: ตัดผมให้เด็ก/).count() >= 1 && await p2.getByRole('dialog').count() === 0, 'summary chips shown after closing popup')
  await p2.getByRole('checkbox', { name: /วันเสาร์/ }).click()
  await p2.getByLabel(/ข้อความถึงฝ่ายทะเบียน/).fill('ย้ายบ้านใหม่')
  await p2.getByRole('button', { name: /คัดลอกข้อความ/ }).click()
  const reply = await p2.evaluate(() => navigator.clipboard.readText())
  must(reply.includes('โทรศัพท์: 0899999999') && reply.includes('หมายเหตุ: ย้ายบ้านใหม่') && reply.includes('รหัสตรวจ:') && reply.includes('LINE ID: dara_l') && reply.includes('อาชีพ/ความสามารถ: พยาบาล') && reply.includes('ครัว / อาหาร / เครื่องดื่ม, อื่นๆ: ตัดผมให้เด็ก') && reply.includes('วันที่สะดวกรับใช้: วันเสาร์') && reply.includes('Facebook: ดารา ผลจันทร์') && /มานมัสการครั้งแรก \(ประมาณ\): 6 พ\.ค\./.test(reply), 'reply text: ' + reply)
  // ลิงก์เสีย
  await p2.goto(`http://localhost:${PORT}/#/form?d=xxx`)
  await p2.getByText(/ลิงก์นี้ไม่ถูกต้อง/).waitFor({ timeout: 8000 })
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('memberform-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
