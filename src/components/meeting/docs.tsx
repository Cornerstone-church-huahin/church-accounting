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
