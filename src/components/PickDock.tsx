import { useState } from 'react'
import { downloadPagesPdf, sharePagesPdf, shareImages } from '../lib/pdf'
import { IconDownload, IconImage, IconPrint, IconShare } from './ToolIcons'

/** ช่องติ๊กท้ายแถบหัวข้อแผ่นงาน (ใช้ในแถบสีเขียว/แดง/ม่วง) */
export function SheetTick({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="sheettick no-print" title="ติ๊กเพื่อเลือกส่งออก (ดาวน์โหลด/แชร์/พิมพ์)">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} aria-label={`เลือก ${label}`} />
      <span>เลือก</span>
    </label>
  )
}

/**
 * แผงปุ่มลอยมุมบนซ้าย: ขึ้นทันทีที่ติ๊กแผ่นงานแรก — ดาวน์โหลด PDF · แชร์ PDF · แชร์เป็นรูป · พิมพ์
 * ทำกับ “ทุกแผ่นที่ติ๊กอยู่” (เรียงตามลำดับในหน้า) ดึงหน้ากระดาษจริงจากหน้าจอ ณ ตอนกด จึงตรงกับข้อมูลล่าสุดเสมอ
 */
export default function PickDock({ keys, getEls, file, title, onClear }: { keys: string[]; getEls: () => HTMLDivElement[]; file: string; title: string; onClear: () => void }) {
  const [busy, setBusy] = useState<'' | 'dl' | 'pdf' | 'img'>('')
  if (keys.length === 0) return null
  const pages = () => getEls().map((el) => ({ el, landscape: el.classList.contains('a4page--sheet') }))
  const run = async (k: 'dl' | 'pdf' | 'img') => {
    const list = pages()
    if (!list.length) return
    setBusy(k)
    try {
      if (k === 'dl') await downloadPagesPdf(list, file, { strip: true })
      else if (k === 'pdf') {
        if ((await sharePagesPdf(list, file, title, { strip: true })) === 'unsupported') { await downloadPagesPdf(list, file, { strip: true }); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') }
      } else if ((await shareImages(list.map((x) => x.el), file.replace(/\.pdf$/i, ''), title, true)) === 'downloaded') alert('เครื่องนี้ยังแชร์รูปโดยตรงไม่ได้ — ดาวน์โหลดรูปให้แล้ว ส่งต่อจากรูปที่ดาวน์โหลดได้เลย')
    } catch (e) { console.error('pick', e); alert('สร้างไฟล์ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
    finally { setBusy('') }
  }
  const print = () => {
    document.body.classList.add('print-sel')
    const done = () => { document.body.classList.remove('print-sel'); window.removeEventListener('afterprint', done) }
    window.addEventListener('afterprint', done)
    window.print()
  }
  return (
    <div className="pickdock no-print" role="toolbar" aria-label="ส่งออกแผ่นงานที่เลือก">
      <div className="pickdock__head"><b>เลือก {keys.length} แผ่น</b><button type="button" className="pickdock__x" onClick={onClear} aria-label="ล้างที่เลือก">✕</button></div>
      <div className="pickdock__btns">
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('dl')} aria-label="ดาวน์โหลด PDF แผ่นที่เลือก"><IconDownload /><span>{busy === 'dl' ? '…' : 'ดาวน์โหลด'}</span></button>
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('pdf')} aria-label="แชร์ PDF แผ่นที่เลือก"><IconShare /><span>{busy === 'pdf' ? '…' : 'แชร์ PDF'}</span></button>
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('img')} aria-label="แชร์เป็นรูป แผ่นที่เลือก"><IconImage /><span>{busy === 'img' ? '…' : 'แชร์รูป'}</span></button>
        <button type="button" className="rec-tool" onClick={print} aria-label="พิมพ์แผ่นที่เลือก"><IconPrint /><span>พิมพ์</span></button>
      </div>
    </div>
  )
}
