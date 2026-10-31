// วาระของงาน: แสดงทุกห้อง · แอดมินตั้งได้พร้อมคำเตือน · คนอื่นไม่เห็นปุ่มตั้ง
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4194
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
async function run(role, works, fn) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const page = await ctx.newPage()
  await page.addInitScript(([role, works]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ท' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'u1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'u1', name: 'ท', role, works, workRoles: works.length ? { [works[0]]: 'owner' } : undefined, joined: 1, updated: 1 }]))
  }, [role, works])
  await page.goto(`http://localhost:${PORT}/#/meeting/1`); await page.reload()
  try { await fn(page) } finally { await ctx.close() }
}
try {
  await run('admin', [], async (page) => {
    const box = page.getByLabel('วาระงานเลขา')
    await box.waitFor({ timeout: 8000 })
    const y = new Date().getFullYear() + 543 + 1
    const t = await box.innerText()
    must(t.includes(`1 ม.ค. ${y}`) && t.includes(`31 ธ.ค. ${y + 1}`) && /อีก .*ปี .*เดือน .*วัน/.test(t), 'default term: ' + t)
    if (process.env.SHOT) await page.screenshot({ path: process.env.SHOT })
    await page.getByRole('button', { name: 'ตั้งวาระ' }).click()
    await page.getByLabel('วันเริ่มวาระ').fill('2027-03-01')
    await page.getByLabel('วันสิ้นสุดวาระ').fill('2029-02-28')
    let warned = false
    page.once('dialog', (d) => { warned = /ตรวจให้ถูกต้อง/.test(d.message()); d.accept() })
    await page.getByRole('button', { name: 'บันทึกวาระ' }).click()
    await page.waitForTimeout(300)
    must(warned, 'confirm warning shown')
    must((await box.innerText()).includes('1 มี.ค. 2570'), 'saved term')
  })
  await run('viewer', [1], async (page) => {
    await page.getByLabel('วาระงานเลขา').waitFor({ timeout: 8000 })
    must(await page.getByRole('button', { name: 'ตั้งวาระ' }).count() === 0, 'non-admin has no edit button')
  })
  console.log('term-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
