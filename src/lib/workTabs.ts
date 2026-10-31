/** ห้องทำงาน: แท็บ 1–18 (พัฒนาทีละแท็บ) ขนาดเดียวกับช่องเงินคริสตจักรหน้าแรก */
export const MEETING_TABS = [
  { n: 1, name: 'งานเลขา' }, { n: 2, name: 'งานทะเบียน' }, { n: 3, name: 'งานเหรัญญิก' }, { n: 4, name: 'งานอภิบาล' }, { n: 5, name: 'งานสุสาน' },
  { n: 6, name: 'งานนมัสการ' }, { n: 7, name: 'งานต่างชาติ' }, { n: 8, name: 'งานรวี' }, { n: 9, name: 'งานอนุชน' }, { n: 10, name: 'งานสตรี' },
  { n: 11, name: 'งานประกาศ' }, { n: 12, name: 'งานทรัพย์สิน' },
  { n: 13, name: 'งานมีเดีย' }, { n: 14, name: 'งานโรงครัว' }, { n: 15, name: 'แท็บ 15' }, // 15–18 ยังไม่ได้ตั้งชื่อ
  { n: 16, name: 'แท็บ 16' }, { n: 17, name: 'แท็บ 17' }, { n: 18, name: 'แท็บ 18' },
]

/** ปุ่ม “‹ หน้าแรก” ในหัวของทุกงาน: กลับหน้าแรก (ห้องทำงาน) เหมือนกันทุกงาน ทุกบทบาท */
export const workHomePath = (_works: number[]) => '/'
/** ห้องที่ยังไม่ได้ตั้งชื่อ (แท็บ 15–18): เห็นเฉพาะแอดมิน */
export const isUnnamedWork = (t: { name: string }) => /^แท็บ \d+$/.test(t.name)
/** งานที่แสดงในหน้าเลือกงาน: กำหนดแล้ว = เฉพาะงานของตน · ไม่ได้กำหนด = ทุกงาน (แอดมิน/บัญชีที่เห็นรายละเอียดเท่านั้น: all) หรือไม่เห็นเลย · ห้องที่ยังไม่มีชื่อเห็นเฉพาะแอดมิน */
export const visibleWorks = (works: number[], opts: { all?: boolean; admin?: boolean } = {}) => {
  const { all = true, admin = true } = opts
  const base = works.length ? MEETING_TABS.filter((t) => works.includes(t.n)) : all ? MEETING_TABS : []
  return admin ? base : base.filter((t) => !isUnnamedWork(t))
}
