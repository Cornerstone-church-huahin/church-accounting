import { diffDays, isISO } from './money'
import type { CsvMap, StatementLine } from './types'

/** แยกไฟล์ CSV/TSV (รองรับเครื่องหมายคำพูด ตัวคั่น , ; แท็บ และ BOM) */
export function parseCSV(text: string): string[][] {
  const src = text.replace(/^﻿/, '')
  const first = src.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const count = (c: string) => first.split(c).length - 1
  const delim = [',', '\t', ';', '|'].sort((a, b) => count(b) - count(a))[0]
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let q = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++ } else q = false } else cell += c
    } else if (c === '"') q = true
    else if (c === delim) { row.push(cell); cell = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(cell); cell = ''
      if (row.some((x) => x.trim())) rows.push(row)
      row = []
    } else cell += c
  }
  row.push(cell)
  if (row.some((x) => x.trim())) rows.push(row)
  return rows.map((r) => r.map((x) => x.trim()))
}

/** วันที่จากสเตตเมนต์ → YYYY-MM-DD (รองรับ ค.ศ./พ.ศ. 4 หลัก และปี 2 หลัก, dd/mm/yyyy, yyyy-mm-dd) */
export function parseStmtDate(raw: string): string {
  const s = raw.trim().split(/[\sT]/)[0]
  let d: number, m: number, y: number
  let t = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/.exec(s)
  if (t) { y = +t[1]; m = +t[2]; d = +t[3] } else {
    t = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(s)
    if (!t) return ''
    d = +t[1]; m = +t[2]; y = +t[3]
    if (y < 100) y += y >= 60 ? 2500 : 2000 // 69 = พ.ศ. 2569 · 26 = ค.ศ. 2026
  }
  if (y > 2400) y -= 543
  const iso = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  return isISO(iso) ? iso : ''
}

/** จำนวนเงิน → สตางค์ (รองรับ 1,234.50 · (1,234.50) · 1,234.50- · ว่าง = 0) · ผิดรูปแบบ = NaN */
export function parseStmtAmount(raw: string): number {
  let t = raw.replace(/[,\s฿]/g, '')
  if (t === '' || t === '-') return 0
  let neg = false
  if (/^\(.*\)$/.test(t)) { neg = true; t = t.slice(1, -1) }
  if (t.endsWith('-')) { neg = true; t = t.slice(0, -1) }
  if (t.startsWith('-')) { neg = !neg; t = t.slice(1) }
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return NaN
  const v = Math.round(parseFloat(t) * 100)
  return neg ? -v : v
}

const KEYS: Record<keyof CsvMap, RegExp> = {
  date: /วันที่|date/i,
  desc: /รายการ|รายละเอียด|หมายเหตุ|description|details|particular|narrat|memo/i,
  credit: /ฝาก|เงินเข้า|credit|deposit|\bcr\b/i,
  debit: /ถอน|เงินออก|debit|withdraw|\bdr\b/i,
  amount: /จำนวนเงิน|amount/i,
  balance: /คงเหลือ|balance/i,
}

/** เดาว่าคอลัมน์ไหนคืออะไรจากแถวหัวตาราง (-1 = ไม่พบ) */
export function guessMap(header: string[]): CsvMap {
  const find = (k: keyof CsvMap, skip: number[] = []) => header.findIndex((h, i) => !skip.includes(i) && KEYS[k].test(h))
  const date = find('date')
  const balance = find('balance')
  const credit = find('credit', [balance])
  const debit = find('debit', [balance, credit])
  const amount = credit < 0 && debit < 0 ? find('amount', [balance]) : -1
  const desc = find('desc', [date, credit, debit, balance, amount])
  return { date, desc, credit, debit, amount, balance }
}

export interface ParsedStatement { lines: Omit<StatementLine, 'batchId' | 'accountId' | 'updated'>[]; skipped: number; from: string; to: string }

/** แปลงแถวข้อมูล (หลังหัวตาราง) เป็นรายการสเตตเมนต์ · id คงที่จากเนื้อหา จึงอัปโหลดไฟล์ซ้ำแล้วไม่เกิดรายการซ้ำ */
export function parseRows(rows: string[][], map: CsvMap, accountId: string): ParsedStatement {
  const seen = new Map<string, number>()
  const lines: ParsedStatement['lines'] = []
  let skipped = 0
  for (const r of rows) {
    const date = map.date >= 0 ? parseStmtDate(r[map.date] ?? '') : ''
    let credit = 0, debit = 0
    if (map.credit >= 0 || map.debit >= 0) {
      credit = map.credit >= 0 ? parseStmtAmount(r[map.credit] ?? '') : 0
      debit = map.debit >= 0 ? parseStmtAmount(r[map.debit] ?? '') : 0
    } else if (map.amount >= 0) {
      const a = parseStmtAmount(r[map.amount] ?? '')
      if (a >= 0) credit = a; else debit = -a
    }
    if (!date || Number.isNaN(credit) || Number.isNaN(debit) || (credit === 0 && debit === 0)) { skipped++; continue }
    credit = Math.abs(credit); debit = Math.abs(debit)
    const desc = map.desc >= 0 ? (r[map.desc] ?? '') : ''
    const bal = map.balance >= 0 ? parseStmtAmount(r[map.balance] ?? '') : NaN
    const base = `${accountId}|${date}|${credit}|${debit}|${Number.isNaN(bal) ? '' : bal}|${desc}`
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    lines.push({ id: `sl-${hash(base)}-${n}`, date, desc, credit, debit, ...(Number.isNaN(bal) ? {} : { balance: bal }) })
  }
  const dates = lines.map((l) => l.date).sort()
  return { lines, skipped, from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' }
}

function hash(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) }
  return (h >>> 0).toString(36)
}

// ---------- จับคู่ ----------
export interface Candidate { kind: 'deposit' | 'income' | 'voucher'; refId: string; date: string; amount: number; ref?: string; label: string }
export interface Suggestion { lineId: string; cand: Candidate; score: number }

/**
 * เสนอคู่ที่ "ยอดเท่ากันเป๊ะ" และวันที่ห่างไม่เกิน maxDays · เลขอ้างอิงตรงกับรายละเอียดในสเตตเมนต์ได้คะแนนสูง
 * จับคู่แบบ 1 ต่อ 1 (รายการหนึ่งถูกใช้ได้ครั้งเดียว) เรียงจากคะแนนสูงสุด — ไม่บันทึกอัตโนมัติ ให้ผู้ใช้ยืนยันเอง
 */
export function suggest(lines: StatementLine[], cands: Candidate[], maxDays: number): Suggestion[] {
  const all: Suggestion[] = []
  for (const l of lines) {
    if (l.match || l.deleted) continue
    for (const c of cands) {
      const isCredit = l.credit > 0
      if (isCredit !== (c.kind !== 'voucher')) continue
      if ((isCredit ? l.credit : l.debit) !== c.amount) continue
      const dd = Math.abs(diffDays(l.date, c.date))
      if (dd > maxDays) continue
      const refHit = c.ref && c.ref.length >= 4 && l.desc.replace(/\s/g, '').includes(c.ref.replace(/\s/g, '')) ? 100 : 0
      all.push({ lineId: l.id, cand: c, score: refHit + (maxDays - dd) })
    }
  }
  all.sort((a, b) => b.score - a.score)
  const usedL = new Set<string>(), usedC = new Set<string>(), out: Suggestion[] = []
  for (const s of all) {
    const ck = `${s.cand.kind}:${s.cand.refId}`
    if (usedL.has(s.lineId) || usedC.has(ck)) continue
    usedL.add(s.lineId); usedC.add(ck); out.push(s)
  }
  return out
}
