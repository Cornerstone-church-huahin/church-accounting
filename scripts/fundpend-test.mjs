// เตรียมนำฝาก: เงินกองทุนรายสัปดาห์เรียงต่อเนื่อง · รอนำฝาก → กด ฝากแล้ว → ติ๊ก · ส่วนใหม่ต่อแถวรอนำฝาก
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const nxt = new Date(sun); nxt.setDate(nxt.getDate() + 7)
const Y = sun.getFullYear()
await page.goto(`http://localhost:${PORT}/#/meeting/3`)
await page.evaluate(([Y, a, b]) => localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([
  { id: 'f1', date: a, typeId: 'tt4', amount: 12000, method: 'cash', source: 'manual', updated: 1 },
  { id: 'f2', date: a, typeId: 'tt8', amount: 5000, method: 'cash', source: 'manual', updated: 1 },
  { id: 'f3', date: b, typeId: 'tt8', amount: 3000, method: 'transfer', source: 'manual', updated: 1 },
])), [Y, iso(sun), iso(nxt)])
try {
  await page.goto(`http://localhost:${PORT}/#/balance/fund`); await page.reload()
  await page.getByRole('button', { name: /เตรียมนำฝาก/ }).first().click()
  const list = page.locator('.fundpend__tbl tbody tr')
  must((await list.count()) === 3, 'three rows in one continuous list: ' + await list.count())
  must((await page.locator('.fundpend__tr--wait').count()) === 3 && /รอนำฝาก/.test(await list.first().innerText()), 'all waiting with warning')
  must(/200/.test(await page.locator('.fundpend__tbl tfoot').innerText()), 'waiting total 200: ' + await page.locator('.fundpend__tbl tfoot').innerText())
  await list.first().getByRole('button', { name: /ฝากแล้ว/ }).click()
  must((await page.locator('.fundpend__tr--done').count()) === 1 && /ฝากแล้ว/.test(await list.first().innerText()), 'first row ticked as deposited')
  must(/80/.test(await page.locator('.fundpend__tbl tfoot').innerText()), 'waiting total updates: ' + await page.locator('.fundpend__tbl tfoot').innerText())
  await page.getByRole('button', { name: /ฝากแล้วทั้งหมดที่รอ/ }).click()
  must((await page.locator('.fundpend__tr--wait').count()) === 0 && /ไม่มีรายการค้างรอนำฝาก/.test(await page.locator('.fundpend__tbl tfoot').innerText()), 'mark all done')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('fundpend-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
