import type { Meeting, MtAgenda } from '../../lib/types'
import { AGENDA_GROUPS, letterDate, refNo } from '../../lib/meetings'

/** เวลา “09:00” → “09.00 น.” */
export const timeTh = (t?: string) => (t ? `${t.replace(':', '.')} น.` : '')

/** วาระเรียงตามกลุ่ม (แจ้งเพื่อทราบ → รับรองรายงาน → ติดตามงาน → เรื่องเสนอพิจารณา) ภายในกลุ่มคงลำดับที่จัด · พร้อมเลขข้อ */
export function orderedAgenda(m: Pick<Meeting, 'agenda'>): { n: number; item: MtAgenda }[] {
  const rank = (a: MtAgenda) => AGENDA_GROUPS.indexOf(a.group)
  return m.agenda.map((item, i) => ({ item, i })).filter((x) => x.item.title.trim()).sort((a, b) => rank(a.item) - rank(b.item) || a.i - b.i).map((x, k) => ({ n: k + 1, item: x.item }))
}

export const defaultNoticeBody = (m: Meeting) =>
  `ด้วย${m.name || '………'} กำหนดจัดการประชุม${m.type === 'พิเศษ' ? 'พิเศษ' : ''} ครั้งที่ ${m.no}/${m.year} ในวันที่ ${letterDate(m.date) || '………'} เวลา ${timeTh(m.time) || '………'} ณ ${m.place || '………'} โดยมีระเบียบวาระการประชุมตามที่แนบมาพร้อมนี้\n\nจึงเรียนเชิญท่านเข้าร่วมประชุมตามวัน เวลา และสถานที่ดังกล่าว หากไม่สามารถเข้าร่วมได้ กรุณาแจ้งเลขานุการล่วงหน้า`

const Row = ({ k, children }: { k: string; children: React.ReactNode }) => <div className="letter__row"><span>{k}</span><span style={{ flex: 1 }}>{children}</span></div>

/** เนื้อหาหนังสือเชิญประชุม (ใส่ใน LetterPage) */
export function NoticeBody({ m, body }: { m: Meeting; body: string }) {
  const issued = letterDate(m.notice?.sentAt ? new Date(m.notice.sentAt).toISOString().slice(0, 10) : undefined)
  return (
    <>
      <div style={{ textAlign: 'right', fontWeight: 700, marginBottom: 10 }}>ที่ {m.notice?.ref || refNo(m)}</div>
      <div style={{ textAlign: 'center', margin: '0 0 14px' }}>{issued || '………………'}</div>
      <Row k="เรื่อง">เชิญประชุม{m.name} ครั้งที่ {m.no}/{m.year}</Row>
      <Row k="เรียน">กรรมการและผู้เกี่ยวข้องทุกท่าน</Row>
      <Row k="สิ่งที่แนบมาด้วย">ระเบียบวาระการประชุม</Row>
      <div style={{ margin: '12px 0' }}>{body.split(/\n\s*\n/).map((p, i) => <p key={i} className="letter__p">{p}</p>)}</div>
      <div className="letter__sign">
        <div>ขอแสดงความนับถือในพระคริสต์</div>
        <div style={{ height: 54 }} />
        <div>({m.secretary || '………………………'})</div>
        <div>เลขานุการ{m.name}</div>
      </div>
    </>
  )
}

/** ระเบียบวาระการประชุม (ใส่ใน LetterPage) */
export function AgendaBody({ m }: { m: Meeting }) {
  const items = orderedAgenda(m)
  return (
    <>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, margin: '4px 0 2px' }}>ระเบียบวาระการประชุม</div>
      <div style={{ textAlign: 'center' }}>{m.name} ครั้งที่ {m.no}/{m.year}{m.type === 'พิเศษ' ? ' (การประชุมพิเศษ)' : ''}</div>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>วันที่ {letterDate(m.date) || '………'} เวลา {timeTh(m.time) || '………'} ณ {m.place || '………'}</div>
      <table aria-label="ระเบียบวาระ">
        <thead><tr><th style={{ width: 46 }}>วาระ</th><th>เรื่อง</th><th style={{ width: 70 }}>เพื่อ</th><th style={{ width: 150 }}>เอกสารประกอบ</th></tr></thead>
        <tbody>
          {AGENDA_GROUPS.map((g) => {
            const rows = items.filter((x) => x.item.group === g)
            return rows.length === 0 ? null : [
              <tr key={g}><td colSpan={4} style={{ background: '#f4f6fa', fontWeight: 700 }}>{g}</td></tr>,
              ...rows.map(({ n, item }) => <tr key={item.id}><td style={{ textAlign: 'center' }}>{n}</td><td>{item.title}{item.carried ? ' (ค้างจากครั้งก่อน)' : ''}</td><td style={{ textAlign: 'center' }}>{item.purpose}</td><td>{item.docs || '—'}</td></tr>),
            ]
          })}
          {items.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', height: 60 }}>— ยังไม่มีวาระ —</td></tr>}
        </tbody>
      </table>
      <div style={{ marginTop: 14, fontSize: 14 }}>ประธาน: {m.chair || '………'}{m.agendaOk ? ` · เห็นชอบวาระแล้ว ${letterDate(new Date(m.agendaOk.at).toISOString().slice(0, 10))}` : ' · ยังไม่ได้รับความเห็นชอบจากประธาน'}</div>
    </>
  )
}

// ---------------------------------------------------------------------------
// เอกสารขั้นเตรียมประชุม (ขั้น 4) และรายงานการประชุม (ขั้น 7–9)
// ---------------------------------------------------------------------------
const Title = ({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) => (
  <>
    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18, margin: '4px 0 2px' }}>{children}</div>
    {sub && <div style={{ textAlign: 'center', marginBottom: 10 }}>{sub}</div>}
  </>
)
const where = (m: Meeting) => `วันที่ ${letterDate(m.date) || '………'} เวลา ${timeTh(m.time) || '………'} ณ ${m.place || '………'}`
const head = (m: Meeting) => `${m.name} ครั้งที่ ${m.no}/${m.year}`

export const SIGN_PER_PAGE = 22
/** จำนวนหน้าของใบลงชื่อ */
export const signPages = (m: Meeting) => Math.max(1, Math.ceil(m.people.filter((p) => p.name.trim()).length / SIGN_PER_PAGE))

/** ใบลงชื่อผู้ประชุม (หน้าที่ page เริ่มที่ 0) — แยกกลุ่มกรรมการ/ผู้มีสิทธิ์ลงคะแนน/ผู้เข้าร่วมอื่นด้วยคอลัมน์ประเภท */
export function SignInBody({ m, page }: { m: Meeting; page: number }) {
  const people = m.people.filter((p) => p.name.trim())
  const rows = people.slice(page * SIGN_PER_PAGE, (page + 1) * SIGN_PER_PAGE)
  const total = signPages(m)
  return (
    <>
      <Title sub={<>{where(m)}</>}>ใบลงชื่อผู้เข้าร่วมประชุม — {head(m)}{total > 1 ? ` (แผ่น ${page + 1}/${total})` : ''}</Title>
      <table aria-label="ใบลงชื่อ">
        <thead><tr><th style={{ width: 36 }}>ที่</th><th>ชื่อ-สกุล</th><th style={{ width: 120 }}>ประเภท</th><th style={{ width: 150 }}>ลายมือชื่อ</th><th style={{ width: 70 }}>หมายเหตุ</th></tr></thead>
        <tbody>
          {rows.map((p, i) => <tr key={p.id} style={{ height: 28 }}><td style={{ textAlign: 'center' }}>{page * SIGN_PER_PAGE + i + 1}</td><td>{p.name}</td><td>{p.kind}</td><td /><td /></tr>)}
          {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', height: 60 }}>— ยังไม่มีรายชื่อ —</td></tr>}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 13.5 }}>ผู้มีสิทธิ์ลงคะแนนและกรรมการทั้งหมด {people.filter((p) => p.kind !== 'ผู้เข้าร่วมอื่น').length} คน · ใช้ตรวจองค์ประชุมก่อนเริ่มประชุม</div>
    </>
  )
}

/** แบบบันทึกการประชุม (เปล่า) — แถวต่อวาระ มีช่องสาระ ข้อเสนอ มติ ผลลงคะแนน ผู้รับผิดชอบ/กำหนดเสร็จ */
export function MinuteFormBody({ m }: { m: Meeting }) {
  const items = orderedAgenda(m)
  return (
    <>
      <Title sub={where(m)}>แบบบันทึกการประชุม — {head(m)}</Title>
      <div style={{ fontSize: 14, marginBottom: 6 }}>เปิดประชุมเวลา ……………… น. · ประธาน {m.chair || '………'} · ผู้บันทึก {m.secretary || '………'}</div>
      <table aria-label="แบบบันทึกการประชุม">
        <thead><tr><th style={{ width: 80 }}>วาระ</th><th>สาระสำคัญ / ข้อเสนอ</th><th style={{ width: 120 }}>มติ / ผลลงคะแนน</th><th style={{ width: 120 }}>ผู้รับผิดชอบ / กำหนดเสร็จ</th></tr></thead>
        <tbody>
          {items.map(({ n, item }) => <tr key={item.id} style={{ height: 84 }}><td><b>{n}.</b> {item.title}<br /><small>({item.purpose})</small></td><td /><td /><td /></tr>)}
          {items.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', height: 60 }}>— ยังไม่มีวาระ —</td></tr>}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: 14 }}>เลิกประชุมเวลา ……………… น. · นัดประชุมครั้งต่อไป ………………………………………………</div>
    </>
  )
}

/** บัตรลงคะแนน (วาระที่ขอมติ) — ตัดแบ่งได้ · และแบบสรุปผลคะแนน */
export function BallotBody({ m }: { m: Meeting }) {
  const votes = orderedAgenda(m).filter((x) => x.item.purpose === 'ขอมติ')
  const voters = m.people.filter((p) => p.name.trim() && p.kind !== 'ผู้เข้าร่วมอื่น').length
  return (
    <>
      <Title sub={where(m)}>บัตรลงคะแนน — {head(m)}</Title>
      {votes.length === 0 && <p style={{ textAlign: 'center' }}>ไม่มีวาระที่ต้องลงคะแนน</p>}
      {votes.map(({ n, item }) => (
        <div key={item.id} style={{ border: '1.5px dashed #333', padding: '8px 12px', margin: '8px 0' }}>
          <b>วาระที่ {n}: {item.title}</b>
          <div style={{ display: 'flex', gap: 28, marginTop: 6 }}><span>☐ เห็นชอบ</span><span>☐ ไม่เห็นชอบ</span><span>☐ งดออกเสียง</span></div>
        </div>
      ))}
      {votes.length > 0 && (
        <>
          <p style={{ fontSize: 13.5, margin: '8px 0' }}>พิมพ์ {voters} ใบ (ตามจำนวนผู้มีสิทธิ์) · ลงคะแนนโดยไม่ระบุชื่อเพื่อรักษาความลับ</p>
          <table aria-label="แบบสรุปผลคะแนน">
            <thead><tr><th>วาระ</th><th style={{ width: 80 }}>เห็นชอบ</th><th style={{ width: 90 }}>ไม่เห็นชอบ</th><th style={{ width: 90 }}>งดออกเสียง</th><th style={{ width: 80 }}>รวม</th></tr></thead>
            <tbody>{votes.map(({ n, item }) => <tr key={item.id} style={{ height: 30 }}><td>{n}. {item.title}</td><td /><td /><td /><td /></tr>)}</tbody>
          </table>
        </>
      )}
    </>
  )
}
