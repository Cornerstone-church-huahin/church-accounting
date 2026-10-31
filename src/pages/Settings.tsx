import { useEffect, useState, type ReactNode } from 'react'
import MoneyInput from '../components/MoneyInput'
import { MEETING_TABS } from '../lib/workTabs'
import { can, normalizeRoles, ROLE_HELP, ROLE_LABEL, rolesLabel, rolesOf, type Role } from '../lib/access'
import { isFundType } from '../lib/funds'
import { makeExpenseGroup, makeIncomeType } from '../lib/catalog'
import { DEFAULT_EXPENSE_CATS } from '../lib/expenseCats'
import { DEFAULT_INCOME_TYPES, useExpenses, useFundMoves, useLoans, usePassbook, useSheetFiles, useWeekCloses, useOpening, useAccounts, useExpenseCats, useBudgetAdjs, useBudgetEntries, useBudgetLines, useFunds, useIncome, useIncomeTypes, useRounds, useSettings, useStatementBatches, useStatementLines, useVouchers } from '../lib/data'
import { useMembers, useRole } from '../lib/members'
import { fmtBaht, newId, parseBaht, todayISO } from '../lib/money'
import { autoActivities } from '../lib/fundActs'
import { DEFAULT_REPO, deleteFile, getSync, listDir, saveSync, testSync } from '../lib/sync'
import InstallApp from '../components/InstallApp'
import { WORK_LEVELS, workLevelHelp, WORK_LEVEL_LABEL, workLevelOf, type WorkLevel } from '../lib/access'
import { buildInstallOnlyMessage, buildInviteMessage, installUrlOf } from '../lib/inviteMessage'
import { DEFAULT_MODEL, getGemini, publishSharedGemini, refreshSharedGemini, saveGemini, testGemini } from '../lib/gemini'
import { be } from '../lib/money'
import { useYear } from '../lib/year'

const fmtJoined = (t: number) => (t ? new Date(t).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) : '')

/** การ์ดพับได้: แตะหัวข้อเพื่อเปิด/ปิด (เปิดค้างไว้ตามที่ผู้ใช้ตั้ง ไม่ถูกปิดเมื่อข้อมูลเปลี่ยน) */
function Fold({ id, title, open, children }: { id: string; title: ReactNode; open?: boolean; children: ReactNode }) {
  const [isOpen, setOpen] = useState(!!open)
  useEffect(() => { if (open) setOpen(true) }, [open]) // มีเรื่องรอท่านอยู่ (เช่น คำขอเข้าร่วม) → เปิดให้เห็นเอง
  return (
    <details className="card fold" open={isOpen} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} aria-labelledby={id}>
      <summary><h2 id={id}>{title}</h2><span className="fold__chev" aria-hidden="true">▾</span></summary>
      <div className="fold__body">{children}</div>
    </details>
  )
}

export default function Settings() {
  const role = useRole()
  const cfg = getSync()
  return (
    <>
      <div className="page-head"><h1>ตั้งค่า</h1></div>
      {can(role, 'settings') && <General />}
      {can(role, 'settings') && <OpeningCard />}
      {can(role, 'settings') && <Types />}
      {can(role, 'settings') && <ExpenseCatsCard />}
      {can(role, 'settings') && <DataClean />}
      <Fold id="h-inst" title="📲 ติดตั้งเป็นแอป"><InstallApp /></Fold>
      <Connect />
      {cfg && <Members />}
      {can(role, 'income') && <Reader />}
      {can(role, 'settings') && <Accounts />}
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
    <Fold id="h-conn" title={<>☁️ เชื่อมต่อออนไลน์</>}>
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
    </Fold>
  )
}

function Members() {
  const m = useMembers()
  const fundTypes = useIncomeTypes().list.filter((t) => t.active && isFundType(t))
  const cfg = getSync()
  const [inviteWork, setInviteWork] = useState(0)
  const [inviteLevel, setInviteLevel] = useState<WorkLevel>('helper')
  const [inviteFor, setInviteFor] = useState('')
  const [want] = useState<Record<string, Role[]>>({})
  // ห้องงาน+ตำแหน่งที่แอดมินกำหนดตอนอนุมัติ (ค่าเริ่มต้น = ตามลิงก์ที่ใช้ขอ) · null = ไม่เข้าห้องงาน
  const [wantWork, setWantWork] = useState<Record<string, { n: number; level: WorkLevel } | null>>({})
  const [delId, setDelId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  if (!cfg) return null
  const flash = (t: string) => { setMsg(t); window.setTimeout(() => setMsg(''), 3000) }
  const link = `${location.origin}${location.pathname}?openExternalBrowser=1#/join?t=${encodeURIComponent(cfg.token)}${cfg.repo !== DEFAULT_REPO ? `&r=${encodeURIComponent(cfg.repo)}` : ''}&role=viewer${inviteWork ? `&w=${inviteWork}&lv=${inviteLevel}` : ''}${inviteFor.trim() ? `&for=${encodeURIComponent(inviteFor.trim())}` : ''}`
  const send = async (text: string, title: string, okText: string) => {
    try {
      if (navigator.share) await navigator.share({ title, text })
      else { await navigator.clipboard.writeText(text); flash(okText) }
    } catch { /* ผู้ใช้ปิดหน้าต่างแชร์ */ }
  }
  const installUrl = installUrlOf(location.origin, location.pathname)
  const share = () => send(buildInviteMessage({ forName: inviteFor, installUrl, inviteUrl: link, level: inviteWork ? `${WORK_LEVEL_LABEL[inviteLevel]} ของ${MEETING_TABS.find((t) => t.n === inviteWork)?.name} — ${workLevelHelp(inviteLevel, inviteWork)}` : 'ผู้ดู (ดูข้อมูลทั่วไป ยังไม่ได้ระบุงาน)' }), 'เข้าร่วมแอปบัญชีคริสตจักร', 'คัดลอกข้อความเชิญแล้ว วางในแชตส่วนตัวได้เลย (อย่าโพสต์ในกลุ่ม)')
  const shareInstall = () => send(buildInstallOnlyMessage(installUrl), 'ติดตั้งแอปบัญชีคริสตจักร', 'คัดลอกลิงก์ติดตั้งแล้ว')
  return (
    <Fold id="h-mem" open={m.isAdmin && m.pending.length > 0} title={<>👤 ผู้ใช้ร่วมและสิทธิ์ {m.isAdmin && m.pending.length > 0 && <span className="badge badge--gold">รออนุมัติ {m.pending.length}</span>}</>}>
      {m.isAdmin && (
        <div className="stack">
          <h3>① ส่งลิงก์เชิญ</h3>
          <div className="field"><label htmlFor="inv-for">ส่งให้ใคร (ชื่อ — ไว้เทียบตอนอนุมัติ)</label><input id="inv-for" className="input" value={inviteFor} maxLength={40} onChange={(e) => setInviteFor(e.target.value)} placeholder="เช่น พี่สมชาย" /></div>
          <div className="field"><label htmlFor="inv-work">เชิญเข้างานไหน</label>
            <select id="inv-work" className="input" value={inviteWork} onChange={(e) => setInviteWork(Number(e.target.value))}>
              <option value={0}>ไม่ระบุงาน (ผู้ดูทั่วไป)</option>
              {MEETING_TABS.map((t) => <option key={t.n} value={t.n}>{t.name}</option>)}
            </select></div>
          {inviteWork > 0 && (
            <div className="field" role="radiogroup" aria-label="ตำแหน่งที่ตั้งใจให้ในงานนี้">
              <label>ตำแหน่งในงานนี้ <span className="small muted">(เหมือนกันทุกงาน · เปลี่ยนได้ทุกเมื่อภายหลัง)</span></label>
              <div className="stack" style={{ gap: 6 }}>
                {WORK_LEVELS.map((l) => (
                  <button key={l} type="button" role="radio" aria-checked={inviteLevel === l} className={`lvlcard${inviteLevel === l ? ' lvlcard--on' : ''}`} onClick={() => setInviteLevel(l)}>
                    <b>{WORK_LEVEL_LABEL[l]}</b>
                    <span className="small">{workLevelHelp(l, inviteWork)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <details className="lvlhelp"><summary><b>ℹ️ สรุปตำแหน่ง (ไว้ดูกันลืม · ใช้เหมือนกันทุกงาน)</b></summary>
            <ul className="list">
              {WORK_LEVELS.map((l) => <li key={l} style={{ display: 'block' }}><b>{WORK_LEVEL_LABEL[l]}</b><br /><span className="small">{workLevelHelp(l)}</span></li>)}
            </ul>
            <p className="small muted">แอดมินอยู่เหนือทุกงาน · ผู้ดูแลหลักเชิญหรือตั้งตำแหน่งเองไม่ได้ ต้องให้แอดมินตั้งให้ · งานเหรัญญิก: ผู้ดูแลหลัก = ทำงานบัญชีครบ · ผู้ช่วย/ที่ปรึกษา = ดูรายละเอียดอย่างเดียว · ยืนยันยอดนับ/รับรองใบเบิก ตอนนี้เป็นของแอดมิน (เพิ่ม “ผู้ตรวจ” ได้ภายหลัง) · สิทธิ์เฉพาะทาง (นมัสการ ดูแลกองทุน แอดมิน) ตั้งที่รายชื่อผู้ใช้ร่วม</p>
            <p className="small"><b>เปลี่ยนตำแหน่งของใครก็ได้ทุกเมื่อ:</b> ที่รายชื่อ “ผู้ใช้ร่วม” ด้านล่าง เปิด “ตำแหน่งในงาน” ของคนนั้นแล้วเลือกใหม่ ทันทีที่เลือกมีผลกับเขา · พักสิทธิ์หรือลบได้เช่นกัน</p>
          </details>
          <button type="button" className="btn btn--gold" onClick={share}>📤 ส่งชุดเชิญ (ติดตั้ง + เข้าร่วม)</button>
          <button type="button" className="btn btn--ghost" onClick={shareInstall}>📲 ส่งเฉพาะลิงก์ติดตั้ง</button>
          <p className="small muted" style={{ margin: 0 }}>ชุดเชิญมี 2 ขั้น: ① ลิงก์ติดตั้ง (ตรวจ Android/iPhone ให้เอง) ② ลิงก์เชิญเข้าร่วม — iPhone ต้องติดตั้งก่อนแล้ววางลิงก์เชิญในแอป</p>
          <p className="foot-note">ลิงก์มีรหัสเข้าใช้ร่วมอยู่ด้วย — ส่งเฉพาะแชตส่วนตัว อย่าโพสต์ในกลุ่ม · ผู้รับต้องรออนุมัติจากท่านก่อนจึงใช้ได้ · สิทธิ์แอดมินให้ได้ตอนอนุมัติเท่านั้น</p>

          <h3>② คำขอที่รออนุมัติ ({m.pending.length})</h3>
          {m.pending.length === 0 && <p className="muted small">ยังไม่มีคำขอ <button type="button" className="mini" onClick={m.syncNow}>🔄 ตรวจคำขอใหม่</button></p>}
          <ul className="list">
            {m.pending.map((x) => {
              const w = want[x.id] ?? rolesOf(x)
              const matches = !x.invitedFor || x.invitedFor.trim().toLowerCase() === x.name.trim().toLowerCase()
              return (
                <li key={x.id} style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                  <div><b>{x.name}</b><br /><span className="small muted">{x.invitedFor ? (matches ? `✓ ตรงกับชื่อที่ส่งลิงก์ให้ (${x.invitedFor})` : `⚠️ ลิงก์นี้ส่งให้ “${x.invitedFor}” แต่ผู้ขอใช้ชื่อ “${x.name}” — ตรวจให้แน่ใจก่อนอนุมัติ`) : 'ลิงก์ไม่ได้ระบุชื่อผู้รับ — ตรวจว่าเป็นคนที่ท่านส่งไปหรือไม่'}</span></div>
                  {(() => {
                    const ww = x.id in wantWork ? wantWork[x.id] : (x.invitedWork ?? null)
                    const wName = (n: number) => MEETING_TABS.find((t) => t.n === n)?.name ?? `งาน ${n}`
                    return (
                      <>
                        <dl className="reqinfo" aria-label={`รายละเอียดคำขอของ ${x.name}`}>
                          <div><dt>ขอเมื่อ</dt><dd>{x.joined ? new Date(x.joined).toLocaleString('th-TH', { day: 'numeric', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit' }) + ' น.' : '—'}</dd></div>
                          <div><dt>ขอมาทาง</dt><dd>ลิงก์เชิญ{x.invitedFor ? ` ที่ส่งให้ “${x.invitedFor}”` : ' (ไม่ได้ระบุชื่อผู้รับ)'} · อุปกรณ์ {x.device ?? 'ไม่ทราบ (คำขอเก่า)'}</dd></div>
                          <div><dt>สิทธิ์ในลิงก์</dt><dd>{ROLE_LABEL[x.role]}</dd></div>
                          <div><dt>ห้องงานที่ขอ</dt><dd>{x.invitedWork ? <><b>{wName(x.invitedWork.n)}</b> · ตำแหน่ง <b>{WORK_LEVEL_LABEL[x.invitedWork.level]}</b></> : <>ลิงก์นี้ไม่ได้ระบุห้องงาน/ตำแหน่ง (ขอเป็นผู้ดูทั่วไป)</>}</dd></div>
                        </dl>
                        <div className="row" style={{ alignItems: 'end' }}>
                          <div className="field grow" style={{ minWidth: '8rem' }}><label htmlFor={`rw-${x.id}`}>ให้เข้าห้องงาน</label>
                            <select id={`rw-${x.id}`} className="input" value={ww ? String(ww.n) : ''} onChange={(e) => setWantWork({ ...wantWork, [x.id]: e.target.value ? { n: Number(e.target.value), level: ww?.level ?? 'helper' } : null })}>
                              <option value="">— ไม่ระบุงาน (ผู้ดูทั่วไป) —</option>
                              {MEETING_TABS.map((t) => <option key={t.n} value={t.n}>{t.name}</option>)}
                            </select></div>
                          {ww && <div className="field" style={{ minWidth: '7.5rem' }}><label htmlFor={`rl-${x.id}`}>ตำแหน่ง</label>
                            <select id={`rl-${x.id}`} className="input" value={ww.level} onChange={(e) => setWantWork({ ...wantWork, [x.id]: { n: ww.n, level: e.target.value as WorkLevel } })}>
                              {WORK_LEVELS.map((lv) => <option key={lv} value={lv}>{WORK_LEVEL_LABEL[lv]}</option>)}
                            </select></div>}
                        </div>
                        <div className="row">
                    <div className="grow small" style={{ minWidth: 0 }}>{ww ? <>จะให้เป็น <b>{WORK_LEVEL_LABEL[ww.level]}</b> ของ <b>{wName(ww.n)}</b> เมื่ออนุมัติ</> : <>จะอนุมัติเป็นผู้ดูทั่วไป (ตั้งตำแหน่งในงานได้หลังอนุมัติ)</>}</div>
                    <button type="button" className="btn btn--gold" onClick={() => { m.approve(x.id, w, x.id in wantWork ? wantWork[x.id] : undefined); flash(`อนุมัติ ${x.name} แล้ว (${rolesLabel(normalizeRoles(w))})`) }}>✓ อนุมัติ</button>
                    <button type="button" className="btn btn--ghost" onClick={() => { m.reject(x.id); flash(`ไม่อนุมัติ ${x.name}`) }}>✕</button>
                  </div>
                      </>
                    )
                  })()}
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
          const lastAdmin = rolesOf(x).includes('admin') && m.adminCount <= 1
          return (
            <li key={x.id} style={{ flexWrap: 'wrap', gap: '0.4rem 0.5rem' }}>
              <span className="grow" style={{ flexBasis: '100%' }}><b>{x.name}</b> {x.id === m.meId && <span className="badge">คุณ</span>} {x.paused && <span className="badge badge--gold">พักสิทธิ์</span>}<br /><span className="small muted">เข้าร่วม {fmtJoined(x.joined)}</span></span>
              {m.isAdmin ? (
                <>
                  {(() => {
                    const rs = rolesOf(x), isAd = rs.includes('admin'), isFk = rs.includes('fundkeeper')
                    const legacy = rs.filter((r): r is 'bookkeeper' | 'worship' | 'auditor' => r !== 'viewer' && r !== 'admin' && r !== 'fundkeeper')
                    const keep = rs.filter((r) => !(legacy as Role[]).includes(r))
                    return (
                      <div className="rightsbox" style={{ flexBasis: '100%' }}>
                        <SwitchRow label="แอดมินระบบ" sub="ทำได้ทุกอย่างทั้งระบบ (จัดการผู้ใช้ ประเภทถวาย งบประมาณ) · ไม่ต้องกำหนดห้องงาน" on={isAd} disabled={lastAdmin} onChange={(v) => { if (m.setRole(x.id, v ? ['admin'] : ['viewer'])) flash(`${v ? 'ตั้ง' : 'เอา'} ${x.name} ${v ? 'เป็น' : 'ออกจาก'}แอดมินระบบ`) }} />
                        {!isAd && <SwitchRow label="ผู้ดูแลกองทุน" sub="เห็นเฉพาะกองทุนที่กำหนดด้านล่าง (ใช้แทนห้องงาน)" on={isFk} onChange={(v) => { if (m.setRole(x.id, v ? ['fundkeeper'] : ['viewer'])) flash(`${v ? 'ตั้ง' : 'เอา'} ${x.name} ${v ? 'เป็น' : 'ออกจาก'}ผู้ดูแลกองทุน`) }} />}
                        {legacy.length > 0 && <p className="small" style={{ margin: '0.3rem 0 0' }}>สิทธิ์เดิม: <b>{rolesLabel(legacy)}</b> <button type="button" className="mini" aria-label={`ล้างสิทธิ์เดิมของ ${x.name}`} onClick={() => { if (m.setRole(x.id, keep.length ? keep : ['viewer'])) flash(`ล้างสิทธิ์เดิมของ ${x.name}`) }}>ล้าง ✕</button> <span className="muted">(ให้ตั้งห้องงาน × ตำแหน่งด้านล่างแทน)</span></p>}
                      </div>
                    )
                  })()}
                  {!rolesOf(x).includes('admin') && <button type="button" className="mini" onClick={() => m.setPaused(x.id, !x.paused)} aria-label={`${x.paused ? 'เปิดสิทธิ์คืน' : 'พักสิทธิ์'} ${x.name}`}>{x.paused ? '▶ เปิดคืน' : '⏸ พัก'}</button>}
                  {delId === x.id ? (
                    <span className="row"><button type="button" className="btn btn--danger" onClick={() => { if (!m.removeMember(x.id)) flash('ลบแอดมินคนสุดท้ายไม่ได้'); setDelId(null) }}>ลบ {x.name}</button><button type="button" className="btn btn--ghost" onClick={() => setDelId(null)}>ไม่ลบ</button></span>
                  ) : <button type="button" className="mini" disabled={lastAdmin} onClick={() => setDelId(x.id)} aria-label={`ลบ ${x.name}`}>🗑️</button>}
                  {rolesOf(x).includes('fundkeeper') && (
                    <details style={{ flexBasis: '100%' }} open={!x.funds?.length}>
                      <summary className="small">กองทุนที่ดูแล: {x.funds?.length ? x.funds.map((a) => fundTypes.find((t) => t.id === a.id)?.name ?? '(กองทุนที่ถูกลบ)').join(', ') : 'ยังไม่ได้กำหนด (จะยังไม่เห็นกองทุนใดเลย)'}</summary>
                      <p className="small muted" style={{ margin: '0.3rem 0' }}>เลือกกองทุนที่คนนี้ดูแล เขาจะเห็นเฉพาะกองทุนเหล่านี้ (เปิดแอปแล้วเข้ากองทุนนั้นทันที) · ถ้ากองทุนมีหมวด เลือกหมวดที่ให้ดูแลได้ ไม่เลือกหมวด = ทุกหมวดของกองทุนนั้น</p>
                      {fundTypes.length === 0 && <p className="small">ยังไม่มีกองทุน</p>}
                      {fundTypes.map((t) => {
                        const a = x.funds?.find((f) => f.id === t.id)
                        const subs = (t.subs ?? []).filter((q) => q.active)
                        const setF = (next: { id: string; subs?: string[] }[]) => { if (m.setFunds(x.id, next)) flash(`ตั้งกองทุนของ ${x.name}: ${next.length ? next.map((f) => fundTypes.find((q) => q.id === f.id)?.name).filter(Boolean).join(', ') : 'ไม่มี'}`) }
                        return (
                          <div key={t.id} style={{ marginBottom: 6 }}>
                            <button type="button" className="wchip" style={{ padding: '0 0.7rem' }} aria-pressed={!!a} aria-label={`กองทุน ${t.name} ของ ${x.name}`} onClick={() => setF(a ? (x.funds ?? []).filter((f) => f.id !== t.id) : [...(x.funds ?? []), { id: t.id }])}>{t.name}</button>
                            {a && subs.length > 0 && (
                              <div className="row" role="group" aria-label={`หมวดของ ${t.name} ที่ ${x.name} ดูแล`} style={{ marginLeft: 12, marginTop: 4 }}>
                                {subs.map((q) => {
                                  const on = a.subs?.includes(q.id) ?? false
                                  return <button key={q.id} type="button" className="wchip" style={{ padding: '0 0.7rem' }} aria-pressed={on} onClick={() => { const next = on ? (a.subs ?? []).filter((s) => s !== q.id) : [...(a.subs ?? []), q.id]; setF((x.funds ?? []).map((f) => (f.id === t.id ? { id: t.id, ...(next.length ? { subs: next } : {}) } : f))) }}>{q.name}</button>
                                })}
                                <span className="small muted">{a.subs?.length ? '' : 'ทุกหมวด'}</span>
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </details>
                  )}
                  {!rolesOf(x).includes('admin') && !rolesOf(x).includes('fundkeeper') && (
                    <div style={{ flexBasis: '100%' }} role="group" aria-label={`ห้องงานและตำแหน่งของ ${x.name}`}>
                      <p className="small" style={{ margin: '0.3rem 0' }}><b>ห้องงานและตำแหน่ง</b> <span className="muted">เปิดสวิตช์ = ได้ไอคอนห้องนั้นตามตำแหน่งที่เลือก · ไม่ต้องส่งลิงก์ใหม่ · เครื่องของเขาเห็นเมื่อซิงก์ (กดรีเฟรช)</span></p>
                      <ul className="list" aria-label={`ตำแหน่งของ ${x.name} ในแต่ละงาน`}>
                        {MEETING_TABS.map((t) => {
                          const lv = workLevelOf(x, t.n)
                          const setLv = (next: WorkLevel | null) => {
                            const pos: Record<number, WorkLevel | null> = {}
                            for (const z of MEETING_TABS) pos[z.n] = workLevelOf(x, z.n)
                            pos[t.n] = next
                            if (m.setPositions(x.id, pos)) flash(next ? `${x.name} เป็น${WORK_LEVEL_LABEL[next]}ของ${t.name}` : `เอา ${x.name} ออกจาก${t.name}`)
                          }
                          return (
                            <li key={t.n} style={{ display: 'block' }}>
                              <div className="row row--between" style={{ alignItems: 'center', flexWrap: 'nowrap', gap: 8 }}>
                                <SwitchRow label={t.name} on={!!lv} compact onChange={(v) => setLv(v ? 'helper' : null)} />
                                <select className="input" style={{ width: '9.5rem', flex: 'none' }} disabled={!lv} aria-label={`ตำแหน่งของ ${x.name} ใน ${t.name}`} value={lv ?? ''} onChange={(e) => setLv((e.target.value || null) as WorkLevel | null)}>
                                  <option value="">— ปิด —</option>
                                  {WORK_LEVELS.map((l) => <option key={l} value={l}>{WORK_LEVEL_LABEL[l]}</option>)}
                                </select>
                              </div>
                              {lv && <p className="small muted" style={{ margin: '0.1rem 0 0.3rem' }}>{workLevelHelp(lv, t.n)}</p>}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </>
              ) : <span className="badge">{rolesLabel(rolesOf(x))}{x.works?.length ? ` · ${x.works.map((n) => MEETING_TABS.find((t) => t.n === n)?.name).filter(Boolean).join(', ')}` : ''}</span>}
            </li>
          )
        })}
      </ul>
      {msg && <p className="ok" role="status">{msg}</p>}
      <details>
        <summary>ตำแหน่งในห้องงานแต่ละแบบทำอะไรได้</summary>
        <ul>{WORK_LEVELS.map((l) => <li key={l}><b>{WORK_LEVEL_LABEL[l]}</b> — {workLevelHelp(l)}</li>)}<li><b>แอดมินระบบ</b> — {ROLE_HELP.admin}</li><li><b>ผู้ดูแลกองทุน</b> — {ROLE_HELP.fundkeeper}</li></ul>
      </details>
      <p className="foot-note">สิทธิ์เป็นการกันในแอป ไม่ใช่การล็อกระดับ GitHub — ใครมีรหัสเข้าใช้ร่วมก็อ่าน repo ข้อมูลได้ตรง ๆ จึงควรแจกรหัสเฉพาะคนที่ไว้ใจ และเปลี่ยนรหัสใหม่เมื่อมีคนออก</p>
    </Fold>
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
    <Fold id="h-gen" title={<>⚙️ ค่าทั่วไป</>}>
      <div className="field"><label htmlFor="g-name">ชื่อคริสตจักร (หัวรายงาน)</label><input id="g-name" className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label htmlFor="g-two">ใบเบิกเกินกี่บาทต้องอนุมัติ 2 ขั้น</label><input id="g-two" className="input input--money" inputMode="decimal" value={two} onChange={(e) => setTwo(e.target.value)} /><span className="foot-note">ไม่เกินจำนวนนี้: ผู้ตรวจสอบหรือแอดมิน 1 คนอนุมัติ · เกิน: ต้อง 2 คนต่างกัน และมีแอดมินอย่างน้อย 1 คน (ขณะนี้ {fmtBaht(settings.twoStepOver, { dec: false })} บาท)</span></div>
      <div className="field"><label htmlFor="g-days">เทียบสเตตเมนต์: ยอมให้วันที่ห่างกันกี่วัน</label><input id="g-days" className="input" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} /></div>
      <button type="button" className="btn btn--gold" onClick={apply}>บันทึก</button>
      {msg && <p className="ok" role="status">{msg}</p>}
    </Fold>
  )
}

function Types() {
  const t = useIncomeTypes()
  const ec = useExpenseCats()
  const [mv, setMv] = useState('')
  /** ย้ายรายการที่ใส่ผิดฝั่ง (เช่น ซ่อมรถตู้) ไปอยู่ รายการจ่าย: สร้างในรายการจ่ายแล้วเอาออกจากรายการรับ */
  const moveToExpense = (x: { id: string; name: string }) => {
    if (!confirm(`ย้าย “${x.name}” ไปอยู่ รายการจ่าย?\n(จะเอาออกจากรายการรับ · รายรับที่เคยบันทึกด้วยชื่อนี้ไว้แล้วจะแสดงเป็น “ประเภทที่ถูกลบ” ควรลบ/แก้รายการนั้นด้วย)`)) return
    if (!ec.groups.some((g) => g.name === x.name)) { const g = makeExpenseGroup(ec.list, x.name); if (typeof g === 'string') return setMv(g); if (!ec.put([g])) return setMv('สิทธิ์ของท่านเพิ่มไม่ได้') }
    t.remove(x.id); setMv(`ย้าย “${x.name}” ไปรายการจ่ายแล้ว`)
  }
  const [name, setName] = useState('')
  const add = () => {
    const nt = makeIncomeType(t.list, name)
    if (typeof nt === 'string') return
    t.put([nt])
    setName('')
  }
  const rename = (id: string, cur: string) => {
    const n = prompt('ชื่อประเภทถวาย', cur)?.trim()
    const x = t.byId(id)
    if (n && x) t.put([{ ...x, name: n }])
  }
  return (
    <Fold id="h-types" title={<>🙏 รายการรับ ({t.list.length} รายการ)</>}>
      <p className="muted small">ติ๊ก “กองทุน” ที่ประเภทที่เป็นเงินวัตถุประสงค์ (ที่ดิน สร้างอาคาร ศึกษา ฯลฯ) กองทุนที่ติ๊กจะไปอยู่ในการ์ด “ยอดยกมา” ให้กรอกเงินตั้งต้น และระบบติดตามยอดค้างย้ายให้ · เพิ่มได้เองตามต้องการ · ปิดการใช้งานแทนการลบ เพื่อให้รายงานเก่ายังแสดงชื่อเดิมได้</p>
      <ul className="list">
        {t.list.map((x) => (
          <li key={x.id}>
            <span className="grow" style={x.active ? undefined : { opacity: 0.55 }}>{x.name}</span>
            <label className="small" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" checked={isFundType(x)} onChange={(e) => t.put([{ ...x, fund: e.target.checked }])} />กองทุน</label>
            {isFundType(x) && <label className="small" style={{ display: 'flex', gap: 4, alignItems: 'center' }}><input type="checkbox" aria-label={`แบ่ง ${x.name} เป็นกิจกรรม`} checked={!!x.actMode} onChange={(e) => t.put([{ ...x, ...(e.target.checked ? autoActivities(x, () => undefined, todayISO()) : { actMode: false }) }])} /> แบ่งเป็นกิจกรรม (การ์ดกิจกรรม)</label>}
            <button type="button" className="mini" onClick={() => rename(x.id, x.name)}>แก้ชื่อ</button>
            <button type="button" className="mini" onClick={() => t.put([{ ...x, active: !x.active }])}>{x.active ? 'ปิดใช้' : 'เปิดใช้'}</button>
            <button type="button" className="mini" aria-label={`ย้าย ${x.name} ไปรายการจ่าย`} onClick={() => moveToExpense(x)}>→ ไปรายจ่าย</button>
            <button type="button" className="mini" aria-label={`ลบ ${x.name}`} onClick={() => confirm(`ลบประเภท “${x.name}” ออกจากรายการ?\n(รายการที่บันทึกไว้แล้วยังอยู่ แต่จะแสดงเป็น “ประเภทที่ถูกลบ”)`) && t.remove(x.id)}>🗑️</button>
          </li>
        ))}
      </ul>
      {mv && <p className="small" role="status">{mv}</p>}
      <div className="row"><button type="button" className="btn btn--ghost" onClick={() => {
        if (!confirm('คืนเป็นรายการตามใบบันทึกการถวายล่าสุด?\nประเภทที่เพิ่มเองจะถูกลบ และรายการตามใบกลับมาครบ')) return
        const keep = new Set(DEFAULT_INCOME_TYPES.map((d) => d.id))
        t.put([...t.list.filter((x) => !keep.has(x.id)).map((x) => ({ ...x, deleted: true })), ...DEFAULT_INCOME_TYPES.map((d) => ({ ...d, updated: 0, deleted: false }))])
      }}>↺ คืนเป็นรายการตามใบ</button></div>
      <div className="row"><input className="input grow" aria-label="ชื่อประเภทถวายใหม่" placeholder="ชื่อประเภทใหม่ เช่น ถวายค่าไฟ" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} /><button type="button" className="btn btn--gold" onClick={add}>เพิ่ม</button></div>
    </Fold>
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
    <Fold id="h-acc" title={<>🏦 บัญชีธนาคาร</>}>
      <ul className="list">
        {a.list.length === 0 && <li className="muted small">ยังไม่มีบัญชี — เพิ่มบัญชีที่ใช้รับโอนและฝากเงิน</li>}
        {a.list.map((x) => <li key={x.id}><span className="grow"><b>{x.name}</b><br /><span className="small muted">{x.bank} {x.last4 && `· เลขท้าย ${x.last4}`}</span></span><select className="input" style={{ maxWidth: '9rem' }} aria-label={`ประเภทบัญชี ${x.name}`} value={x.role ?? ''} onChange={(e) => a.put([{ ...x, ...(e.target.value ? { role: e.target.value as 'operating' | 'restricted' } : { role: undefined }) }])}><option value="">ไม่ระบุ</option><option value="operating">หมุนเวียน</option><option value="restricted">วัตถุประสงค์</option></select><button type="button" className="mini" onClick={() => confirm(`ลบบัญชี ${x.name}?`) && a.remove(x.id)}>🗑️</button></li>)}
      </ul>
      <div className="field"><label htmlFor="a-name">ชื่อบัญชี</label><input id="a-name" className="input" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="เช่น บัญชีหลัก" /></div>
      <div className="grid2">
        <div className="field"><label htmlFor="a-bank">ธนาคาร</label><input id="a-bank" className="input" value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })} /></div>
        <div className="field"><label htmlFor="a-4">เลขท้าย 4 ตัว</label><input id="a-4" className="input" inputMode="numeric" maxLength={4} value={f.last4} onChange={(e) => setF({ ...f, last4: e.target.value })} /></div>
      </div>
      <button type="button" className="btn btn--gold" onClick={add}>เพิ่มบัญชี</button>
    </Fold>
  )
}

function Display() {
  const cur = document.documentElement.dataset.scale ?? '100'
  const [scale, setScale] = useState(cur)
  const set = (s: string) => { setScale(s); document.documentElement.dataset.scale = s; try { localStorage.setItem('acct.scale', s) } catch { /* ignore */ } }
  return (
    <Fold id="h-disp" title={<>🔠 ขนาดตัวอักษร</>}>
      <div className="seg" role="group" aria-label="ขนาดตัวอักษร">
        {['85', '100', '125', '150'].map((s) => <button key={s} type="button" className={scale === s ? 'on' : ''} aria-pressed={scale === s} onClick={() => set(s)}>{s}%</button>)}
      </div>
    </Fold>
  )
}

/** ล้างข้อมูล: ลบถาวรรายการที่ลบแล้ว · ล้างข้อมูลทดสอบทั้งปี (รายรับ รอบนับ ใบเบิก งบ สเตตเมนต์) — ไม่แตะผู้ใช้ ประเภทถวาย บัญชีธนาคาร ตั้งค่า */
function DataClean() {
  const { year } = useYear()
  const income = useIncome(year), rounds = useRounds(year), vouchers = useVouchers(year)
  const lines = useBudgetLines(year), adjs = useBudgetAdjs(year), entries = useBudgetEntries(year)
  const stmt = useStatementLines(year), batches = useStatementBatches(), types = useIncomeTypes(), accounts = useAccounts()
  const funds = useFunds()
  // ข้อมูลของแท็บ จ่าย/ปรับ/สมุดบัญชี/เงินยืม (รุ่นใหม่) ต้องถูกล้างด้วย ไม่งั้นข้อมูลทดสอบค้าง
  const expenses = useExpenses(year), sheetFiles = useSheetFiles(year), passbook = usePassbook(year), weekCloses = useWeekCloses(year), fundMoves = useFundMoves(year)
  const loans = useLoans(), openingS = useOpening()
  const [withFunds, setWithFunds] = useState(false)
  const [word, setWord] = useState('')
  const [files, setFiles] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const all = [income, rounds, vouchers, lines, adjs, entries, stmt, batches, expenses, sheetFiles, passbook, weekCloses, fundMoves] as const
  const oneOff = [loans, openingS] as const // ไม่แบ่งปี: ล้างพร้อมกันเมื่อเลือก “เริ่มใหม่ทั้งหมด”
  const [withLoans, setWithLoans] = useState(true)
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
    const rs = await Promise.all([...all.map((s) => s.resetAll()), ...(withFunds ? [funds.resetAll()] : []), ...(withLoans ? oneOff.map((s) => s.resetAll()) : [])])
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
    <Fold id="h-clean" title={<>🧹 ล้างข้อมูล (ลบถาวร)</>}>
      <p className="muted small">ปกติเมื่อกด “ลบ” ข้อมูลแค่ถูกซ่อน (กู้คืนได้ และใช้ให้เครื่องอื่นรับรู้การลบ) ส่วนนี้ใช้เอาออกจากไฟล์จริงเมื่อต้องการให้สะอาด เฉพาะแอดมิน</p>
      <div className="stack">
        <h3>1) ลบถาวรรายการที่ลบแล้ว ({pending})</h3>
        <button type="button" className="btn btn--ghost" disabled={busy || pending === 0} onClick={purge}>🗑️ ลบถาวรรายการที่ลบแล้วทั้งหมด</button>
        <h3>2) ล้างข้อมูลทดสอบ ปี {be(year)} ({total} รายการ)</h3>
        <p className="small">ล้าง: รายรับ · ใบบันทึกการถวาย/รอบนับ · ใบเบิกจ่าย · รายจ่าย (บันทึกด้วยมือ/วางบิล/สำรองจ่าย) · สมุดบัญชีที่สแกน · ปิดสัปดาห์ · ย้ายเงินเข้ากองทุน · งบประมาณและบันทึกในงบ/กองทุนของปีนี้ · รายการสเตตเมนต์ · (กองทุนล้างเมื่อติ๊กเลือก) · <b>ไม่แตะ:</b> ผู้ใช้และสิทธิ์ ประเภทถวาย บัญชีธนาคาร ค่าตั้งค่า</p>
        <label className="row"><input type="checkbox" checked={withLoans} onChange={(e) => setWithLoans(e.target.checked)} /> ล้างเงินยืมและยอดยกมาด้วย ({loans.items.length + openingS.items.length} รายการ — ไม่แบ่งปี)</label>
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
    </Fold>
  )
}

/** ตัวอ่านใบถวายด้วย Gemini: รหัส API ของเครื่องนี้ (เก็บในเครื่อง ไม่ขึ้น repo) */
function Reader() {
  const [cur, setCur] = useState(getGemini)
  const [key, setKey] = useState('')
  const [model, setModel] = useState(cur.model)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const role = useRole()
  const isAdmin = role === 'admin'
  const online = !!getSync()
  const [share, setShare] = useState(true)
  useEffect(() => { void refreshSharedGemini().then(() => setCur(getGemini())) }, [])
  const save = async () => {
    if (!key.trim()) return setMsg({ ok: false, text: 'วางรหัส Gemini API ก่อน' })
    saveGemini(key, model)
    if (isAdmin && online && share) {
      setBusy(true)
      try { await publishSharedGemini(key, model); setMsg({ ok: true, text: 'บันทึกแล้ว และแชร์ให้ผู้ใช้ร่วมทุกคนใช้รหัสนี้อัตโนมัติ — กด “ทดสอบรหัส” เพื่อเช็กว่าใช้ได้' }) }
      catch (e) { setMsg({ ok: false, text: `บันทึกในเครื่องแล้ว แต่แชร์ไม่สำเร็จ: ${e instanceof Error ? e.message : e}` }) }
      setBusy(false)
    } else setMsg({ ok: true, text: 'บันทึกรหัสแล้ว (เก็บในเครื่องนี้เท่านั้น) — กด “ทดสอบรหัส” เพื่อเช็กว่าใช้ได้' })
    setCur(getGemini()); setKey('')
  }
  const unshare = async () => {
    if (!confirm('เลิกแชร์รหัส Gemini? ผู้ใช้ร่วมคนอื่นจะอ่านรูปไม่ได้จนกว่าจะใส่รหัสของตัวเอง')) return
    setBusy(true)
    try { await publishSharedGemini(''); setMsg({ ok: true, text: 'เลิกแชร์รหัสแล้ว' }) } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : 'เลิกแชร์ไม่สำเร็จ' }) }
    setBusy(false); setCur(getGemini())
  }
  const test = async () => {
    setBusy(true)
    const err = await testGemini()
    setBusy(false)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: '✓ รหัสใช้ได้ — พร้อมอ่านใบบันทึกการถวาย' })
  }
  return (
    <Fold id="h-gem" title={<>🤖 ตัวอ่านใบถวาย (Gemini)</>}>
      <p className="muted small">รหัส API ขอจาก aistudio.google.com/apikey ใช้อ่านรูปใบถวาย สลิป และบิล · <b>แอดมินใส่รหัสครั้งเดียว แล้วแชร์ให้ผู้ใช้ร่วมที่ได้รับอนุมัติใช้ได้เลย</b> ไม่ต้องให้แต่ละคนขอรหัสเอง</p>
      <p className="small">สถานะ: {cur.key ? <b className="ok">มีรหัสแล้ว (…{cur.key.slice(-4)}){cur.shared ? ' · ใช้รหัสร่วมจากแอดมิน' : ''}</b> : <b>ยังไม่ได้ใส่รหัส{!isAdmin ? ' — ให้แอดมินใส่และแชร์ไว้ในเครื่องของแอดมิน' : ''}</b>}</p>
      {isAdmin && online && <label className="small" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '0.4rem 0' }}><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />แชร์รหัสนี้ให้ผู้ใช้ร่วมทุกคนใช้ด้วย</label>}
      {isAdmin && online && share && <p className="muted small">⚠️ รหัสจะถูกเก็บในไฟล์ใน repo ข้อมูล (Private) ผู้ที่ถือรหัสเข้าใช้ร่วมอ่านไฟล์นี้ได้ — แจกให้เฉพาะคนที่ไว้ใจ และถ้ามีคนออกให้สร้างรหัส Gemini ใหม่แล้วบันทึกที่นี่อีกครั้ง</p>}
      <div className="field"><label htmlFor="gem-key">รหัส Gemini API</label><input id="gem-key" className="input" type="password" autoComplete="off" placeholder={cur.key ? 'วางรหัสใหม่เพื่อเปลี่ยน' : 'วางรหัสที่นี่'} value={key} onChange={(e) => setKey(e.target.value)} /></div>
      <div className="field"><label htmlFor="gem-model">รุ่น (ปกติไม่ต้องแก้)</label><input id="gem-model" className="input" value={model} onChange={(e) => setModel(e.target.value)} placeholder={DEFAULT_MODEL} /></div>
      <div className="row">
        <button type="button" className="btn btn--gold grow" disabled={busy} onClick={() => void save()}>บันทึกรหัส</button>
        {cur.key && <button type="button" className="btn btn--ghost" disabled={busy} onClick={test}>{busy ? 'กำลังทดสอบ…' : 'ทดสอบรหัส'}</button>}
        {isAdmin && online && <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => void unshare()}>เลิกแชร์</button>}
        {cur.key && !cur.shared && <button type="button" className="btn btn--ghost" onClick={() => { if (confirm('ลบรหัส Gemini ออกจากเครื่องนี้?')) { saveGemini(''); setCur(getGemini()); setMsg({ ok: true, text: 'ลบรหัสออกจากเครื่องนี้แล้ว' }) } }}>ลบรหัส</button>}
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.text}</p>}
    </Fold>
  )
}

/** หมวดรายจ่าย: 15 หมวดหลัก / 150 รายการตั้งต้น — แก้ชื่อ ซ่อน ลบ เพิ่มรายการ/หมวดใหม่ได้ (ใช้ในใบเบิกและตารางรายจ่ายของใบสรุป) */
function ExpenseCatsCard() {
  const c = useExpenseCats()
  const [name, setName] = useState('')
  const rename = (id: string) => {
    const x = c.byId(id)
    const n = prompt('ชื่อรายการ', x?.name)?.trim()
    if (x && n) c.put([{ ...x, name: n }])
  }
  const add = () => {
    const g = makeExpenseGroup(c.list, name)
    if (typeof g === 'string') return
    c.put([g])
    setName('')
  }
  const reset = () => {
    if (!confirm('คืนเป็นรายการตามใบเบิก-จ่ายเงินสดล่าสุด?\nรายการที่เพิ่มเองจะถูกลบ และรายการตามใบกลับมาครบ')) return
    const keep = new Set(DEFAULT_EXPENSE_CATS.map((d) => d.id))
    c.put([...c.list.filter((x) => !keep.has(x.id)).map((x) => ({ ...x, deleted: true })), ...DEFAULT_EXPENSE_CATS.map((d) => ({ ...d, updated: 0, deleted: false }))])
  }
  return (
    <Fold id="h-ecat" title={<>🧾 รายการจ่าย ({c.groups.length} รายการ)</>}>
      <p className="muted small">รายการที่เลือกได้ในแท็บ จ่าย (ตามใบเบิก-จ่ายเงินสด) และเป็นแถวของตารางรายจ่ายในใบสรุป · เพิ่มได้ที่นี่หรือพิมพ์ชื่อใหม่ตอนบันทึกรายจ่าย · ซ่อนหรือลบได้ (รายจ่ายที่บันทึกไว้แล้วไม่หาย)</p>
      <ul className="list">
        {c.groups.map((g) => (
          <li key={g.id}>
            <span className="grow" style={g.active ? undefined : { opacity: 0.55 }}>{g.name}</span>
            <button type="button" className="mini" onClick={() => rename(g.id)}>แก้ชื่อ</button>
            <button type="button" className="mini" onClick={() => c.put([{ ...g, active: !g.active }])}>{g.active ? 'ซ่อน' : 'แสดง'}</button>
            <button type="button" className="mini" aria-label={`ลบ ${g.name}`} onClick={() => confirm(`ลบ “${g.name}” ออกจากรายการจ่าย?\n(รายจ่ายที่บันทึกไว้แล้วจะแสดงเป็น “ยังไม่ระบุหมวด”)`) && c.remove(g.id)}>🗑️</button>
          </li>
        ))}
      </ul>
      <div className="row"><input className="input grow" aria-label="ชื่อรายการจ่ายใหม่" placeholder="เพิ่มรายการจ่ายใหม่ เช่น ค่าน้ำมันรถสีขาว" value={name} onChange={(e) => setName(e.target.value)} /><button type="button" className="btn btn--gold" onClick={add}>เพิ่ม</button></div>
      <div className="row"><button type="button" className="btn btn--ghost" onClick={reset}>↺ คืนเป็นรายการตามใบ</button></div>
    </Fold>
  )
}

/** ยอดยกมา ณ วันตัดยอด: แยกเป็นแต่ละกองทุน + เงินของคริสตจักร แล้วรวมเป็นเงินตั้งต้น · ที่เก็บจริง (บัญชี/เงินสด) ไม่บังคับ ใช้ตรวจยอด */
function OpeningCard() {
  const o = useOpening()
  const accts = useAccounts()
  const types = useIncomeTypes()
  const funds = types.list.filter((t) => t.active && isFundType(t))
  const cur = o.opening
  const [date, setDate] = useState(cur?.date ?? '')
  const [fnd, setFnd] = useState<Record<string, number | null>>(() => ({ ...(cur?.funds ?? {}) }))
  const [own, setOwn] = useState<number | null>(cur?.own ?? null)
  const [acc, setAcc] = useState<Record<string, number | null>>(() => ({ ...(cur?.accounts ?? {}) }))
  const [cash, setCash] = useState<number | null>(cur?.cash ?? null)
  const [unm, setUnm] = useState<Record<string, number | null>>(() => ({ ...(cur?.unmoved ?? {}) }))
  const [newFund, setNewFund] = useState('')
  const [fmsg, setFmsg] = useState('')
  const others = types.list.filter((t) => t.active && !isFundType(t))
  const rename = (id: string, cur: string) => {
    const n = prompt('แก้ชื่อ', cur)?.trim()
    const x = types.byId(id)
    if (!n || !x || n === cur) return
    if (types.list.some((y) => y.id !== id && y.name === n)) return setFmsg(`มี “${n}” อยู่แล้ว`)
    setFmsg(types.put([{ ...x, name: n }]) ? `เปลี่ยนชื่อเป็น “${n}” แล้ว (ใช้ชื่อนี้ทุกที่ทั้งใบถวายและยอดยกมา)` : 'สิทธิ์ของท่านแก้ชื่อไม่ได้')
  }
  const [msg, setMsg] = useState('')
  const clean = (r: Record<string, number | null>) => Object.fromEntries(Object.entries(r).filter(([, v]) => v !== null && v !== 0)) as Record<string, number>
  const sumOf = (r: Record<string, number | null>, ids: string[]) => ids.reduce((s, id) => s + (r[id] ?? 0), 0)
  const fundSum = sumOf(fnd, funds.map((f) => f.id))
  const total = fundSum + (own ?? 0)
  const held = (cash ?? 0) + sumOf(acc, accts.list.map((a) => a.id))
  const addFund = () => {
    const n = newFund.trim()
    if (!n) return setFmsg('พิมพ์ชื่อกองทุนก่อน')
    if (types.list.some((x) => x.name === n)) return setFmsg(`มี “${n}” อยู่แล้ว`)
    setFmsg(types.put([{ id: newId('t'), name: n, order: types.list.length, active: true, fund: true, updated: 0 }]) ? `เพิ่มกองทุน “${n}” แล้ว — กรอกเงินตั้งต้นของกองนี้ได้เลย` : 'สิทธิ์ของท่านเพิ่มกองทุนไม่ได้')
    setNewFund('')
  }
  const save = () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setMsg('เลือกวันตัดยอดก่อน')
    const ids = new Set(funds.map((f) => f.id))
    const keep = Object.fromEntries(Object.entries(clean(fnd)).filter(([id]) => ids.has(id)))
    setMsg(o.save({ date, funds: keep, own: own ?? 0, accounts: clean(acc), cash: cash ?? 0, unmoved: clean(unm) }) ? 'บันทึกยอดยกมาแล้ว' : 'สิทธิ์ของท่านบันทึกไม่ได้')
  }
  return (
    <Fold id="h-open" title={<>📌 ยอดยกมา (ตั้งต้น)</>}>
      <p className="muted small">ใส่เงินตั้งต้นแยกเป็นแต่ละกองทุนและเงินของคริสตจักรก่อน แล้วระบบรวมให้เป็นเงินตั้งต้นทั้งหมด หลังจากนั้นเงินถวายกองทุนไหนจะเข้ากองนั้น เงินที่ไม่เข้ากองทุนไหนจะอยู่เป็นเงินหมุนเวียนของคริสตจักร · ยังไม่มีตัวเลขก็ปล่อยว่างได้ ใส่ภายหลังได้</p>
      <div className="field"><label htmlFor="op-date">วันตัดยอด (ควรเป็นวันอาทิตย์ที่ปรับสมุดแล้ว)</label><input id="op-date" className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
      <p className="small"><b>เงินแต่ละกองทุน</b></p>
      {funds.length === 0 && <p className="small muted">ยังไม่มีกองทุน — เพิ่มด้านล่าง</p>}
      {funds.map((t) => (
        <div className="field" key={t.id}>
          <label>{t.name}</label>
          <div className="row"><div className="grow"><MoneyInput value={fnd[t.id] ?? null} onChange={(v) => setFnd({ ...fnd, [t.id]: v })} /></div><button type="button" className="mini" aria-label={`แก้ชื่อกองทุน ${t.name}`} onClick={() => rename(t.id, t.name)}>✎ แก้ชื่อ</button><button type="button" className="mini" aria-label={`ลบกองทุน ${t.name}`} onClick={() => { if (!confirm(`ลบกองทุน “${t.name}” ออกจากรายการ?\n(รายการที่บันทึกไว้แล้วยังอยู่ แต่จะแสดงเป็น “ประเภทที่ถูกลบ”)`)) return; setFnd(({ [t.id]: _drop, ...rest }) => rest); setFmsg(types.remove(t.id) ? `ลบกองทุน “${t.name}” แล้ว` : 'สิทธิ์ของท่านลบกองทุนไม่ได้') }}>🗑️ ลบ</button></div>
        </div>
      ))}
      <div className="row"><input className="input grow" aria-label="ชื่อกองทุนใหม่" placeholder="ชื่อกองทุนใหม่" value={newFund} onChange={(e) => setNewFund(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addFund()} /><button type="button" className="btn btn--ghost" onClick={addFund}>＋ เพิ่มกองทุน</button></div>
      {fmsg && <p className="small" role="status">{fmsg}</p>}
      <p className="muted small">กองทุนชุดเดียวกับ “รายการรับ” — แก้ชื่อ เพิ่ม หรือลบที่ไหนก็ตรงกันทั้งสองที่</p>
      {others.length > 0 && (
        <details>
          <summary className="small">รายการรับที่ยังไม่ใช่กองทุน ({others.length}) — ตั้งเป็นกองทุน / แก้ชื่อ / ลบ</summary>
          <ul className="list">{others.map((t) => <li key={t.id}><span className="grow">{t.name}</span><button type="button" className="mini" aria-label={`แก้ชื่อ ${t.name}`} onClick={() => rename(t.id, t.name)}>✎</button><button type="button" className="mini" aria-label={`ลบ ${t.name}`} onClick={() => { if (!confirm(`ลบ “${t.name}” ออกจากรายการรับ?\n(รายการที่บันทึกไว้แล้วยังอยู่ แต่จะแสดงเป็น “ประเภทที่ถูกลบ”)`)) return; setFmsg(types.remove(t.id) ? `ลบ “${t.name}” แล้ว` : 'สิทธิ์ของท่านลบไม่ได้') }}>🗑️</button><button type="button" className="mini" aria-label={`ตั้ง ${t.name} เป็นกองทุน`} onClick={() => setFmsg(types.put([{ ...t, fund: true }]) ? `ตั้ง “${t.name}” เป็นกองทุนแล้ว` : 'สิทธิ์ของท่านแก้ไม่ได้')}>ตั้งเป็นกองทุน</button></li>)}</ul>
        </details>
      )}
      <p className="small"><b>เงินหมุนเวียนของคริสตจักร</b> (ส่วนที่ไม่เข้ากองทุนไหน ใช้บริหารประจำสัปดาห์/เดือน)</p>
      <div className="field"><label>เงินหมุนเวียน</label><MoneyInput value={own} onChange={setOwn} /></div>
      <p className="small" role="status"><b>รวมเงินตั้งต้นทั้งหมด {fmtBaht(total)} บาท</b><span className="muted"> (กองทุน {fmtBaht(fundSum)} + หมุนเวียน {fmtBaht(own ?? 0)})</span></p>
      <details>
        <summary className="small">เงินอยู่ที่ไหน (ไม่บังคับ — ใช้ตรวจว่ายอดตรงกับเงินจริง)</summary>
        {accts.list.length === 0 && <p className="small muted">ยังไม่มีบัญชีธนาคาร — เพิ่มที่การ์ด “บัญชีธนาคาร” ด้านล่างก่อน</p>}
        {accts.list.map((a) => (
          <div className="field" key={a.id}><label>ยอดคงเหลือ {a.name}{a.last4 ? ` (…${a.last4})` : ''}{a.role === 'operating' ? ' · หมุนเวียน' : a.role === 'restricted' ? ' · วัตถุประสงค์' : ''}</label><MoneyInput value={acc[a.id] ?? null} onChange={(v) => setAcc({ ...acc, [a.id]: v })} /></div>
        ))}
        <div className="field"><label>เงินสดในมือ</label><MoneyInput value={cash} onChange={setCash} /></div>
        <p className="small">รวมเงินสด+บัญชี {fmtBaht(held)} บาท{held !== total && (cash !== null || Object.keys(acc).length > 0) ? <span className="err"> · ต่างจากเงินตั้งต้น {fmtBaht(held - total, { sign: true })} บาท</span> : null}</p>
        {funds.length > 0 && <p className="small"><b>เงินกองทุนที่ยังอยู่ในบัญชีหมุนเวียน (ยังไม่ย้ายเข้าบัญชีวัตถุประสงค์)</b></p>}
        {funds.map((t) => <div className="field" key={t.id}><label>{t.name}</label><MoneyInput value={unm[t.id] ?? null} onChange={(v) => setUnm({ ...unm, [t.id]: v })} /></div>)}
      </details>
      <button type="button" className="btn btn--gold" onClick={save}>บันทึกยอดยกมา</button>
      {msg && <p className={msg.startsWith('บันทึก') ? 'ok' : 'err'} role="status">{msg}</p>}
    </Fold>
  )
}

/** สวิตช์เปิด/ปิด: เปิด = เขียว · compact = บรรทัดเดียว (ชื่ออยู่ขวาของสวิตช์) */
function SwitchRow({ label, sub, on, onChange, disabled, compact }: { label: string; sub?: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean; compact?: boolean }) {
  return (
    <div className="swrow" style={compact ? { flex: 1, minWidth: 0 } : undefined}>
      <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={`swt${on ? ' swt--on' : ''}`} onClick={() => onChange(!on)}><i /></button>
      <span className="swrow__t"><b>{label}</b>{sub && <><br /><span className="small muted">{sub}</span></>}</span>
    </div>
  )
}
