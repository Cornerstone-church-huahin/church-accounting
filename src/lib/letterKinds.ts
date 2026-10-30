/**
 * ชนิดหนังสือที่ใช้ระบบเดียวกัน (กรอก → แจ้งประธานตรวจ → ลงลายเซ็น → ส่งเข้าคลังเอกสาร · เลขที่รันตามหมวดคลัง):
 * invite = หนังสือเชิญร่วมงาน (ต้นแบบ) · notice = หนังสือแจ้งการประชุมคณะธรรมกิจ
 */
export type LetterKindId = 'invite' | 'notice'
export interface LetterKind {
  id: LetterKindId
  /** ชื่อหนังสือ (หัวหน้า/รายการ/คลังเอกสาร) */
  name: string
  icon: string
  /** ที่อยู่หน้ารายการ และหน้าแก้แต่ละฉบับ (ใต้ /meeting/1/1/) */
  slug: string
  /** ที่เก็บข้อมูลร่วมกัน */
  storeKey: string; file: string; label: string
  settingsKey: string; settingsFile: string; settingsLabel: string
  /** หมวดในคลังเอกสารที่ชื่อมีคำนี้ = หมวดของหนังสือชนิดนี้ (เลขที่และตัวย่อตามหมวด) · ไม่มี = สร้างหมวดชื่อ defaultCat ให้ตอนส่งเข้าคลังครั้งแรก */
  catMatch: string; defaultCat: string
  /** บรรทัดอธิบายใต้หัวหน้า และคำอธิบายสั้นบนการ์ดลำดับงาน */
  intro: string; blurb: string
  /** ชื่อไฟล์ PDF และหัวเรื่องตอนแจ้งประธาน */
  fileName: string
  /** ค่าตั้งต้นของช่องที่แตกต่างกันตามชนิด */
  blank: { subject: string; to: string; body: string }
  proceed: string
  /** ผู้ลงนามเป็นเลขาเอง (เลขากดลงลายเซ็นและตั้งรูปลายเซ็นได้เอง ไม่ต้องรอประธาน) */
  secretarySigns?: boolean
  /** มีช่องวาระการประชุมเรียงเป็นข้อ */
  agenda?: string[]
}
export const LETTER_KINDS: Record<LetterKindId, LetterKind> = {
  invite: {
    id: 'invite', name: 'หนังสือเชิญร่วมงาน', icon: '✉️', slug: 'invite',
    storeKey: 'inviteletter', file: 'invite-letter.json', label: 'หนังสือเชิญร่วมงาน',
    settingsKey: 'invitesettings', settingsFile: 'invite-settings.json', settingsLabel: 'ค่าตั้งต้นหนังสือเชิญ',
    catMatch: 'เชิญ', defaultCat: 'หนังสือเชิญ',
    intro: 'เชิญผู้ใหญ่ร่วมงานกิจกรรมของคริสตจักร', blurb: 'หน้าเดียว: เลขที่ วันที่ เรื่อง เรียน เนื้อหา · ลงนาม · ส่งเข้าคลังเอกสาร',
    fileName: 'หนังสือเชิญ', blank: { subject: '', to: '', body: '' },
    proceed: 'จึงเรียนมาเพื่อโปรดพิจารณาและดำเนินการต่อไป',
  },
  notice: {
    id: 'notice', name: 'หนังสือแจ้งการประชุมคณะธรรมกิจ', icon: '📣', slug: 'notice',
    storeKey: 'noticeletter', file: 'notice-letter.json', label: 'หนังสือแจ้งการประชุมประจำเดือน',
    settingsKey: 'noticesettings', settingsFile: 'notice-settings.json', settingsLabel: 'ค่าตั้งต้นหนังสือแจ้งการประชุม',
    catMatch: 'แจ้งการประชุม', defaultCat: 'หนังสือแจ้งการประชุม',
    intro: 'แจ้งกำหนดการประชุมคณะธรรมกิจคริสตจักร', blurb: 'หน้าเดียว (ทำงานเหมือนหนังสือเชิญ): เลขที่ วันที่ เรื่อง เรียน เนื้อหา · ลงนาม · ส่งเข้าคลังเอกสาร',
    fileName: 'หนังสือแจ้งการประชุม',
    blank: {
      subject: 'แจ้งการประชุมคณะธรรมกิจ',
      to: 'คณะธรรมกิจคริสตจักรศิลาเอก',
      body: 'ด้วยคณะธรรมกิจคริสตจักรศิลาเอกกำหนดประชุมประจำเดือน ………… ในวัน…………… ที่ …… เดือน …………… พ.ศ. …… เวลา ……… น. ณ …………………… จึงขอแจ้งวาระการประชุม ดังนี้',
    },
    secretarySigns: true,
    agenda: ['รับรองรายงานการประชุมครั้งที่แล้ว', 'เรื่องแจ้งเพื่อทราบ', 'เรื่องเพื่อพิจารณา', 'เรื่องอื่นๆ'],
    proceed: 'จึงเรียนมาเพื่อโปรดทราบ และขอเชิญเข้าร่วมประชุมตามวัน เวลา และสถานที่ดังกล่าว',
  },
}
export const LETTER_KIND_LIST = Object.values(LETTER_KINDS)
