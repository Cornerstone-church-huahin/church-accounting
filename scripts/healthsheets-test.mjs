// หน้าสถานะการเงิน: การ์ดบนกะทัดรัด + แผ่นงานต่อกัน (รับ/จ่าย/ข้อมูลก่อนติดบอร์ด/สำหรับติดบอร์ด) มีติ๊กเลือก แผงลอย และไอคอน 4 ปุ่ม · ผู้ดูอย่างเดียวไม่เห็นใบรายละเอียดก่อนติดบอร์ด
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4243
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const run = async (role) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const page = await ctx.newPage()
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript((role) => {
    navigator.canShare = () => true; window.__shared = null
    navigator.share = async (x) => { window.__shared = x.files[0].type }
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ผู้ทดสอบ' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'u1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'u1', name: 'ผู้ทดสอบ', role, works: [1], joined: 1, updated: 1 }]))
  }, role)
  await page.goto(`http://localhost:${PORT}/#/meeting/1/health`); await page.reload()
  await page.getByRole('region', { name: 'บันทึกรายรับ' }).waitFor({ timeout: 15000 })
  const card = await page.locator('.healthcard').boundingBox()
  must(card.height < 150, role + ': health card compact: ' + card.height)
  must(await page.getByRole('region', { name: 'ดูรายละเอียดบัญชี' }).count() === 0, role + ': old link block removed')
  must(await page.getByRole('link', { name: /ภาพรวมรายรับ-รายจ่าย/ }).count() === 1, role + ': overview still reachable')
  const names = ['เครื่องมือใบบันทึกการถวาย', 'เครื่องมือใบเบิก-จ่ายเงินสด', 'เครื่องมือใบสำหรับติดบอร์ดประกาศ']
  if (role === 'admin') names.push('เครื่องมือข้อมูลก่อนติดบอร์ด')
  for (const n of names) { const tb = page.getByRole('toolbar', { name: n }); await tb.waitFor({ timeout: 10000 }); must(await tb.getByRole('button').count() === 4, role + ': 4 icons ' + n) }
  must((await page.getByRole('region', { name: 'ข้อมูลก่อนติดบอร์ด' }).count()) === (role === 'admin' ? 1 : 0), role + ': detail sheet only with detail permission')
  await page.getByRole('checkbox', { name: 'เลือก รายรับ' }).check()
  const dock = page.getByRole('toolbar', { name: 'ส่งออกแผ่นงานที่เลือก' })
  await dock.waitFor()
  await page.getByRole('checkbox', { name: 'เลือก สำหรับติดบอร์ดประกาศ' }).check()
  must((await dock.innerText()).includes('เลือก 2 แผ่น'), role + ': dock counts')
  await dock.getByRole('button', { name: /^แชร์ PDF/ }).click()
  await page.waitForFunction(() => window.__shared, null, { timeout: 40000 })
  must((await page.evaluate(() => window.__shared)) === 'application/pdf', role + ': shared pdf')
  must(errors.length === 0, role + ': no errors ' + errors.join('|'))
  await ctx.close()
}
try { await run('admin'); await run('viewer'); console.log('healthsheets-test OK') } catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
