// หน้าติดตั้งแอป (#/install): ลิงก์เดียว ตรวจเครื่องแล้วโชว์ปุ่ม/ขั้นตอนที่ถูกต้อง — Android ปุ่มติดตั้งคลิกเดียว · iPhone 3 ขั้น · แอปแชต = เตือนให้เปิดนอกแอป
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4204
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
const open = async (ua, init) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH', userAgent: ua })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  if (init) await page.addInitScript(init)
  await page.goto(`http://localhost:${PORT}/#/install`); await page.waitForLoadState('networkidle')
  return page
}
const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
const AND = 'Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36'
const LINE = AND + ' Line/14.9.0'
try {
  // iPhone Safari: 3 ขั้น + ไอคอนแชร์
  let p = await open(IOS)
  const ios = p.getByLabel('ขั้นตอนสำหรับ iPhone')
  must(await ios.isVisible() && (await ios.locator('li').count()) === 3 && /เพิ่มลงหน้าจอโฮม/.test(await ios.innerText()) && await ios.locator('svg').count() >= 2, 'iPhone: three steps with share icon')
  must(await p.getByRole('button', { name: /ติดตั้งแอป/ }).count() === 0, 'iPhone: no fake install button')
  must(/วางลิงก์เชิญ/.test(await p.getByLabel('ขั้นต่อไป').innerText()) && /iPhone/.test(await p.getByLabel('ขั้นต่อไป').innerText()), 'step ② explains pasting the invite in the installed app')
  await p.screenshot({ path: 'shots/install-ios.png' })
  // Android Chrome: ปุ่มติดตั้งคลิกเดียว (จำลอง beforeinstallprompt)
  p = await open(AND, () => { window.addEventListener('DOMContentLoaded', () => { setTimeout(() => { const e = new Event('beforeinstallprompt'); e.prompt = async () => { window.__prompted = true }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e) }, 200) }) })
  const btn = p.getByRole('button', { name: /📲 ติดตั้งแอป/ })
  await btn.waitFor({ timeout: 5000 })
  await btn.click()
  await p.getByRole('status').filter({ hasText: 'ติดตั้งแล้ว' }).waitFor({ timeout: 3000 })
  must(await p.evaluate(() => window.__prompted === true), 'Android: one tap opens the native install prompt')
  // Android ที่ไม่มีคำขอติดตั้ง: ขั้นตอนเมนู ⋮
  p = await open(AND)
  must(/ติดตั้งแอป/.test(await p.getByLabel('ติดตั้งบน Android').innerText()) && /⋮/.test(await p.getByLabel('ติดตั้งบน Android').innerText()), 'Android fallback steps')
  // เปิดในแอป LINE: เตือน + ปุ่มเปิดนอกแอป
  p = await open(LINE)
  const warn = p.getByRole('alert')
  must(/ติดตั้งจากตรงนี้ไม่ได้/.test(await warn.innerText()) && await warn.getByRole('link', { name: /เปิดใน Chrome/ }).isVisible(), 'in-app browser warning with Chrome button')
  await p.screenshot({ path: 'shots/install-line.png' })
  // หน้าเข้าร่วมบน iPhone (Safari แท็บ) แนะนำให้ติดตั้งก่อน
  p = await open(IOS)
  await p.goto(`http://localhost:${PORT}/#/join?t=abc`); await p.waitForLoadState('networkidle')
  must(await p.getByLabel('คำแนะนำสำหรับ iPhone').isVisible(), 'join page nudges iPhone users to install first')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('install-test OK')
} finally { await browser.close(); server.kill() }
