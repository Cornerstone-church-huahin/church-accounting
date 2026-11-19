import { addDays, parseBaht, sheetSunday, todayISO } from './money'
import type { DonorGift, GiftKind } from './types'

export const GIFT_KINDS: { k: GiftKind; label: string; short: string; color: string; soft: string }[] = [
  { k: 'weekly', label: 'ถวายประจำสัปดาห์', short: 'ประจำสัปดาห์', color: '#23814a', soft: '#e3f4ea' },
  { k: 'tithe', label: 'ถวายสิบลด', short: 'สิบลด', color: '#0f7f8f', soft: '#dff2f4' },
  { k: 'thanks', label: 'ถวายขอบพระคุณ', short: 'ขอบพระคุณ', color: '#d9660a', soft: '#fdecd8' },
  { k: 'building', label: 'ถวายสร้างอาคาร', short: 'สร้างอาคาร', color: '#2557b8', soft: '#e6eefc' },
  { k: 'loan', label: 'ให้คริสตจักรยืม', short: 'ให้ยืม', color: '#7a3fb0', soft: '#efe6f9' },
  { k: 'other', label: 'อื่น ๆ', short: 'อื่น ๆ', color: '#5b6577', soft: '#eceff4' },
]
export const kindInfo = (k: GiftKind) => GIFT_KINDS.find((x) => x.k === k) ?? GIFT_KINDS[GIFT_KINDS.length - 1]

/** ยอด 300 = ประจำสัปดาห์ · ยอดอื่นที่ไม่ได้ระบุ = ขอบพระคุณ (ค่าเริ่มต้นตอนเพิ่มเอง) */
export const guessKind = (satang: number): GiftKind => (satang === 30000 ? 'weekly' : 'thanks')

const WORDS: [RegExp, GiftKind][] = [[/tithe|สิบลด/i, 'tithe'], [/weekly|ประจำ/i, 'weekly'], [/thanks|ขอบพระคุณ/i, 'thanks'], [/building|อาคาร/i, 'building'], [/loan|ยืม/i, 'loan'], [/other|อื่น/i, 'other']]
const kindOfWord = (w: string): GiftKind | null => { for (const [re, k] of WORDS) if (re.test(w)) return k; return null }

/** แปลงข้อความวางหลายบรรทัด: "2026-05-24 16:55 300 weekly 0123456789ABC หมายเหตุ" (วันที่ เวลา จำนวน ประเภท [เลขที่รายการ] [หมายเหตุ]) */
export function parseGiftLines(text: string, code: string): { rows: Omit<DonorGift, 'id' | 'updated'>[]; errors: string[] } {
  const rows: Omit<DonorGift, 'id' | 'updated'>[] = [], errors: string[] = []
  // บรรทัดที่ไม่ได้ขึ้นต้นด้วยวันที่ = ส่วนที่ถูกตัดขึ้นบรรทัดใหม่ตอนคัดลอก (เช่น เลขที่รายการตกลงมาบรรทัดถัดไป) ให้ต่อกับบรรทัดก่อนหน้า
  const lines: string[] = []
  for (const l of text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean)) {
    if (/^\d{4}-\d{2}-\d{2}\b/.test(l) || lines.length === 0) lines.push(l)
    else lines[lines.length - 1] += ` ${l}`
  }
  lines.forEach((line, i) => {
    const m = line.match(/^(\d{4}-\d{2}-\d{2})\s+(?:(\d{1,2}:\d{2})\s+)?([\d,]+(?:\.\d{1,2})?)\s+(\S+)(?:\s+([0-9A-Za-z]{10,}))?(?:\s+(.*))?$/)
    if (!m) { errors.push(`บรรทัด ${i + 1}: รูปแบบไม่ถูกต้อง`); return }
    const amount = parseBaht(m[3]), kind = kindOfWord(m[4])
    if (Number.isNaN(amount) || amount <= 0) { errors.push(`บรรทัด ${i + 1}: จำนวนเงินไม่ถูกต้อง`); return }
    if (!kind) { errors.push(`บรรทัด ${i + 1}: ไม่รู้จักประเภท “${m[4]}” (weekly/tithe/thanks/building/loan/other)`); return }
    rows.push({ code, date: m[1], ...(m[2] ? { time: m[2].padStart(5, '0') } : {}), amount, kind, ...(m[5] ? { ref: m[5] } : {}), ...(m[6] ? { note: m[6] } : {}) })
  })
  return { rows, errors }
}

/** อาทิตย์ที่ไม่มีการถวายประจำ (ประจำสัปดาห์หรือสิบลด) ตั้งแต่สัปดาห์แรกที่มีข้อมูลถึงสัปดาห์ล่าสุดที่จบแล้ว (นับตามอาทิตย์ปลายสัปดาห์ของใบบันทึก) */
export function missingWeeks(gifts: Pick<DonorGift, 'date' | 'kind' | 'deleted'>[], today = todayISO()): string[] {
  const live = gifts.filter((g) => !g.deleted)
  if (!live.length) return []
  const first = sheetSunday(live.map((g) => g.date).sort()[0])
  const thisSun = sheetSunday(today)
  const last = thisSun > today ? addDays(thisSun, -7) : thisSun
  const have = new Set(live.filter((g) => g.kind === 'weekly' || g.kind === 'tithe').map((g) => sheetSunday(g.date)))
  const out: string[] = []
  for (let d = first; d <= last; d = addDays(d, 7)) if (!have.has(d)) out.push(d)
  return out
}

export const giftId = (code: string, g: { ref?: string; date: string; time?: string; amount: number }) => `dg:${code}:${g.ref ?? `${g.date}${g.time ?? ''}-${g.amount}`}`
