// ทางลัด วันเกิดสมาชิก/รายงานการนมัสการ บนหน้ารวมสมาชิกของห้องงาน: ทุกระดับเห็น · ดูอย่างเดียว · เห็นเท่าที่จำเป็น
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4199
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
async function run(role, works, fn, shot, path = '/meeting/4/1') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, locale: 'th-TH' })
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const page = await ctx.newPage()
  await page.addInitScript(([role, works]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ท' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'u1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'u1', name: 'ท', role, works, workRoles: works.length ? { [works[0]]: 'advisor' } : undefined, joined: 1, updated: 1 }]))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([
      { id: 'a', name: 'สมชาย ใจดี', nick: 'ชาย', status: 'สมบูรณ์ ( 1 )', gender: 'ชาย', birth: '1980-03-15', updated: 1 },
      { id: 'b', name: 'สมหญิง รักดี', status: 'สมบูรณ์ ( 1 )', gender: 'หญิง', birth: '1990-11-02', updated: 1 },
      { id: 'c', name: 'ผู้ล่วงลับ ท่านหนึ่ง', status: 'เสียชีวิต', birth: '1950-01-05', updated: 1 },
    ]))
    localStorage.setItem('acct.attendance.2026.v1', JSON.stringify([
      { id: 'k1', date: '2026-10-25', mid: 'a', tm: '09:00', rec: 'ก', updated: 1000 },
      { id: 'k2', date: '2026-10-25', mid: 'b', tm: '09:05', rec: 'ก', updated: 1001 },
    ]))
  }, [role, works])
  await page.goto(`http://localhost:${PORT}/#${path}`); await page.reload()
  try { await fn(page); if (shot) await page.screenshot({ path: shot }) } finally { await ctx.close() }
}
const check = async (page) => {
  const pills = page.getByRole('group', { name: 'ทางลัดดูอย่างเดียว' })
  await pills.waitFor({ timeout: 10000 })
  must(await pills.getByRole('button').count() === 2, 'two shortcut buttons')
  await pills.getByRole('button', { name: /วันเกิดสมาชิก/ }).click()
  const dlg = page.getByRole('dialog', { name: 'วันเกิดสมาชิก' })
  await dlg.waitFor()
  const t = await dlg.innerText()
  must(/สมชาย ใจดี/.test(t) && /สมหญิง รักดี/.test(t), 'names shown: ' + t)
  must(!/ผู้ล่วงลับ/.test(t), 'deceased hidden')
  must(!/1980|2523|อายุ|สมบูรณ์/.test(t), 'no birth year / age / status: ' + t)
  must(/15 มีนาคม/.test(t), 'day-month shown')
  must(await dlg.getByRole('button', { name: /ดูข้อมูล/ }).count() === 0, 'rows are not clickable')
  await dlg.getByRole('button', { name: 'ปิด' }).click()
  await pills.getByRole('button', { name: /รายงานการนมัสการ/ }).click()
  const d2 = page.getByRole('dialog', { name: 'รายงานการนมัสการ' })
  await d2.waitFor()
  const t2 = await d2.innerText()
  must(/จำนวนครั้งที่มีบันทึก/.test(t2) && /25/.test(t2), 'report summary shown')
  must(!/สมชาย|สมหญิง/.test(t2), 'no member names in report')
}
try {
  await run('admin', [], check, process.env.SHOT)
  await run('viewer', [4], check)
  // หน้าหลักของห้องงานไม่มีทางลัดนี้ (อยู่เฉพาะหน้ารวมสมาชิก)
  for (const n of [1, 2, 3, 5, 14]) await run('admin', [], async (page) => {
    await page.getByRole('heading').first().waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    must(await page.getByRole('group', { name: 'ทางลัดดูอย่างเดียว' }).count() === 0, `no shortcuts on room ${n} home`)
  }, undefined, `/meeting/${n}`)
  console.log('quickreports-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
