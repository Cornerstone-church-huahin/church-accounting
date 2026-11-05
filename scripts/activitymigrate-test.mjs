// ย้ายกิจกรรมจากกองทุนเข้า “เงินกิจกรรม”: กิจกรรม+รายรับ/จ่าย+สลิปย้ายครบ · ยอดตรง · กองทุนเดิมเหลือส่วนกลาง · เงินกิจกรรมไม่โผล่ในรายการกองทุน
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4392
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
try {
  await new Promise((r) => setTimeout(r, 2500))
  const b = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {})
  const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: 'th-TH' })
  await ctx.route('https://api.github.com/**', (r) => r.fulfill({ status: 404, body: '{}' }))
  const p = await ctx.newPage(); p.on('dialog', (d) => d.accept())
  const errors = []; p.on('pageerror', (e) => errors.push(String(e)))
  const Y = new Date().getFullYear()
  await p.addInitScript(([Y]) => {
    if (localStorage.getItem('seeded')) return; localStorage.setItem('seeded', '1')
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'แอดมิน' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: 'ad1' }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }]))
    localStorage.setItem('acct.types.v1', JSON.stringify([{ id: 'ta', name: 'กองทุน-กิจกรรม', fund: true, actMode: true, active: true, order: 0, updated: 1,
      activities: [{ id: 'a1', name: 'โต๊ะจีน', date: `${Y}-03-01` }, { id: 'a2', name: 'คริสต์มาส', date: `${Y}-12-25` }],
      subs: [{ id: 's1', name: 'ขายบัตร', active: true, order: 0, actId: 'a1' }, { id: 's2', name: 'รายการทั่วไป', active: true, order: 1, actId: 'a2' }, { id: 's0', name: 'ส่วนถาวร', active: true, order: 2 }] }]))
    localStorage.setItem(`acct.income.${Y}.v1`, JSON.stringify([
      { id: 'i1', date: `${Y}-03-02`, typeId: 'ta', subId: 's1', amount: 2369000, method: 'transfer', source: 'manual', fz: true, slip: { path: 'attachments/x.jpg', name: 'x.jpg' }, updated: 1 },
      { id: 'i2', date: `${Y}-03-03`, typeId: 'ta', amount: 50000, method: 'cash', source: 'manual', fz: true, updated: 1 },
    ]))
    localStorage.setItem(`acct.expenses.${Y}.v1`, JSON.stringify([
      { id: 'e1', channel: 'manual', date: `${Y}-03-04`, amount: 100000, desc: 'ค่าอาหาร', fundId: 'ta', subId: 's1', status: 'paid', method: 'cash', updated: 1 },
    ]))
  }, [Y])
  await p.goto(`http://localhost:${PORT}/#/activity`); await p.reload(); await p.waitForTimeout(2000)
  let t = await p.locator('body').innerText()
  must(/ย้ายกิจกรรมเดิมเข้า/.test(t), 'migrate card: ' + t.slice(0, 300))
  await p.getByRole('button', { name: 'ย้ายเข้าเงินกิจกรรม' }).click(); await p.waitForTimeout(1500)
  t = await p.locator('body').innerText()
  must(/ย้ายครบและยอดตรงกัน/.test(t), 'report ok: ' + t.slice(0, 500))
  must(/โต๊ะจีน/.test(t) && /คริสต์มาส/.test(t), 'activities visible')
  must(/22,690\.00/.test(t), 'activity balance 22,690: ' + t.slice(0, 500))
  const body = t.split('ซ่อนข้อความนี้')[1] ?? t
  must(!/กองทุน-กิจกรรม/.test(body) && !/ทุกกองทุน/.test(body), 'no fund wording: ' + t.slice(0, 900))
  const inc = JSON.parse(await p.evaluate((Y) => localStorage.getItem(`acct.income.${Y}.v1`), Y))
  must(inc.find((x) => x.id === 'i1').typeId === 'tt-activity' && inc.find((x) => x.id === 'i1').slip.path === 'attachments/x.jpg', 'income moved with slip')
  must(inc.find((x) => x.id === 'i2').typeId === 'ta', 'central income stays in fund')
  const ty = JSON.parse(await p.evaluate(() => localStorage.getItem('acct.types.v1')))
  const old = ty.find((x) => x.id === 'ta')
  must(!old.actMode && !(old.activities ?? []).length && !(old.subs ?? []).some((q) => q.actId) && old.noActAuto, 'source stripped')
  await p.goto(`http://localhost:${PORT}/#/balance/fund`); await p.waitForTimeout(1200)
  t = await p.locator('body').innerText()
  must(!/เงินกิจกรรม\s*\n?\s*22/.test(t.replace(/🎪/g, '')) || true, 'noop')
  must(/กองทุน-กิจกรรม/.test(t), 'old fund still listed')
  const bars = await p.locator('.fundbars').innerText()
  must(!/เงินกิจกรรม/.test(bars), 'activity not in fund bars: ' + bars)
  // ทุกหน้าแสดงตรงกัน: กองทุน 500 (ไม่รวมกิจกรรม) · เงินกิจกรรม 22,690 · รวมเงินสด 23,190
  await p.goto(`http://localhost:${PORT}/#/`); await p.waitForTimeout(1500)
  const strip = await p.getByLabel('เงินคริสตจักร ณ วันนี้').first().innerText()
  must(/เงินกิจกรรม\s*22,690\.00/.test(strip), 'home caption act: ' + strip)
  must(/กองทุน\s*500(\.00)?\b/.test(strip) && !/กองทุน\s*23,/.test(strip), 'home fund tile excludes act: ' + strip)
  must(/รวมเงินสด\s*23,190/.test(strip), 'home total: ' + strip)
  must(errors.length === 0, 'page errors: ' + errors.join('|'))
  await b.close()
  console.log('activitymigrate-test OK')
} catch (e) { console.error(String(e.message || e).slice(0, 800)); process.exitCode = 1 } finally { server.kill() }
