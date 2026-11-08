import { useRef, useState } from 'react'
import FoodRosterPaper from './FoodRosterPaper'
import Sheet from './Sheet'
import PdfTools from './PdfTools'
import { canRole, canWork } from '../lib/access'
import { useFoodPay, useFoodSlots, useSettings } from '../lib/data'
import { foodFile } from '../lib/blankFood'
import { monthPages, shortThaiDate, type YM } from '../lib/foodRoster'
import { useRole } from '../lib/members'
import { todayISO } from '../lib/money'

const OCCASIONS = ['วันเกิด', 'ครบรอบแต่งงาน', 'ขอบพระคุณพระเจ้า', 'ขอพระพรให้ครอบครัว', 'ระลึกถึงผู้ล่วงลับ', 'คริสต์มาส', 'อีสเตอร์']

/**
 * งานโรงครัว › ตารางถวายอาหาร: แผ่น A4 แผ่นละ 2 เดือนต่อเนื่อง วันอาทิตย์กำกับถูกต้อง
 * แตะแถวเพื่อบันทึกชื่อผู้ถวาย/โอกาส (เก็บในระบบ ซิงก์ร่วม) · ดาวน์โหลด/แชร์ PDF ได้ทั้ง ใบเปล่า (ให้เขียนเอง) และ ใบที่มีชื่อ · พิมพ์ได้
 */
export default function FoodRoster() {
  const role = useRole()
  const canEdit = canRole(role, 'detail') || canWork(14, 'edit')
  const { settings } = useSettings()
  const church = settings.churchName.split(' ')[0]
  const slots = useFoodSlots()
  const foodPay = useFoodPay()
  const [pf, setPf] = useState({ bank: '', accName: '', accNo: '', note: '' })
  const [payOpen, setPayOpen] = useState(false)
  const today = todayISO()
  const start: YM = { y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }
  const count = 2
  const [edit, setEdit] = useState<string | null>(null)
  const [donor, setDonor] = useState('')
  const [occasion, setOccasion] = useState('')
  const [msg, setMsg] = useState('')
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const pages = monthPages(start, count)

  const open = (date: string) => { if (!canEdit) return; const s = slots.byDate.get(date); setDonor(s?.donor ?? ''); setOccasion(s?.occasion ?? ''); setEdit(date) }
  const save = () => {
    if (!edit) return
    const id = `food-${edit}`
    if (!donor.trim() && !occasion.trim()) slots.put([{ id, updated: 0, date: edit, donor: '', occasion: '', deleted: true }])
    else slots.put([{ id, updated: 0, date: edit, donor: donor.trim(), occasion: occasion.trim() }])
    setEdit(null); setMsg('บันทึกแล้ว')
  }
  const els = () => refs.current.filter((e): e is HTMLDivElement => !!e)
  const file = foodFile(start, count, false)

  return (
    <div aria-label="ตารางถวายอาหาร">
      <details className="card no-print" style={{ margin: '0 0 8px' }} open={payOpen} onToggle={(e) => { const o = (e.currentTarget as HTMLDetailsElement).open; setPayOpen(o); if (o) setPf({ bank: foodPay.pay.bank, accName: foodPay.pay.accName, accNo: foodPay.pay.accNo, note: foodPay.pay.note }) }}>
        <summary><b>💳 บัญชีรับถวาย (แสดงท้ายใบ)</b>{foodPay.pay.accNo.trim() ? <span className="small muted"> · {foodPay.pay.accNo}</span> : <span className="small muted"> · ยังไม่ได้ใส่</span>}</summary>
        {canEdit ? (
          <div style={{ marginTop: 6 }}>
            <div className="field"><label htmlFor="fp-bank">ธนาคาร</label><input id="fp-bank" className="input" maxLength={40} value={pf.bank} onChange={(e) => setPf({ ...pf, bank: e.target.value })} placeholder="เช่น ธนาคารกสิกรไทย" /></div>
            <div className="field"><label htmlFor="fp-name">ชื่อบัญชี</label><input id="fp-name" className="input" maxLength={60} value={pf.accName} onChange={(e) => setPf({ ...pf, accName: e.target.value })} /></div>
            <div className="field"><label htmlFor="fp-no">เลขที่บัญชี</label><input id="fp-no" className="input" inputMode="numeric" maxLength={24} value={pf.accNo} onChange={(e) => setPf({ ...pf, accNo: e.target.value.replace(/[^\d\- ]/g, '') })} placeholder="เช่น 123-4-56789-0" /></div>
            <div className="field"><label htmlFor="fp-note">ข้อความสั้น ๆ (ไม่บังคับ)</label><input id="fp-note" className="input" maxLength={40} value={pf.note} onChange={(e) => setPf({ ...pf, note: e.target.value })} placeholder="เช่น โอนแล้วแจ้งงานโรงครัว" /></div>
            <div className="row" style={{ gap: 8 }}>
              <button type="button" className="btn btn--gold" onClick={() => { foodPay.save({ bank: pf.bank.trim(), accName: pf.accName.trim(), accNo: pf.accNo.trim(), note: pf.note.trim() }); setMsg('บันทึกบัญชีแล้ว — แสดงท้ายทุกแผ่น') }}>บันทึกบัญชี</button>
              {foodPay.pay.accNo.trim() && <button type="button" className="btn btn--ghost" onClick={() => { foodPay.save({ bank: '', accName: '', accNo: '', note: '' }); setPf({ bank: '', accName: '', accNo: '', note: '' }); setMsg('เอาบัญชีออกจากใบแล้ว') }}>เอาออกจากใบ</button>}
            </div>
            <p className="small muted" style={{ margin: '4px 0 0' }}>เลขที่บัญชีจะพิมพ์เป็นตัวใหญ่ในกรอบท้ายทุกแผ่น (ทั้งใบเปล่าและใบพร้อมชื่อ) — ตรวจเลขให้ถูกต้องก่อนพิมพ์แจก</p>
          </div>
        ) : <p className="small muted">ผู้มีสิทธิ์เท่านั้นที่แก้บัญชีได้</p>}
      </details>
      {pages.map((mp, i) => <FoodRosterPaper key={`${start.y}-${start.m}-${i}`} ref={(el) => { refs.current[i] = el }} church={church} months={mp} slots={slots.byDate} onRowClick={canEdit ? open : undefined} pay={foodPay.pay} pageNo={pages.length > 1 ? `แผ่นที่ ${i + 1}/${pages.length}` : undefined} />)}
      {edit && (
        <Sheet title={`ผู้ถวายอาหาร · ${shortThaiDate(edit)}`} onClose={() => setEdit(null)}>
          <div className="field"><label htmlFor="fr-donor">ชื่อผู้ถวาย</label><input id="fr-donor" className="input" maxLength={40} value={donor} onChange={(e) => setDonor(e.target.value)} placeholder="เช่น ครอบครัวสมชาย" autoFocus /><span className="small muted">{donor.length}/40</span></div>
          <div className="field"><label htmlFor="fr-occ">เนื่องในโอกาส</label><input id="fr-occ" className="input" maxLength={30} list="fr-occs" value={occasion} onChange={(e) => setOccasion(e.target.value)} placeholder="พิมพ์เอง หรือเลือกจากรายการ" /><span className="small muted">{occasion.length}/30</span>
            <datalist id="fr-occs">{OCCASIONS.map((o) => <option key={o} value={o} />)}</datalist></div>
          <div className="row" style={{ gap: 8 }}>
            <button type="button" className="btn btn--gold" onClick={save}>บันทึก</button>
            {slots.byDate.get(edit) && <button type="button" className="btn btn--ghost" onClick={() => { slots.put([{ id: `food-${edit}`, updated: 0, date: edit, donor: '', occasion: '', deleted: true }]); setEdit(null); setMsg('ล้างชื่อแล้ว') }}>ล้างวันนี้</button>}
          </div>
        </Sheet>
      )}
      {msg && <p className="note no-print" role="status" style={{ margin: '6px 0 0', textAlign: 'center' }}>{msg}</p>}
      <PdfTools compact els={els} file={file} title="ตารางถวายอาหาร" label="ตารางถวายอาหาร" />
      <p className="muted small no-print" style={{ textAlign: 'center' }}>แตะที่หน้ากระดาษเพื่อขยาย (แตะอีกครั้งเพื่อย่อ)</p>
    </div>
  )
}
