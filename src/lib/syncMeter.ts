/**
 * มาตรวัดโควตา GitHub: อ่านจากหัวคำตอบ x-ratelimit-* ของทุกการเรียก (โควตานับต่อ “รหัส” — ทุกเครื่องที่ใช้รหัสเดียวกันใช้ร่วมกัน)
 * + นับการเรียกของเครื่องนี้ใน 1 ชั่วโมงล่าสุดแยกประเภท (304 = ถามแล้วไม่มีอะไรเปลี่ยน ไม่นับโควตา)
 */
export type CallKind = 'pull' | 'cond' | 'push' | 'check' | 'other'
export interface Snapshot { limit: number; remaining: number; used: number; reset: number; at: number }
export interface Meter extends Partial<Snapshot> { calls: Record<CallKind, number>; total: number }

const KEY = 'acct.sync.meter.v1'
const HOUR = 3600_000
const events: { t: number; k: CallKind }[] = []
let snap: Snapshot | null = (() => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') as Snapshot | null } catch { return null } })()
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(snap)) } catch { /* ignore */ } }

const num = (v: string | null) => (v !== null && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : undefined)

/** เรียกทุกครั้งที่ได้คำตอบจาก GitHub */
export function recordResponse(kind: CallKind, r: Pick<Response, 'status' | 'headers'>) {
  const now = Date.now()
  while (events.length && events[0].t < now - HOUR) events.shift()
  events.push({ t: now, k: r.status === 304 ? 'cond' : kind })
  const limit = num(r.headers.get('x-ratelimit-limit')), remaining = num(r.headers.get('x-ratelimit-remaining')), reset = num(r.headers.get('x-ratelimit-reset'))
  if (limit !== undefined && remaining !== undefined && reset !== undefined) {
    snap = { limit, remaining, used: num(r.headers.get('x-ratelimit-used')) ?? limit - remaining, reset: reset * 1000, at: now }
    save()
  }
  emit()
}

export function getMeter(): Meter {
  const now = Date.now()
  while (events.length && events[0].t < now - HOUR) events.shift()
  const calls: Record<CallKind, number> = { pull: 0, cond: 0, push: 0, check: 0, other: 0 }
  for (const e of events) calls[e.k]++
  // ถ้าเลยเวลารีเซ็ตแล้ว ค่าที่จำไว้หมดอายุ (โควตาเริ่มนับใหม่)
  const s = snap && snap.reset > now ? snap : null
  return { ...(s ?? {}), calls, total: events.length }
}
export const subscribeMeter = (f: () => void) => { subs.add(f); return () => { subs.delete(f) } }

/** โควตาเต็มและยังไม่ถึงเวลารีเซ็ต → คืนเวลารีเซ็ต (ms) ไม่งั้น 0 — ใช้หยุดการถามอัตโนมัติไม่ให้ซ้ำเติม */
export const quotaBlockedUntil = () => (snap && snap.remaining <= 0 && snap.reset > Date.now() ? snap.reset : 0)

/** อ่านค่าล่าสุดจาก GitHub (การเรียก /rate_limit ไม่นับโควตา) */
export async function refreshRateLimit(token: string): Promise<boolean> {
  try {
    const r = await fetch('https://api.github.com/rate_limit', { cache: 'no-store', headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'x-github-api-version': '2022-11-28' } })
    if (!r.ok) return false
    const j = (await r.json()) as { resources?: { core?: { limit: number; remaining: number; used: number; reset: number } } }
    const c = j.resources?.core
    if (!c) return false
    snap = { limit: c.limit, remaining: c.remaining, used: c.used, reset: c.reset * 1000, at: Date.now() }
    save(); emit()
    return true
  } catch { return false }
}
