/**
 * ดึงส่วนพารามิเตอร์ของลิงก์เชิญออกจากข้อความที่วางมา (วางทั้งข้อความที่แอดมินแชร์ หรือเฉพาะลิงก์ก็ได้)
 * คืนค่า "t=…&role=…" สำหรับเปิดหน้าขอเข้าร่วม · ไม่พบ = null
 */
export function parseInviteLink(text: string): string | null {
  const m = /#\/join\?([^\s]+)/.exec(text)
  if (!m || !/(^|&)t=[^&]+/.test(m[1])) return null
  return m[1]
}
