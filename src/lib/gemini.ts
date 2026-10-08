import { compressImage } from './image'

/** อ่านใบบันทึกการถวายด้วย Gemini (เฉพาะแถวเงินสด) — รหัส API เก็บในเครื่องนี้เท่านั้น ไม่ส่งขึ้น repo */
const KEY = 'acct.gemini.v1'
export const DEFAULT_MODEL = 'gemini-flash-latest'

export function getGemini(): { key: string; model: string } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { key?: string; model?: string } | null
    return { key: v?.key ?? '', model: v?.model || DEFAULT_MODEL }
  } catch { return { key: '', model: DEFAULT_MODEL } }
}
export function saveGemini(key: string, model = DEFAULT_MODEL) {
  try { if (key.trim()) localStorage.setItem(KEY, JSON.stringify({ key: key.trim(), model: model.trim() || DEFAULT_MODEL })); else localStorage.removeItem(KEY) } catch { /* ignore */ }
}

export interface SheetRead {
  date?: string
  rows: { label: string; envelopes?: number; amount: number }[]
  /** ยอดที่เขียนไว้ในใบ (สตางค์) เพื่อเทียบกับผลรวมที่อ่านได้ */
  writtenCash?: number
}

const toSatang = (v: unknown): number | undefined => {
  const n = typeof v === 'string' ? Number(v.replace(/[,\s]/g, '')) : typeof v === 'number' ? v : NaN
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : undefined
}

/** แปลงคำตอบ JSON ของ Gemini เป็นข้อมูลใบถวาย (ทนต่อรูปแบบที่ไม่ตรง) */
export function parseSheetJson(text: string): SheetRead {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '')
  const j = JSON.parse(clean) as { date?: string; rows?: { label?: string; envelopes?: unknown; amount?: unknown }[]; cashTotal?: unknown }
  const rows = (Array.isArray(j.rows) ? j.rows : []).flatMap((r) => {
    const amount = toSatang(r.amount)
    const label = String(r.label ?? '').trim()
    if (!amount || amount <= 0) return []
    const env = typeof r.envelopes === 'number' ? Math.round(r.envelopes) : Number(r.envelopes)
    return [{ label, amount, ...(Number.isFinite(env) && env > 0 ? { envelopes: env } : {}) }]
  })
  const date = typeof j.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.date) ? j.date : undefined
  const writtenCash = toSatang(j.cashTotal)
  return { ...(date ? { date } : {}), rows, ...(writtenCash ? { writtenCash } : {}) }
}

const PROMPT = `นี่คือรูป "ใบบันทึกการถวาย" ของคริสตจักรศิลาเอก (ตารางพิมพ์ มีลายมือกรอก) ให้อ่านและตอบเป็น JSON เท่านั้น
กติกา:
- อ่านเฉพาะ "เงินสด" คือคอลัมน์ "จำนวนซอง" และ "จำนวนเงิน" ชุดแรก (ซ้ายสุด) ห้ามนำคอลัมน์ "จำนวนผู้โอนผ่านบ/ช" หรือคอลัมน์ "รวม" มาปน
- ทุกแถวที่มีตัวเลขเงิน ให้ใส่ใน rows ตามลำดับบนลงล่าง รวมแถวที่พิมพ์ไว้ (สิบลด, ประจำสัปดาห์, ขอบพระคุณ, กองทุนเพื่อที่ดินคริสตจักร, กองทุนเพื่ออาหาร) และแถวที่เขียนมือเพิ่มเอง (เช่น ค่าเช่า, ถวายพิเศษเงินสด) ใช้ข้อความชื่อแถวตามที่เห็น
- แถวที่ว่างไม่ต้องใส่ ส่วน amount เป็นเลขบาท (ไม่ใช้คอมมา) envelopes เป็นจำนวนซอง (ถ้าไม่มีให้เว้น)
- date: ที่หัวใบมีลายมือ "ประจำวันอาทิตย์ ที่ __ เดือน __ พ.ศ. __" ให้ประกอบเป็นวันที่เดียว แปลงปี พ.ศ. เป็น ค.ศ. (ลบ 543) รูปแบบ YYYY-MM-DD เช่น 4 ตุลาคม 2569 → 2026-10-04 (ถ้าอ่านไม่ได้ให้เว้น อย่าเดา)
- cashTotal คือตัวเลขที่เขียนไว้ที่ "รวมจากตู้ถวาย" (ถ้ามี)
- ห้ามเดาตัวเลขที่อ่านไม่ออก ให้ข้ามแถวนั้น`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    date: { type: 'STRING', nullable: true },
    cashTotal: { type: 'NUMBER', nullable: true },
    rows: { type: 'ARRAY', items: { type: 'OBJECT', properties: { label: { type: 'STRING' }, envelopes: { type: 'INTEGER', nullable: true }, amount: { type: 'NUMBER' } }, required: ['label', 'amount'] } },
  },
  required: ['rows'],
}

const b64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

const FALLBACKS = ['gemini-2.5-flash', 'gemini-flash-lite-latest', 'gemini-2.5-flash-lite']
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** เรียก Gemini: ถ้ารุ่นหนึ่งไม่ว่าง (503/500/429) หรือไม่พบ (404) จะลองซ้ำแล้วสลับไปรุ่นสำรองให้เอง */
export async function readSheet(file: Blob & { name?: string }): Promise<SheetRead> {
  const { key, model } = getGemini()
  if (!key) throw new Error('ยังไม่ได้ใส่รหัส Gemini API')
  const f = file instanceof File ? file : new File([file], 'sheet.jpg', { type: file.type || 'image/jpeg' })
  const { data } = await compressImage(f, 1800, 0.8)
  const body = JSON.stringify({
    contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: b64(data) } }] }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
  })
  let last = ''
  for (const m of [...new Set([model, ...FALLBACKS])]) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let r: Response
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key }, body })
      } catch { throw new Error('ไม่มีอินเทอร์เน็ต — อ่านใบถวายไม่ได้') }
      if (r.ok) {
        const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] }
        const text = j.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
        if (text) return parseSheetJson(text)
        last = 'Gemini ไม่ส่งผลการอ่านกลับมา'
        break
      }
      const detail = ((await r.json().catch(() => null)) as { error?: { message?: string } } | null)?.error?.message ?? ''
      if (r.status === 403 || (r.status === 400 && /api key|API_KEY/i.test(detail))) throw new Error('รหัส Gemini API ไม่ถูกต้องหรือไม่มีสิทธิ์ — ตรวจรหัสในตั้งค่า')
      last = `Gemini (${m}) ตอบกลับ ${r.status}${detail ? `: ${detail.slice(0, 120)}` : ''}`
      if (r.status === 503 || r.status === 500 || r.status === 429) { if (attempt === 0) { await sleep(1200); continue } }
      break
    }
  }
  throw new Error(`${last} — ลองกด “อ่านซ้ำ” อีกครั้งในอีกสักครู่ หรือกรอกตารางเอง`)
}

/** ทดสอบรหัส: '' = ใช้ได้ · อย่างอื่น = ข้อความอธิบาย */
export async function testGemini(): Promise<string> {
  const { key, model } = getGemini()
  if (!key) return 'ยังไม่ได้ใส่รหัส'
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`, { headers: { 'x-goog-api-key': key } })
    if (r.ok) return ''
    if (r.status === 400 || r.status === 403) return 'รหัสไม่ถูกต้องหรือยังไม่ได้เปิดสิทธิ์ใช้งาน Gemini API'
    if (r.status === 404) return `ไม่พบรุ่น “${model}” — ลองล้างช่องรุ่นให้ใช้ค่าเริ่มต้น`
    if (r.status === 429) return 'โควตาครบชั่วคราว — รหัสน่าจะใช้ได้ ลองใหม่ภายหลัง'
    return `ทดสอบไม่สำเร็จ (${r.status})`
  } catch { return 'ไม่มีอินเทอร์เน็ต' }
}
