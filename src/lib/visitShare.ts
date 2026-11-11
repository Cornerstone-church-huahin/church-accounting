import { cachedImage } from './imageCache'
import { getBinary, getSync } from './sync'
import { mapsLink } from './geo'
import type { Visit } from './types'

/** ข้อความสรุปการเยี่ยมสำหรับส่งเข้ากลุ่ม (ไลน์ ฯลฯ) */
export function visitShareText(o: { dateText: string; names: string[]; visitor: string; checkin?: Visit['checkin'] | null; note?: string; place?: string; absentNames?: string[] }): string {
  const lines = [`🏠 รายงานการเยี่ยม · ${o.dateText}`]
  if (o.names.length) lines.push(`✅ เยี่ยมแล้ว: ${o.names.join(', ')}`)
  if (o.absentNames?.length) lines.push(`✗ ไม่พบ/ไม่อยู่บ้าน: ${o.absentNames.join(', ')}`)
  if (o.place?.trim()) lines.push(`📌 สถานที่: ${o.place.trim()}`)
  if (o.visitor) lines.push(`👥 ผู้เยี่ยม: ${o.visitor}`)
  if (o.checkin) {
    const t = new Date(o.checkin.at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
    lines.push(`📍 เช็คอิน${o.checkin.kind === 'work' ? 'ที่ทำงาน' : o.checkin.kind === 'place' ? 'ที่สถานที่นัดพบ' : 'ที่บ้าน'} ${t} น.`, mapsLink(o.checkin))
  }
  if (o.note?.trim()) lines.push(`📝 ${o.note.trim()}`)
  return lines.join('\n')
}

async function photoFile(path: string, i: number): Promise<File | null> {
  try {
    let b = await cachedImage(path)
    if (!b) { const cfg = getSync(); if (!cfg) return null; b = await getBinary(cfg, path) }
    return new File([b], `เยี่ยม-${i + 1}.jpg`, { type: b.type || 'image/jpeg' })
  } catch { return null }
}

/** แชร์ข้อความ + รูป (ถ้าเครื่องรองรับ) · ไม่รองรับ → คัดลอกข้อความให้ */
export async function shareVisit(text: string, photoPaths: string[]): Promise<'shared' | 'cancelled' | 'copied' | 'failed'> {
  const files = (await Promise.all(photoPaths.map(photoFile))).filter((f): f is File => !!f)
  const nav = typeof navigator !== 'undefined' ? navigator : undefined
  if (nav && typeof nav.share === 'function') {
    try {
      if (files.length && typeof nav.canShare === 'function' && nav.canShare({ files })) {
        try { await nav.clipboard?.writeText(text) } catch { /* ignore */ } // บางแอป (ไลน์) ตัดข้อความเมื่อแนบรูป — วางจากคลิปบอร์ดได้
        await nav.share({ text, files })
      } else await nav.share({ text })
      return 'shared'
    } catch (e) { if ((e as Error).name === 'AbortError') return 'cancelled' }
  }
  try { await nav?.clipboard?.writeText(text); return 'copied' } catch { return 'failed' }
}
