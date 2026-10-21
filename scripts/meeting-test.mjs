// โหมดประชุม: ไอคอนบนแถบหัวแอป → แท็บ 1–6 (ว่าง) → แต่ละแท็บเปิดหน้าว่าง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 800 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  must((await page.getByRole('link', { name: 'โหมดประชุม', exact: true }).count()) === 0 && (await page.getByRole('link', { name: 'ลงชื่อนมัสการ' }).count()) === 0, 'top bar has no meeting / members icons')
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('link', { name: /ห้องทำงาน/ }).click()
  const tiles = page.locator('nav[aria-label^="โหมดประชุม"] a.btile')
  must((await tiles.count()) === 15, 'fifteen tabs: ' + await tiles.count())
  const texts = await tiles.allInnerTexts()
  must(['งานเลขา', 'งานทะเบียน', 'งานเหรัญญิก', 'งานอภิบาล', 'งานสุสาน', 'งานนมัสการ', 'งานต่างชาติ', 'งานรวี', 'งานอนุชน', 'งานสตรี', 'งานประกาศ', 'ฝ่ายทรัพย์สิน', 'งานมีเดีย', 'แท็บ 14', 'แท็บ 15'].every((n, i) => texts[i].includes(n)), 'tab names: ' + texts.join('|'))
  await page.screenshot({ path: '/tmp/meeting.png' })
  // งานเหรัญญิก = หน้าแรกบัญชีเต็ม ใช้งานได้จริง
  await tiles.nth(2).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).count() === 0, 'treasurer page is untouched; calendar is collapsed')
  must(await page.getByRole('link', { name: '‹ ทุกแท็บ' }).isVisible(), 'back link to ทุกแท็บ on the treasurer work too')
  must(await page.getByText('ขั้นตอนทำบัญชีประจำสัปดาห์').isVisible() && await page.locator('.balance-tiles .btile').count() === 6, 'treasurer tab shows the whole home page')
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).isVisible(), '📅 button at the top opens the calendar')
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  await page.getByRole('tab', { name: /รับ/ }).first().click()
  must(await page.getByText('ดาวน์โหลด PDF ไฟล์เปล่า').first().isVisible(), 'income step works inside the tab (sheet + download buttons)')
  // ปุ่มห้องทำงานบนหน้าแรก
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('link', { name: /ห้องทำงาน/ }).click()
  must((await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').count()) === 15, 'หน้าแรก › ห้องทำงาน opens the meeting page with the tabs')
  await page.goto(`http://localhost:${PORT}/#/balance/spare`); await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').first().waitFor({ timeout: 5000 }); must((await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').count()) === 15, 'old spare route also lands on the meeting page')
  await tiles.nth(2).click()
  // งานทะเบียน = หน้าสมาชิกเต็ม (เปิดที่ ลงชื่อ)
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await tiles.nth(1).click()
  await page.getByRole('tab', { name: /ตรวจสอบ/ }).first().waitFor({ timeout: 8000 })
  for (const t of ['ตรวจสอบ', 'ยอดผู้มา', 'ลงชื่อ', 'ทะเบียน', 'วันเกิด', 'เพศ']) must(await page.getByRole('tab', { name: new RegExp(t) }).first().isVisible(), 'registry tab ' + t)
  must(await page.getByText('ลงชื่อวันนี้แล้ว').count() === 0 && await page.locator('.kpi').count() === 0, 'registry opens on the six-tile menu only (content zone empty)')
  // กดช่อง → เมนูหายและหน้านั้นเต็มจอ · ‹ เมนูสมาชิก → กลับมาเห็นช่องทั้งหก (ทดสอบทุกช่อง)
  for (const [t, probe] of [['ตรวจสอบ', null], ['ยอดผู้มา', null], ['ลงชื่อ', /ลงชื่อวันนี้แล้ว/], ['ทะเบียน', null], ['วันเกิด', null], ['เพศ', null]]) {
    await page.getByRole('tab', { name: new RegExp(t) }).first().click()
    await page.getByRole('button', { name: '‹ เมนูสมาชิก' }).waitFor({ timeout: 5000 })
    must(await page.getByRole('tab').count() === 0, t + ': tile menu is hidden while the page is open')
    if (probe) must(await page.getByText(probe).first().isVisible(), t + ': its page is shown')
    await page.getByRole('button', { name: '‹ เมนูสมาชิก' }).click()
    must(await page.getByRole('tab').count() === 6, t + ': back shows all six tiles again')
  }
  await page.getByRole('tab', { name: /ทะเบียน/ }).click()
  must((await page.locator('.kpi').count()) > 0 || (await page.getByText(/ยังไม่มีสมาชิก/).count()) > 0, 'registry page works inside งานทะเบียน')
  await page.getByRole('button', { name: '‹ เมนูสมาชิก' }).click()
  // แท็บอื่นยังว่าง
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await tiles.nth(0).click()
  must(await page.getByRole('heading', { name: 'งานเลขา', exact: true }).isVisible(), 'secretary heading has no "โหมดประชุม" prefix')
  must(await page.getByRole('heading', { name: 'งานเลขา', exact: true }).isVisible(), 'secretary heading has no "โหมดประชุม" prefix')
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).count() === 0 && await page.getByRole('button', { name: /ตารางงาน/ }).isVisible(), '📅 ตารางงาน button on top, collapsed')
  const links = (nm) => page.getByRole('navigation', { name: nm, exact: true }).getByRole('link')
  const sec = await links('หมวดงานเลขา').allInnerTexts()
  must(sec.map((x) => x.replace(/^\S+\s+/, '').trim()).join('|') === 'การประชุม|แท็บ 2|แท็บ 3|แท็บ 4|แท็บ 5|แท็บ 6', 'six secretary tabs: ' + sec.join('|'))
  // กดช่องแท็บ = เปิดหน้าเต็ม ว่างไว้ก่อน ไม่มีเมนูแท็บรกบนหน้านั้น · ปุ่มบนขวากลับหน้าหลักของงาน
  await links('หมวดงานเลขา').filter({ hasText: 'แท็บ 5' }).click()
  await page.getByRole('heading', { name: 'แท็บ 5', exact: true }).waitFor({ timeout: 5000 })
  must(/แท็บ 5 — ยังว่าง/.test(await page.locator('main').innerText()), 'tab opens a full empty page')
  must(await page.locator('.tiletabs').count() === 0 && await page.getByRole('tab').count() === 0 && await page.getByRole('button', { name: /ตารางงาน/ }).count() === 0, 'no tab menu clutter on the full page')
  await page.getByRole('link', { name: '‹ งานเลขา' }).click()
  must(await page.getByRole('heading', { name: 'งานเลขา', exact: true }).isVisible() && await page.locator('.tiletabs a.btile').count() === 6, 'back to the work home with its six tiles')
  // งานอภิบาล: สมาชิก 👥 / ตารางเยี่ยม เปิดหน้าเต็มว่าง
  await page.goto(`http://localhost:${PORT}/#/meeting`); await tiles.nth(3).click()
  const tabs4 = await links('หมวดงานอภิบาล').allInnerTexts()
  must(tabs4.map((x) => x.replace(/^\S+\s+/, '').trim()).join('|') === 'สมาชิก|ตารางเยี่ยม|แท็บ 3|แท็บ 4|แท็บ 5|แท็บ 6', 'pastoral tabs: ' + tabs4.join('|'))
  must(tabs4[0].includes('👥'), 'สมาชิก tile has the members icon')
  for (const parent of ['สมาชิก', 'ตารางเยี่ยม']) {
    await links('หมวดงานอภิบาล').filter({ hasText: parent }).click()
    await page.getByRole('heading', { name: new RegExp(parent), level: 1 }).waitFor({ timeout: 5000 })
    must((parent === 'สมาชิก' ? /1 · ตัวเลขสำคัญ/ : new RegExp(`${parent} — ยังว่าง`)).test(await page.locator('main').innerText()) && await page.locator('.tiletabs').count() === 0, parent + ' opens a full page without sub tabs')
    await page.getByRole('link', { name: '‹ งานอภิบาล' }).click()
  }
  must(await page.locator('.tiletabs a.btile').count() === 6, 'tabs are colored tiles like the home money tiles')
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).isVisible(), 'other work tabs open their own calendar from the top button')
  // ปุ่ม ‹ ทุกแท็บ อยู่ตำแหน่งเดียวกันในทุกงาน (1–12) และกดแล้วกลับหน้าห้องทำงาน
  // งานประกาศ / ฝ่ายทรัพย์สิน: เมนูมาตรฐานครบเหมือนงานอื่น (ปุ่มตารางงาน + ช่องแท็บ 1–6 เปิดหน้าเต็ม)
  for (const [k, nm] of [[11, 'งานประกาศ'], [12, 'ฝ่ายทรัพย์สิน'], [13, 'งานมีเดีย'], [14, 'แท็บ 14'], [15, 'แท็บ 15']]) {
    await page.goto(`http://localhost:${PORT}/#/meeting/${k}`)
    await page.getByRole('heading', { name: nm, exact: true }).waitFor({ timeout: 8000 })
    const t = await page.getByRole('navigation', { name: `หมวด${nm}`, exact: true }).getByRole('link').allInnerTexts()
    must(t.map((x) => x.replace(/^\S+\s+/, '').trim()).join('|') === 'แท็บ 1|แท็บ 2|แท็บ 3|แท็บ 4|แท็บ 5|แท็บ 6' && await page.getByRole('button', { name: /ตารางงาน/ }).isVisible() && await page.getByRole('link', { name: '‹ ทุกแท็บ' }).isVisible() && await page.locator('.workteam').count() === 1, nm + ' has the standard work menu')
    await page.getByRole('navigation', { name: `หมวด${nm}`, exact: true }).getByRole('link').nth(2).click()
    await page.getByRole('heading', { name: 'แท็บ 3', exact: true }).waitFor({ timeout: 5000 })
    must(/แท็บ 3 — ยังว่าง/.test(await page.locator('main').innerText()), nm + ' tab opens a full empty page')
  }
  const boxes = []
  for (let k = 1; k <= 15; k++) {
    await page.goto(`http://localhost:${PORT}/#/meeting/${k}`)
    const l = page.getByRole('link', { name: '‹ ทุกแท็บ' }); await l.waitFor({ timeout: 8000 })
    const b = await l.boundingBox(); boxes.push(`${Math.round(b.x)},${Math.round(b.y)},${Math.round(b.width)}`)
  }
  must(new Set(boxes).size === 1, 'same position of the back link in every work: ' + boxes.join(' | '))
  must(await page.getByRole('link', { name: '🏠 หน้างาน' }).count() === 0, 'no 🏠 หน้างาน button in the work header any more')
  await page.getByRole('link', { name: '‹ ทุกแท็บ' }).click()
  must(await page.getByRole('heading', { name: /ห้องทำงาน/ }).isVisible(), 'back link returns to the work room')
  // งานเหรัญญิก: เข้าหน้ารายละเอียดที่อยู่นอกห้องทำงาน (ยอดเงิน/กองทุน) แล้วมีปุ่มกลับหน้างานเหรัญญิก
  await page.goto(`http://localhost:${PORT}/#/meeting/3`)
  await page.locator('nav[aria-label^="เงินคริสตจักร"] a.btile').first().click()
  await page.getByRole('link', { name: /🏠 หน้างานเหรัญญิก/ }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: /🏠 หน้างานเหรัญญิก/ }).click()
  must(await page.getByText('ขั้นตอนทำบัญชีประจำสัปดาห์').isVisible(), 'back to the treasurer work home')
  // ออกไปหน้าหลักของแอปแล้วปุ่มหายไป
  await page.locator('nav[aria-label^="เงินคริสตจักร"] a.btile').first().click()
  await page.getByRole('link', { name: /🏠 หน้างานเหรัญญิก/ }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: 'เบิกจ่าย', exact: true }).click()
  must(await page.getByRole('link', { name: /🏠 หน้างานเหรัญญิก/ }).count() === 0, 'button disappears on the app\'s main pages')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('meeting-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
