import type { ReactNode } from 'react'
import { orderedAgenda, timeTh } from './docs'
import { attendance, letterDate } from '../../lib/meetings'
export { attendance, quorumNeeded } from '../../lib/meetings'
import type { Meeting, MtPerson } from '../../lib/types'

export interface MBlock { key: string; lines: number; node: ReactNode }
const est = (s: string | undefined, per = 64) => (s ? Math.max(1, Math.ceil(s.length / per)) : 0)
const names = (ps: MtPerson[]) => ps.map((p) => p.name).join(', ')

export const resultLine = (a: ReturnType<typeof orderedAgenda>[number]['item']) => {
  const mi = a.minute
  if (!mi) return ''
  return `${mi.result ?? ''}${mi.result === 'มีเงื่อนไข' && mi.condition ? ` (${mi.condition})` : ''}`
}

/** เนื้อหารายงานการประชุมแบ่งเป็นบล็อก (ไว้จัดลงหน้า A4) — ใช้ทั้งร่างและฉบับสมบูรณ์ */
export function minutesBlocks(m: Meeting, opts: { draft?: boolean; final?: boolean } = {}): MBlock[] {
  const a = attendance(m)
  const out: MBlock[] = []
  out.push({ key: 'title', lines: 3, node: (
    <>
      <div style={{ textAlign: 'center', fontWeight: 800, fontSize: 18 }}>รายงานการประชุม{opts.draft ? ' (ร่าง)' : ''}</div>
      <div style={{ textAlign: 'center' }}>{m.name} ครั้งที่ {m.no}/{m.year}{m.type === 'พิเศษ' ? ' (การประชุมพิเศษ)' : ''}</div>
      <div style={{ textAlign: 'center', marginBottom: 8 }}>วันที่ {letterDate(m.date) || '………'} เวลา {timeTh(m.time) || '………'} ณ {m.place || '………'}</div>
    </>) })
  const lines = [
    a.present.length ? `ผู้มาประชุม (${a.present.length} คน): ${names(a.present)}` : '',
    a.leave.length ? `ผู้ลาประชุม (${a.leave.length} คน): ${names(a.leave)}` : '',
    a.absent.length ? `ผู้ไม่มาประชุม (${a.absent.length} คน): ${names(a.absent)}` : '',
    a.guests.length ? `ผู้เข้าร่วมเพิ่มเติม (${a.guests.length} คน): ${names(a.guests)}` : '',
  ].filter(Boolean)
  out.push({ key: 'att', lines: lines.reduce((s, l) => s + est(l), 0) + 1, node: <div style={{ margin: '4px 0' }}>{lines.map((l, i) => <div key={i} style={{ marginBottom: 2 }}>{l}</div>)}{lines.length === 0 && <div>ผู้มาประชุม: ………………………</div>}</div> })
  out.push({ key: 'open', lines: 2, node: <p className="letter__p">{m.opened ? `ประธานที่ประชุมคือ ${m.opened.chair || m.chair} เปิดประชุมเมื่อเวลา ${timeTh(m.opened.time)} หลังตรวจองค์ประชุมครบ${m.opened.agendaConfirmed ? ' ที่ประชุมเห็นชอบระเบียบวาระ' : ''}` : `ประธาน ${m.chair || '………'} เปิดประชุมเมื่อเวลา ……… น.`}</p> })
  for (const { n, item } of orderedAgenda(m)) {
    const mi = item.minute ?? {}
    const vote = mi.yes != null || mi.no != null || mi.abstain != null ? `ผลลงคะแนน: เห็นชอบ ${mi.yes ?? 0} · ไม่เห็นชอบ ${mi.no ?? 0} · งดออกเสียง ${mi.abstain ?? 0}` : ''
    const parts = [
      mi.summary && { k: 'สาระสำคัญ', v: mi.summary }, mi.proposal && { k: 'ข้อเสนอ', v: mi.proposal },
      mi.result && { k: 'มติที่ประชุม', v: resultLine(item), b: true }, vote && { k: '', v: vote },
      mi.assignee && { k: 'ผู้รับผิดชอบ', v: `${mi.assignee}${mi.due ? ` กำหนดเสร็จ ${letterDate(mi.due)}` : ''}` },
    ].filter(Boolean) as { k: string; v: string; b?: boolean }[]
    out.push({ key: item.id, lines: 1 + parts.reduce((s, p) => s + est(`${p.k} ${p.v}`), 0) + 1, node: (
      <div style={{ margin: '6px 0' }}>
        <div style={{ fontWeight: 700 }}>วาระที่ {n} {item.title}{item.carried ? ' (เรื่องค้างจากครั้งก่อน)' : ''}</div>
        {parts.map((p, i) => <div key={i} style={{ paddingLeft: 18, fontWeight: p.b ? 700 : 400 }}>{p.k ? `${p.k}: ` : ''}{p.v}</div>)}
        {parts.length === 0 && <div style={{ paddingLeft: 18, color: '#777' }}>(ยังไม่มีบันทึก)</div>}
      </div>) })
  }
  out.push({ key: 'close', lines: 2, node: <p className="letter__p">{m.closed?.time ? `เลิกประชุมเมื่อเวลา ${timeTh(m.closed.time)}` : 'เลิกประชุมเมื่อเวลา ……… น.'}{m.closed?.next ? ` · นัดประชุมครั้งต่อไป ${m.closed.next}` : ''}</p> })
  if (opts.final && m.approval) {
    out.push({ key: 'appr', lines: 3, node: <div style={{ margin: '6px 0', padding: '6px 10px', border: '1.5px solid #1a2b4c' }}><b>การรับรองรายงาน:</b> {m.approval.result} ในการประชุมครั้งที่ {m.approval.atNo} เมื่อวันที่ {letterDate(m.approval.date)}{m.approval.edits ? ` · แก้ไข: ${m.approval.edits}` : ''}</div> })
  }
  const signs = m.signs?.length ? m.signs : [{ role: 'ผู้จดรายงานการประชุม', name: m.secretary }, { role: 'ผู้ตรวจรายงานการประชุม', name: m.chair }]
  out.push({ key: 'sign', lines: 7, node: (
    <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 24, textAlign: 'center' }}>
      {signs.map((s) => (
        <div key={s.role} style={{ width: '44%' }}>
          <div style={{ height: 54, display: 'grid', placeItems: 'end center' }}>{s.img && <img src={s.img} alt={`ลายเซ็น ${s.name}`} style={{ maxHeight: 52, maxWidth: '100%' }} />}</div>
          <div>({s.name || '………………………'})</div><div>{s.role}</div>
        </div>
      ))}
    </div>) })
  return out
}

/** จัดบล็อกลงหน้า A4 (งบบรรทัดต่อหน้า) */
export function paginate(blocks: MBlock[], perPage = 31): MBlock[][] {
  const pages: MBlock[][] = [[]]
  let used = 0
  for (const b of blocks) {
    if (used + b.lines > perPage && pages[pages.length - 1].length > 0) { pages.push([]); used = 0 }
    pages[pages.length - 1].push(b); used += b.lines
  }
  return pages
}
