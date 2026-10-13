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
  must(/หมุนเวียน\s+1,260/.test(tt) && /กองทุน\s+6,050/.test(tt) && /รวม\s+7,310/.test(tt), 'home tiles show own 1,260 · funds 6,050 · total 7,310: ' + tt)
  must(/หนี้สินภายนอก\s+40,000/.test(tt), 'debt tile counts only outside lenders (50,000 − 10,000 repaid; fund loan excluded): ' + tt)
  must((await page.locator('.balance-tiles .btile').count()) === 4, 'four tiles')
  const ys = await page.locator('.balance-tiles .btile').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  must(ys[0] === ys[1] && ys[2] === ys[3] && ys[2] > ys[0], '2 x 2 layout: ' + ys)
  const hy = await page.locator('.home-tab').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
  must(new Set(hy).size === 1 && hy.length === 4, 'step tabs on one row')
  await page.screenshot({ path: 'shots/home-balance.png' })
  await tiles.getByRole('link', { name: /หนี้สินภายนอก/ }).click()
  must(await page.getByText('พี่ก').first().isVisible() && /40,000/.test(await page.locator('.bigfig').first().innerText()), 'debt page lists lender and total')
  await page.getByRole('button', { name: /บันทึกหนี้สินใหม่/ }).click()
  await page.getByLabel('ชื่อผู้ให้ยืม').fill('มน.เสาวคน')
  await page.locator('#ln-borrower').selectOption({ label: '💰 กองทุนศึกษา' })
  await page.getByLabel('ยืมไปใช้ทำอะไร').fill('ใช้ทำหลุมสุสาน')
  await page.locator('#ln-purpose').locator('xpath=following::input[@inputmode="decimal"][1]').fill('100000')
  await page.getByRole('button', { name: 'บันทึกเงินยืม' }).click()
  await page.getByText('ผู้ยืม: กองทุนศึกษา').waitFor()
  await page.screenshot({ path: 'shots/balance-debt.png', fullPage: true })
  await page.goto(`http://localhost:${PORT}/#/`)
  await tiles.getByRole('link', { name: /รวม/ }).click()
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
  must(/กองทุนเพื่อที่ดินคริสตจักร\s+6,000\.00/.test(body), 'land fund = 5,000 opening + 1,000 received: ' + body.slice(0, 500))
  must(/กองทุนศึกษา\s+50\.00/.test(body), 'study fund = 200 opening − 150 paid from fund')
  const cardOf = (n) => page.locator('details.fundcard', { hasText: n })
  must(/ยืมมา 50,000 บาท · ค้างคืน 40,000 จาก พี่ก.*ทำสุสาน/.test((await cardOf('กองทุนสุสาน').locator('.debtbanner').first().innerText()).replace(/\n/g, ' ')), 'borrowing fund shows the red banner while collapsed')
  must(/ถูกยืมไป 20,000 บาท โดย กองทุนสร้างอาคารพันธกิจ/.test((await cardOf('กองทุนเพื่อที่ดินคริสตจักร').innerText()).replace(/\n/g, ' ')), 'lending fund shows it was lent out')
  must(/ยืมมา 100,000 บาท.*มน.เสาวคน|ยืมมา 100,000 บาท.*จาก มน\.เสาวคน/.test((await cardOf('กองทุนศึกษา').locator('.debtbanner').first().innerText()).replace(/\n/g, ' ')), 'study fund shows the loan added from the debt page')
  await page.locator('details.fundcard', { hasText: 'กองทุนศึกษา' }).locator('summary').click()
  await page.screenshot({ path: 'shots/fundview-funds.png', fullPage: true })
  must(await page.getByText(/จ่าย · ค่าหนังสือศึกษา/).isVisible(), 'fund page lists the payment made from the fund')
  // เงินกองทุนไม่ปนรายรับปกติ: สรุปสัปดาห์
  await page.goto(`http://localhost:${PORT}/#/`)
  await page.getByRole('tab', { name: /สรุป/ }).click()
  await page.getByRole('tab', { name: /^1\s*สัปดาห์/ }).click()
  const sum = (await page.locator('.a4page').first().innerText()).replace(/\n/g, ' ')
  must(/สิบลด/.test(sum) && !/กองทุนเพื่อที่ดิน\S*\s+1,000/.test(sum.split('หมายเหตุ')[0]) && /ไม่รวมเงินถวายกองทุน 1,000/.test(sum), 'main income sheet excludes the fund offering and explains: ' + sum.slice(0, 600))
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
  must((await page.locator('#me-fund option').count()) >= 4, 'จ่ายจาก lists the funds')
  must(errors.length === 0, 'no page errors: ' + errors.join('|'))
  console.log('FUNDVIEW OK')
} catch (e) { await page.screenshot({ path: 'shots/fundview-fail.png', fullPage: true }); console.error(e.message); process.exitCode = 1 } finally { await browser.close(); server.kill() }
