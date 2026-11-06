import { forwardRef } from 'react'
import { PaperHead } from '../PaperSheets'
import ScaledPage from '../ScaledPage'
import { letterDate, plainName, yearBE } from '../../lib/meetings'
import type { Meeting, MtPerson } from '../../lib/types'

const DOTS = '………………………………………'
const cell: React.CSSProperties = { border: '1px solid #333', padding: '3px 6px', verticalAlign: 'middle' }
const th: React.CSSProperties = { ...cell, background: '#e8ecf5', fontWeight: 700, textAlign: 'center', fontSize: 13 }

/** สถานะที่ช่องลงชื่อ: ร่วม = เส้นจุดไข่ปลาให้เซ็น · ลา/ขาด = ข้อความ (ไม่ต้องเซ็น) · ยังไม่ติ๊ก = เส้นจุดไข่ปลา */
const signCell = (p: MtPerson) => (p.att === 'ลา' ? <i>ลาประชุม</i> : p.att === 'ไม่มา' ? <i>ขาดประชุม</i> : DOTS)

/**
 * ใบลงชื่อผู้ร่วมประชุม (A4 แนวตั้ง พร้อมพิมพ์/แชร์): คณะธรรมกิจตามลำดับ + ตำแหน่ง + ช่องลงชื่อ · ผู้เข้าร่วม/ผู้สังเกตการณ์ · สรุปจำนวน · ช่องลงนามประธาน/ผู้จดรายงาน
 * ชุดเดียวกับรายงานการประชุม (หัวกระดาษ/ตัวอักษรแบบเดียวกัน) เพียงคนละแผ่น
 */
const RosterPaper = forwardRef<HTMLDivElement, { church: string; m: Meeting }>(function RosterPaper({ church, m }, ref) {
  const members = m.people.filter((p) => p.kind === 'กรรมการ' && p.name.trim())
  const guests = m.people.filter((p) => p.kind === 'ผู้เข้าร่วมอื่น' && p.name.trim())
  const present = members.filter((p) => p.att === 'มา').length
  const sub = [`${plainName(m.name) || 'การประชุมคณะธรรมกิจ'} ครั้งที่ ${m.no}/${yearBE(m.year)}`, m.date ? `วันที่ ${letterDate(m.date)}${m.time ? ` เวลา ${m.time} น.` : ''}` : '', m.place ? `ณ ${m.place}` : ''].filter(Boolean).join(' · ')
  return (
    <ScaledPage ref={ref}>
      <>
        <PaperHead church={church} title="ใบลงชื่อผู้ร่วมประชุม" sub={sub} />
        <p style={{ fontWeight: 700, margin: '8px 0 3px', fontSize: 14 }}>คณะธรรมกิจ</p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }} aria-label="ใบลงชื่อคณะธรรมกิจ">
          <colgroup><col style={{ width: '7%' }} /><col style={{ width: '31%' }} /><col style={{ width: '22%' }} /><col style={{ width: '40%' }} /></colgroup>
          <thead><tr><th style={th}>ที่</th><th style={th}>ชื่อ - สกุล</th><th style={th}>ตำแหน่ง</th><th style={th}>ลายมือชื่อ / หมายเหตุ</th></tr></thead>
          <tbody>
            {members.map((p, i) => (
              <tr key={p.id} style={{ height: 30 }}>
                <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
                <td style={cell}>{p.name}</td>
                <td style={{ ...cell, fontSize: 12 }}>{p.role ?? ''}</td>
                <td style={{ ...cell, color: p.att === 'มา' || !p.att ? '#999' : '#111', fontSize: 12 }}>{signCell(p)}{p.note ? <span style={{ color: '#111' }}> · {p.note}</span> : null}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {guests.length > 0 && (<>
          <p style={{ fontWeight: 700, margin: '10px 0 3px', fontSize: 14 }}>ผู้เข้าร่วมประชุม / ผู้สังเกตการณ์</p>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }} aria-label="ใบลงชื่อผู้สังเกตการณ์">
            <colgroup><col style={{ width: '7%' }} /><col style={{ width: '31%' }} /><col style={{ width: '22%' }} /><col style={{ width: '40%' }} /></colgroup>
            <thead><tr><th style={th}>ที่</th><th style={th}>ชื่อ - สกุล</th><th style={th}>หมายเหตุ / บทบาท</th><th style={th}>ลายมือชื่อ</th></tr></thead>
            <tbody>
              {guests.map((p, i) => (
                <tr key={p.id} style={{ height: 30 }}>
                  <td style={{ ...cell, textAlign: 'center' }}>{i + 1}</td>
                  <td style={cell}>{p.name}</td>
                  <td style={{ ...cell, fontSize: 12 }}>{p.role ?? ''}</td>
                  <td style={{ ...cell, color: '#999', fontSize: 12 }}>{DOTS}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>)}
        <p style={{ margin: '10px 0 0', fontSize: 14 }}>
          <b>สรุป:</b> กรรมการร่วมประชุม {present} คน · ลา {members.filter((p) => p.att === 'ลา').length} · ขาด {members.filter((p) => p.att === 'ไม่มา').length} · ผู้เข้าร่วม/สังเกตการณ์ {guests.length} คน · <b>รวมผู้ร่วมประชุมทั้งหมด {present + guests.length} คน</b>
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: 26, fontSize: 13.5, textAlign: 'center' }}>
          <div>ลงชื่อ …………………………………<br />({m.chair || '……………………………'})<br />ประธานที่ประชุม</div>
          <div>ลงชื่อ …………………………………<br />({m.secretary || '……………………………'})<br />ผู้จดรายงานการประชุม</div>
        </div>
      </>
    </ScaledPage>
  )
})
export default RosterPaper
