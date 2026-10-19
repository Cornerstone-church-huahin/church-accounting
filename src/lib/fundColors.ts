/** สีประจำกองทุน: คนละสีชัดเจน ใช้ตรงกันทุกจอ (กราฟ ตาราง แถบกองทุน) — เรียงตามลำดับกองทุนในระบบ จึงไม่เปลี่ยนเมื่อยอดเปลี่ยน */
export const OWN_COLOR = '#102a5c'
const PALETTE = ['#1f77b4', '#e69f00', '#009e73', '#d55e00', '#7b3fa0', '#c2185b', '#0aa5b5', '#8a8a00', '#6d4c41', '#e0457b', '#4c9f38', '#546e7a']
export function fundColorMap(ids: string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id, i) => [id, PALETTE[i % PALETTE.length]]))
}
