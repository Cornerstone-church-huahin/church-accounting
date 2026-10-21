// ศูนย์จัดการประชุม: เมนู 10 ขั้น → รายละเอียดแต่ละขั้น (อ่านอย่างเดียว) · จัดหน้า 4/2/1 ต่อแถว · ไม่ล้นจอ · ปุ่มกลับ/ก่อนหน้า/ถัดไป
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4185
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const TITLES = ['สร้างการประชุม', 'จัดวาระ', 'แจ้งประชุม', 'เตรียมเอกสาร / พิมพ์', 'เริ่มประชุม', 'บันทึกประชุม', 'ส่งประธานตรวจ', 'รอที่ประชุมรับรอง', 'รับรอง / ลงนาม', 'เก็บเอกสาร']
const BLURBS = ['กำหนดข้อมูลพื้นฐานของการประชุม', 'รวบรวมเรื่องและเรียงลำดับวาระ', 'เตรียมหนังสือเชิญและเอกสารล่วงหน้า', 'ตรวจชุดเอกสารให้พร้อมก่อนประชุม', 'ลงชื่อ ตรวจองค์ประชุม และบันทึกเวลาเปิด', 'บันทึกสาระ มติ และงานที่มอบหมาย', 'เรียบเรียงร่างรายงานและตรวจความถูกต้อง', 'ส่งรายงานอ่านล่วงหน้าและเตรียมรับรอง', 'บันทึกผลรับรองและจัดฉบับลงนาม', 'รวบรวมฉบับสมบูรณ์และค้นย้อนหลัง']
const noOverflow = async (page, m) => must(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no horizontal overflow: ' + m)
try {
  const mk = async (w, h) => { const p = await (await browser.newContext({ viewport: { width: w, height: h }, locale: 'th-TH' })).newPage(); p.on('pageerror', (e) => errors.push(String(e))); return p }
  const page = await mk(390, 844)
  // เปิดจาก งานเลขา › การประชุม
  await page.goto(`http://localhost:${PORT}/#/meeting/1`)
  await page.getByRole('navigation', { name: 'หมวดงานเลขา', exact: true }).getByRole('link').first().click()
  await page.getByRole('heading', { name: 'ศูนย์จัดการประชุม', level: 1 }).waitFor({ timeout: 8000 })
  must(await page.getByText('ลำดับงานเลขานุการ ตั้งแต่เตรียมประชุมจนถึงจัดเก็บเอกสาร').isVisible(), 'subtitle')
  const btns = page.getByRole('navigation', { name: 'ขั้นตอนการประชุม 10 ขั้น' }).getByRole('link')
  must(await btns.count() === 10, 'ten buttons')
  for (let i = 0; i < 10; i++) {
    const t = (await btns.nth(i).innerText()).replace(/\s+/g, ' ')
    must(t.includes(String(i + 1)) && t.includes(TITLES[i]) && t.includes(BLURBS[i]), `button ${i + 1}: ` + t)
  }
  const cols = async (p) => (await p.locator('.mcbtn').evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size && els.filter((e) => Math.round(e.getBoundingClientRect().top) === Math.round(els[0].getBoundingClientRect().top)).length))
  must(await cols(page) === 2, 'two per row on a phone')
  await noOverflow(page, 'hub 390'); await page.screenshot({ path: '/tmp/mc-hub.png', fullPage: true })
  const wide = await mk(1280, 900); await wide.goto(`http://localhost:${PORT}/#/meeting/1/1`); await wide.locator('.mcbtn').first().waitFor({ timeout: 8000 })
  must(await cols(wide) === 4, 'four per row on a wide screen')
  const tiny = await mk(320, 700); await tiny.goto(`http://localhost:${PORT}/#/meeting/1/1`); await tiny.locator('.mcbtn').first().waitFor({ timeout: 8000 })
  must(await cols(tiny) === 1, 'one per row on a very narrow screen'); await noOverflow(tiny, 'hub 320')
  // รายละเอียดแต่ละขั้น
  for (let n = 1; n <= 10; n++) {
    await page.goto(`http://localhost:${PORT}/#/meeting/1/1`)
    await btns.nth(n - 1).click()
    await page.getByRole('heading', { name: `${n}. ${TITLES[n - 1]}`, level: 1 }).waitFor({ timeout: 5000 })
    const items = await page.getByRole('list', { name: `หัวข้อของ ${TITLES[n - 1]}` }).locator('li').allInnerTexts()
    must(items.length === 6 && items.every((t, i) => t.startsWith(`${n}.${i + 1}`)), `step ${n} has six numbered items: ` + items.map((t) => t.slice(0, 8)).join('|'))
    must((await page.locator('main').innerText()).includes(BLURBS[n - 1]), `step ${n} blurb`)
    const note = await page.getByRole('note').count()
    must(note === ([4, 9, 10].includes(n) ? 1 : 0), `step ${n} note count ${note}`)
    must(await page.getByRole('link', { name: '‹ กลับศูนย์จัดการประชุม' }).isVisible() && await page.getByRole('link', { name: 'กลับศูนย์จัดการประชุม', exact: true }).isVisible(), `step ${n} back buttons`)
    const prev = await page.getByRole('link', { name: /ขั้นตอนก่อนหน้า/ }).count(), next = await page.getByRole('link', { name: /ขั้นตอนถัดไป/ }).count()
    must(prev === (n > 1 ? 1 : 0) && next === (n < 10 ? 1 : 0), `step ${n} prev/next: ${prev}/${next}`)
    must(await page.locator('.mcenter button, .mcenter input, .mcenter textarea, .mcenter select').count() === 0, `step ${n} has no fake action buttons or forms`)
    must(!/ความคืบหน้า|เสร็จแล้ว|ส่งแล้ว|อนุมัติแล้ว/.test(await page.locator('.mcenter').innerText()), `step ${n} shows no progress status`)
    await noOverflow(page, `step ${n} @390`)
  }
  // ก่อนหน้า/ถัดไป/กลับ
  await page.goto(`http://localhost:${PORT}/#/meeting/1/1/4`)
  must(/4\.1ใบลงชื่อผู้ประชุม|4\.1\s+ใบลงชื่อผู้ประชุม/.test((await page.locator('.mc__items li').first().innerText()).replace(/\n/g, ' ').replace(/\s+/g, ' ').replace('4.1 ', '4.1')), 'content of 4.1')
  await page.getByRole('link', { name: /ขั้นตอนถัดไป/ }).click(); await page.getByRole('heading', { name: '5. เริ่มประชุม', level: 1 }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: /ขั้นตอนก่อนหน้า/ }).click(); await page.getByRole('heading', { name: '4. เตรียมเอกสาร / พิมพ์', level: 1 }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: 'กลับศูนย์จัดการประชุม', exact: true }).click(); await page.getByRole('heading', { name: 'ศูนย์จัดการประชุม', level: 1 }).waitFor({ timeout: 5000 })
  await page.getByRole('link', { name: '‹ งานเลขา' }).click(); await page.getByRole('heading', { name: 'งานเลขา', exact: true }).waitFor({ timeout: 5000 })
  // ขั้นที่ไม่มี
  await page.goto(`http://localhost:${PORT}/#/meeting/1/1/11`); must(await page.getByText('ไม่พบขั้นตอนนี้').isVisible(), 'unknown step handled')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('meetingcenter-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
