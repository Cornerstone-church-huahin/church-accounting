// งานเลขา › แผนงานประจำปี: เพิ่มกิจกรรม → ขึ้นตาราง (เดือนรวมช่อง ช่วงวันที่ ขีดฆ่าวันที่ผ่านแล้ว รวมงบ) + อยู่ในปฏิทินด้วย + คำขวัญ + ดาวน์โหลด PDF + A4 พอดี
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4193
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'th-TH', acceptDownloads: true })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/1`); await page.waitForLoadState('networkidle')
  must(/แผนประจำปี/.test(await page.locator('.tiletabs').innerText()), 'งานเลขา tab 3 = แผนประจำปี')
  await page.getByRole('link', { name: /แผนประจำปี/ }).click()
  await page.getByLabel('ปี พ.ศ.').first().selectOption('2026'); await page.getByLabel('ไตรมาส', { exact: true }).selectOption('4')
  await page.getByLabel('คำขวัญประจำปี (แสดงหัวแผ่น)').fill('ก้าวต่อไปในนิมิต'); await page.getByLabel('คำขวัญประจำปี (แสดงหัวแผ่น)').blur()
  must(/ก้าวต่อไปในนิมิต/.test(await page.locator('.a4page').innerText()), 'motto on sheet')
  const add = async (t, d, e, lead, b) => {
    await page.getByRole('button', { name: /เพิ่มกิจกรรม/ }).click()
    await page.locator('#ap-t').fill(t); await page.locator('#ap-d').fill(d); if (e) await page.locator('#ap-e').fill(e)
    await page.locator('#ap-l').fill(lead); if (b) await page.locator('#ap-b').fill(b)
    await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  }
  await add('จัดค่ายคริสตจักร', '2026-12-05', '2026-12-07', 'ผู้ทดสอบ', '1500')
  await add('ประกาศวันคริสต์มาส', '2026-12-20', '', 'ผู้ทดสอบ', '700')
  await add('กิจกรรมที่ผ่านมาแล้ว', '2026-10-04', '', 'ผู้ทดสอบ', '300')
  const t = (await page.locator('.a4page').innerText()).replace(/\s+/g, ' ')
  must(/05 - 07/.test(t) && /เสาร์ - จันทร์/.test(t) && /ประกาศวันคริสต์มาส/.test(t), 'range and weekday shown: ' + t)
  must(/รวมงบประมาณไตรมาส 4/.test(t) && /2,500/.test(t), 'quarter total 2,500: ' + t)
  const struck = await page.evaluate(() => [...document.querySelectorAll('.sheetpaper--plan td')].filter((c) => getComputedStyle(c).textDecorationLine.includes('line-through')).length)
  must(struck >= 2, 'past date struck through: ' + struck)
  must(await page.evaluate(() => [...document.querySelectorAll('.a4page')].every((e) => e.scrollHeight <= e.clientHeight + 1)), 'fits A4')
  // แก้ไข
  await page.locator('.sheetpaper--plan tbody tr', { hasText: 'ประกาศวันคริสต์มาส' }).click()
  await page.locator('#ap-l').fill('ผู้ทดสอบ 2'); await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/ผู้ทดสอบ 2/.test(await page.locator('.a4page').innerText()), 'edit saved')
  // อยู่ในปฏิทินด้วย
  const saved = await page.evaluate(() => Object.entries(localStorage).filter(([k]) => /calendar/.test(k)).map(([, v]) => v).join(''))
  must(/จัดค่ายคริสตจักร/.test(saved), 'event stored in the shared calendar data')
  // PDF
  const [d1] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ดาวน์โหลด PDF \(ไตรมาสนี้\)/ }).click()])
  const p1 = await d1.path(); must(fs.statSync(p1).size > 3000, 'filled pdf')
  const [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /ไฟล์เปล่า \(4 ไตรมาส\)/ }).click()])
  const p2 = await d2.path(); must(fs.statSync(p2).size > 3000, 'blank pdf')
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  console.log('plan-test OK')
} finally { await browser.close(); server.kill() }
