import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4391
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1 } }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {}); const p = await b.newPage({ viewport: { width: 390, height: 800 } })
  await p.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const Y = new Date().getFullYear()
  await p.addInitScript(([Y]) => {
        localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
    localStorage.setItem('acct.types.v1', JSON.stringify([{ id: 'ta', name: 'กองทุน-กิจกรรม', fund: true, actMode: true, active: true, order: 0, updated: 1, activities: [{ id: 'a1', name: 'โต๊ะจีน', date: `${Y}-03-01` }], subs: [{ id: 's1', name: 'รับ', actId: 'a1' }] }]))
    localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([{ id: 'i1', date: `${Y}-03-02`, typeId: 'ta', subId: 's1', amount: 1000000, method: 'cash', source: 'manual', fz: true, updated: 1 }]))
  }, [Y])
  await p.goto(`http://localhost:${PORT}/#/`); await p.reload(); await p.waitForTimeout(2000)
  const cap = await p.locator('.moneystrip__cap, [aria-label="เงินคริสตจักร ณ วันนี้"]').first().innerText()
  must(/เงินกิจกรรม/.test(cap), 'caption shows เงินกิจกรรม: ' + cap)
  await p.getByRole('link', { name: /เงินกิจกรรม/ }).first().click(); await p.waitForTimeout(800)
  const t = await p.locator('main, body').first().innerText()
  must(p.url().includes('/activity/'), 'url ' + p.url())
  must(/เงินกิจกรรม/.test(t) && !/ทุกกองทุน/.test(t) && !/กองทุน-กิจกรรม/.test(t), 'page has no fund wording: ' + t.slice(0, 300))
  must(/10,000\.00/.test(t), 'activity balance: ' + t.slice(0, 300))
  await b.close()
} finally { server.kill() }
if (!process.exitCode) console.log('activitymenu-test OK')
