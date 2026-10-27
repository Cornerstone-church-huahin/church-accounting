// ยอดเงินคงเหลือ กองทุน และเงินยืม ดูได้เฉพาะแอดมิน/ผู้บันทึกบัญชี/ผู้ตรวจสอบ · ผู้ดูอย่างเดียวเห็นเฉพาะใบสรุปรับ-จ่ายรายสัปดาห์
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4194
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const members = [
  { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
  { id: 'vw1', name: 'ผู้ดู', role: 'viewer', joined: 2, updated: 1 },
  { id: 'au1', name: 'ผู้ตรวจ', role: 'auditor', joined: 3, updated: 1 },
  { id: 'ld1', name: 'หัวหน้าทีม', role: 'viewer', works: [5], joined: 5, updated: 1 },
  { id: 'bk1', name: 'ผู้บันทึก', role: 'bookkeeper', joined: 4, updated: 1 },
]
async function open(id, name) {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(([id, name, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, [id, name, members])
  await page.goto(`http://localhost:${PORT}/`); await page.waitForTimeout(1200)
  return page
}
const U = `http://localhost:${PORT}/#`
try {
  for (const [id, name, allowed] of [['vw1', 'ผู้ดู', false], ['ad1', 'แอดมิน', true], ['au1', 'ผู้ตรวจ', true], ['bk1', 'ผู้บันทึก', true]]) {
    const page = await open(id, name)
    await page.goto(`${U}/`); await page.waitForTimeout(600)
    must((await page.locator('.balance-tiles--strip').count() > 0) === allowed, `${name}: home money tiles ${allowed ? 'shown' : 'hidden'}`)
    must(await page.locator('.hubgrid a').count() === 18, `${name}: home is the work room with 18 tabs`)
    await page.goto(`${U}/meeting/3`); await page.waitForTimeout(600)
    must((await page.locator('.balance-tiles').count() > 0) === allowed, `${name}: treasurer page money tiles ${allowed ? 'shown' : 'hidden'}`)
    must(await page.locator('.stepgrid').count() > 0, `${name}: weekly steps still there (tab 3)`)
    for (const route of ['balance/own', 'balance/indebt', 'funds', 'land']) {
      await page.goto(`${U}/${route}`); await page.waitForTimeout(500)
      const gated = /ดูได้เฉพาะแอดมิน ผู้บันทึกบัญชี และผู้ตรวจสอบ/.test(await page.locator('main').innerText())
      must(gated === !allowed, `${name}: /${route} ${allowed ? 'opens' : 'is blocked'}`)
    }
    await page.goto(`${U}/meeting/5/all`); await page.waitForTimeout(600)
    must((await page.getByRole('region', { name: /โซน 1/ }).count() > 0) === allowed, `${name}: overview zone 1 (balances) ${allowed ? 'shown' : 'hidden'}`)
    must(await page.getByRole('region', { name: /โซน 3/ }).count() === 1, `${name}: overview still lists the weekly summaries`)
    await page.goto(`${U}/meeting/5/out`); await page.waitForTimeout(800)
    must((await page.locator('[aria-label="ยอดเงินหมุนเวียน"]').count() > 0) === allowed, `${name}: weekly sheet balance box ${allowed ? 'shown' : 'hidden'}`)
    if (!allowed) must(!/เงินหมุนเวียนทั้งหมดปัจจุบัน/.test(await page.locator('main').innerText()), 'no balance wording left for the viewer')
    await page.context().close()
  }
  // ระดับ 2: หัวหน้าทีม = ดูภาพรวมยอดรวมในห้องงานของตัวเองอย่างเดียว ไม่เห็นหน้าหลัก/หน้ายอด/กองทุน
  {
    const page = await open('ld1', 'หัวหน้าทีม')
    await page.goto(`${U}/`); await page.waitForTimeout(600)
    must(await page.locator('.balance-tiles--strip').count() === 0, 'leader: home money strip hidden')
    for (const route of ['balance/own', 'funds', 'land']) {
      await page.goto(`${U}/${route}`); await page.waitForTimeout(500)
      must(/ดูได้เฉพาะแอดมิน/.test(await page.locator('main').innerText()), `leader: /${route} blocked`)
    }
    await page.goto(`${U}/meeting/5/all`); await page.waitForTimeout(600)
    must(await page.getByRole('region', { name: /โซน 1/ }).count() > 0, 'leader: overview totals shown')
    must(await page.getByRole('button', { name: /ข้อความสรุปสถานการณ์/ }).count() === 0, 'leader cannot edit the note')
    must(!/เงินเดือน/.test(await page.getByRole('region', { name: /โซน 2/ }).innerText()) || /ยอดรวม/.test(await page.getByRole('region', { name: /โซน 2/ }).innerText()), 'leader: no per-person salary in notice')
    await page.goto(`${U}/meeting/5/out`); await page.waitForTimeout(800)
    must(await page.locator('[aria-label="ยอดเงินหมุนเวียน"]').count() > 0, 'leader: weekly sheet balance box shown')
    await page.context().close()
  }
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('balance-gate-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
