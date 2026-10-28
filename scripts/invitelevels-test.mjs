// ลิงก์เชิญ: 3 ระดับการใช้งาน (ผู้ดู / ผู้บันทึก / ผู้ตรวจสอบ) พร้อมคำอธิบาย · ระดับที่เลือกไปอยู่ในลิงก์และข้อความ · เปลี่ยนระดับภายหลังที่รายชื่อ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4205
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
await page.addInitScript(() => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'tok123', name: 'admin' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'me1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'me1', name: 'admin', role: 'admin', status: 'active', joined: 1, updated: 1 }, { id: 'u2', name: 'สมชาย', role: 'viewer', status: 'active', joined: 1, updated: 1 }]))
  window.__shared = null
  navigator.share = async (x) => { window.__shared = x.text }
})
await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForLoadState('networkidle')
  await page.getByText(/ผู้ใช้ร่วมและสิทธิ์/).first().click()
  const grp = page.getByRole('radiogroup', { name: 'ระดับการใช้งานที่ตั้งใจให้' })
  const cards = grp.getByRole('radio')
  must(await cards.count() === 3, 'three level cards')
  must(/ผู้ดู/.test(await cards.nth(0).innerText()) && /ผู้บันทึก/.test(await cards.nth(1).innerText()) && /ผู้ตรวจสอบ/.test(await cards.nth(2).innerText()), 'level names in order')
  must(/✓/.test(await cards.nth(1).innerText()) && /✗/.test(await cards.nth(1).innerText()), 'each card says what it can and cannot do')
  must(await cards.nth(0).getAttribute('aria-checked') === 'true', 'safest level (viewer) is the default')
  await cards.nth(2).click()
  must(await cards.nth(2).getAttribute('aria-checked') === 'true' && await cards.nth(0).getAttribute('aria-checked') === 'false', 'choose level 3')
  await page.getByRole('button', { name: /ส่งชุดเชิญ/ }).click()
  await page.waitForFunction(() => window.__shared)
  const text = await page.evaluate(() => window.__shared)
  must(/role=auditor/.test(text) && /ระดับ 3 ผู้ตรวจสอบ/.test(text) && /#\/install/.test(text), 'message carries role in the link and level in words: ' + text)
  // สรุประดับสิทธิ์ไว้ดูกันลืม + วิธีเปลี่ยนภายหลัง
  await page.getByText(/สรุประดับสิทธิ์/).click()
  const help = await page.locator('.lvlhelp').innerText()
  must(/ระดับ 1/.test(help) && /ระดับ 2/.test(help) && /ระดับ 3/.test(help) && /เปลี่ยนระดับของใครก็ได้ทุกเมื่อ/.test(help) && /แอดมิน/.test(help), 'admin cheat-sheet')
  await page.screenshot({ path: 'shots/invitelevels.png', fullPage: true })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('invitelevels-test OK')
} finally { await browser.close(); server.kill() }
