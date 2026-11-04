import { useState } from 'react'
import { downloadPdf, loadAttachment, printImages, shareImageFiles, sharePdf } from '../lib/imageExport'
import { IconDownload, IconImage, IconPrint, IconShare } from './ToolIcons'

/**
 * แถบไอคอน 4 ปุ่มของ “รูปแนบ” (บิล/สลิป/หลักฐาน): ดาวน์โหลด PDF · แชร์ PDF · แชร์เป็นรูป · พิมพ์
 * โหลดรูปจริงตอนกดเสมอ (จึงตรงกับรูปที่แนบอยู่ ณ ตอนนั้น) · files = รูปทั้งหมดที่เปิดดู หรือ load = ส่งรูปที่โหลดไว้แล้วมาเอง
 */
export default function ImageTools({ files, load, title, base = 'attachment' }: { files?: { path: string; name: string }[]; load?: () => Promise<Blob[]>; title: string; base?: string }) {
  const [busy, setBusy] = useState<'' | 'dl' | 'pdf' | 'img' | 'print'>('')
  const [msg, setMsg] = useState('')
  const blobs = () => (load ? load() : Promise.all((files ?? []).map((f) => loadAttachment(f.path))))
  const run = async (k: 'dl' | 'pdf' | 'img' | 'print') => {
    setBusy(k); setMsg('')
    try {
      const bs = await blobs()
      if (!bs.length) { setMsg('ยังไม่มีรูปให้ส่งออก'); return }
      if (k === 'dl') { await downloadPdf(bs, base); setMsg('บันทึกไฟล์ PDF แล้ว (ดูในโฟลเดอร์ดาวน์โหลด)') }
      else if (k === 'pdf') { if ((await sharePdf(bs, base, title)) === 'unsupported') { await downloadPdf(bs, base); setMsg('เครื่องนี้ยังแชร์ไฟล์โดยตรงไม่ได้ — ดาวน์โหลด PDF ให้แล้ว') } }
      else if (k === 'img') { if ((await shareImageFiles(bs, base, title)) === 'downloaded') setMsg('เครื่องนี้ยังแชร์รูปโดยตรงไม่ได้ — ดาวน์โหลดรูปให้แล้ว') }
      else printImages(bs)
    } catch (e) { setMsg(e instanceof Error ? e.message : 'ทำรายการไม่สำเร็จ') } finally { setBusy('') }
  }
  return (
    <>
      <div className="no-print rec-tools rec-tools--four" role="toolbar" aria-label={`เครื่องมือรูปแนบ ${title}`}>
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('dl')} aria-label="ดาวน์โหลด PDF รูปแนบ" title="ดาวน์โหลดเป็นไฟล์ PDF"><IconDownload /><span>{busy === 'dl' ? 'กำลังสร้าง…' : 'ดาวน์โหลด PDF'}</span></button>
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('pdf')} aria-label="แชร์ PDF รูปแนบ" title="แชร์ไฟล์ PDF"><IconShare /><span>{busy === 'pdf' ? 'กำลังสร้าง…' : 'แชร์ PDF'}</span></button>
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('img')} aria-label="แชร์เป็นรูป รูปแนบ" title="แชร์เป็นรูปภาพ"><IconImage /><span>{busy === 'img' ? 'กำลังสร้าง…' : 'แชร์เป็นรูป'}</span></button>
        <button type="button" className="rec-tool" disabled={!!busy} onClick={() => void run('print')} aria-label="พิมพ์ รูปแนบ" title="พิมพ์"><IconPrint /><span>พิมพ์</span></button>
      </div>
      {msg && <p role="status" className="small" style={{ margin: '4px 0 0', textAlign: 'center' }}>{msg}</p>}
    </>
  )
}
