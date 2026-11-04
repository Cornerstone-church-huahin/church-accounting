// หน้าเงินหมุนเวียน: ยอดคงเหลือกะทัดรัด + แผ่นรายรับ/รายจ่าย (ไอคอน 4 ปุ่ม + สแกนใบ) + ติ๊กเลือกส่งออก
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4237
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
const page = await ctx.newPage()
const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(() => {
  navigator.canShare = () => true
  window.__shared = null
  navigator.share = async (x) => { window.__shared = { type: x.files[0].type, size: x.files[0].size } }
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
})
try {
  await page.goto(`http://localhost:${PORT}/#/balance/own`); await page.reload()
  const card = page.getByRole('region', { name: 'เงินหมุนเวียน', exact: true })
  await card.waitFor({ timeout: 10000 })
  const bb = await card.boundingBox()
  must(bb.height < 130, 'balance card is compact: ' + bb.height)
  must(await page.getByLabel('ที่มาของเงินหมุนเวียน').count() === 1, 'breakdown line present')
  for (const n of ['บันทึกรายรับ', 'บันทึกรายจ่าย', 'ข้อมูลก่อนติดบอร์ด', 'สำหรับติดบอร์ดประกาศ']) await page.getByRole('region', { name: n }).waitFor()
  for (const n of ['เครื่องมือใบบันทึกการถวาย', 'เครื่องมือใบเบิก-จ่ายเงินสด', 'เครื่องมือข้อมูลก่อนติดบอร์ด', 'เครื่องมือใบสำหรับติดบอร์ดประกาศ']) {
    const tb = page.getByRole('toolbar', { name: n }); await tb.waitFor({ timeout: 10000 })
    must(await tb.getByRole('button').count() === 4, n + ' has four icons')
  }
  // ติ๊กเลือก → แผงลอย → แชร์ PDF
  await page.getByRole('checkbox', { name: 'เลือก รายรับ' }).check()
  const dock = page.getByRole('toolbar', { name: 'ส่งออกแผ่นงานที่เลือก' })
  await dock.waitFor()
  await page.getByRole('checkbox', { name: 'เลือก รายจ่าย' }).check()
  must((await dock.innerText()).includes('เลือก 2 แผ่น'), 'two sheets picked')
  await dock.getByRole('button', { name: /^แชร์ PDF/ }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 60000 })
  must((await page.evaluate(() => window.__shared)).type === 'application/pdf', 'picked sheets shared as PDF')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('ownsheets-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
