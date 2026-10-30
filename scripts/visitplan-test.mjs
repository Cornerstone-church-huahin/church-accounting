// แผนเยี่ยมรายวัน (ตะกร้า) ในแท็บตารางเยี่ยม: เลือกคนหลายคน → ป้ายจำนวน → แผนของวัน เรียงลำดับ ▲▼ เพิ่ม/ลบ · ผู้ช่วยแก้ได้ ที่ปรึกษาดูอย่างเดียว
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4397
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
const MEMBERS = [
  { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, status: 'active', updated: 1 },
  { id: 'help1', name: 'ผู้ช่วยอภิบาล', role: 'viewer', joined: 2, status: 'active', updated: 1, works: [4], workRoles: { 4: 'helper' } },
  { id: 'adv1', name: 'ที่ปรึกษาอภิบาล', role: 'viewer', joined: 3, status: 'active', updated: 1, works: [4], workRoles: { 4: 'advisor' } },
]
const CM = Array.from({ length: 4 }, (_, i) => ({ id: `m${i}`, name: `สมาชิก${i}`, status: '1.สมบูรณ์ ( 1 )', updated: 1 }))
async function open(meId, meName) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  await page.addInitScript(([id, name, members, cm]) => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
    localStorage.setItem('acct.church-members.v1', JSON.stringify(cm))
  }, [meId, meName, MEMBERS, CM])
  await page.goto(`http://localhost:${PORT}/#/meeting/4/2`); await page.waitForLoadState('networkidle')
  return page
}
try {
  const page = await open('help1', 'ผู้ช่วยอภิบาล') // ผู้ช่วยแก้แผนได้
  const list = page.getByRole('list', { name: 'รายชื่อสมาชิก' })
  await list.getByRole('button', { name: /สมาชิก1/ }).click(); await list.getByRole('button', { name: /สมาชิก3/ }).click(); await list.getByRole('button', { name: /สมาชิก0/ }).click()
  must(/3/.test(await page.getByRole('tab', { name: /แผนของวัน/ }).innerText()), 'basket badge counts the chosen people')
  await list.getByRole('button', { name: /สมาชิก3/ }).click() // แตะซ้ำ = เอาออก
  must(/2/.test(await page.getByRole('tab', { name: /แผนของวัน/ }).innerText()), 'tapping again removes from the plan')
  await list.getByRole('button', { name: /สมาชิก3/ }).click()
  await page.getByRole('tab', { name: /แผนของวัน/ }).click()
  const order = () => page.locator('.vplan__item .vplan__who b').allInnerTexts()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก1', 'สมาชิก0', 'สมาชิก3']), 'plan keeps the order they were added: ' + await order())
  await page.getByRole('button', { name: 'เลื่อน สมาชิก3 ขึ้น' }).click(); await page.getByRole('button', { name: 'เลื่อน สมาชิก3 ขึ้น' }).click()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก3', 'สมาชิก1', 'สมาชิก0']), 'reorder with ▲: ' + await order())
  await page.getByRole('button', { name: 'เอา สมาชิก1 ออกจากแผน' }).click()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก3', 'สมาชิก0']), 'remove from the plan')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-plans.v1')))
  must(saved.length === 1 && saved[0].items.map((x) => x.id).join() === 'm3,m0', 'plan is saved per day as an ordered list: ' + JSON.stringify(saved))
  await page.getByRole('button', { name: 'วันถัดไป' }).click()
  must(await page.locator('.vplan__item').count() === 0, 'each day has its own plan')
  await page.getByRole('button', { name: 'วันก่อน' }).click()
  must(await page.locator('.vplan__item').count() === 2, 'back to the day with its plan')
  // ที่ปรึกษา: เห็นแผนไม่ได้แก้ (ไม่มีปุ่มเลื่อน/ลบ และแตะชื่อไม่เพิ่ม)
  const adv = await open('adv1', 'ที่ปรึกษาอภิบาล')
  await adv.evaluate((p) => localStorage.setItem('acct.visit-plans.v1', p), JSON.stringify(saved)); await adv.reload(); await adv.waitForLoadState('networkidle')
  must(await adv.getByRole('list', { name: 'รายชื่อสมาชิก' }).getByRole('button').count() === 0, 'advisor cannot pick people into the plan (read-only list)')
  await adv.getByRole('tab', { name: /แผนของวัน/ }).click()
  must(await adv.locator('.vplan__item').count() === 2 && await adv.getByRole('button', { name: /เลื่อน|ออกจากแผน/ }).count() === 0, 'advisor sees the plan without edit buttons')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('visitplan-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
