// เครดิตผู้ออกแบบและพัฒนาระบบ: ท้ายทุกหน้า (มือถือ/คอม) · ใบ A4 ทุกหน้า · หน้าพิมพ์ · ไม่ซ้ำ ไม่บังเนื้อหา
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4178
const APP = 'ออกแบบและพัฒนาระบบโดย มน.สมเจต เสมาทอง'
const DOC = 'จัดพิมพ์ผ่านระบบที่ออกแบบและพัฒนาโดย มน.สมเจต เสมาทอง'
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const sun = new Date(); sun.setDate(sun.getDate() + ((7 - sun.getDay()) % 7))
const a = new Date(sun); a.setDate(a.getDate() - 2)
const Y = sun.getFullYear()
const routes = ['#/', '#/income', '#/rounds', '#/vouchers', '#/funds', '#/balance/fund', '#/reports', '#/members', '#/more', '#/settings', '#/join', '#/land', '#/meeting', '#/meeting/4', '#/meeting/4/1', '#/meeting/1/4', '#/meeting/1/4/4', '#/meeting/9/2', '#/meeting/notes']
try {
  for (const vp of [{ width: 390, height: 800 }, { width: 1280, height: 800 }]) {
    const ctx = await browser.newContext({ viewport: vp, locale: 'th-TH' })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`http://localhost:${PORT}/#/meeting/3`)
    await page.evaluate(([Y, d]) => {
      localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([{ id: 'i1', date: d, typeId: 'tt1', amount: 285500, method: 'cash', source: 'manual', updated: 1 }]))
      localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify(Array.from({ length: 40 }, (_, i) => ({ id: 'm' + i, channel: 'manual', date: d, amount: 1000, desc: 'รายการ ' + (i + 1), status: 'paid', method: 'cash', updated: 1 }))))
    }, [Y, iso(a)])
    for (const r of routes) {
      await page.goto(`http://localhost:${PORT}/${r}`); await page.reload()
      await page.waitForTimeout(250)
      const c = page.locator('[data-credit="app"]')
      must((await c.count()) === 1, `${vp.width}px ${r}: exactly one app credit (got ${await c.count()})`)
      must((await c.innerText()).trim() === APP, `${r}: credit text`)
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(100)
      const cb = await c.boundingBox(), nav = await page.locator('.bottomnav').boundingBox()
      must(cb && (!nav || cb.y + cb.height <= nav.y + 1), `${vp.width}px ${r}: credit not covered by the bottom nav (${JSON.stringify(cb)} vs ${JSON.stringify(nav)})`)
      must(cb.width <= vp.width && cb.x >= 0, `${r}: credit fits the viewport width`)
      const pos = await c.evaluate((el) => getComputedStyle(el).position)
      must(pos !== 'fixed' && pos !== 'absolute', `${r}: credit does not float (position ${pos})`)
    }
    // ใบ A4: ทุกหน้ามีเครดิตเอกสาร ครั้งเดียวต่อหน้า (ใบสรุปแผ่นเดียวเสมอ)
    await page.goto(`http://localhost:${PORT}/#/meeting/3`)
    await page.getByRole('tab', { name: /สรุป/ }).first().click()
    await page.getByRole('button', { name: /เปิดใบสรุปรายสัปดาห์/ }).click()
    const pages = page.locator('.a4page')
    const n = await pages.count()
    must(n >= 1, 'notice has at least one page (always a single sheet): ' + n)
    for (let i = 0; i < n; i++) {
      const cc = pages.nth(i).locator('[data-credit="doc"]')
      must((await cc.count()) === 1 && (await cc.innerText()).trim() === DOC, `notice page ${i + 1} has exactly one document credit`)
    }
    must((await page.locator('[data-credit="app"]').count()) === 1, 'app credit still once on the page with documents')
    // หน้าพิมพ์ (รายงาน/ใบเบิก/ใบนับ/ทะเบียนสมาชิก): กรอบพิมพ์มีเครดิตเป็นส่วนท้ายซ้ำทุกหน้า และเครดิตหน้าจอไม่ถูกพิมพ์
    await page.emulateMedia({ media: 'print' })
    for (const r of ['#/reports', '#/members?tab=roster', `#/rounds/${iso(a)}`]) {
      await page.goto(`http://localhost:${PORT}/${r}`); await page.reload(); await page.waitForTimeout(250)
      const f = page.locator('.print-frame')
      must((await f.count()) === 1, `${r}: exactly one print frame (got ${await f.count()})`)
      must((await f.locator('[data-credit="print"]').innerText()).trim() === DOC, `${r}: print credit text`)
      must((await f.locator('> tfoot').evaluate((el) => getComputedStyle(el).display)) === 'table-footer-group', `${r}: footer repeats on every printed page`)
      must((await page.locator('[data-credit="app"]').count()) === 0 || (await page.locator('[data-credit="app"]').evaluate((el) => getComputedStyle(el).display)) === 'none', `${r}: screen credit not printed`)
    }
    await page.emulateMedia({ media: 'screen' })
    must(errors.length === 0, 'no page errors: ' + errors.join('|'))
    if (vp.width === 390) await page.screenshot({ path: '/tmp/credit-mobile.png' })
    await ctx.close()
  }
  console.log('credit-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
