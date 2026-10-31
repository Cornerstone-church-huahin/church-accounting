// สิทธิ์จากห้องงาน × ตำแหน่ง: ไม่มีห้อง = ไม่เห็นอะไร · ห้อง 15–18 ซ่อนจากผู้ใช้ทั่วไป · ที่ปรึกษาห้องทะเบียนดูอย่างเดียว · แอดมินห้องทะเบียนจัดการเต็ม · แปลงสิทธิ์ผู้บันทึกการนมัสการเดิม — npm run build && node scripts/rights-test.mjs
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
const PORT = 4190
const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' })
await new Promise((r) => setTimeout(r, 2500))
const exe = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined
const browser = await chromium.launch(exe ? { executablePath: exe } : {})
const errors = []
const must = (c, m) => { if (!c) throw new Error('FAIL: ' + m) }
async function open(me, members, route = '') {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, locale: 'th-TH' })
  const files = new Map(); let n = 0
  await ctx.route('https://api.github.com/**', async (route) => {
    const url = new URL(route.request().url())
    const mm = url.pathname.match(/^\/repos\/x\/y(?:\/contents\/(.+))?$/)
    const json = (status, b) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(b) })
    if (route.request().method() === 'OPTIONS') return json(204, {})
    if (!mm) return json(404, {})
    if (!mm[1]) return json(200, { private: true, permissions: { push: true } })
    const path = decodeURIComponent(mm[1])
    if (route.request().method() === 'GET') { const f = files.get(path); return f ? json(200, { sha: f.sha, encoding: 'base64', content: Buffer.from(f.text).toString('base64') }) : json(404, {}) }
    if (route.request().method() === 'PUT') { const b = JSON.parse(route.request().postData()); files.set(path, { text: Buffer.from(b.content, 'base64').toString('utf8'), sha: `s${++n}` }); return json(200, { content: { sha: `s${n}` } }) }
    return json(404, {})
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => d.accept())
  await page.addInitScript(([me, members]) => {
    localStorage.setItem('acct.sync.v1', JSON.stringify({ repo: 'x/y', token: 'fake', name: 'ทดสอบ' }))
    localStorage.setItem('acct.me.v1', JSON.stringify({ id: me }))
    localStorage.setItem('acct.members.v1', JSON.stringify([{ id: 'ad1', name: 'แอดมิน', role: 'admin', joined: 1, updated: 1 }, ...members]))
    localStorage.setItem('acct.church-members.v1', JSON.stringify([{ id: 'm1', name: 'นายสมชาย ตัวอย่าง', group: '3.วัยทำงาน', tel: '0812345678', birth: '1980-03-15', status: 'สมบูรณ์ ( 1 )', updated: 1 }]))
  }, [me, members])
  await page.goto(`http://localhost:${PORT}/${route}`)
  await page.reload()
  await page.waitForTimeout(1500)
  return page
}
const body = (p) => p.locator('body').innerText()
try {
  // 1) ผู้ใช้ทั่วไปที่ยังไม่มีห้อง: ไม่เห็นอะไร
  let p = await open('u1', [{ id: 'u1', name: 'ผู้ใช้ใหม่', role: 'viewer', joined: 2, updated: 1 }])
  must(/ยังไม่ได้รับสิทธิ์ใช้งานห้องงาน/.test(await body(p)), 'viewer with no room sees the no-rights notice')
  // 2) ห้อง 15–18 ซ่อนจากผู้ใช้ทั่วไป
  p = await open('u2', [{ id: 'u2', name: 'ผู้ใช้', role: 'viewer', works: [1, 2, 16], workRoles: { 1: 'lead', 2: 'helper', 16: 'lead' }, joined: 2, updated: 1 }])
  must(await p.locator('.btile').count() === 2 && !/แท็บ 16/.test(await body(p)), 'unnamed room 16 hidden from a normal user: ' + await p.locator('.btile').count())
  // 3) ที่ปรึกษาห้องทะเบียน: ดูอย่างเดียว ไม่มีไอคอนลงชื่อ
  p = await open('u3', [{ id: 'u3', name: 'ที่ปรึกษา', role: 'viewer', works: [2], workRoles: { 2: 'advisor' }, joined: 2, updated: 1 }], '#/meeting/2')
  let t = await body(p)
  must(/รวมสมาชิก/.test(t) && /รายงาน/.test(t) && !/ลงชื่อ/.test(t), 'advisor of registry: view icons only, no ลงชื่อ: ' + t.slice(0, 300))
  // 4) แอดมินห้องทะเบียน: จัดการทะเบียนเต็ม (เครื่องมือทะเบียน)
  p = await open('u4', [{ id: 'u4', name: 'แอดมินห้อง', role: 'viewer', works: [2], workRoles: { 2: 'owner' }, joined: 2, updated: 1 }], '#/meeting/2')
  await p.getByText('รวมสมาชิก', { exact: true }).first().click()
  must(await p.getByText('เครื่องมือทะเบียน').count() >= 1, 'room admin of registry sees the full registry tools')
  // 5) แอดมินระบบ: แปลงสิทธิ์ผู้บันทึกการนมัสการเดิมเป็นผู้ช่วยงาน ห้องทะเบียน
  p = await open('ad1', [{ id: 'w1', name: 'ผู้บันทึกเดิม', role: 'worship', joined: 2, updated: 1 }])
  const w1 = await p.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((x) => x.id === 'w1'))
  must(w1.role === 'viewer' && w1.works?.includes(2) && w1.workRoles?.['2'] === 'helper', 'legacy worship role migrated to registry helper: ' + JSON.stringify(w1))
  must(/ย้ายสิทธิ์ “ผู้บันทึกการนมัสการ”/.test(await body(p)), 'admin sees the migration notice')
  // 7) ที่ปรึกษา/ผู้ช่วยห้องเหรัญญิกดูรายงานการเงินได้ แต่แก้ข้อมูลห้องเลขาไม่ได้ · ผู้ดูแลห้องเลขาแก้ได้
  const mk = async (me, rec, label) => {
    const q = await open(me, [rec], '#/meeting/1/1/invite')
    await q.getByRole('button', { name: /เพิ่มหนังสือฉบับใหม่/ }).click().catch(() => {})
    await q.waitForTimeout(1200)
    const n = await q.evaluate(() => JSON.parse(localStorage.getItem('acct.inviteletter.v1') ?? '[]').filter((x) => !x.deleted).length)
    return n
  }
  must(await mk('f1', { id: 'f1', name: 'ที่ปรึกษาเหรัญญิก', role: 'viewer', works: [3], workRoles: { 3: 'advisor' }, joined: 2, updated: 1 }) === 0, 'finance advisor cannot create a secretary letter')
  must(await mk('f2', { id: 'f2', name: 'ผู้ช่วยเหรัญญิก', role: 'viewer', works: [3], workRoles: { 3: 'helper' }, joined: 2, updated: 1 }) === 0, 'finance helper cannot create a secretary letter')
  must(await mk('f3', { id: 'f3', name: 'ผู้ดูแลเลขา', role: 'viewer', works: [1], workRoles: { 1: 'lead' }, joined: 2, updated: 1 }) === 1, 'secretary-room lead can create a letter')
  // 6) หน้าตั้งค่า (แอดมิน): สวิตช์ห้องงาน × ตำแหน่ง แทนช่องสิทธิ์เดิม
  p = await open('ad1', [{ id: 'u5', name: 'คนทดสอบ', role: 'viewer', joined: 2, updated: 1 }], '#/settings')
  await p.getByText(/ผู้ใช้ร่วมและสิทธิ์/).first().click()
  const st = await body(p)
  must(!/ผู้บันทึกการนมัสการ/.test(st.split('ตำแหน่งในห้องงานแต่ละแบบ')[0]) && /ห้องงานและตำแหน่ง/.test(st), 'settings: no old role picker, new room × position switches')
  const grp = p.getByRole('group', { name: 'ห้องงานและตำแหน่งของ คนทดสอบ' })
  must(await grp.locator('.rgrid__row').count() === 0, 'no rooms yet: no rows, only the add button')
  await p.getByRole('button', { name: '＋ เพิ่มหน้าที่' }).click()
  must(await grp.locator('.rgrid__row').count() === 1, 'add button shows the new-duty row')
  await p.getByLabel('ห้องงานใหม่ของ คนทดสอบ', { exact: true }).selectOption({ label: 'งานทะเบียน' })
  must(await p.getByRole('switch', { name: 'เปิดห้องงานใหม่ของ คนทดสอบ' }).isDisabled(), 'switch disabled until a position is chosen')
  await p.getByLabel('ตำแหน่งใหม่ของ คนทดสอบ', { exact: true }).selectOption({ label: 'ที่ปรึกษา' })
  await p.getByRole('switch', { name: 'เปิดห้องงานใหม่ของ คนทดสอบ' }).click()
  await p.waitForTimeout(600)
  if (process.env.SHOT) await p.screenshot({ path: process.env.SHOT })
  must(await grp.locator('.rgrid__row').count() === 1 && await p.getByRole('button', { name: '＋ เพิ่มหน้าที่' }).count() === 1, 'one real room, new-duty row closed, add button back')
  const u5 = await p.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((x) => x.id === 'u5'))
  must(u5.works?.includes(2) && u5.workRoles?.['2'] === 'advisor', 'room + position saved: ' + JSON.stringify(u5))
  await p.getByLabel('ตำแหน่งของ คนทดสอบ ใน งานทะเบียน', { exact: true }).selectOption({ label: 'ผู้ช่วยงาน' })
  await p.waitForTimeout(500)
  must((await p.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((x) => x.id === 'u5'))).workRoles?.['2'] === 'helper', 'position can be changed in the row')
  await p.getByRole('switch', { name: 'งานทะเบียน' }).first().click()
  await p.waitForTimeout(500)
  const u5b = await p.evaluate(() => JSON.parse(localStorage.getItem('acct.members.v1')).find((x) => x.id === 'u5'))
  must(!u5b.works?.includes(2), 'switch off removes the room: ' + JSON.stringify(u5b))
  must(errors.length === 0, 'no page errors: ' + errors.join(';'))
  console.log('rights-test OK')
} catch (e) { console.error(e); process.exitCode = 1 } finally { await browser.close(); server.kill() }
