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
  const pill = page.getByRole('button', { name: /เปิดตะกร้า/ })
  must(/3/.test(await pill.innerText()), 'floating basket button counts the chosen people')
  await list.getByRole('button', { name: /สมาชิก3/ }).click() // แตะซ้ำ = เอาออก
  must(/2/.test(await pill.innerText()), 'tapping again removes from the plan')
  await list.getByRole('button', { name: /สมาชิก3/ }).click()
  await pill.click()
  must(await page.getByRole('dialog', { name: 'ตะกร้าแผนเยี่ยม' }).count() === 1, 'clicking the basket opens it as a popup')
  const order = () => page.locator('.vplan__item .vplan__who b').allInnerTexts()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก1', 'สมาชิก0', 'สมาชิก3']), 'plan keeps the order they were added: ' + await order())
  await page.getByRole('button', { name: 'เลื่อน สมาชิก3 ขึ้น' }).click(); await page.getByRole('button', { name: 'เลื่อน สมาชิก3 ขึ้น' }).click()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก3', 'สมาชิก1', 'สมาชิก0']), 'reorder with ▲: ' + await order())
  await page.getByRole('button', { name: 'เอา สมาชิก1 ออกจากตะกร้า' }).click()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก3', 'สมาชิก0']), 'remove from the plan')
  // แบ่งกลุ่ม: เพิ่มกลุ่ม → ย้ายคนไปกลุ่ม 2 → ตั้งชื่อสถานที่
  await page.getByRole('button', { name: '＋ เพิ่มกลุ่ม' }).click()
  must(await page.getByRole('region', { name: 'กลุ่มที่ 2' }).count() === 1, 'a second (empty) group appears')
  await page.getByLabel('ย้าย สมาชิก0 ไปกลุ่ม').selectOption({ label: 'กลุ่ม 2' })
  must((await page.getByRole('region', { name: 'กลุ่มที่ 2' }).innerText()).includes('สมาชิก0') && (await page.getByRole('region', { name: 'กลุ่มที่ 1' }).innerText()).includes('สมาชิก3'), 'member moved to group 2, the other stays in group 1')
  await page.getByLabel('ชื่อสถานที่ของกลุ่มที่ 2').fill('บ้านปากน้ำ'); await page.getByLabel('ชื่อสถานที่ของกลุ่มที่ 2').blur()
  const saved0 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-plans.v1'))[0])
  must(saved0.groups === 2 && saved0.names['2'] === 'บ้านปากน้ำ' && saved0.items.map((x) => x.id + ':' + x.g).join() === 'm3:1,m0:2', 'groups, place name and per-person group are saved: ' + JSON.stringify(saved0))
  // กลับไปแท็บเลือกคน: เห็นปุ่ม ＋ ชัดเจน · เพิ่มเข้ากลุ่มที่เลือก
  await page.getByRole('button', { name: 'ย่อตะกร้า' }).click()
  must(await page.getByRole('dialog', { name: 'ตะกร้าแผนเยี่ยม' }).count() === 0 && await pill.count() === 1, 'minimize leaves the floating basket button')
  must(await page.locator('.pvpick__add').count() >= 4 && await page.locator('.pvpick__add.in').count() === 2, 'every row shows a ＋ (✓ when already in the basket)')
  await page.getByLabel('เพิ่มเข้ากลุ่ม', { exact: true }).selectOption({ label: 'กลุ่ม 2 · บ้านปากน้ำ' })
  await page.getByRole('list', { name: 'รายชื่อสมาชิก' }).getByRole('button', { name: /สมาชิก2/ }).click()
  await pill.click() // เปิดตะกร้าได้เสมอ
  must((await page.getByRole('region', { name: 'กลุ่มที่ 2' }).innerText()).includes('สมาชิก2'), 'people added from the list go into the chosen group')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-plans.v1')))
  await page.getByRole('button', { name: 'เอา สมาชิก2 ออกจากตะกร้า' }).click()
  must(saved.length === 1 && saved[0].items.map((x) => x.id).join() === 'm3,m0,m2', 'plan is saved per day as an ordered list: ' + JSON.stringify(saved))
  const mini = () => page.getByRole('button', { name: 'ย่อตะกร้า' }).click()
  await mini()
  await page.getByRole('button', { name: 'วันถัดไป' }).click(); await pill.click()
  must(await page.locator('.vplan__item').count() === 0, 'each day has its own plan'); await mini()
  await page.getByRole('button', { name: 'วันก่อน' }).click(); await pill.click()
  must(await page.locator('.vplan__item').count() === 2, 'back to the day with its plan'); await mini()
  // ที่ปรึกษา: เห็นแผนไม่ได้แก้ (ไม่มีปุ่มเลื่อน/ลบ และแตะชื่อไม่เพิ่ม)
  const adv = await open('adv1', 'ที่ปรึกษาอภิบาล')
  await adv.evaluate((p) => localStorage.setItem('acct.visit-plans.v1', p), JSON.stringify(saved)); await adv.reload(); await adv.waitForLoadState('networkidle')
  must(await adv.getByRole('list', { name: 'รายชื่อสมาชิก' }).getByRole('button').count() === 0, 'advisor cannot pick people into the plan (read-only list)')
  await adv.getByRole('button', { name: /เปิดตะกร้า/ }).click()
  must(await adv.locator('.vplan__item').count() === 3 && await adv.getByRole('button', { name: /เลื่อน|ออกจากตะกร้า/ }).count() === 0, 'advisor sees the plan without edit buttons')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('visitplan-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
