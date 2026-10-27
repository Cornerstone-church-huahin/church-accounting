// หน้าแรก = ห้องทำงาน: แถบเงิน 6 ช่องบนสุด + แท็บ 1–18 พอดีจอ · ลิงก์ทุกอันใช้ได้เหมือนเดิม (บัญชีอยู่ที่ แท็บ 3 งานเหรัญญิก)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4194
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  must(await page.getByRole('heading', { name: /ห้องทำงาน/ }).isVisible(), 'home is the work room')
  const hrefs = await page.locator('.balance-tiles--strip a').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  must(JSON.stringify(hrefs) === JSON.stringify(['#/balance/own', '#/balance/fund', '#/balance/total', '#/balance/indebt', '#/balance/debt', '#/land']), 'six money tiles on top with the right links: ' + hrefs)
  const tabs = await page.locator('.hubgrid a').evaluateAll((els) => els.map((e) => e.getAttribute('href')))
  must(tabs.length === 18 && tabs.every((h, i) => h === `#/meeting/${i + 1}`), '18 work tabs link to /meeting/1..18: ' + tabs.length)
  const ys = await page.evaluate(() => { const t = [...document.querySelectorAll('.hubgrid a')].map((e) => e.getBoundingClientRect()); const nav = document.querySelector('.bottomnav').getBoundingClientRect(); return { bottom: Math.max(...t.map((x) => x.bottom)), nav: nav.top, widths: [...new Set(t.map((x) => Math.round(x.width)))].length } })
  must(ys.bottom <= ys.nav + 1, `all 18 tabs fit above the bottom bar without scrolling (${ys.bottom} <= ${ys.nav})`)
  must(ys.widths === 1, 'all tab buttons have the same width')
  // ลิงก์: แตะแถบเงิน → หน้ารายละเอียด · แท็บ 3 → หน้าบัญชีเดิม ครบ 6 ปุ่มขั้นตอน
  await page.locator('.balance-tiles--strip a').first().click()
  must(/#\/balance\/own/.test(page.url()), 'tile opens the circulating balance page')
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.locator('.hubgrid a').nth(2).click()
  await page.locator('.stepbtn').first().waitFor()
  must((await page.locator('.stepbtn').count()) === 6, 'tab 3 (treasurer) keeps the six accounting steps')
  await page.locator('.bottomnav').getByRole('link', { name: 'หน้าแรก' }).click()
  must(/#\/$/.test(page.url()) && (await page.locator('.hubgrid a').count()) === 18, 'bottom bar home returns to the work room')
  await page.setViewportSize({ width: 360, height: 740 })
  await page.reload(); await page.waitForLoadState('networkidle')
  const ov = await page.evaluate(() => [...document.querySelectorAll('.hubhome .btile')].some((e) => e.scrollWidth > e.clientWidth + 1) || document.documentElement.scrollWidth > innerWidth)
  must(!ov, 'no horizontal overflow at 360px')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('hubhome-test OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
