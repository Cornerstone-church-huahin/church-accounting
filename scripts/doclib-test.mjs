// งานเลขา › คลังเอกสาร (ไฟล์สำเร็จรูป): จัดการหมวด (เพิ่ม/แก้ชื่อ/ลบ) → เพิ่มเอกสารพร้อมไฟล์ → แถบเรียงใหม่สุดอยู่บน → ค้นหา → เปิด/ดาวน์โหลด
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4202
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH', acceptDownloads: true })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('dialog', async (d) => { if (d.type() === 'prompt') await d.accept(d.defaultValue() + 'X'); else await d.accept() })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
// จำลอง GitHub: เก็บไฟล์ที่อัป แล้วส่งคืนตอนดึง
const store = new Map()
await page.route('**/api.github.com/**', async (route) => {
  const req = route.request(), url = new URL(req.url()), m = /\/contents\/(.+)$/.exec(decodeURIComponent(url.pathname))
  const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors })
  if (req.method() === 'PUT' && m) { store.set(m[1], Buffer.from(JSON.parse(req.postData()).content, 'base64')); return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: JSON.stringify({ content: { sha: 'x' } }) }) }
  if (req.method() === 'GET' && m && store.has(m[1])) return route.fulfill({ status: 200, headers: cors, body: store.get(m[1]) })
  return route.fulfill({ status: 404, headers: cors, contentType: 'application/json', body: '{}' })
})
const pdf = (name, text) => ({ name, mimeType: 'application/pdf', buffer: Buffer.from(`%PDF-1.1\n${text}\n%%EOF`) })
const numbers = []
const addDoc = async (file, title, cat, date) => {
  await page.getByRole('button', { name: /เพิ่มเอกสาร/ }).click()
  await page.locator('#df-file').setInputFiles(file)
  await page.locator('#df-title').fill(title); await page.locator('#df-cat').selectOption(cat); await page.locator('#df-date').fill(date)
  numbers.push(await page.locator('#df-no').inputValue())
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  await page.getByRole('dialog', { name: title }).waitFor({ timeout: 10000 })
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด', exact: true }).click()
}
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/1`)
  await page.evaluate(() => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'o/r', token: 't', name: 'x' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'me1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'me1', name: 'x', role: 'admin', status: 'active', joined: 1, updated: 1 }]))
  })
  await page.reload(); await page.waitForLoadState('networkidle')
  await page.getByRole('link', { name: /คลังเอกสาร/ }).click()
  must(await page.getByText(/ยังไม่มีเอกสาร/).isVisible(), 'empty library')
  // จัดการหมวด: เพิ่ม → แก้ชื่อ → ลบ
  await page.getByRole('button', { name: 'จัดการหมวดเอกสาร' }).click()
  for (const [c, pre] of [['ประชุมธรรมกิจ', 'ปศอ.'], ['จดหมายเชิญ', 'ชศอ'], ['หมวดที่จะลบ', '']]) { await page.getByLabel('ชื่อหมวดใหม่').fill(c); await page.getByLabel('ตัวย่อเลขที่ของหมวดใหม่').fill(pre); await page.getByRole('button', { name: /เพิ่ม$/ }).click() }
  must(/เลขที่ ปศอ\.###/.test(await page.getByRole('list', { name: 'รายชื่อหมวด' }).innerText()) && /เลขที่ ชศอ\.###/.test(await page.getByRole('list', { name: 'รายชื่อหมวด' }).innerText()), 'prefixes shown in the manager')
  await page.getByRole('button', { name: 'แก้ชื่อหมวด หมวดที่จะลบ' }).click()
  await page.getByRole('list', { name: 'รายชื่อหมวด' }).getByText(/หมวดที่จะลบX/).waitFor()
  await page.getByRole('button', { name: 'ลบหมวด หมวดที่จะลบX' }).click()
  must(await page.getByRole('list', { name: 'รายชื่อหมวด' }).locator('li').count() === 2, 'two categories after delete')
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด', exact: true }).click()
  // เพิ่มเอกสาร 3 ฉบับ (วาระ 1–3) ในหมวดประชุมธรรมกิจ + 1 ฉบับจดหมายเชิญ
  await addDoc(pdf('v1.pdf', 'one'), 'วาระที่ 1', 'ประชุมธรรมกิจ', '2026-03-01')
  await addDoc(pdf('v3.pdf', 'three'), 'วาระที่ 3', 'ประชุมธรรมกิจ', '2026-03-03')
  await addDoc(pdf('v2.pdf', 'two'), 'วาระที่ 2', 'ประชุมธรรมกิจ', '2026-03-02')
  await addDoc(pdf('invite.pdf', 'inv'), 'เชิญอาจารย์สมชาย', 'จดหมายเชิญ', '2026-02-01')
  must(numbers.join('|') === 'ปศอ.001|ปศอ.002|ปศอ.003|ชศอ.001', 'numbers follow the category prefix: ' + numbers.join('|'))
  await page.locator('#dl-cat').selectOption('ประชุมธรรมกิจ')
  const names = await page.locator('.docbar b').allInnerTexts()
  must(names.join('|') === 'วาระที่ 3|วาระที่ 2|วาระที่ 1', 'newest on top, oldest at the bottom: ' + names.join('|'))
  await page.locator('#dl-cat').selectOption('จดหมายเชิญ')
  must(await page.locator('.docbar').count() === 1, 'category select shows only that category')
  await page.locator('#dl-cat').selectOption('')
  await page.locator('#dl-q').fill('สมชาย')
  must(await page.locator('.docbar').count() === 1, 'search by name')
  await page.locator('#dl-q').fill('v2.pdf')
  must(await page.locator('.docbar').count() === 1, 'search by file name')
  await page.locator('#dl-q').fill('')
  // เปิดเอกสาร: ดาวน์โหลดได้ไฟล์เดิม
  await page.getByRole('button', { name: 'เปิดเอกสาร วาระที่ 2' }).click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ดาวน์โหลด/ }).click()])
  must(fs.readFileSync(await dl.path()).toString().includes('two'), 'downloaded the same file content')
  must(await page.getByRole('button', { name: /เปิดดู/ }).isVisible() && await page.getByRole('button', { name: /แชร์/ }).isVisible(), 'view/share buttons')
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด', exact: true }).click()
  // ลบฉบับล่าสุด (ปศอ.003) แล้วสร้างใหม่ → ได้เลข ปศอ.003 ซ้ำ
  await page.getByRole('button', { name: 'เปิดเอกสาร วาระที่ 2' }).click()
  await page.getByRole('button', { name: /ลบ$/ }).click()
  await page.getByRole('button', { name: 'เปิดเอกสาร วาระที่ 2' }).waitFor({ state: 'detached' })
  await page.getByRole('button', { name: /เพิ่มเอกสาร/ }).click()
  await page.locator('#df-cat').selectOption('ประชุมธรรมกิจ')
  must(await page.locator('#df-no').inputValue() === 'ปศอ.003', 'deleted latest number is reused: ' + await page.locator('#df-no').inputValue())
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก' }).click()
  // เปลี่ยนตัวย่อของหมวด + เลขที่เดิมตามไปด้วย
  await page.getByRole('button', { name: 'จัดการหมวดเอกสาร' }).click()
  await page.getByRole('button', { name: 'ตั้งตัวย่อเลขที่ หมวด ประชุมธรรมกิจ' }).click()
  await page.getByText(/เปลี่ยนเลขที่ของเอกสารเดิม|เปลี่ยนตัวย่อเป็น/).first().waitFor()
  must(/ปศอX\.###/.test(await page.getByRole('list', { name: 'รายชื่อหมวด' }).innerText()), 'prefix edited in the manager')
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด', exact: true }).click()
  await page.locator('#dl-cat').selectOption('ประชุมธรรมกิจ')
  must(/ปศอX\.00[12]/.test(await page.locator('.docbar').first().innerText()), 'existing numbers followed the new prefix: ' + await page.locator('.docbar').first().innerText())
  await page.getByRole('button', { name: /เพิ่มเอกสาร/ }).click()
  must(await page.locator('#df-no').inputValue() === 'ปศอX.003', 'next number uses the new prefix and continues: ' + await page.locator('#df-no').inputValue())
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก' }).click()
  // แก้ชื่อหมวดแล้วเอกสารตามไป · ลบหมวดแล้วเอกสารย้ายไปไม่ระบุหมวด
  await page.getByRole('button', { name: 'จัดการหมวดเอกสาร' }).click()
  await page.getByRole('button', { name: 'ลบหมวด จดหมายเชิญ' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด', exact: true }).click()
  await page.locator('#dl-cat').selectOption('ไม่ระบุหมวด')
  must(await page.locator('.docbar').count() === 1, 'doc moved to no-category, not deleted')
  await page.screenshot({ path: 'shots/doclib.png' })
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('doclib-test OK')
} finally { await browser.close(); server.kill() }
