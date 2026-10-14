// รายรับก่อนวันตัดยอดยกมาไม่ถูกนับ → หน้าแรกเตือนและมีปุ่มใช้เป็นยอดยกมาเงินหมุนเวียน: npm run build && node scripts/cutoff-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4185
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.addInitScript(() => {
    if (localStorage.getItem('seeded')) return
    localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.opening.v1', JSON.stringify([{ id: 'opening', date: '2026-10-11', accounts: {}, cash: 0, unmoved: {}, own: 100, updated: 1 }]))
    localStorage.setItem('acct.income.2026.v1', JSON.stringify([{ id: 'in1', date: '2026-10-04', typeId: 'tt1', amount: 7238070, method: 'cash', source: 'manual', updated: 1 }]))
  })
  await page.goto(`http://localhost:${PORT}/#/`); await page.waitForLoadState('networkidle')
  const alert = page.getByRole('alert').filter({ hasText: 'ก่อนวันตัดยอดยกมา' })
  await alert.waitFor({ timeout: 10000 })
  must(/72,380\.70/.test(await alert.innerText()), 'warning names the skipped amount: ' + await alert.innerText())
  must(/^\s*1\s*$/.test((await page.locator('.btile--own b').innerText())), 'circulating ignores the income dated before the cutoff while an opening balance exists')
  must(await page.getByRole('button', { name: /ใช้ที่เลือกเป็นยอดยกมา/ }).isDisabled(), 'nothing is absorbed until the user ticks an item')
  await page.getByRole('group', { name: 'รายการก่อนวันตัดยอด' }).getByRole('checkbox').first().check()
  await page.getByRole('button', { name: /ใช้ที่เลือกเป็นยอดยกมา/ }).click()
  await page.waitForFunction(() => /72,38/.test(document.querySelector('.btile--own b')?.textContent ?? ''))
  await alert.getByRole('button', { name: /ไม่ต้องเตือน/ }).click()
  must(await alert.count() === 0, 'warning can be dismissed')
  // ยอดยกมาเงินหมุนเวียนเป็น 0 → ไม่มีอะไรให้นับซ้ำ: นับทุกรายการที่บันทึกไว้ (เท่ากับ "สรุปปีนี้") ไม่ต้องเตือน
  const page2 = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  await page2.addInitScript(() => {
    localStorage.setItem('acct.opening.v1', JSON.stringify([{ id: 'opening', date: '2026-10-04', accounts: {}, cash: 0, unmoved: {}, own: 0, updated: 1 }]))
    localStorage.setItem('acct.income.2026.v1', JSON.stringify([{ id: 'in1', date: '2026-09-06', typeId: 'tt1', amount: 7328170, method: 'cash', source: 'manual', updated: 1 }]))
  })
  await page2.goto(`http://localhost:${PORT}/#/`); await page2.waitForLoadState('networkidle')
  must(/73,28[12]/.test(await page2.locator('.btile--own b').innerText()), 'with opening 0 every recorded income counts: ' + await page2.locator('.btile--own b').innerText())
  must(await page2.getByRole('alert').filter({ hasText: 'ก่อนวันตัดยอดยกมา' }).count() === 0, 'no cutoff warning when there is nothing to double count')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('CUTOFF OK')
} catch (e) { console.error(e instanceof Error ? e.message : e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
