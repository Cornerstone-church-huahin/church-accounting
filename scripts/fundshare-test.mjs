// ใบกองทุน: มีปุ่มแชร์ข้างดาวน์โหลดและพิมพ์ · กดแล้วเปิดเมนูแชร์พร้อมไฟล์ PDF
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4205
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const Y = sun.getFullYear()
await page.addInitScript(([Y, d]) => {
  navigator.canShare = () => true
  navigator.share = async (x) => { window.__shared = { name: x.files[0].name, type: x.files[0].type, size: x.files[0].size } }
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([{ id: 'f1', date: d, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 }]))
}, [Y, iso(sun)])
try {
  await page.goto(`http://localhost:${PORT}/#/funds/tt4`); await page.reload()
  must(await page.getByRole('tab', { name: /ใบกองทุน/ }).count() === 0, 'tab row removed')
  for (const n of ['เครื่องมือใบบันทึกการถวาย', 'เครื่องมือใบเบิก-จ่ายเงินสด', 'เครื่องมือใบกองทุน ใบรับ', 'เครื่องมือใบกองทุน ใบจ่าย']) {
    const t = page.getByRole('toolbar', { name: n })
    await t.waitFor({ timeout: 10000 })
    must(await t.getByRole('button').count() === 4, n + ' has four icons')
  }
  const tin = page.getByRole('toolbar', { name: 'เครื่องมือใบกองทุน ใบรับ' })
  const sb = tin.getByRole('button', { name: /^แชร์ PDF/ })
  must(await sb.isVisible() && await tin.getByRole('button', { name: /^แชร์เป็นรูป/ }).isVisible(), 'share pdf + share image buttons visible')
  if (process.env.SHOT) { await sb.scrollIntoViewIfNeeded(); await page.screenshot({ path: process.env.SHOT }) }
  await sb.click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 40000 })
  const sh = await page.evaluate(() => window.__shared)
  must(sh.type === 'application/pdf' && /^fund-.*\.pdf$/.test(sh.name) && sh.size > 1000, 'device share sheet opened with the fund PDF: ' + JSON.stringify(sh))
  await page.evaluate(() => { window.__shared = null })
  await tin.getByRole('button', { name: /^แชร์เป็นรูป/ }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 40000 })
  const shi = await page.evaluate(() => window.__shared)
  must(shi.type === 'image/png' && shi.size > 1000, 'image share opened with a PNG: ' + JSON.stringify(shi))
  // ติ๊กเลือกแผ่นงาน → แผงปุ่มลอยมุมบนซ้าย → ส่งออกเฉพาะที่เลือก
  must(await page.getByRole('toolbar', { name: 'ส่งออกแผ่นงานที่เลือก' }).count() === 0, 'no dock before ticking')
  await page.getByRole('checkbox', { name: 'เลือก รายรับ' }).check()
  const dock = page.getByRole('toolbar', { name: 'ส่งออกแผ่นงานที่เลือก' })
  await dock.waitFor({ timeout: 5000 })
  const bb = await dock.boundingBox()
  must(bb.x < 20 && bb.y < 120 && bb.width < 260, 'dock floats top-left and small: ' + JSON.stringify(bb))
  must(await dock.getByRole('button', { name: /แผ่นที่เลือก/ }).count() === 4, 'dock has the four actions')
  await page.getByRole('checkbox', { name: 'เลือก สรุป ใบกองทุน ใบรับ' }).check()
  await page.screenshot({ path: '/tmp/claude-0/-home-user/40071fdd-6ce1-5923-b9bf-7ff374fad5f4/scratchpad/dock.png' })
  must((await dock.innerText()).includes('เลือก 2 แผ่น'), 'dock counts ticked sheets: ' + await dock.innerText())
  await page.evaluate(() => { window.__shared = null })
  await dock.getByRole('button', { name: /^แชร์ PDF/ }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 60000 })
  const sp = await page.evaluate(() => window.__shared)
  must(sp.type === 'application/pdf' && sp.size > 1000, 'picked sheets shared as one PDF: ' + JSON.stringify(sp))
  await page.getByRole('checkbox', { name: 'เลือก รายรับ' }).uncheck()
  await page.getByRole('checkbox', { name: 'เลือก สรุป ใบกองทุน ใบรับ' }).uncheck()
  must(await dock.count() === 0, 'dock disappears when nothing ticked')
  // ส่วนหัวกะทัดรัด: จัดการหมวดพับไว้หลังปุ่ม ⚙️ แล้วกดเปิดได้
  must(await page.getByLabel('ชื่อหมวดใหม่').count() === 0, 'category manager collapsed by default')
  await page.getByRole('button', { name: 'จัดการหมวด · ยอดแต่ละหมวด' }).click()
  must(await page.getByLabel('ชื่อหมวดใหม่').isVisible(), 'gear opens the category manager')
  // หมวด: แถบเลือกหมวดด้านบนแถบเดียว — ใบกองทุนตามหมวดที่เลือก ไม่มีแถบซ้ำ
  for (const n of ['พืชผัก', 'โต๊ะจีน']) { await page.getByLabel('ชื่อหมวดใหม่').fill(n); await page.getByRole('button', { name: '＋ เพิ่มหมวด' }).click() }
  await page.waitForTimeout(500)
  must(await page.getByRole('tablist', { name: 'เลือกหมวดของใบกองทุน' }).count() === 0, 'no duplicate category chooser above the summary sheet')
  await page.getByRole('tab', { name: 'โต๊ะจีน' }).first().click()
  await page.waitForTimeout(500)
  must(/ใบกองทุน · .*โต๊ะจีน/.test(await page.locator('[data-sheet="fin"]').innerText()), 'summary ledger follows the chosen category')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundshare-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
