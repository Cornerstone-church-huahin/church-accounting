// ทดสอบหน้ากองทุน (ตั้งต้น + รับ − จ่าย) · เงินกองทุนไม่ปนรายรับ-จ่ายปกติ · ตัวเลือก "จ่ายจาก" · สรุปรายสัปดาห์แบบเมนูพับ: npm run build && node scripts/fundview-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4177
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
const o = new Date(now); o.setDate(o.getDate() - 20)
try {
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.evaluate(([T, Y, O]) => {
    const set = (k, v) => localStorage.setItem(`acct.${k}.v1`, JSON.stringify(v))
    set('opening', [{ id: 'opening', updated: 1, date: O, accounts: {}, cash: 0, unmoved: {}, funds: { tt4: 500000, tt9: 20000 }, own: 100000 }])
    set('loans', [
      { id: 'l1', lender: { kind: 'person', name: 'พี่ก' }, borrower: 'tt8', purpose: 'ทำสุสาน', date: '2026-06-01', principal: 5000000, repayments: [{ id: 'r1', date: '2026-07-01', amount: 1000000 }], updated: 1 },
      { id: 'l2', lender: { kind: 'fund', fundId: 'tt4' }, borrower: 'tt7', purpose: 'รถตู้', date: '2026-06-02', principal: 2000000, repayments: [], updated: 1 },
      { id: 'l3', lender: { kind: 'fund', fundId: 'tt4' }, borrower: 'tt9', purpose: 'ซื้อหนังสือ', date: T, principal: 50000, repayments: [], updated: 1 },
    ])
    set(`income.${Y}`, [
      { id: 'i1', date: T, typeId: 'tt4', amount: 100000, method: 'cash', source: 'manual', updated: 1 },
      { id: 'i2', date: T, typeId: 'tt1', amount: 30000, method: 'cash', source: 'manual', updated: 1 },
    ])
    set(`expenses.${Y}`, [
      { id: 'e1', channel: 'manual', date: T, amount: 15000, desc: 'ค่าหนังสือศึกษา', catId: 'xq-6', fundId: 'tt9', status: 'paid', paidDate: T, method: 'cash', updated: 1 },
      { id: 'e2', channel: 'manual', date: T, amount: 4000, desc: 'ค่าไฟ', catId: 'xq-10', status: 'paid', paidDate: T, method: 'cash', updated: 1 },
    ])
  }, [T, Y, iso(o)])
  await page.reload(); await page.waitForLoadState('networkidle')
  // แถบเงินคริสตจักรใต้ชื่อบัญชี: หมุนเวียน · กองทุน · รวม (ต่างจากแท็บขั้นตอน)
  const tiles = page.getByRole('navigation', { name: /เงินคริสตจักร/ })
  const tt = (await tiles.innerText()).replace(/\n/g, ' ')
  must(/หมุนเวียน\s+1,260/.test(tt) && /กองทุน\s+46,050/.test(tt) && /รวมเงินสด\s+47,310/.test(tt), 'home tiles show own 1,260 · funds 46,050 · total 47,310: ' + tt)
  must(/หนี้ภายนอก\s+40,000/.test(tt), 'debt tile counts only outside lenders (50,000 − 10,000 repaid; fund loan excluded): ' + tt)
  must((await page.locator('.balance-tiles .btile').count()) === 6, 'six tiles')
  must(/หนี้ภายใน\s+20,500/.test(tt), 'internal debt tile = 20,000 + 500: ' + tt)
  const ys = await page.locator('.balance-tiles .btile').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  must(ys[0] === ys[1] && ys[1] === ys[2] && ys[3] === ys[4] && ys[4] === ys[5] && ys[3] > ys[0], '3 x 2 layout: ' + ys)
  const hy = await page.locator('.stepbtn').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  must(hy.length === 4 && hy[0] === hy[1] && hy[2] === hy[3] && hy[2] > hy[0], 'step buttons are 2 x 2: ' + hy)
  // กดขั้นตอน → เต็มจอ (ซ่อนช่องบน) → ‹ หน้าแรก กลับ
  await page.getByRole('tab', { name: /💚 รับ/ }).click()
  must((await page.locator('.balance-tiles').count()) === 0 && await page.getByRole('button', { name: 'กลับหน้าแรก' }).isVisible(), 'full screen hides the top area')
  await page.getByRole('button', { name: 'กลับหน้าแรก' }).click()
  must((await page.locator('.balance-tiles .btile').count()) === 6 && (await page.locator('.stepbtn').count()) === 4, 'back to the two-part home')
  await page.screenshot({ path: 'shots/home-balance.png' })
  await tiles.getByRole('link', { name: /หนี้ภายนอก/ }).click()
  must(await page.getByText('พี่ก').first().isVisible() && /40,000/.test(await page.locator('.bigfig').first().innerText()), 'debt page lists lender and total')
  await page.getByRole('button', { name: /บันทึกหนี้สินใหม่/ }).click()
  await page.getByLabel('ชื่อผู้ให้ยืม').fill('มน.เสาวคน')
  await page.locator('#ln-borrower').selectOption({ label: '💰 กองทุนศึกษา' })
  must((await page.getByLabel('ยืมไปใช้ทำอะไร').count()) === 0, 'old purpose field replaced')
  await page.locator('#ln-date').locator('xpath=following::input[@inputmode="decimal"][1]').fill('100000')
  await page.locator('#ln-purpose').fill('ทำหลุมสุสาน')
  await page.getByRole('button', { name: 'บันทึกเงินยืม' }).click()
  await page.getByText('ผู้ยืม: กองทุนศึกษา').waitFor()
  await page.screenshot({ path: 'shots/balance-debt.png', fullPage: true })
  await page.goto(`http://localhost:${PORT}/#/`)
  await tiles.getByRole("link", { name: /รวมเงินสด/ }).click()
  must(await page.getByRole('heading', { name: /รวมเงินคริสตจักร/ }).isVisible(), 'total detail page opens')
  await page.getByRole('tab', { name: /หมุนเวียน/ }).click()
  must(await page.getByText('เงินหมุนเวียนคงเหลือ').first().isVisible() && (await page.locator('svg[aria-label="คงเหลือสะสม"]').count()) >= 0, 'own detail page opens')
  await page.screenshot({ path: 'shots/balance-own.png', fullPage: true })
  await page.goto(`http://localhost:${PORT}/#/`)
  // หน้ากองทุน
  await page.getByRole('link', { name: /เพิ่มเติม/ }).click()
  await page.getByRole('link', { name: /^กองทุน/ }).click()
  await page.getByRole('heading', { name: /กองทุน/ }).waitFor()
  const body = (await page.locator('main, body').first().innerText()).replace(/\n/g, ' ')
  must(/กองทุนเพื่อที่ดินคริสตจักร\s+[−-]14,500\.00/.test(body), 'land fund = 5,000 opening + 1,000 received − 500 − 20,000 lent (even for loans dated before the opening date): ' + body.slice(0, 500))
  must(/กองทุนศึกษา\s+100,550\.00/.test(body), 'study fund = 200 opening − 150 paid + 500 internal loan + 100,000 outside loan, all real cash')
  const cardOf = (n) => page.locator('details.fundcard').filter({ has: page.locator('summary > div > b:first-child', { hasText: new RegExp('^' + n + '$') }) })
  { const st = (await cardOf('กองทุนศึกษา').locator('summary').innerText()).replace(/\n/g, ' '); must(/ยืมมา 500 · ค้างคืน 500 จาก/.test(st), 'borrowing fund shows the real cash + red debt banner: ' + st) }
  must(/ให้ยืมไป 500 /.test((await cardOf('กองทุนเพื่อที่ดินคริสตจักร').innerText()).replace(/\n/g, ' ')), 'lending fund shows red lent-out banner')
  must(/ยืมมา 50,000 · ค้างคืน 40,000 จาก พี่ก.*ทำสุสาน/.test((await cardOf('กองทุนสุสาน').locator('summary').innerText()).replace(/\n/g, ' ')), 'borrowing fund shows the red banner while collapsed')
  must(/ให้ยืมไป 500 /.test((await cardOf('กองทุนเพื่อที่ดินคริสตจักร').innerText()).replace(/\n/g, ' ')), 'lending fund shows it was lent out')
  must(/ยืมมา 100,000 .*มน.เสาวคน|ยืมมา 100,000 .*จาก มน\.เสาวคน/.test((await cardOf('กองทุนศึกษา').locator('summary').innerText()).replace(/\n/g, ' ')), 'study fund shows the loan added from the debt page')
  await page.screenshot({ path: 'shots/fundview-funds.png', fullPage: true })
  // เงินกองทุนไม่ปนรายรับปกติ: สรุปสัปดาห์
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('tab', { name: /สรุป/ }).click()
  await page.getByRole('tab', { name: /^1\s*สัปดาห์/ }).click()
  const sum = (await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ')
  must(/สิบลด/.test(sum) && !/กองทุนเพื่อที่ดิน/.test(sum.split('เงินถวายกองทุน (แยก')[0]) && /เงินถวายกองทุน \(แยก.*กองทุนเพื่อที่ดิน\S*\s+1\s+1,000/.test(sum), 'main income table excludes the fund offering; it is listed separately below: ' + sum.slice(0, 600))
  const exp = (await page.locator('.a4page').nth(1).innerText()).replace(/\n/g, ' ')
  must(!/ค่าหนังสือ|150/.test(exp) && /ค่าไฟ|ยังไม่ระบุ|40/.test(exp), 'main expense sheet excludes the fund payment: ' + exp.slice(0, 500))
  // เมนูพับ: สัปดาห์ล่าสุดอยู่บนสุด เปิดอยู่ · กดพับ/ขยายได้
  const heads = page.locator('.weekacc__head')
  must((await heads.first().getAttribute('aria-expanded')) === 'true', 'latest week is open and on top')
  await heads.first().click()
  must((await page.locator('.a4page').count()) === 0, 'collapse hides the sheets')
  await heads.first().click()
  must((await page.locator('.a4page').count()) === 3, 'expand shows the 3 related sheets')
  await page.screenshot({ path: 'shots/fundview-weeks.png' })
  // ฟอร์มรายจ่ายมีตัวเลือก "จ่ายจาก"
  await page.getByRole('tab', { name: '🔴 จ่าย' }).click()
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  must((await page.locator('#me-fund').count()) === 0, 'no จ่ายจาก picker in the circulating-money expense form')
  // รายจ่ายของกองทุนไม่โผล่ในใบเบิก-จ่ายเงินสด (บัญชีหมุนเวียน) — แยกกันโดยสิ้นเชิง
  const vt = (await page.getByRole('table', { name: /ใบเบิก-จ่ายเงินสด \(A4\)/ }).innerText()).replace(/\s+/g, ' ')
  must(!/ค่าหนังสือศึกษา/.test(vt) && /ค่าไฟ/.test(vt), 'voucher sheet shows only circulating-money rows: ' + vt.slice(0, 300))
  await page.getByRole('tab', { name: /💚 รับ/ }).click(); await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  const typeOpts = await page.locator('#mi-type option').allInnerTexts()
  must(typeOpts.filter((t) => /กองทุน/.test(t)).length >= 4, 'income form lists the same types as settings (funds included): ' + typeOpts.join('|'))
  // หน้ากองทุน: ยอดรวมของกองทุนนั้นอยู่ด้านบน → แท็บ รับ/จ่าย ใช้ใบ A4 และฟังก์ชันชุดเดียวกับหน้าแรก แต่เป็นข้อมูลของกองทุนนี้ล้วน
  await page.goto(`http://localhost:${PORT}/#/funds/tt9`)
  await page.getByRole('heading', { name: /กองทุนศึกษา/ }).waitFor()
  const topBal = page.getByRole('status', { name: /ยอดคงเหลือ กองทุน กองทุนศึกษา/ })
  const balNow = async () => Number((await topBal.innerText()).match(/(-?[\d,]+\.\d\d) บาท/)[1].replace(/,/g, ''))
  const base = await balNow()
  const bal0 = (await topBal.innerText()).replace(/\n/g, ' ')
  must(/ตั้งต้น 200\.00/.test(bal0) && /เข้า .* − ออก/.test(bal0), 'fund page shows its total with opening + in − out at the top: ' + bal0)
  must((await page.getByRole('tab', { name: /💚 รับ/ }).count()) === 1 && (await page.getByRole('tab', { name: /🔴 จ่าย/ }).count()) === 1, 'fund page has the two tabs รับ/จ่าย')
  must(await page.getByRole('table', { name: /ใบบันทึกการถวาย \(A4 แนวนอน\)/ }).isVisible(), 'income tab shows the same A4 income sheet')
  must((await page.getByRole('tab', { name: /บันทึกสลิป|ใบบันทึกการถวาย/ }).count()) === 0, 'no extra functions besides รับ/จ่าย (slip/sheet tabs hidden)')
  // เงินยืมระหว่างกองทุน: กองทุนที่ยืมมา → แถว "ยืมจาก …" ในใบรับ + แถบแดงเล็กด้านบนหน้า
  const incSheet0 = (await page.locator('.a4page').first().innerText()).replace(/\s+/g, ' ')
  must(/กองทุนศึกษา · ยืมจาก กองทุน/.test(incSheet0) && !/⚠️/.test(incSheet0), 'borrower fund income sheet lists the loan received (the red warning lives at the top of the page, not on the sheet): ' + incSheet0.slice(0, 400))
  must(/ยืมมา .* ค้างคืน/.test(await page.getByRole('alert').first().innerText()), 'red debt banner at the top of the fund page')
  // รับ: ใส่เงินเข้ากองทุนนี้ (ประเภทคือกองทุนนี้เท่านั้น)
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  must((await page.locator('#mi-type option').allInnerTexts()).join('|') === 'กองทุนศึกษา', 'income form offers only this fund')
  await page.locator('#mi-note').fill('ยกยอดมา')
  await page.locator('.entryrow .field', { hasText: 'เงินสด (บาท)' }).locator('input').fill('1000')
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('1,000'))
  must(/กองทุนศึกษา · ยกยอดมา/.test(await page.getByRole('table', { name: /ใบบันทึกการถวาย \(A4 แนวนอน\)/ }).innerText()), 'typed description shows on the fund income sheet')
  // แตะแถวในใบ → ป๊อปอัพ: พิมพ์รายการเองได้ ไม่ขึ้นข้อความ "สิทธิ์ไม่พอ" และบันทึกเป็นหมายเหตุของแถว
  await page.getByRole('table', { name: /ใบบันทึกการถวาย \(A4 แนวนอน\)/ }).locator('tbody tr', { hasText: 'ยกยอดมา' }).first().click()
  await page.locator('#ire-label').fill('ยกยอดมาจากปีก่อน')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await page.waitForFunction(() => document.querySelector('table[aria-label*="ใบบันทึกการถวาย"]')?.textContent?.includes('ยกยอดมาจากปีก่อน'))
  must(await page.getByRole('alert').filter({ hasText: 'สิทธิ์' }).count() === 0, 'no permission error when typing a description on the fund page')
  must(Math.abs((await balNow()) - (base + 1000)) < 0.01, 'top total rises by the income: ' + await topBal.innerText())
  // จ่าย: ใบเบิก-จ่าย A4 ชุดเดียวกัน + กรอบสรุปของกองทุน + แนบบิลได้
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  const vt0 = (await page.getByLabel('สรุปประจำสัปดาห์').first().innerText()).replace(/\s+/g, ' ')
  must(/เงินรับ กองทุนศึกษา 101,500/.test(vt0) && /เงินกองทุนคงเหลือปัจจุบัน/.test(vt0), 'fund expense sheet summary boxes show this fund only: ' + vt0)
  await page.getByRole('tab', { name: /บันทึกด้วยมือ/ }).click()
  must((await page.getByLabel('แนบไฟล์สลิปหรือบิล').count()) === 1, 'can attach a bill/slip like the circulating pay tab')
  await page.locator('.entryrow .field', { hasText: 'จำนวนเงิน (บาท)' }).locator('input').fill('300')
  await page.getByRole('button', { name: '＋ เพิ่มลงตาราง' }).click()
  await page.getByLabel('ใบเบิก-จ่ายเงินสด (A4)').first().getByText('300').first().waitFor()
  must(Math.abs((await balNow()) - (base + 700)) < 0.01, 'top total drops by the expense: ' + await topBal.innerText())
  // กองทุนที่ให้ยืม: แถว "ให้ … ยืม" ในใบเบิก-จ่าย (ยอดคงเหลือหักไปแล้ว)
  await page.goto(`http://localhost:${PORT}/#/funds/tt4`)
  await page.getByRole('tab', { name: /🔴 จ่าย/ }).click()
  const lendSheet = (await page.getByLabel('ใบเบิก-จ่ายเงินสด (A4)').first().innerText()).replace(/\s+/g, ' ')
  must(/ให้ กองทุนศึกษา ยืม/.test(lendSheet), 'lender fund expense sheet lists the loan given: ' + lendSheet.slice(0, 300))
  must(/ให้ยืมไป .* รอรับคืน/.test(await page.getByRole('alert').filter({ hasText: 'ให้ยืมไป' }).first().innerText()) && (await page.locator('.debtbanner--lent').count()) >= 1, 'lender fund page shows a green banner that money is lent out')
  // บัญชีหมุนเวียนไม่เห็นรายการของกองทุน
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.locator('.stepbtn', { hasText: 'ใบเบิก-จ่ายเงินสด' }).click()
  const circ = (await page.getByRole('table', { name: /ใบเบิก-จ่ายเงินสด \(A4\)/ }).innerText()).replace(/\s+/g, ' ')
  must(/ค่าไฟ/.test(circ) && !/(^|\s)300(\s|$)/.test(circ), 'circulating voucher sheet shows its own rows only, not the fund expense: ' + circ.slice(0, 300))
  // หน้าเงินคริสตจักร › กองทุน: แถบยาวต่อกองทุน → แตะเข้าหน้ากองทุนนั้น
  await page.goto(`http://localhost:${PORT}/#/balance/fund`)
  const bars = page.getByRole('list', { name: 'ยอดแต่ละกองทุน' })
  await bars.getByRole('link', { name: /^กองทุนศึกษา/ }).click()
  await page.getByRole('heading', { name: /กองทุนศึกษา/ }).waitFor()
  await page.screenshot({ path: 'shots/fund-detail.png', fullPage: true })
  await page.goto(`http://localhost:${PORT}/#/`)
  must(/กองทุน\s+−?[\d,]+/.test((await page.getByRole('navigation', { name: /เงินคริสตจักร/ }).innerText()).replace(/\n/g, ' ')), 'home fund tile still renders')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('FUNDVIEW OK')
} catch (e) { await page.screenshot({ path: 'shots/fundview-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
