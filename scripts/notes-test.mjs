// บันทึกโน้ต: ไอคอนที่หัว ห้องทำงาน → เขียน · พูดให้พิมพ์ (จำลอง) · อัดเสียง (ไมค์จำลอง) → บันทึก → เปิดฟังซ้ำหลังรีโหลด → แก้/ลบ
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4180
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch({ ...(exe ? { executablePath: exe } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH', permissions: ['microphone'] })
// การรู้จำเสียงพูดจริงทดสอบไม่ได้ในเบราว์เซอร์อัตโนมัติ: จำลองให้ส่งข้อความไทยหนึ่งประโยคเมื่อเริ่ม
await ctx.addInitScript(() => {
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { setTimeout(() => { this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: 'ประชุมวันอาทิตย์หน้า' }], { isFinal: true })] }) }, 100) }
    stop() { setTimeout(() => this.onend?.(), 0) }
  }
})
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', (d) => d.accept())
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/meeting`)
  await page.getByRole('link', { name: 'บันทึกโน้ต' }).click()
  must(await page.getByRole('heading', { name: /บันทึกโน้ต/ }).isVisible() && await page.getByText(/ยังไม่มีโน้ต/).isVisible(), 'notes page opens from the icon, empty')
  await page.getByRole('button', { name: '＋ โน้ตใหม่' }).click()
  await page.getByLabel('หัวข้อ (ไม่บังคับ)').fill('ประชุมกรรมการ')
  await page.getByLabel('ข้อความ').fill('วาระที่ 1')
  await page.getByRole('button', { name: '🎙️ พูดให้พิมพ์' }).click()
  await page.waitForFunction(() => document.querySelector('#nt-b').value.includes('ประชุมวันอาทิตย์หน้า'), null, { timeout: 3000 })
  must((await page.getByLabel('ข้อความ').inputValue()) === 'วาระที่ 1 ประชุมวันอาทิตย์หน้า', 'dictated text appended to the note')
  await page.getByRole('button', { name: /หยุดพูดให้พิมพ์/ }).click()
  await page.getByRole('button', { name: '🔴 อัดเสียง' }).click()
  await page.getByRole('button', { name: /หยุดอัด/ }).waitFor({ timeout: 5000 })
  await page.waitForTimeout(2200)
  await page.getByRole('button', { name: /หยุดอัด/ }).click()
  await page.locator('audio[aria-label="เล่นเสียงโน้ต"]').waitFor({ timeout: 5000 })
  must(await page.getByText(/ยังไม่บันทึก/).isVisible(), 'recorded clip shown with an audio player before saving')
  await page.getByRole('button', { name: 'บันทึกโน้ต' }).click()
  await page.getByRole('list', { name: 'รายการโน้ต' }).waitFor({ timeout: 5000 })
  const row = await page.getByRole('list', { name: 'รายการโน้ต' }).innerText()
  must(row.includes('ประชุมกรรมการ') && row.includes('🎧 1 คลิป'), 'saved note listed with 1 clip: ' + row)
  // รีโหลดแล้วเปิดฟัง (เสียงอยู่ในที่เก็บของเครื่อง)
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: /เปิดโน้ต ประชุมกรรมการ/ }).click()
  must((await page.getByLabel('ข้อความ').inputValue()).includes('ประชุมวันอาทิตย์หน้า'), 'text persisted')
  await page.getByRole('button', { name: '▶ เล่น' }).click()
  await page.locator('audio[aria-label="เล่นเสียงโน้ต"]').waitFor({ timeout: 5000 })
  const dur = await page.locator('audio').evaluate((a) => new Promise((res) => { if (a.readyState >= 1) res(a.duration); else a.onloadedmetadata = () => res(a.duration); setTimeout(() => res(-1), 4000) }))
  must(dur !== -1, 'saved audio loads back and is playable (duration ' + dur + ')')
  // แก้ไข แล้วลบ
  await page.getByLabel('หัวข้อ (ไม่บังคับ)').fill('ประชุมกรรมการ (แก้)')
  await page.getByRole('button', { name: 'บันทึกโน้ต' }).click()
  must((await page.getByRole('list', { name: 'รายการโน้ต' }).innerText()).includes('(แก้)'), 'edit saved')
  await page.getByRole('button', { name: /เปิดโน้ต/ }).click()
  await page.getByRole('button', { name: 'ลบโน้ต' }).click()
  must(await page.getByText(/ยังไม่มีโน้ต/).isVisible(), 'delete removes the note')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('notes-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
