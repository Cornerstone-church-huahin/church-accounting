// เงินยืมจากเงินหมุนเวียน + จ่ายสวัสดิการผ่านเงินยืม: เงินหมุนเวียนลดครั้งเดียว · หนี้กองทุนที่ถูกยืมลด · ยอดสุทธิกองทุนไม่เปลี่ยน · ยกเลิกทั้งชุดได้ (ข้อมูลสมมติ)
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4193
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const page = await (await browser.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })).newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const now = new Date(), Y = now.getFullYear(), T = iso(now)
const O = iso(new Date(now.getFullYear(), 0, 1))
const num = (t) => Number(t.replace(/[^\d.]/g, ''))
try {
  await page.goto(`http://localhost:${PORT}/#/meeting/3`)
  await page.evaluate(([T, O]) => {
    const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
    set('opening', [{ id: 'opening', updated: 1, date: O, accounts: {}, cash: 0, unmoved: {}, funds: { tt4: 20000000, tt7: 0 }, own: 5000000 }])
    // กองทุน tt4 (ผู้รับใช้สมมติ) ให้ tt7 (ห้องพักสมมติ) ยืม 200,000
    set('loans', [{ id: 'l0', lender: { kind: 'fund', fundId: 'tt4' }, borrower: 'tt7', purpose: 'สร้างห้องพัก', date: O, principal: 20000000, repayments: [], updated: 1 }])
  }, [T, O])
  await page.reload(); await page.waitForLoadState('networkidle')
  const tile = async (cls) => num(await page.locator(`.btile--${cls} b`).first().innerText())
  must(await tile('own') === 50000 && await tile('indebt') === 200000, 'start: own 50,000 · internal debt 200,000: ' + await tile('own') + '/' + await tile('indebt'))
  await page.goto(`http://localhost:${PORT}/#/balance/indebt`)
  const reg = page.getByRole('region', { name: 'จ่ายสวัสดิการผ่านเงินยืม' })
  await reg.getByRole('button', { name: /จ่ายสวัสดิการผ่านเงินยืม/ }).click()
  await reg.locator('#ap-date').fill(T)
  await reg.getByRole('button', { name: 'ยืนยัน 3 รายการ' }).click()
  must(/ใส่จำนวนเงิน/.test(await reg.innerText()), 'amount required')
  const amt = reg.locator('.field', { hasText: 'จำนวนเงิน' }).locator('input')
  await amt.fill('5000')
  await reg.locator('#ap-desc').fill('สวัสดิการผู้รับใช้ เดือนนี้')
  const prev = await reg.getByRole('list', { name: 'ตัวอย่างรายการที่จะบันทึก' }).innerText()
  must(/เงินหมุนเวียนให้/.test(prev) && /คืนหนี้/.test(prev) && /ค้างคืน .* เหลือ 195,000/.test(prev.replace(/\s+/g, ' ')), 'preview shows the three entries: ' + prev.replace(/\s+/g, ' '))
  await reg.getByRole('button', { name: 'ยืนยัน 3 รายการ' }).click()
  await reg.getByText(/ค้างคืนเงินหมุนเวียน/).waitFor({ timeout: 8000 })
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.waitForLoadState('networkidle')
  must(await tile('own') === 45000, 'own money dropped once by 5,000: ' + await tile('own'))
  must(await tile('indebt') === 200000, 'internal debt: 195,000 to the fund + 5,000 to own money = 200,000: ' + await tile('indebt'))
  // หน้าเงินหมุนเวียน: ให้ยืมไป 5,000
  await page.goto(`http://localhost:${PORT}/#/balance/own`)
  must(/ให้กองทุนยืมไป/.test(await page.locator('main').innerText()), 'own money page shows the amount lent out')
  // หน้ากองทุนผู้ให้ยืมเดิม: ยอดสุทธิไม่เปลี่ยน มีการรับคืน/จ่ายสวัสดิการ
  await page.goto(`http://localhost:${PORT}/#/funds/tt4`); await page.waitForLoadState('networkidle')
  const f4 = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  must(/ให้ยืมไป 195,000/.test(f4) && /เข้า 5,000\.00/.test(f4) && /ออก 205,000\.00/.test(f4) && /เงินคงเหลือของกองทุนนี้ 0\.00/.test(f4), 'fund that was lent money: +5,000 repaid, −5,000 welfare, net unchanged, still owed 195,000: ' + f4.slice(0, 300))
  await page.goto(`http://localhost:${PORT}/#/funds/tt7`); await page.waitForLoadState('networkidle')
  const f7 = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  must(/ค้างคืน 5,000 จาก เงินหมุนเวียน/.test(f7) && /ค้างคืน 195,000 จาก กองทุน/.test(f7), 'borrowing fund owes 5,000 to own money and 195,000 to the fund: ' + f7.slice(0, 400))
  await page.screenshot({ path: 'shots/advance-fund.png', fullPage: true })
  // ยกเลิกทั้งชุด
  await page.goto(`http://localhost:${PORT}/#/balance/indebt`)
  page.once('dialog', (d) => d.accept())
  await page.getByRole('button', { name: 'ยกเลิกทั้งชุด' }).click()
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.waitForLoadState('networkidle')
  must(await tile('own') === 50000 && await tile('indebt') === 200000, 'undo restores everything: ' + await tile('own'))
  // ฟอร์มเงินยืมปกติ: ผู้ให้ยืม = เงินหมุนเวียน
  await page.goto(`http://localhost:${PORT}/#/balance/indebt`)
  const lp = page.getByRole('region', { name: 'เงินยืม', exact: true })
  await lp.getByRole('button', { name: /บันทึกเงินยืม/ }).click()
  await lp.locator('#ln-fund').selectOption('own')
  await lp.locator('#ln-borrower').selectOption('own')
  await lp.locator('.field', { hasText: 'จำนวนเงินที่ยืม' }).locator('input').fill('1000')
  await lp.getByRole('button', { name: 'บันทึกเงินยืม', exact: true }).click()
  must(/เงินหมุนเวียนให้เงินหมุนเวียนยืมไม่ได้/.test(await lp.innerText()), 'own cannot lend to own')
  await lp.locator('#ln-borrower').selectOption('tt7')
  await lp.getByRole('button', { name: 'บันทึกเงินยืม', exact: true }).click()
  await page.waitForFunction(() => /ยืมจากเงินหมุนเวียน/.test(document.body.innerText))
  await page.goto(`http://localhost:${PORT}/#/meeting/3`); await page.waitForLoadState('networkidle')
  must(await tile('own') === 49000 && await tile('indebt') === 201000, 'lender = own money: own −1,000, internal debt +1,000: ' + await tile('own') + '/' + await tile('indebt'))
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('advance-test OK')
} catch (e) { console.error(e.message); process.exitCode = 1 }
await browser.close(); server.kill()
