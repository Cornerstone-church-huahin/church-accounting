// ใบเบิก-จ่าย A4: ช่อง "หมายเหตุ · ต้องเบิก" อยู่ในหน้าเสมอ เห็นถึงยอดรวมต้องเบิก (ไม่ถูกตัด) แม้มีรายการต้องเบิกมาก
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4212
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7)); sun.setHours(12)
const d1 = new Date(sun); d1.setDate(d1.getDate() - 2)
const Y = sun.getFullYear()
const fits = async () => page.evaluate(() => [...document.querySelectorAll('.a4page')].map((e) => { const t = [...e.querySelectorAll('table[aria-label="หมายเหตุ ต้องเบิก"] tfoot')][0]; const c = e.getBoundingClientRect(); const tr = t?.getBoundingClientRect(); return { over: e.scrollHeight > e.clientHeight + 1, hasTotal: !!t, bottomOk: t ? tr.bottom <= c.bottom - 0.5 : true } }))
for (const n of [14, 26, 60]) {
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.evaluate(([Y, a, n]) => {
    localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: 'e' + i, channel: 'manual', date: a, amount: 10000 + i, desc: 'รายการทดสอบยาว ๆ เพื่อดูการตัดบรรทัด ' + (i + 1), status: 'paid', method: 'cash', biller: 'พี่ผู้วางบิล', updated: i }))))
  }, [Y, iso(d1), n])
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click(); await page.waitForTimeout(800)
  const r = await fits()
  must(r.every((x) => !x.over), `${n} items: no A4 page overflows: ` + JSON.stringify(r))
  must(r.some((x) => x.hasTotal && x.bottomOk), `${n} items: the withdraw table incl. the total is fully inside a page: ` + JSON.stringify(r))
  must(/รวมต้องเบิก/.test((await page.locator('.a4page').allInnerTexts()).join('\n')), `${n} items: total shown`)
  const clash = await page.evaluate(() => [...document.querySelectorAll('.a4page')].map((e) => { const t = e.querySelector('table[aria-label="หมายเหตุ ต้องเบิก"]'); const c = e.querySelector('.doccredit'); return t && c ? t.getBoundingClientRect().bottom - c.getBoundingClientRect().top : -99 }).filter((x) => x > -99))
  must(clash.every((x) => x <= 0.5), `${n} items: the withdraw box never overlaps the credit line: ` + JSON.stringify(clash))
  if (n === 26) await page.locator('.a4page').first().screenshot({ path: 'shots/voucher-withdraw.png' })
}
must(errors.length === 0, 'no page errors: ' + errors.join('|'))
console.log('voucherfit-test OK')
await browser.close(); server.kill()
