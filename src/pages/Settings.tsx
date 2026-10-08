import { useState } from 'react'
import { can, ROLE_HELP, ROLE_LABEL, ROLES, type Role } from '../lib/access'
import { useAccounts, useBudgetAdjs, useBudgetEntries, useBudgetLines, useFunds, useIncome, useIncomeTypes, useRounds, useSettings, useStatementBatches, useStatementLines, useVouchers } from '../lib/data'
import { useMembers, useRole } from '../lib/members'
import { fmtBaht, newId, parseBaht } from '../lib/money'
import { DEFAULT_REPO, deleteFile, getSync, listDir, saveSync, testSync } from '../lib/sync'
import InstallApp from '../components/InstallApp'
import { be } from '../lib/money'
import { useYear } from '../lib/year'

const fmtJoined = (t: number) => (t ? new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

export default function Settings() {
  const role = useRole()
  const cfg = getSync()
  return (
    <>
      <div className="page-head"><h1>ตั้งค่า</h1></div>
      <section className="card" aria-labelledby="h-inst"><h2 id="h-inst">📲 ติดตั้งเป็นแอป</h2><InstallApp /></section>
      <Connect />
      {cfg && <Members />}
      {can(role, 'settings') && <General />}
      {can(role, 'settings') && <Types />}
      {can(role, 'settings') && <Accounts />}
      {can(role, 'settings') && <DataClean />}
      <Display />
    </>
  )
}

function Connect() {
  const cfg = getSync()
  const [repo, setRepo] = useState(cfg?.repo ?? DEFAULT_REPO)
  const [token, setToken] = useState('')
  const [name, setName] = useState(cfg?.name ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const connect = async () => {
    if (!name.trim()) return setMsg({ ok: false, text: 'ใส่ชื่อของท่านก่อน' })
    if (!token.trim()) return setMsg({ ok: false, text: 'ใส่รหัสเข้าใช้ร่วม' })
    setBusy(true)
    const next = { repo: repo.trim() || DEFAULT_REPO, token: token.trim(), name: name.trim() }
    const err = await testSync(next)
    setBusy(false)
    if (err) return setMsg({ ok: false, text: err })
    saveSync(next)
    setToken('')
    setMsg({ ok: true, text: 'เชื่อมต่อแล้ว ✓' })
  }
  return (
    <section className="card" aria-labelledby="h-conn">
      <h2 id="h-conn">☁️ เชื่อมต่อออนไลน์</h2>
      {cfg ? (
        <>
          <p>เชื่อมต่อแล้ว · <b>{cfg.name}</b> · <span className="muted small">{cfg.repo}</span></p>
          <button type="button" className="btn btn--ghost" onClick={() => { if (confirm('ตัดการเชื่อมต่อบนเครื่องนี้? (ข้อมูลออนไลน์ไม่หาย)')) saveSync(null) }}>ตัดการเชื่อมต่อเครื่องนี้</button>
        </>
      ) : (
        <>
          <p className="muted small">ตอนนี้ใช้คนเดียวในเครื่อง (ทดลอง) · แอดมินคนแรกใส่รหัสเข้าใช้ร่วมที่นี่ ส่วนคนอื่นเปิดลิงก์เชิญที่แอดมินส่งให้</p>
          <div className="field"><label htmlFor="c-name">ชื่อของท่าน</label><input id="c-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="field"><label htmlFor="c-repo">repo ข้อมูล (Private)</label><input id="c-repo" className="input" value={repo} onChange={(e) => setRepo(e.target.value)} /></div>
          <div className="field"><label htmlFor="c-token">รหัสเข้าใช้ร่วม (GitHub fine-grained token)</label><input id="c-token" className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" /></div>
          <button type="button" className="btn btn--gold" disabled={busy} onClick={connect}>{busy ? 'กำลังทดสอบ…' : 'เชื่อมต่อ'}</button>
          <p className="foot-note">สร้างรหัสที่ GitHub › Settings › Developer settings › Fine-grained tokens · เลือกเฉพาะ repo ข้อมูล · สิทธิ์ Contents: Read and write · รหัสเก็บในเครื่องนี้เท่านั้น</p>
        </>
      )}
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
    </section>
  )
}

function Members() {
  const m = useMembers()
  const cfg = getSync()
  const [inviteRole, setInviteRole] = useState<'bookkeeper' | 'auditor' | 'viewer'>('bookkeeper')
  const [inviteFor, setInviteFor] = useState('')
  const [want, setWant] = useState<Record<string, Role>>({})
  const [delId, setDelId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  if (!cfg) return null
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 3000) }
  const link = `${location.origin}${location.pathname}#/join?t=${encodeURIComponent(cfg.token)}${cfg.repo !== DEFAULT_REPO ? `&r=${encodeURIComponent(cfg.repo)}` : ''}&role=${inviteRole}${inviteFor.trim() ? `&for=${encodeURIComponent(inviteFor.trim())}` : ''}`
  const share = async () => {
    const text = `ขอเชิญร่วมใช้แอปบัญชีคริสตจักร${inviteFor.trim() ? ` (ถึง ${inviteFor.trim()})` : ''} — เปิดลิงก์นี้ แล้วพิมพ์ชื่อของท่านเพื่อส่งคำขอ แอดมินอนุมัติแล้วจึงใช้ได้:\n${link}`
    try {
      if (navigator.share) await navigator.share({ title: 'เข้าร่วมแอปบัญชีคริสตจักร', text })
      else { await navigator.clipboard.writeText(text); flash('คัดลอกลิงก์แล้ว วางในแชตส่วนตัวได้เลย (อย่าโพสต์ในกลุ่ม)') }
    } catch { /* ผู้ใช้ปิดหน้าต่างแชร์ */ }
  }
  return (
    <section className="card" aria-labelledby="h-mem">
      <h2 id="h-mem">👤 ผู้ใช้ร่วมและสิทธิ์ {m.isAdmin && m.pending.length > 0 && <span className="badge badge--gold">รออนุมัติ {m.pending.length}</span>}</h2>
      {m.isAdmin && (
        <div className="stack">
          <h3>① ส่งลิงก์เชิญ</h3>
          <div className="field"><label htmlFor="inv-for">ส่งให้ใคร (ชื่อ — ไว้เทียบตอนอนุมัติ)</label><input id="inv-for" className="input" value={inviteFor} maxLength={40} onChange={(e) => setInviteFor(e.target.value)} placeholder="เช่น พี่สมชาย" /></div>
          <div className="field">
            <label htmlFor="inv-role">สิทธิ์ที่ตั้งใจให้ (เปลี่ยนได้ตอนอนุมัติ)</label>
            <select id="inv-role" className="input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}>
              {(['bookkeeper', 'auditor', 'viewer'] as const).map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
            </select>
          </div>
          <button type="button" className="btn btn--gold" onClick={share}>📤 ส่งลิงก์ทาง Line หรืออื่น ๆ</button>
          <p className="foot-note">ลิงก์มีรหัสเข้าใช้ร่วมอยู่ด้วย — ส่งเฉพาะแชตส่วนตัว อย่าโพสต์ในกลุ่ม · ผู้รับต้องรออนุมัติจากท่านก่อนจึงใช้ได้ · สิทธิ์แอดมินให้ได้ตอนอนุมัติเท่านั้น</p>

          <h3>② คำขอที่รออนุมัติ ({m.pending.length})</h3>
          {m.pending.length === 0 && <p className="muted small">ยังไม่มีคำขอ <button type="button" className="mini" onClick={m.syncNow}>🔄 ตรวจคำขอใหม่</button></p>}
          <ul className="list">
            {m.pending.map((x) => {
              const w = want[x.id] ?? x.role
              const matches = !x.invitedFor || x.invitedFor.trim().toLowerCase() === x.name.trim().toLowerCase()
              return (
                <li key={x.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div><b>{x.name}</b><br /><span className="small muted">{x.invitedFor ? (matches ? `✓ ตรงกับชื่อที่ส่งลิงก์ให้ (${x.invitedFor})` : `⚠️ ลิงก์นี้ส่งให้ “${x.invitedFor}” แต่ผู้ขอใช้ชื่อ “${x.name}” — ตรวจให้แน่ใจก่อนอนุมัติ`) : 'ลิงก์ไม่ได้ระบุชื่อผู้รับ — ตรวจว่าเป็นคนที่ท่านส่งไปหรือไม่'}</span></div>
                  <div className="row">
                    <select aria-label={`สิทธิ์ที่จะให้ ${x.name}`} className="input grow" value={w} onChange={(e) => setWant({ ...want, [x.id]: e.target.value as Role })}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button type="button" className="btn btn--gold" onClick={() => { m.approve(x.id, w); flash(`อนุมัติ ${x.name} แล้ว (${ROLE_LABEL[w]})`) }}>✓ อนุมัติ</button>
                    <button type="button" className="btn btn--ghost" onClick={() => { m.reject(x.id); flash(`ไม่อนุมัติ ${x.name}`) }}>✕</button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      <h3>{m.isAdmin ? '③ ' : ''}ผู้ใช้ร่วม ({m.members.length} คน)</h3>
      {m.members.length === 0 && <p className="muted small">ยังไม่มีรายชื่อ — จะขึ้นเมื่อซิงก์ครั้งแรกเสร็จ <button type="button" className="mini" onClick={m.syncNow}>🔄 ซิงก์ตอนนี้</button></p>}
      <ul className="list">
        {m.members.map((x) => {
          const lastAdmin = x.role === 'admin' && m.adminCount <= 1
          return (
            <li key={x.id} style={{ flexWrap: 'wrap' }}>
              <span className="grow"><b>{x.name}</b> {x.id === m.meId && <span className="badge">คุณ</span>}<br /><span className="small muted">เข้าร่วม {fmtJoined(x.joined)}</span></span>
              {m.isAdmin ? (
                <>
                  <select aria-label={`สิทธิ์ของ ${x.name}`} className="input" style={{ width: '10.5rem' }} value={x.role} disabled={lastAdmin} onChange={(e) => { if (!m.setRole(x.id, e.target.value as Role)) flash('ต้องมีแอดมินอย่างน้อย 1 คน') }}>
                    {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                  </select>
                  {delId === x.id ? (
                    <span className="row"><button type="button" className="btn btn--danger" onClick={() => { if (!m.removeMember(x.id)) flash('ลบแอดมินคนสุดท้ายไม่ได้'); setDelId(null) }}>ลบ {x.name}</button><button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button></span>
                  ) : <button type="button" className="mini" disabled={lastAdmin} onClick={() => setDelId(x.id)} aria-label={`ลบ ${x.name}`}>🗑️</button>}
                </>
              ) : <span className="badge">{ROLE_LABEL[x.role]}</span>}
            </li>
          )
        })}
      </ul>
      {msg && <p className="ok" role="status">{msg}</p>}
      <details>
        <summary>สิทธิ์แต่ละระดับทำอะไรได้</summary>
        <ul>{ROLES.map((r) => <li key={r}><b>{ROLE_LABEL[r]}</b> — {ROLE_HELP[r]}</li>)}</ul>
      </details>
      <p className="foot-note">สิทธิ์เป็นการกันในแอป ไม่ใช่การล็อกระดับ GitHub — ใครมีรหัสเข้าใช้ร่วมก็อ่าน repo ข้อมูลได้ตรง ๆ จึงควรแจกรหัสเฉพาะคนที่ไว้ใจ และเปลี่ยนรหัสใหม่เมื่อมีคนออก</p>
    </section>
  )
}

function General() {
  const { settings, save } = useSettings()
  const [name, setName] = useState(settings.churchName)
  const [two, setTwo] = useState(String(settings.twoStepOver / 100))
  const [days, setDays] = useState(String(settings.matchDays))
  const [msg, setMsg] = useState('')
  const apply = () => {
    const t = parseBaht(two), d = parseInt(days, 10)
    if (Number.isNaN(t) || t < 0 || !(d >= 0 && d <= 31)) return setMsg('ตรวจตัวเลขอีกครั้ง')
    if (save({ churchName: name.trim() || settings.churchName, twoStepOver: t, matchDays: d })) setMsg('บันทึกแล้ว ✓')
  }
  return (
    <section className="card" aria-labelledby="h-gen">
      <h2 id="h-gen">⚙️ ค่าทั่วไป</h2>
      <div className="field"><label htmlFor="g-name">ชื่อคริสตจักร (หัวรายงาน)</label><input id="g-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label htmlFor="g-two">ใบเบิกเกินกี่บาทต้องอนุมัติ 2 ขั้น</label><input id="g-two" className="input input--money" inputMode="decimal" value={two} onChange={(e) => setTwo(e.target.value)} /><span className="foot-note">ไม่เกินจำนวนนี้: ผู้ตรวจสอบหรือแอดมิน 1 คนอนุมัติ · เกิน: ต้อง 2 คนต่างกัน และมีแอดมินอย่างน้อย 1 คน (ขณะนี้ {fmtBaht(settings.twoStepOver, { dec: false })} บาท)</span></div>
      <div className="field"><label htmlFor="g-days">เทียบสเตตเมนต์: ยอมให้วันที่ห่างกันกี่วัน</label><input id="g-days" className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
      <button type="button" className="btn btn--gold" onClick={apply}>บันทึก</button>
      {msg && <p className="ok" role="status">{msg}</p>}
    </section>
  )
}

function Types() {
  const t = useIncomeTypes()
  const [name, setName] = useState('')
  const add = () => {
    const n = name.trim()
    if (!n || t.list.some((x) => x.name === n)) return
    t.put([{ id: newId('t'), name: n, order: t.list.length, active: true, updated: 0 }])
    setName('')
  }
  const rename = (id: string, cur: string) => {
    const n = prompt('ชื่อประเภทถวาย', cur)?.trim()
    const x = t.byId(id)
    if (n && x) t.put([{ ...x, name: n }])
  }
  return (
    <section className="card" aria-labelledby="h-types">
      <h2 id="h-types">🙏 ประเภทถวาย</h2>
      <p className="muted small">เพิ่มได้เองตามต้องการ · ปิดการใช้งานแทนการลบ เพื่อให้รายงานเก่ายังแสดงชื่อเดิมได้</p>
      <ul className="list">
        {t.list.map((x) => (
          <li key={x.id}>
            <span className="grow" style={x.active ? undefined : { opacity: 0.55 }}>{x.name}</span>
            <button type="button" className="mini" onClick={() => rename(x.id, x.name)}>แก้ชื่อ</button>
            <button type="button" className="mini" onClick={() => t.put([{ ...x, active: !x.active }])}>{x.active ? 'ปิดใช้' : 'เปิดใช้'}</button>
          </li>
        ))}
      </ul>
      <div className="row"><input className="input grow" aria-label="ชื่อประเภทถวายใหม่" placeholder="ชื่อประเภทใหม่ เช่น ถวายค่าไฟ" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button type="button" className="btn btn--gold" onClick={add}>เพิ่ม</button></div>
    </section>
  )
}

function Accounts() {
  const a = useAccounts()
  const [f, setF] = useState({ name: '', bank: '', last4: '' })
  const add = () => {
    if (!f.name.trim()) return
    a.put([{ id: newId('ac'), name: f.name.trim(), bank: f.bank.trim(), last4: f.last4.trim().slice(-4), updated: 0 }])
    setF({ name: '', bank: '', last4: '' })
  }
  return (
    <section className="card" aria-labelledby="h-acc">
      <h2 id="h-acc">🏦 บัญชีธนาคาร</h2>
      <ul className="list">
        {a.list.length === 0 && <li className="muted small">ยังไม่มีบัญชี — เพิ่มบัญชีที่ใช้รับโอนและฝากเงิน</li>}
        {a.list.map((x) => <li key={x.id}><span className="grow"><b>{x.name}</b><br /><span className="small muted">{x.bank} {x.last4 && `· เลขท้าย ${x.last4}`}</span></span><button type="button" className="mini" onClick={() => confirm(`ลบบัญชี ${x.name}?`) && a.remove(x.id)}>🗑️</button></li>)}
      </ul>
      <div className="field"><label htmlFor="a-name">ชื่อบัญชี</label><input id="a-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="เช่น บัญชีหลัก" /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="a-bank">ธนาคาร</label><input id="a-bank" className="input" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></div>
        <div className="field"><label htmlFor="a-4">เลขท้าย 4 ตัว</label><input id="a-4" className="input" inputMode="numeric" maxLength={4} value={f.last4} onChange={(e) => setF({ ...f, last4: e.target.value })} /></div>
      </div>
      <button type="button" className="btn btn--gold" onClick={add}>เพิ่มบัญชี</button>
    </section>
  )
}

function Display() {
  const cur = document.documentElement.dataset.scale ?? '100'
  const [scale, setScale] = useState(cur)
  const set = (s: string) => { setScale(s); document.documentElement.dataset.scale = s; try { localStorage.setItem('acct.scale', s) } catch { /* ignore */ } }
  return (
    <section className="card" aria-labelledby="h-disp">
      <h2 id="h-disp">🔠 ขนาดตัวอักษร</h2>
      <div className="seg" role="group" aria-label="ขนาดตัวอักษร">
        {['85', '100', '125', '150'].map((s) => <button key={s} type="button" className={scale === s ? 'on' : ''} aria-pressed={scale === s} onClick={() => set(s)}>{s}%</button>)}
      </div>
    </section>
  )
}

/** ล้างข้อมูล: ลบถาวรรายการที่ลบแล้ว · ล้างข้อมูลทดสอบทั้งปี (รายรับ รอบนับ ใบเบิก งบ สเตตเมนต์) — ไม่แตะผู้ใช้ ประเภทถวาย บัญชีธนาคาร ตั้งค่า */
function DataClean() {
  const { year } = useYear()
  const income = useIncome(year), rounds = useRounds(year), vouchers = useVouchers(year)
  const lines = useBudgetLines(year), adjs = useBudgetAdjs(year), entries = useBudgetEntries(year)
  const stmt = useStatementLines(year), batches = useStatementBatches(), types = useIncomeTypes(), accounts = useAccounts()
  const funds = useFunds()
  const [withFunds, setWithFunds] = useState(false)
  const [word, setWord] = useState('')
  const [files, setFiles] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const all = [income, rounds, vouchers, lines, adjs, entries, stmt, batches] as const
  const pending = [...all.map((s) => s.deletedCount), funds.deletedCount, types.deletedCount, accounts.deletedCount].reduce((a, b) => a + b, 0)
  const total = all.reduce((a, s) => a + s.all.length, 0)

  const purge = async () => {
    if (!confirm(`ลบถาวร ${pending} รายการที่ลบแล้ว?\nเอาออกจากไฟล์จริง กู้คืนไม่ได้`)) return
    setBusy(true)
    const rs = await Promise.all([...all.map((s) => s.purgeDeleted()), funds.purgeDeleted(), types.purgeDeleted(), accounts.purgeDeleted()])
    setBusy(false)
    setMsg(rs.every(Boolean) ? { ok: true, text: `ลบถาวรแล้ว ${pending} รายการ ✓` } : { ok: false, text: 'ทำไม่สำเร็จบางส่วน ตรวจการเชื่อมต่อแล้วลองใหม่' })
  }
  const reset = async () => {
    setBusy(true); setMsg(null)
    const rs = await Promise.all([...all.map((s) => s.resetAll()), ...(withFunds ? [funds.resetAll()] : [])])
    let removed = 0
    const cfg = getSync()
    if (files && cfg) {
      try {
        for (const dir of [`attachments/${year}`, `attachments/statements/${year}`]) {
          for (const f of await listDir(cfg, dir)) if (f.type === 'file') { await deleteFile(cfg, f.path, f.sha, 'ไฟล์แนบ'); removed++ }
        }
      } catch (e) { setBusy(false); return setMsg({ ok: false, text: `ล้างข้อมูลแล้ว แต่ลบไฟล์แนบไม่สำเร็จ: ${e instanceof Error ? e.message : ''}` }) }
    }
    setBusy(false); setWord('')
    setMsg(rs.every(Boolean) ? { ok: true, text: `ล้างข้อมูลปี ${be(year)} เรียบร้อย ✓${removed ? ` (ลบไฟล์แนบ ${removed} ไฟล์)` : ''}` } : { ok: false, text: 'ทำไม่สำเร็จบางส่วน ตรวจการเชื่อมต่อแล้วลองใหม่' })
  }
  return (
    <section className="card" aria-labelledby="h-clean">
      <h2 id="h-clean">🧹 ล้างข้อมูล (ลบถาวร)</h2>
      <p className="muted small">ปกติเมื่อกด “ลบ” ข้อมูลแค่ถูกซ่อน (กู้คืนได้ และใช้ให้เครื่องอื่นรับรู้การลบ) ส่วนนี้ใช้เอาออกจากไฟล์จริงเมื่อต้องการให้สะอาด เฉพาะแอดมิน</p>
      <div className="stack">
        <h3>1) ลบถาวรรายการที่ลบแล้ว ({pending})</h3>
        <button type="button" className="btn btn--ghost" disabled={busy || pending === 0} onClick={purge}>🗑️ ลบถาวรรายการที่ลบแล้วทั้งหมด</button>
        <h3>2) ล้างข้อมูลทดสอบ ปี {be(year)} ({total} รายการ)</h3>
        <p className="small">ล้าง: รายรับ · ใบบันทึกการถวาย/รอบนับ · ใบเบิกจ่าย · งบประมาณและบันทึกในงบ/กองทุนของปีนี้ · รายการสเตตเมนต์ · (กองทุนล้างเมื่อติ๊กเลือก) · <b>ไม่แตะ:</b> ผู้ใช้และสิทธิ์ ประเภทถวาย บัญชีธนาคาร ค่าตั้งค่า</p>
        <label className="row"><input type="checkbox" checked={withFunds} onChange={(e) => setWithFunds(e.target.checked)} /> ล้างกองทุนทั้งหมดด้วย ({funds.items.length} กองทุน — กองทุนสะสมข้ามปี ไม่ผูกกับปีใดปีหนึ่ง)</label>
        <label className="row"><input type="checkbox" checked={files} onChange={(e) => setFiles(e.target.checked)} /> ลบรูปใบเสร็จ/สลิป/ไฟล์สเตตเมนต์ของปีนี้ใน repo ด้วย</label>
        <div className="field"><label htmlFor="cl-word">พิมพ์ “ล้างข้อมูล” เพื่อยืนยัน</label><input id="cl-word" className="input" value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" /></div>
        <button type="button" className="btn btn--danger" disabled={busy || word.trim() !== 'ล้างข้อมูล'} onClick={reset}>{busy ? 'กำลังล้าง…' : `ล้างข้อมูลปี ${be(year)}`}</button>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
      <details>
        <summary>ควรรู้ก่อนล้าง</summary>
        <ul className="small">
          <li>ให้ทุกเครื่องซิงก์ให้เสร็จก่อน — งานที่ยังไม่ซิงก์ในเครื่องอื่นจะถูกทิ้งเมื่อเครื่องนั้นรับการล้าง (เพื่อไม่ให้ข้อมูลเก่าผุดกลับ)</li>
          <li>ประวัติ commit ใน GitHub ยังเก็บข้อมูลเก่าไว้ (ย้อนดูได้) ถ้าต้องการสะอาด 100% ตอนเริ่มใช้งานจริง ให้สร้าง repo ข้อมูลใหม่ แล้วเชื่อมต่อใหม่ด้วยรหัสใหม่ — ง่ายที่สุด</li>
          <li>เปลี่ยนปีบัญชีที่มุมขวาบนเพื่อล้างปีอื่น</li>
        </ul>
      </details>
    </section>
  )
}
