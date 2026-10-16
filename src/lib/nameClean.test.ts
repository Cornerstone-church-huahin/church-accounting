import { describe, expect, it } from 'vitest'
import { applyNameFix, cleanName, planNameClean } from './nameClean'
import type { ChurchMember } from './types'

const mem = (name: string, extra: Partial<ChurchMember> = {}): ChurchMember => ({ id: name, name, updated: 1, ...extra })

describe('จัดชื่อกับวงเล็บ', () => {
  it('ไม่มีวงเล็บ = ไม่ยุ่ง', () => expect(cleanName({ name: 'สมชาย ใจดี' })).toEqual({ kind: 'none' }))
  it('วงเล็บตรงกับชื่อเล่นเดิม = ตัดวงเล็บออกเฉยๆ', () => expect(cleanName({ name: 'ดารา ผลจันทร์ (ดารา)', nick: 'ดารา' })).toEqual({ kind: 'fix', how: 'strip', name: 'ดารา ผลจันทร์' }))
  it('ชื่อเล่นว่าง = ย้ายวงเล็บไปเป็นชื่อเล่น', () => expect(cleanName({ name: 'สมเจตน์ เสมาทอง(เจต)' })).toEqual({ kind: 'fix', how: 'nick', name: 'สมเจตน์ เสมาทอง', nick: 'เจต' }))
  it('วงเล็บเป็นคำอธิบาย = ไปหมายเหตุ ชื่อเล่นเดิมไม่แตะ', () => {
    expect(cleanName({ name: 'อิงโก๊ะ (ลูกคุณนุช)', nick: 'อิงโก๊ะ' })).toEqual({ kind: 'fix', how: 'note', name: 'อิงโก๊ะ', note: 'ลูกคุณนุช' })
    expect(cleanName({ name: 'คุณแจ้ (เพื่อนคุณอมรา)', nick: 'แจ้', note: 'มาจากสระบุรี' })).toEqual({ kind: 'fix', how: 'note', name: 'คุณแจ้', note: 'มาจากสระบุรี · เพื่อนคุณอมรา' })
    expect(cleanName({ name: 'Apml (จีน ภรรยา T-Max)' })).toMatchObject({ how: 'note', name: 'Apml', note: 'จีน ภรรยา T-Max' })
  })
  it('ชื่อเล่นสั้นๆ ที่ขึ้นต้นเหมือนคำเรียกญาติยังเป็นชื่อเล่น (อาเธอร์ น้อง)', () => {
    expect(cleanName({ name: 'ฐกร เล้าฐานะ(อาเธอร์)' }).kind).toBe('review') // ยาวเกิน 6 ตัว ไม่เดา
    expect(cleanName({ name: 'ฐกร เล้าฐานะ(อาร์ต)' })).toMatchObject({ how: 'nick', nick: 'อาร์ต' })
    expect(cleanName({ name: 'เหมนารา ตระกูล(น้อง)' })).toMatchObject({ how: 'nick', nick: 'น้อง' })
    expect(cleanName({ name: 'Ping (พ่อ T-max )' })).toMatchObject({ how: 'note' })
  })
  it('ประเทศ ชื่อฝรั่งในวงเล็บ ไม่เดา ให้คนตรวจ', () => {
    expect(cleanName({ name: 'ซีโย (คนเกาหลี)' })).toMatchObject({ how: 'note' })
    expect(cleanName({ name: 'Glen Haris (แคนนาดา)' }).kind).toBe('review')
    expect(cleanName({ name: 'Han Bing (T -max)' }).kind).toBe('review')
  })
  it('หมายเหตุมีข้อความนั้นอยู่แล้ว = ไม่ใส่ซ้ำ', () => expect(cleanName({ name: 'ม่อม (ลูกป้ามาลี)', note: 'ลูกป้ามาลี' })).toMatchObject({ note: 'ลูกป้ามาลี' }))
  it('วงเล็บว่าง = ตัดทิ้ง', () => expect(cleanName({ name: 'สมศรี ()' })).toEqual({ kind: 'fix', how: 'strip', name: 'สมศรี' }))
  it('ชื่อเล่นเดิมกับวงเล็บคนละคำ / วงเล็บซ้อน / วงเล็บกลางชื่อ = ให้คนตรวจ', () => {
    expect(cleanName({ name: 'สมชาย (ชาติ)', nick: 'โอ' }).kind).toBe('review')
    expect(cleanName({ name: 'กุลณัฐ บูรณารมย์(มาย(เภสัช)' }).kind).toBe('review')
    expect(cleanName({ name: 'Ari(อาร์ลี่) วายแวม' }).kind).toBe('review')
    expect(cleanName({ name: 'Graeme. (England) คนอังกฤษ' }).kind).toBe('review')
  })
  it('ใช้ผลแล้วเก็บชื่อเดิมไว้ครั้งแรกครั้งเดียว', () => {
    const m = mem('ดารา ผลจันทร์ (ดารา)', { nick: 'ดารา' })
    const f = cleanName(m)
    if (f.kind !== 'fix') throw new Error('x')
    const a = applyNameFix(m, f)
    expect([a.name, a.nick, a.nameOrig]).toEqual(['ดารา ผลจันทร์', 'ดารา', 'ดารา ผลจันทร์ (ดารา)'])
    expect(applyNameFix({ ...a, nameOrig: 'เดิม' }, f).nameOrig).toBe('เดิม')
  })
  it('แผนรวม: นับตามชนิด และทำซ้ำแล้วไม่เหลืองาน', () => {
    const ms = [mem('ก (ก)', { nick: 'ก' }), mem('ข (ขข)'), mem('ค (ลูกง)'), mem('จ(ฉ(ช)'), mem('ปกติ')]
    const p = planNameClean(ms)
    expect(p.byHow).toEqual({ nick: 1, strip: 1, note: 1 })
    expect(p.review).toHaveLength(1)
    expect(planNameClean(p.fixes.map((x) => applyNameFix(x.member, x.fix))).fixes).toHaveLength(0)
  })
})
