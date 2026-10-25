import Sheet from './Sheet'
import StoredImage from './StoredImage'

/** ดูไฟล์ที่แนบกับรายการ (หลายรูป) — เปิดจากช่อง "ไฟล์แนบ" ในใบ */
export default function AttachViewer({ title, files, onClose }: { title: string; files: { path: string; name: string }[]; onClose: () => void }) {
  return (
    <Sheet title={`ไฟล์แนบ · ${title}`} onClose={onClose}>
      <p className="muted small" style={{ margin: 0 }}>{files.length} ไฟล์ · แตะที่รูปเพื่อเปิดดูเต็ม</p>
      <div style={{ display: 'grid', gap: 10 }}>
        {files.map((f) => <div key={f.path} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: 6 }}><StoredImage path={f.path} alt={`ไฟล์แนบ ${f.name}`} /></div>)}
      </div>
    </Sheet>
  )
}
