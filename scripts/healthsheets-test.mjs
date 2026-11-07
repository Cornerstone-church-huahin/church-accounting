// หน้าสถานะการเงิน (ดูอย่างเดียว): การ์ดบนกะทัดรัด + แผ่นงานต่อกัน (รับ/จ่าย/ข้อมูลก่อนติดบอร์ด/สำหรับติดบอร์ด) ไม่มีติ๊กเลือก/ดาวน์โหลด/แชร์/พิมพ์ · ผู้ดูอย่างเดียวไม่เห็นใบรายละเอียดก่อนติดบอร์ด
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
  await page.getByRole('region', { name: 'สำหรับติดบอร์ดประกาศ' }).waitFor({ timeout: 15000 })
  const card = await page.locator('.healthcard').boundingBox()
  must(card.height < 150, role + ': health card compact: ' + card.height)
  must(await page.getByRole('region', { name: 'ดูรายละเอียดบัญชี' }).count() === 0, role + ': old link block removed')
  must(await page.getByRole('link', { name: /ภาพรวมรายรับ-รายจ่าย/ }).count() === 1, role + ': overview still reachable')
  // หน้าดูอย่างเดียว: ไม่มีช่องติ๊ก ไม่มีแผงลอย ไม่มีแถบดาวน์โหลด/แชร์/พิมพ์ใต้แผ่น
  must(await page.getByRole('checkbox').count() === 0, role + ': no tick boxes')
  must(await page.getByRole('toolbar').count() === 0, role + ': no export toolbars')
  for (const n of ['ดาวน์โหลด', 'แชร์', 'พิมพ์']) must(await page.getByRole('button', { name: new RegExp(n) }).count() === 0, role + ': no ' + n + ' button')
  // เหลือเฉพาะแผ่นสำหรับติดบอร์ดประกาศ (ไม่มีใบรับ/ใบจ่าย/ข้อมูลก่อนติดบอร์ด)
  must(await page.getByRole('region', { name: 'สำหรับติดบอร์ดประกาศ' }).count() === 1, role + ': board sheet shown')
  for (const n of ['บันทึกรายรับ', 'บันทึกรายจ่าย', 'ข้อมูลก่อนติดบอร์ด']) must(await page.getByRole('region', { name: n }).count() === 0, role + ': no ' + n)
  must(errors.length === 0, role + ': no errors ' + errors.join('|'))
  await ctx.close()
}
try { await run('admin'); await run('viewer'); console.log('healthsheets-test OK') } catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
