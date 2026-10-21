// ผู้รับผิดชอบของงาน: แอดมินใส่/เรียง/ลบรายชื่อใต้ชื่องาน · ทุกคนเห็น · ตำแหน่งเดียวกันทุกงาน · คนที่ไม่ใช่แอดมินแก้ไม่ได้ (ข้อมูลสมมติ)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4184
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`http://localhost:${PORT}/#/meeting/4`)
  const team = page.locator('.workteam')
  await team.waitFor({ timeout: 8000 })
  must(/ยังไม่ระบุผู้รับผิดชอบ/.test(await team.innerText()), 'empty hint when nobody is set')
  // ตำแหน่งเดียวกันทุกงาน (ใต้ชื่องาน ก่อนปุ่มตารางงาน)
  const ys = []
  for (const k of [1, 2, 3, 4, 5, 9, 12, 13, 15, 18]) { await page.goto(`http://localhost:${PORT}/#/meeting/${k}`); await team.waitFor({ timeout: 5000 }); ys.push(Math.round((await team.boundingBox()).y)) }
  must(new Set(ys).size === 1, 'same position in every work: ' + ys)
  const head = await page.locator('.page-head').first().boundingBox(), cal = await page.getByRole('button', { name: /ตารางงาน/ }).boundingBox()
  must(ys[0] > head.y && ys[0] < cal.y, 'sits between the title row and the calendar button')
  // แอดมินใส่ 3 คน แล้วสลับลำดับ
  await page.goto(`http://localhost:${PORT}/#/meeting/4`)
  await page.getByRole('button', { name: /ใส่ผู้รับผิดชอบ/ }).click()
  const fill = async (i, role, name) => { await page.locator(`#tr-${i}`).fill(role); await page.locator(`#tn-${i}`).fill(name) }
  await fill(0, 'ผู้ดูแลหลัก', 'ทดสอบ หนึ่ง')
  await page.getByRole('button', { name: '＋ เพิ่มแถว' }).click(); await fill(1, 'รองผู้ดูแล', 'ทดสอบ สอง')
  await page.getByRole('button', { name: '＋ เพิ่มแถว' }).click(); await fill(2, 'ครูศาสนกิจ', 'ทดสอบ สาม')
  await page.getByRole('button', { name: 'เลื่อนแถว 3 ขึ้น' }).click()
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  let items = await page.locator('.workteam__list li').allInnerTexts()
  must(items.map((t) => t.replace(/\s+/g, ' ')).join('|') === 'ผู้ดูแลหลัก ทดสอบ หนึ่ง|ครูศาสนกิจ ทดสอบ สาม|รองผู้ดูแล ทดสอบ สอง', 'saved in the chosen order: ' + items.join('|'))
  // งานอื่นไม่ปนกัน · รีโหลดแล้วยังอยู่
  await page.goto(`http://localhost:${PORT}/#/meeting/9`)
  must(/ยังไม่ระบุผู้รับผิดชอบ/.test(await team.innerText()), 'another work is not affected')
  await page.goto(`http://localhost:${PORT}/#/meeting/4`); await page.reload(); await page.locator('.workteam__list li').first().waitFor({ timeout: 8000 })
  must(await page.locator('.workteam__list li').count() === 3, 'persisted after reload')
  // แก้ไข/ลบแถว
  await page.getByRole('button', { name: /แก้ไขผู้รับผิดชอบ/ }).click()
  await page.getByRole('button', { name: 'ลบแถว 2' }).click()
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(await page.locator('.workteam__list li').count() === 2, 'delete a row')
  // แถวที่ไม่มีชื่อบันทึกไม่ได้
  await page.getByRole('button', { name: /แก้ไขผู้รับผิดชอบ/ }).click()
  await page.getByRole('button', { name: '＋ เพิ่มแถว' }).click(); await page.locator('#tr-2').fill('ว่าง')
  await page.getByRole('button', { name: 'บันทึก', exact: true }).click()
  must(/ใส่ชื่อให้ครบ/.test(await page.getByRole('alert').innerText()), 'a row without a name is rejected')
  await page.getByRole('button', { name: 'ยกเลิก' }).click()
  // ผู้ใช้ที่ไม่ใช่แอดมิน: เห็นรายชื่อ แต่ไม่มีปุ่มแก้ไข
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  const p2 = await ctx2.newPage()
  p2.on('pageerror', (e) => errors.push(String(e)))
  await p2.addInitScript(() => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ผู้ใช้ทั่วไป' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'u1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }, { id: 'u1', name: 'ผู้ใช้ทั่วไป', role: 'bookkeeper', joined: 2, updated: 1 }]))
    localStorage.setItem('acct.work-teams.v1', JSON.stringify([{ id: 'team-4', n: 4, people: [{ role: 'ผู้ดูแลหลัก', name: 'ทดสอบ หนึ่ง' }], updated: 1 }]))
  })
  await p2.goto(`http://localhost:${PORT}/#/meeting/4`)
  await p2.locator('.workteam__list li').first().waitFor({ timeout: 8000 })
  must(/ทดสอบ หนึ่ง/.test(await p2.locator('.workteam').innerText()) && await p2.getByRole('button', { name: /ผู้รับผิดชอบ/ }).count() === 0, 'non-admin sees the team but has no edit button')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('team-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
