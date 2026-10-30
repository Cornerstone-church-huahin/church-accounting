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
// กดค้างที่ปุ่มจับ ⋮⋮ แล้วลากไปวาง (เมาส์จำลองการสัมผัส) · hold = เวลากดค้างก่อนลาก
const drag = async (pg, who, toLocator, where = 'top', hold = 450) => {
  const h = await pg.getByRole('button', { name: new RegExp(`^จับ ${who} `) }).boundingBox()
  const t = await toLocator.boundingBox()
  const ty = where === 'top' ? t.y + 3 : where === 'bottom' ? t.y + t.height - 3 : t.y + t.height / 2
  await pg.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await pg.mouse.down(); await pg.waitForTimeout(hold)
  await pg.mouse.move(h.x + h.width / 2, (h.y + ty) / 2, { steps: 4 }); await pg.mouse.move(t.x + 60, ty, { steps: 6 }); await pg.mouse.up()
  await pg.waitForTimeout(250)
}
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
  const box = await page.locator('.vbasket').boundingBox(); const vp = page.viewportSize()
  must(box.y <= 1 && box.height >= vp.height - 2, 'basket fills the whole screen: ' + JSON.stringify(box))
  const order = () => page.locator('.vplan__body > .vplan__list .vplan__who b').allInnerTexts()
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก1', 'สมาชิก0', 'สมาชิก3']), 'basket keeps the order they were added: ' + await order())
  must(await page.locator('.vplan__item--set').count() === 0 && await page.getByRole('button', { name: /^กำหนดจุดเยี่ยมของ/ }).count() === 3, 'nobody has a stop yet: each row shows ＋')
  must(await page.getByRole('button', { name: /^จับ / }).count() === 3 && /กดค้างที่ปุ่มนี้/.test(await page.getByRole('note').innerText()), 'drag handles + hint are shown')
  await drag(page, 'สมาชิก3', page.locator('.vplan__body > .vplan__list > li').first(), 'top', 30)
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก1', 'สมาชิก0', 'สมาชิก3']), 'a quick touch does not drag: ' + await order())
  await drag(page, 'สมาชิก3', page.locator('.vplan__body > .vplan__list > li').first(), 'top')
  must(JSON.stringify(await order()) === JSON.stringify(['สมาชิก3', 'สมาชิก1', 'สมาชิก0']), 'hold + drag reorders the basket: ' + await order())
  must(/ยังไม่มีจุดเยี่ยม/.test(await page.locator('.vplan__body').innerText()), 'stop table is empty at first')
  // ＋ → ป๊อปอัพ “จุดเยี่ยมที่” → โอเค
  const setStop = async (who, no) => {
    await page.getByRole('button', { name: new RegExp(`^(กำหนดจุดเยี่ยมของ ${who}|${who} จุดที่ \\d+)`) }).click()
    must(await page.getByRole('dialog', { name: 'จุดเยี่ยม' }).count() === 1, 'asks which stop')
    await page.getByRole('radio', { name: String(no), exact: true }).click(); await page.getByRole('button', { name: 'โอเค' }).click()
  }
  await setStop('สมาชิก3', 2); await setStop('สมาชิก1', 1); await setStop('สมาชิก0', 2)
  must(await page.locator('.vplan__item--set').count() === 3, 'people with a stop are highlighted')
  const t1 = (await page.getByRole('region', { name: 'จุดที่ 1' }).innerText()).replace(/\s+/g, ' '), t2 = (await page.getByRole('region', { name: 'จุดที่ 2' }).innerText()).replace(/\s+/g, ' ')
  must(t1.includes('สมาชิก1') && /สมาชิก3.*สมาชิก0/.test(t2), 'table lists each stop in the order chosen: ' + t1 + ' | ' + t2)
  await page.getByLabel('ชื่อสถานที่ของจุดที่ 2').fill('บ้านปากน้ำ'); await page.getByLabel('ชื่อสถานที่ของจุดที่ 2').blur()
  // แก้จุดจากตาราง
  await page.getByRole('button', { name: 'แก้จุดของ สมาชิก0' }).click(); await page.getByRole('radio', { name: '1', exact: true }).click(); await page.getByRole('button', { name: 'โอเค' }).click()
  must((await page.getByRole('region', { name: 'จุดที่ 1' }).innerText()).includes('สมาชิก0') && !(await page.getByRole('region', { name: 'จุดที่ 2' }).innerText()).includes('สมาชิก0'), 'edit icon moves the person to another stop')
  const saved0 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-plans.v1'))[0])
  must(saved0.names['2'] === 'บ้านปากน้ำ' && saved0.items.map((x) => x.id + ':' + x.g).join() === 'm3:2,m1:1,m0:1', 'stops and place name are saved: ' + JSON.stringify(saved0))
  await page.getByRole('button', { name: 'ย่อตะกร้า' }).click()
  must(await page.getByRole('dialog', { name: 'ตะกร้าแผนเยี่ยม' }).count() === 0 && await pill.count() === 1, 'close leaves the small basket icon')
  const chips = (await pill.getAttribute('title')).replace(/\s+/g, ' ')
  must(/จุด 1: 2 คน/.test(chips) && /จุด 2 บ้านปากน้ำ: 1 คน/.test(chips), 'icon tooltip summarizes the stops: ' + chips)
  must(await page.locator('.pvpick__add').count() >= 4 && await page.locator('.pvpick__add.in').count() === 3, 'every row shows a ＋ (✓ when already in the basket)')
  await page.getByRole('list', { name: 'รายชื่อสมาชิก' }).getByRole('button', { name: /สมาชิก2/ }).click()
  await pill.click()
  must(await page.getByRole('button', { name: 'กำหนดจุดเยี่ยมของ สมาชิก2' }).count() === 1, 'a newly added person waits for a stop')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.visit-plans.v1')))
  await page.getByRole('button', { name: 'เอา สมาชิก2 ออกจากตะกร้า' }).click()
  must(saved.length === 1 && saved[0].items.length === 4, 'plan is saved per day: ' + JSON.stringify(saved))
  const mini = () => page.getByRole('button', { name: 'ย่อตะกร้า' }).click()
  await mini()
  await page.getByRole('button', { name: 'วันถัดไป' }).click(); await pill.click()
  must(await page.locator('.vplan__item').count() === 0, 'each day has its own plan'); await mini()
  await page.getByRole('button', { name: 'วันก่อน' }).click(); await pill.click()
  must(await page.locator('.vplan__body > .vplan__list .vplan__item').count() === 3, 'back to the day with its plan'); await mini()
  // ที่ปรึกษา: เห็นแผนไม่ได้แก้ (ไม่มีปุ่มเลื่อน/ลบ และแตะชื่อไม่เพิ่ม)
  const adv = await open('adv1', 'ที่ปรึกษาอภิบาล')
  await adv.evaluate((p) => localStorage.setItem('acct.visit-plans.v1', p), JSON.stringify(saved)); await adv.reload(); await adv.waitForLoadState('networkidle')
  must(await adv.getByRole('list', { name: 'รายชื่อสมาชิก' }).getByRole('button').count() === 0, 'advisor cannot pick people into the plan (read-only list)')
  await adv.getByRole('button', { name: /เปิดตะกร้า/ }).click()
  must(await adv.locator('.vplan__body > .vplan__list .vplan__item').count() === 4 && await adv.getByRole('button', { name: /^กำหนดจุด|แก้จุด|ออกจากตะกร้า/ }).count() === 0, 'advisor sees the plan without edit buttons')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('visitplan-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
