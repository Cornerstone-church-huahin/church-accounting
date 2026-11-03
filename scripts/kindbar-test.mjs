// ใบรับมีแถบสีเขียว · ใบจ่ายมีแถบสีแดง (ทุกหน้าที่เป็นเอกสารรับ/จ่าย)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4206
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
const sun = new Date(); sun.setDate(sun.getDate() - sun.getDay())
const Y = sun.getFullYear()
await page.addInitScript(([Y, d]) => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
  localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([{ id: 'i1', date: d, typeId: 'tt1', amount: 5000, method: 'cash', source: 'manual', updated: 1 }]))
  localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify([{ id: 'e1', channel: 'manual', date: d, amount: 1200, desc: 'ค่าของ', status: 'paid', method: 'cash', updated: 2 }]))
}, [Y, iso(sun)])
const bar = (sel) => page.locator(sel).first().evaluate((e) => getComputedStyle(e, '::before').backgroundColor)
try {
  for (const [path, sel, color, name] of [['#/meeting/3/in', '.a4page--inc', 'rgb(31, 138, 76)', 'income'], ['#/meeting/3/out', '.a4page--exp', 'rgb(196, 51, 42)', 'expense']]) {
    await page.goto(`http://localhost:${PORT}/${path}`); await page.reload()
    await page.locator(sel).first().waitFor({ state: 'attached', timeout: 15000 })
    must((await bar(sel)) === color, `${name} sheet bar colour: ` + await bar(sel))
    const tcls = name === 'income' ? '.tkind-in' : '.tkind-out'
    must(await page.locator(tcls).count() > 0, `${name} table carries its colour rule`)
    must(await page.locator(name === 'income' ? '.a4page--exp' : '.a4page--inc').count() === 0, `${name} page has no opposite-colour sheet`)
  }
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('kindbar-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
