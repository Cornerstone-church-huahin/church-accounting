/** สีประจำกองทุน: คนละสี สว่างสดตัดกันชัดเจน (เรียงให้กองที่อยู่ติดกันสีต่างกันมากที่สุด) ใช้ตรงกันทุกจอ (กราฟ ตาราง แถบกองทุน) — เรียงตามลำดับกองทุนในระบบ จึงไม่เปลี่ยนเมื่อยอดเปลี่ยน */
export const OWN_COLOR = '#304ffe'
const PALETTE = ['#ff1744', '#ffd600', '#00c853', '#d500f9', '#ff6d00', '#00b0ff', '#76ff03', '#ff4fa3', '#651fff', '#1de9b6', '#ffab00', '#00e5ff']
export function fundColorMap(ids: string[]): Record<string, string> {
  return Object.fromEntries(ids.map((id, i) => [id, PALETTE[i % PALETTE.length]]))
}
