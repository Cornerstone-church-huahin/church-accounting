import { useState, type ReactNode } from 'react'
import { downloadSheetPdf, sharePdf, shareImages } from '../lib/pdf'
import { IconDownload, IconImage, IconPrint, IconShare } from './ToolIcons'

/** แถบไอคอนเล็ก 4 ปุ่มใต้/เหนือเอกสาร: ดาวน์โหลด PDF · แชร์ PDF · แชร์เป็นรูป · พิมพ์ */
export default function PdfTools({ els, file, title, label, mode = 'full', extra, compact }: { /** แถวเตี้ย ไอคอนเล็ก ใช้พื้นที่แนวตั้งน้อยที่สุด */ compact?: boolean; /** ปุ่มเพิ่ม (เช่น สแกนใบ) ต่อท้ายแถว */ extra?: ReactNode; mode?: 'full' | 'landscape'; els: () => HTMLDivElement[]; file: string; title: string; /** ชื่อเอกสารสำหรับอ่านออกเสียง/ทดสอบ */ label: string }) {
  const [busy, setBusy] = useState<'' | 'dl' | 'pdf' | 'img'>('')
  const run = async (k: 'dl' | 'pdf' | 'img') => {
    const list = els()
    if (!list.length) return
    setBusy(k)
    try {
      if (k === 'dl') await downloadSheetPdf(list, file, mode)
      else if (k === 'pdf') {
        if ((await sharePdf(list, file, mode, title)) === 'unsupported') { await downloadSheetPdf(list, file, mode); alert('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลดไฟล์ PDF ให้แล้ว ส่งต่อจากไฟล์ที่ดาวน์โหลดได้เลย') }
      } else if ((await shareImages(list, file.replace(/\.pdf$/i, ''), title, true)) === 'downloaded') alert('เครื่องนี้ยังแชร์รูปโดยตรงไม่ได้ — ดาวน์โหลดรูปให้แล้ว ส่งต่อจากรูปที่ดาวน์โหลดได้เลย')
    } catch (e) { console.error('pdf', e); alert('สร้างไฟล์ไม่สำเร็จ — ลองกด “พิมพ์” แล้วเลือกบันทึกเป็น PDF แทน') }
    finally { setBusy('') }
  }
  return (
    <div className={`no-print rec-tools rec-tools--four${extra ? ' rec-tools--five' : ''}${compact ? ' rec-tools--compact' : ''}`} role="toolbar" aria-label={`เครื่องมือ${label}`}>
      <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('dl')} aria-label={`ดาวน์โหลด PDF ${label}`} title="ดาวน์โหลดไฟล์ PDF"><IconDownload /><span>{busy === 'dl' ? 'กำลังสร้าง…' : 'ดาวน์โหลด PDF'}</span></button>
      <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('pdf')} aria-label={`แชร์ PDF ${label}`} title="แชร์ไฟล์ PDF"><IconShare /><span>{busy === 'pdf' ? 'กำลังสร้าง…' : 'แชร์ PDF'}</span></button>
      <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('img')} aria-label={`แชร์เป็นรูป ${label}`} title="แชร์เป็นรูปภาพ"><IconImage /><span>{busy === 'img' ? 'กำลังสร้าง…' : 'แชร์เป็นรูป'}</span></button>
      <button type="button" className="rec-tool" onClick={() => window.print()} aria-label={`พิมพ์${label}`} title="พิมพ์"><IconPrint /><span>พิมพ์</span></button>
      {extra}
    </div>
  )
}
