// เครื่องที่ยังไม่เชื่อมต่อต้องเห็นแค่หน้า "วางลิงก์เชิญ" (ไม่มีห้องทำงาน/ตัวเลข) · บิลด์นี้ต้องไม่ตั้ง VITE_ALLOW_SOLO
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4391
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const must = (c, m) => { if (!c) { console.error('FAIL', m); server.kill(); process.exit(1) } console.log('ok', m) }
const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}); const page = await b.newPage()
const base = `http://localhost:${PORT}/`
for (const h of ['', '#/', '#/meeting/18', '#/income', '#/vouchers']) {
  await page.goto(base + h); await page.waitForTimeout(500)
  must(await page.locator('#cg-link').count() === 1, `gate shows at "${h}"`)
  must(await page.locator('.topbar, .tabbar, nav').count() === 0, `no app chrome at "${h}"`)
  must(!(await page.locator('body').innerText()).includes('โหมดทดลอง'), 'no solo banner')
}
await page.goto(base + '#/'); await page.fill('#cg-link', 'ขยะ'); await page.click('text=เชื่อมต่อด้วยลิงก์นี้')
must(await page.locator('[role=alert]').count() === 1, 'bad link shows error')
await page.fill('#cg-link', base + '#/join?t=ghp_x&r=a/b'); await page.click('text=เชื่อมต่อด้วยลิงก์นี้'); await page.waitForTimeout(500)
must(page.url().includes('#/join'), 'valid link goes to join page')
await page.goto(base + '#/settings'); await page.waitForTimeout(400)
must(await page.locator('#cg-link').count() === 0, 'settings reachable for first-time admin')
await page.evaluate(() => localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'a/b', token: 'x', name: 'n' })))
await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
await page.goto(base + '#/'); await page.reload(); await page.waitForTimeout(500)
must(await page.locator('#cg-link').count() === 0, 'configured device sees the app')
await b.close(); server.kill()
