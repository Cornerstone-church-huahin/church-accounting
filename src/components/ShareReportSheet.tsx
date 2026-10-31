import { useState } from 'react'
import Sheet from './Sheet'
import { fmtDateLong } from '../lib/money'
import { reportText, shareText, type ServiceReport } from '../lib/serviceReport'

/** ป๊อปอัพตรวจข้อความสรุปผู้มานมัสการก่อนแชร์ไป LINE / Messenger / Facebook (หน้าลงชื่อและหน้ายอดผู้มาใช้ร่วมกัน) */
export default function ShareReportSheet({ report, onClose, onDone }: { report: ServiceReport; onClose: () => void; /** แชร์/คัดลอกสำเร็จ */ onDone?: (text: string) => void }) {
  const [msg, setMsg] = useState<{ text: string; bad?: boolean } | null>(null)
  const text = reportText(report)
  const done = (t: string) => { onDone?.(t); onClose() }
  const doShare = async () => {
    const r = await shareText(`สรุปนมัสการ ${fmtDateLong(report.date)}`, text)
    if (r === 'copied') done('คัดลอกสรุปแล้ว วางในแชต LINE ได้เลย')
    else if (r === 'failed') setMsg({ text: 'แชร์และคัดลอกไม่ได้ในเครื่องนี้ ลองเปิดแอปด้วย Chrome', bad: true })
    else if (r === 'shared') onClose()
  }
  const doCopy = async () => {
    try { await navigator.clipboard.writeText(text); done('คัดลอกสรุปแล้ว วางในแชต LINE ได้เลย') } catch { setMsg({ text: 'คัดลอกไม่ได้ ให้กดค้างที่ข้อความด้านบนเพื่อคัดลอกเอง', bad: true }) }
  }
  return (
    <Sheet title="ตรวจข้อมูลก่อนแชร์" onClose={onClose}>
      <p className="pagehint" style={{ margin: 0 }}>ข้อความนี้จะถูกส่งไป LINE / Messenger / Facebook ที่คุณเลือก (มีเฉพาะตัวเลขและชื่อคนมาใหม่ ไม่มีเบอร์โทรหรือวันเกิด)</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.4rem', textAlign: 'center' }}>
        {([['ทั้งหมด', report.total], ['ชาย', report.male], ['หญิง', report.female]] as const).map(([k, v]) => (
          <div key={k} style={{ border: '1.5px solid var(--line)', borderRadius: '0.7rem', padding: '0.35rem 0' }}><div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{v}</div><div className="small muted">{k}</div></div>
        ))}
      </div>
      <pre aria-label="ข้อความที่จะแชร์" style={{ whiteSpace: 'pre-wrap', margin: 0, padding: '0.75rem', borderRadius: '0.8rem', background: 'var(--surface-2)', border: '1px solid var(--line)', fontFamily: 'inherit', userSelect: 'text' }}>{text}</pre>
      {msg?.bad && <p className="small" role="alert" style={{ margin: 0, color: 'var(--bad)', fontWeight: 700 }}>{msg.text}</p>}
      <button type="button" className="btn btn--gold bigbtn btn--block" onClick={doShare}>📤 แชร์ข้อความนี้</button>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <button type="button" className="btn btn--ghost bigbtn grow" onClick={doCopy}>คัดลอก</button>
        <button type="button" className="btn btn--ghost bigbtn grow" onClick={onClose}>ยกเลิก</button>
      </div>
    </Sheet>
  )
}
