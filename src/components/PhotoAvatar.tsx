import { useRef, useState } from 'react'
import MemberAvatar from './MemberAvatar'
import { uploadMemberPhoto } from '../lib/memberPhoto'
import type { ChurchMember } from '../lib/types'

/**
 * รูปสมาชิกในรายการ: ถ้ามีสิทธิ์ (canPhoto) แตะที่รูปเพื่อถ่าย/เลือกรูป เพิ่มหรือเปลี่ยนได้ทันที · ไม่มีสิทธิ์ = เป็นรูปธรรมดา
 * (สิทธิ์เดียวกับปุ่ม “เพิ่มรูป/เปลี่ยนรูป” ในรายละเอียดสมาชิก)
 */
export default function PhotoAvatar({ member, size = 52, canPhoto, put }: { member: ChurchMember; size?: number; canPhoto?: boolean; put: (x: ChurchMember[]) => boolean }) {
  const file = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  if (!canPhoto) return <MemberAvatar path={member.photoPath} name={member.name} size={size} member={member} />
  const pick = async (f: File | undefined) => {
    if (!f) return
    setBusy(true)
    try { put([{ ...member, photoPath: await uploadMemberPhoto(member.id, f) }]) } catch (e) { window.alert(e instanceof Error ? e.message : 'อัปโหลดรูปไม่สำเร็จ') } finally { setBusy(false) }
  }
  return (
    <span className="photoav" style={{ position: 'relative', display: 'inline-flex', flex: 'none' }}>
      <button type="button" className="photoav__b" disabled={busy} onClick={() => file.current?.click()} aria-label={`${member.photoPath ? 'เปลี่ยน' : 'เพิ่ม'}รูป ${member.name}`} title={member.photoPath ? 'แตะที่รูปเพื่อเปลี่ยนรูป' : 'แตะที่รูปเพื่อเพิ่มรูป'}>
        <MemberAvatar path={member.photoPath} name={member.name} size={size} member={member} />
      </button>
      <span className="photoav__i" aria-hidden="true">{busy ? '…' : '📷'}</span>
      <input ref={file} hidden type="file" accept="image/*" aria-label={`ไฟล์รูป ${member.name}`} onChange={(e) => { void pick(e.target.files?.[0]); e.target.value = '' }} />
    </span>
  )
}
