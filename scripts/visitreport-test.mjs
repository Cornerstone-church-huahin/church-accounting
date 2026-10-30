// งานอภิบาล › รายงานการเยี่ยม (แท็บ 4): รายการสัปดาห์แถวแคบ → แตะดูรายละเอียดของสัปดาห์ · ข้อมูลจากแท็บ “บันทึกการเยี่ยม”
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4395
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const errors = []
try {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  const at = (iso, h, m) => new Date(`${iso}T${h}:${m}:00+07:00`).getTime()
  const V = (id, date, name, visitor, extra = {}) => ({ id, updated: 5, date, memberId: 'm-' + id, memberName: name, reason: 'ขาดนมัสการ 2 เดือน', visitor, ...extra })
  await page.addInitScript((vs) => { if (!localStorage.getItem('seeded')) { localStorage.setItem('seeded', '1'); localStorage.setItem('acct.visit-log.v1', JSON.stringify(vs)) } }, [
    V('a', '2026-10-27', 'สมชาย ใจดี', 'คศ.กฤต, คศ.พิชิต', { reason: 'อธิษฐานร่วมกัน', checkin: { lat: 12.5684, lng: 99.9577, acc: 10, at: at('2026-10-27', '15', '49') }, photos: ['p1'], photoProof: [{ path: 'p1', at: at('2026-10-27', '15', '51'), lat: 12.5685, lng: 99.9577, src: 'live' }] }),
    V('b', '2026-10-28', 'สมหญิง รักดี', 'อ.ดารา'),
    V('c', '2026-10-20', 'สมศักดิ์ มั่นคง', 'คศ.กฤต'),
    // บ้านติดกัน 3 หลัง (ห่างกันไม่เกิน ~100 ม.) วันเดียวกัน = ออกเยี่ยม 1 ครั้ง
    V('d', '2026-11-03', 'บ้านหนึ่ง', 'อ.ดารา', { checkin: { lat: 12.5684, lng: 99.9577, acc: 10, at: at('2026-11-03', '10', '00') } }),
    V('e', '2026-11-03', 'บ้านสอง', 'อ.ดารา', { checkin: { lat: 12.5690, lng: 99.9577, acc: 10, at: at('2026-11-03', '10', '20') } }),
    V('f', '2026-11-03', 'บ้านสาม', 'อ.ดารา', { checkin: { lat: 12.5695, lng: 99.9577, acc: 10, at: at('2026-11-03', '10', '40') } }),
  ])
  await page.goto(`http://localhost:${PORT}/#/meeting/4/4`); await page.waitForLoadState('networkidle')
  await page.getByRole('heading', { name: /รายงานการเยี่ยม/, level: 1 }).waitFor({ timeout: 8000 })
  const rows = page.getByRole('list', { name: 'สัปดาห์ที่มีการเยี่ยม' }).getByRole('button')
  must(await rows.count() === 3, 'three weeks listed')
  must(/1 ครั้ง · 3 คน/.test((await rows.nth(0).innerText()).replace(/\s+/g, ' ')), 'three nearby houses on one day = 1 trip, 3 people')
  await rows.nth(0).click()
  must((await page.locator('main').innerText()).match(/ออกเยี่ยมครั้งที่ 1/g)?.length === 3 && /ออกเยี่ยม 1 ครั้ง · เยี่ยม 3 คน/.test(await page.locator('main').innerText()), 'detail marks the three houses as trip 1')
  await page.getByRole('tab', { name: 'ใบ A4' }).click()
  must(/รวมออกเยี่ยม 1 ครั้ง · เยี่ยม 3 คน/.test((await page.locator('.a4page').allInnerTexts()).join(' ')) && !/นับเป็นออกเยี่ยมครั้งเดียว/.test((await page.locator('.a4page').allInnerTexts()).join(' ')), 'A4 total counts the nearby houses as one trip (no explanatory note)')
  const tints = () => page.locator('.a4page tbody tr').evaluateAll((trs) => trs.map((t) => getComputedStyle(t).backgroundColor))
  const t3 = await tints(); must(t3.length === 3 && new Set(t3).size === 1, 'houses of the same trip share one tint: ' + t3)
  await page.getByRole('button', { name: '‹ รายการสัปดาห์' }).click()
  await rows.nth(1).click(); await page.getByRole('tab', { name: 'ใบ A4' }).click()
  const t2 = await tints(); must(t2.length === 2 && t2[0] !== t2[1], 'different trips get different tints: ' + t2)
  await page.getByRole('button', { name: '‹ รายการสัปดาห์' }).click()
  const t0 = (await rows.nth(1).innerText()).replace(/\s+/g, ' '), t1 = (await rows.nth(2).innerText()).replace(/\s+/g, ' ')
  must(/2 ครั้ง · 2 คน/.test(t0) && /คศ.กฤต, คศ.พิชิต, อ.ดารา/.test(t0) && /1 ครั้ง · 1 คน/.test(t1), 'newest week first with counts and visitors: ' + t0 + ' | ' + t1)
  must((await rows.nth(1).boundingBox()).height < 64, 'rows are compact (tight line spacing)')
  await page.getByRole('heading', { name: /รายงานการเยี่ยม/ }).first().waitFor()
  await rows.nth(1).click()
  must(await page.locator('.vrep__v').count() === 2, 'week detail lists both visits')
  const d = (await page.locator('main').innerText()).replace(/\\s+/g, ' ')
  must(/สมชาย ใจดี/.test(d) && /ผู้ออกเยี่ยม: คศ.กฤต, คศ.พิชิต/.test(d) && /อธิษฐานร่วมกัน/.test(d) && /เช็คอิน 15:49 น\./.test(d) && /ถ่าย 15:51 น\./.test(d), 'detail shows visitors, reason, details, check-in and photo time')
  await page.getByRole('button', { name: 'ดูรูปที่ 1 ของ สมชาย ใจดี' }).click()
  must(/ถ่ายเมื่อ .* น\./.test(await page.getByRole('dialog').innerText()), 'photo opens with time + place')
  await page.getByRole('dialog').getByRole('button', { name: 'ปิด' }).click()
  await page.getByRole('tab', { name: 'ใบ A4' }).click()
  must(await page.locator('.a4page').count() >= 1, 'A4 report view')
  await page.getByRole('button', { name: '‹ รายการสัปดาห์' }).click()
  must(await rows.count() === 3, 'back to the week list')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('visitreport-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
