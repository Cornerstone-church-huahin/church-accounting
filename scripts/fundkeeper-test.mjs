// ผู้ดูแลกองทุน: เห็นเฉพาะกองทุน (และหมวด) ที่แอดมินกำหนด · เปิดมาเข้ากองทุนนั้นทันที · กองทุน/หน้าอื่นถูกกัน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4205
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const U = `http://localhost:${PORT}/#`
const becomeKeeper = async (funds) => {
  await page.evaluate((funds) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ผู้ดูแล' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'fk1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([
      { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
      { id: 'fk1', name: 'ผู้ดูแล', role: 'fundkeeper', joined: 2, updated: 1, ...(funds ? { funds } : {}) },
    ]))
  }, funds)
  await page.goto(`${U}/`); await page.reload(); await page.waitForTimeout(1200)
}
try {
  // 1) แอดมิน (โหมดทดลอง) ตั้งหมวดในกองทุน tt9
  await page.goto(`${U}/funds/tt9`); await page.waitForLoadState('networkidle')
  for (const n of ['พืชผัก', 'โต๊ะจีน']) { await page.getByLabel('ชื่อหมวดใหม่').fill(n); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click() }
  const subs = await page.evaluate(() => { for (const k of Object.keys(localStorage)) { try { const v = JSON.parse(localStorage.getItem(k)); if (Array.isArray(v)) { const t = v.find((x) => x && x.id === 'tt9' && x.subs); if (t) return t.subs } } catch {} } return [] })
  must(subs.length === 2, 'two categories created: ' + JSON.stringify(subs))
  // 2) ผู้ดูแลทุกหมวดของ tt9
  await becomeKeeper([{ id: 'tt9' }])
  must(/#\/funds\/tt9$/.test(page.url()), 'opening the app lands directly on the assigned fund: ' + page.url())
  must(await page.locator('.balance-tiles').count() === 0, 'no money tiles / home')
  await page.goto(`${U}/funds`); await page.waitForTimeout(500)
  must(/#\/funds\/tt9$/.test(page.url()), 'the fund list redirects to the assigned fund')
  await page.goto(`${U}/funds/tt4`); await page.waitForTimeout(500)
  must(/#\/funds\/tt9$/.test(page.url()), 'another fund is not reachable')
  for (const r of ['balance/own', 'land', 'vouchers', 'settings']) { await page.goto(`${U}/${r}`); await page.waitForTimeout(400); must(/#\/funds\/tt9$/.test(page.url()), `/${r} is redirected`) }
  must(await page.getByRole('link', { name: /ทุกกองทุน/ }).count() === 0, 'no link to all funds')
  must(await page.getByRole('region', { name: 'หมวดของกองทุน' }).count() === 0, 'no category management card for the keeper')
  must(await page.locator('nav a').count() === 1, 'one menu only: ' + await page.locator('nav a').count())
  // บันทึกรายรับได้: ฟอร์มมีหมวดให้เลือก
  await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(0).click()
  await page.locator('#ire-sub').waitFor()
  await page.locator('.field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('500')
  await page.locator('.sheet button.btn--gold', { hasText: 'เพิ่มลงใบ' }).click()
  await page.waitForTimeout(600)
  const saved = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('acct.income.')).flatMap((k) => JSON.parse(localStorage.getItem(k))).filter((x) => x.typeId === 'tt9').length)
  must(saved === 1, 'keeper can record income on the assigned fund: ' + saved)
  // 3) ผู้ดูแลเฉพาะหมวดพืชผัก
  await becomeKeeper([{ id: 'tt9', subs: [subs[0].id] }])
  await page.goto(`${U}/funds/tt9`); await page.waitForTimeout(600)
  must(await page.getByRole('status', { name: /หมวดที่ดูแล/ }).count() === 1, 'restricted keeper sees the category balance instead of the whole fund')
  await page.getByRole('table', { name: /ใบบันทึกการถวาย/ }).locator('tbody tr').nth(1).click()
  const opts = await page.locator('#ire-sub option').allInnerTexts()
  must(opts.length === 1 && opts[0] === 'พืชผัก', 'form offers only the assigned category (no ส่วนกลาง): ' + opts.join('|'))
  await page.locator('.sheet').getByRole('button', { name: 'ปิด' }).click()
  await page.getByRole('tab', { name: /ใบกองทุน/ }).click()
  const bar = await page.getByRole('tablist', { name: 'เลือกหมวดของใบกองทุน' }).innerText()
  must(/พืชผัก/.test(bar) && !/โต๊ะจีน|ส่วนกลาง|รวมทุกหมวด/.test(bar), 'sheet bar lists only the assigned category: ' + bar)
  // แอดมินกำหนดกองทุนให้ผู้ดูแลในตั้งค่า
  await page.evaluate(() => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([
      { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
      { id: 'fk1', name: 'ผู้ดูแล', role: 'fundkeeper', joined: 2, updated: 1 },
    ]))
  })
  await page.goto(`${U}/settings`); await page.reload(); await page.waitForTimeout(1500)
  await page.locator('#h-mem').click()
  await page.getByText(/กองทุนที่ดูแล: ยังไม่ได้กำหนด/).waitFor({ timeout: 8000 })
  await page.getByRole('button', { name: 'กองทุน กองทุนศึกษา ของ ผู้ดูแล' }).click()
  await page.waitForTimeout(500)
  const asg = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((m) => m.id === 'fk1').funds)
  must(Array.isArray(asg) && asg.length === 1 && asg[0].id === 'tt9', 'admin assigns a fund to the keeper in settings: ' + JSON.stringify(asg))
  // ตัวเลือกสิทธิ์: ติ๊กผู้ดูแลกองทุนได้แม้มีสิทธิ์อื่นอยู่ (แทนที่ทั้งหมด) และติ๊กสิทธิ์อื่นเพื่อออกจากผู้ดูแลกองทุนได้
  await page.evaluate(() => {
    const ms = JSON.parse(localStorage.getItem('acct.members.v1'))
    ms.find((m) => m.id === 'fk1').role = 'bookkeeper'; ms.find((m) => m.id === 'fk1').roles = ['bookkeeper', 'worship', 'auditor']
    localStorage.setItem('acct.members.v1', JSON.stringify(ms))
  })
  await page.reload(); await page.waitForTimeout(1200)
  await page.locator('#h-mem').click()
  await page.getByRole('button', { name: /สิทธิ์ของ ผู้ดูแล/ }).click()
  await page.getByRole('checkbox', { name: /ผู้ดูแลกองทุน/ }).check()
  must(await page.getByRole('checkbox', { name: /ผู้ดูแลกองทุน/ }).isChecked() && await page.getByRole('checkbox', { name: /^ผู้บันทึกบัญชี/ }).isChecked() === false && await page.getByRole('checkbox', { name: /^ผู้ตรวจสอบ/ }).isChecked() === false, 'ticking ผู้ดูแลกองทุน replaces the other roles')
  await page.getByRole('checkbox', { name: /^ผู้บันทึกการนมัสการ/ }).check()
  must(await page.getByRole('checkbox', { name: /^ผู้บันทึกการนมัสการ/ }).isChecked() && await page.getByRole('checkbox', { name: /ผู้ดูแลกองทุน/ }).isChecked() === false, 'ticking another role leaves ผู้ดูแลกองทุน')
  await page.getByRole('button', { name: 'ยกเลิก' }).click()
  // 4) ยังไม่ได้รับมอบหมาย
  await becomeKeeper(undefined)
  must(await page.getByText('ยังไม่ได้รับมอบหมายกองทุน').count() === 1, 'unassigned keeper sees a clear message')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundkeeper-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
