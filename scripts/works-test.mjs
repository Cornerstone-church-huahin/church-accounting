// งานที่รับผิดชอบ: แอดมินกด ‹ ทุกแท็บ → หน้าเลือกงานทั้งหมด · เลขา/อนุชน (งานเดียว) → หน้าหลักของงานตัวเอง · แอดมินตั้งงานให้คนในตั้งค่าได้
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4182
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const MEMBERS = [
  { id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 },
  { id: 'sec1', name: 'เลขาธิการ', role: 'bookkeeper', joined: 2, updated: 1, works: [1] },
  { id: 'yth1', name: 'หัวหน้าอนุชน', role: 'bookkeeper', joined: 3, updated: 1, works: [9] },
  { id: 'two1', name: 'สองงาน', role: 'bookkeeper', joined: 4, updated: 1, works: [4, 5] },
]
async function open(meId, meName) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript(([id, name, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id }))
    localStorage.setItem('acct.members.v1', JSON.stringify(members))
  }, [meId, meName, MEMBERS])
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await page.waitForTimeout(1200)
  return page
}
try {
  // แอดมิน: หน้าเลือกงานครบ 12 · เข้างานใดก็ได้ · ทุกแท็บ → หน้าเลือกงาน
  let page = await open('ad1', 'แอดมิน')
  must(await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').count() === 18, 'admin sees all 18 works')
  await page.goto(`http://localhost:${PORT}/#/meeting/9`); await page.getByRole('heading', { name: 'งานอนุชน', exact: true }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: '‹ หน้าแรก' }).click()
  must(await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').count() === 18, 'admin: ‹ ทุกแท็บ → all works')
  // เลขา: เข้า /meeting แล้วถูกพาไปงานเลขา · ทุกแท็บ = หน้าหลักของเลขา (เริ่มใหม่)
  page = await open('sec1', 'เลขาธิการ')
  await page.getByRole('heading', { name: 'งานเลขา', exact: true }).waitFor({ timeout: 5000 })
  must(page.url().endsWith('#/meeting/1'), 'secretary lands on her own work: ' + page.url())
  await page.getByRole('button', { name: /ตารางงาน/ }).click()
  must(await page.getByRole('region', { name: 'ปฏิทินงาน' }).isVisible(), 'calendar open on her work home')
  await page.getByRole('link', { name: /แท็บ 4/ }).click(); await page.getByRole('heading', { name: 'แท็บ 4', exact: true }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: '‹ งานเลขา' }).click()
  await page.getByRole('link', { name: '‹ หน้าแรก' }).click()
  must(/#\/$/.test(page.url()) && await page.getByRole('heading', { name: /ห้องทำงาน/ }).isVisible() && await page.locator('.hubgrid a').count() === 1, 'secretary: ‹ หน้าแรก → home (only her own work tab)')
  // อนุชน: เช่นเดียวกัน
  page = await open('yth1', 'หัวหน้าอนุชน')
  await page.getByRole('heading', { name: 'งานอนุชน', exact: true }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: /แท็บ 3/ }).click(); await page.getByRole('heading', { name: 'แท็บ 3', exact: true }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: '‹ งานอนุชน' }).click()
  await page.getByRole('link', { name: '‹ หน้าแรก' }).click()
  must(/#\/$/.test(page.url()) && await page.locator('.hubgrid a').count() === 1, 'youth: ‹ หน้าแรก → home (only the own work tab)')
  // สองงาน: หน้าเลือกงานเห็นเฉพาะสองงานของตน
  page = await open('two1', 'สองงาน')
  await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').first().waitFor({ timeout: 5000 })
  must((await page.locator('nav[aria-label^="โหมดประชุม"] a.btile').allInnerTexts()).map((t) => t.replace(/\s+/g, '')).join('|') === '4งานอภิบาล33%|5งานสุสาน0%', 'two-work user sees only his two works')
  // แอดมินตั้งงานให้คนในตั้งค่า
  page = await open('ad1', 'แอดมิน')
  await page.goto(`http://localhost:${PORT}/#/settings`); await page.waitForTimeout(600)
  if (!(await page.getByText(/งานที่รับผิดชอบในห้องทำงาน/).first().isVisible().catch(() => false))) await page.getByText('ผู้ใช้ร่วมและสิทธิ์').first().click()
  await page.locator('li', { hasText: 'เลขาธิการ' }).locator('summary').click()
  const g = page.getByRole('group', { name: 'งานที่รับผิดชอบของ เลขาธิการ' })
  must(await g.getByRole('button', { name: 'งานเลขา' }).getAttribute('aria-pressed') === 'true', 'secretary is assigned งานเลขา in settings')
  await g.getByRole('button', { name: 'งานสตรี' }).click()
  must(await g.getByRole('button', { name: 'งานสตรี' }).getAttribute('aria-pressed') === 'true', 'admin can add a work to a person')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('works-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
