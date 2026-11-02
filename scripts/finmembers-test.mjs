// งานเหรัญญิก: ปุ่มรวมสมาชิกใต้ขั้นตอน 1–6 (ขั้นตอนเดิมครบ) → เปิดหน้ารวมสมาชิกได้ทั้งแอดมินและเหรัญญิก
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4202
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
async function run(role, works, shot) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1000 }, locale: 'th-TH' })
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const page = await ctx.newPage()
  await page.addInitScript(([role, works]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ท' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'u1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'u1', name: 'ท', role, works, workRoles: works.length ? { [works[0]]: 'owner' } : undefined, joined: 1, updated: 1 }]))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'a', name: 'สมาชิกทดสอบ', status: 'สมบูรณ์ ( 1 )', updated: 1 }]))
  }, [role, works])
  try {
    await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.reload()
    const tile = page.getByRole('link', { name: 'รวมสมาชิก' })
    await tile.waitFor({ timeout: 10000 })
    must(await page.locator('.stepbtn').count() === 6, 'six original step tiles intact')
    const yTile = (await tile.boundingBox()).y, ySteps = (await page.locator('.stepbtn').last().boundingBox()).y
    must(yTile > ySteps, 'members tile sits below the six steps')
    if (shot) await page.screenshot({ path: shot })
    await tile.click()
    await page.getByRole('heading', { name: /รวมสมาชิก/ }).waitFor({ timeout: 8000 })
    await page.getByText('สมาชิกทดสอบ').first().waitFor({ timeout: 8000 })
    await page.getByRole('link', { name: /งานเหรัญญิก/ }).click()
    await page.locator('.stepbtn').first().waitFor({ timeout: 8000 })
  } finally { await ctx.close() }
}
try {
  await run('admin', [], process.env.SHOT)
  await run('viewer', [3])
  console.log('finmembers-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
