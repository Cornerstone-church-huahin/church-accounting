// ลิงก์เชิญต่องาน: เลือกงาน + ตำแหน่ง (เหมือนกันทุกงาน) → อยู่ในลิงก์/ข้อความ · อนุมัติแล้วได้ตำแหน่งในงานนั้นทันที · ชื่อเติมให้จากลิงก์ · ตัวเลือกตำแหน่งในงานเหมือนกันทุกงาน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4208
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
const members = [{ id: 'me1', name: 'แอดมิน', role: 'admin', status: 'active', joined: 1, updated: 1 }, { id: 'u9', name: 'เจ', role: 'viewer', status: 'pending', joined: 1, updated: 1, invitedFor: 'เจ', invitedWork: { n: 14, level: 'helper' } }]
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
page.on('pageerror', (e) => errors.push(String(e)))
await page.addInitScript(([members]) => {
  localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 'tok123', name: 'admin' }))
  localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'me1' }))
  localStorage.setItem('acct.members.v1', JSON.stringify(members))
  window.__shared = null
  navigator.share = async (x) => { window.__shared = x.text }
}, [members])
await page.route('**/api.github.com/**', (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
try {
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForLoadState('networkidle')
  await page.locator('#inv-work').waitFor({ state: 'visible', timeout: 8000 }).catch(async () => { await page.getByText(/ผู้ใช้ร่วมและสิทธิ์/).first().click() })
  // เชิญเข้างานโรงครัว ตำแหน่งผู้ช่วย
  await page.locator('#inv-work').selectOption('14')
  await page.locator('#inv-for').fill('เจ')
  const radios = page.getByRole('radiogroup', { name: 'ตำแหน่งที่ตั้งใจให้ในงานนี้' }).getByRole('radio')
  must(await radios.count() === 3 && /ผู้ดูแลหลัก/.test(await radios.nth(0).innerText()) && /ผู้ช่วย/.test(await radios.nth(1).innerText()) && /ที่ปรึกษา/.test(await radios.nth(2).innerText()), 'three positions, same for every work')
  await radios.nth(1).click()
  await page.getByRole('button', { name: /ส่งชุดเชิญ/ }).click()
  await page.waitForFunction(() => window.__shared)
  const text = await page.evaluate(() => window.__shared)
  must(/w=14&lv=helper/.test(text) && /ผู้ช่วย ของงานโรงครัว/.test(text) && /for=%E0%B9%80%E0%B8%88/.test(text), 'link carries work + position + name; message says it in words: ' + text)
  // ผู้ขอที่รออนุมัติ: เห็นตำแหน่งที่ตั้งใจให้ → อนุมัติแล้วได้ตำแหน่งทันที
  must(/ตั้งใจให้เป็น ผู้ช่วย ของ งานโรงครัว/.test((await page.locator('main').innerText()).replace(/\s+/g, ' ')), 'pending row shows the intended position')
  await page.getByRole('button', { name: /อนุมัติ$/ }).click()
  const m = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((x) => x.id === 'u9'))
  must(m.status === 'active' && m.works.includes(14) && m.workRoles['14'] === 'helper' && !m.invitedWork, 'approval applied the position: ' + JSON.stringify(m))
  // ตัวเลือกตำแหน่งต่อคน: เหมือนกันทุกงาน (18 งาน × ตัวเลือกเดียวกัน)
  await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true }))
  const sels = page.getByLabel(/ตำแหน่งของ เจ ใน /)
  must(await sels.count() === 18, '18 rows, one per work: ' + await sels.count())
  const opts = await sels.nth(0).locator('option').allInnerTexts()
  const opts2 = await sels.nth(17).locator('option').allInnerTexts()
  must(JSON.stringify(opts) === JSON.stringify(opts2) && opts.length === 4, 'same options in every work: ' + opts.join('|'))
  await page.getByLabel('ตำแหน่งของ เจ ใน งานเลขา').selectOption('lead')
  const m2 = await page.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((x) => x.id === 'u9'))
  must(m2.workRoles['1'] === 'lead' && m2.workRoles['14'] === 'helper', 'admin sets another work from the same picker')
  // หน้าเข้าร่วมเติมชื่อจากลิงก์
  await page.goto(`http://localhost:${PORT}/#/join?t=tok&for=${encodeURIComponent('เจ')}&w=14&lv=helper`); await page.waitForLoadState('networkidle')
  must(await page.locator('#join-name').inputValue() === 'เจ', 'join page prefilled the invited name')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('invitework-test OK')
} finally { await browser.close(); server.kill() }
