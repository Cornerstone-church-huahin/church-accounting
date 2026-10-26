import { describe, expect, it } from 'vitest'
import { applyWizard, looksLikeActivity, actDays, actEnded, actAccount, actSubIds, addActivity, addGoal, enableActivities, goalProgress, lockedSubIds, sortedActs, toggleGoal, validScore } from './fundActs'
import type { FundAccount } from './fundAccounts'
import type { IncomeType } from './types'

const t = { id: 'f', name: 'กองทุนกิจกรรม', order: 1, active: true, updated: 1, actMode: true,
  activities: [{ id: 'a1', name: 'ขอบคุณพระเจ้า', date: '2026-10-25' }, { id: 'a2', name: 'คริสต์มาส', date: '2026-12-25', closed: { date: '2026-12-27' }, goals: [{ id: 'g1', text: 'จองสถานที่', done: true }, { id: 'g2', text: 'เตรียมอาหาร', done: false }] }],
  subs: [{ id: 'v', name: 'พืชผัก', active: true, order: 1, actId: 'a1' }, { id: 'c', name: 'อาหาร', active: true, order: 2, actId: 'a2' }] } as IncomeType
const f = { id: 'f', name: 'x', opening: 0, moves: [{ key: '1', date: '2026-10-25', label: '', amount: 5000, subId: 'v' }, { key: '2', date: '2026-10-25', label: '', amount: -2000, subId: 'v' }, { key: '3', date: '2026-12-25', label: '', amount: 900, subId: 'c' }], moneyIn: 5900, moneyOut: 2000, balance: 3900 } as FundAccount

describe('fundActs', () => {
  it('กิจกรรมใหม่อยู่บนสุด', () => expect(sortedActs(t).map((a) => a.id)).toEqual(['a2', 'a1']))
  it('ยอดของกิจกรรมรวมเฉพาะหมวดของกิจกรรมนั้น', () => {
    expect(actAccount(f, actSubIds(t, 'a1'))).toMatchObject({ moneyIn: 5000, moneyOut: 2000, balance: 3000 })
    expect(actAccount(f, actSubIds(t, 'a2')).balance).toBe(900)
  })
  it('หมวดของกิจกรรมที่ปิดแล้วถูกล็อก', () => expect(lockedSubIds(t)).toEqual(['c']))
  it('เพิ่มกิจกรรม: ตรวจชื่อ/วันที่/ซ้ำ', () => {
    expect(addActivity(t, ' ', '2026-01-01')).toEqual({ error: 'พิมพ์ชื่อกิจกรรม' })
    expect(addActivity(t, 'งาน', 'x')).toEqual({ error: 'เลือกวันที่เริ่มกิจกรรม' })
    expect(addActivity(t, 'ขอบคุณพระเจ้า', '2026-10-25')).toEqual({ error: 'มีกิจกรรมชื่อและวันที่นี้แล้ว' })
    const r = addActivity(t, 'อีสเตอร์', '2027-04-05'); expect('activities' in r && r.activities).toHaveLength(3)
  })
  it('เปิดโหมดกิจกรรม: หมวดเดิมย้ายเข้ากิจกรรมแรก', () => {
    const plain = { ...t, actMode: undefined, activities: undefined, subs: t.subs!.map(({ actId: _a, ...s }) => s) } as IncomeType
    const r = enableActivities(plain, 'ขอบคุณพระเจ้า', '2026-10-25')
    expect('error' in r).toBe(false)
    const p = r as Partial<IncomeType>
    expect(p.activities).toHaveLength(1)
    expect(p.subs!.every((s) => s.actId === p.activities![0].id)).toBe(true)
    expect(enableActivities({ ...plain, subs: [] } as IncomeType, 'x', '2026-01-01')).toMatchObject({ actMode: true })
  })
  it('เป้าหมายของงาน: เพิ่ม ติ๊กทำแล้ว/ยังไม่ทำ และความคืบหน้า', () => {
    const a2 = t.activities![1]
    expect(goalProgress(a2)).toEqual({ done: 1, total: 2, pct: 50 })
    expect(goalProgress(t.activities![0])).toEqual({ done: 0, total: 0, pct: 0 })
    expect(addGoal(a2, '  ')).toEqual({ error: 'พิมพ์เป้าหมายหรือขั้นตอนของงาน' })
    const g = addGoal(a2, 'ซ้อมดนตรี'); expect(Array.isArray(g) && g).toHaveLength(3)
    const tg = toggleGoal(a2, 'g2', '2026-12-01'); expect(tg.find((x) => x.id === 'g2')).toMatchObject({ done: true, doneDate: '2026-12-01' })
    expect(toggleGoal({ ...a2, goals: tg }, 'g2', 'x').find((x) => x.id === 'g2')?.done).toBe(false)
  })
  it('คะแนนความพึงพอใจ 0–100', () => { expect(validScore(0) && validScore(100) && validScore(85)).toBe(true); expect(validScore(101) || validScore(-1) || validScore(NaN)).toBe(false) })
  it('จำนวนวันและสถานะสิ้นสุด: ผ่านวันสิ้นสุดแล้วเป็นสีเทา', () => {
    expect(actDays({ date: '2026-12-24' })).toBe(1)
    expect(actDays({ date: '2026-12-24', endDate: '2026-12-26' })).toBe(3)
    const a = { id: 'x', name: 'x', date: '2026-12-24', endDate: '2026-12-26' }
    expect(actEnded(a, '2026-12-26')).toBe(false)
    expect(actEnded(a, '2026-12-27')).toBe(true)
    expect(actEnded({ ...a, closed: { date: '2026-12-25' } }, '2026-12-25')).toBe(true)
    expect(actEnded({ id: 'y', name: 'y', date: '2026-12-24' }, '2026-12-25')).toBe(true) // ไม่มีวันสิ้นสุด = วันเดียว
  })
  it('วันสิ้นสุดต้องไม่ก่อนวันเริ่ม', () => {
    expect(addActivity(t, 'งานใหม่', '2027-01-10', '2027-01-09')).toEqual({ error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มกิจกรรม' })
    const r = addActivity(t, 'งานใหม่', '2027-01-10', '2027-01-12'); expect('activities' in r && r.activities.at(-1)?.endDate).toBe('2027-01-12')
  })
  it('ตัวช่วยแบ่งเป็นกิจกรรม: หมวดชื่อกิจกรรมแปลงเป็นกิจกรรมเอง หมวดอื่นย้ายตามที่เลือก', () => {
    expect(looksLikeActivity('วันคริสต์มาส') && looksLikeActivity('งานอีสเตอร์') && !looksLikeActivity('พืชผัก')).toBe(true)
    const base = { id: 'f', name: 'กองทุนกิจกรรม', order: 1, active: true, updated: 1, subs: [
      { id: 'v', name: 'พืชผัก', active: true, order: 1 }, { id: 'tg', name: 'วันขอบคุณพระเจ้า', active: true, order: 2 }, { id: 'xm', name: 'วันคริสต์มาส', active: true, order: 3 }] } as IncomeType
    const rows = [{ key: 'a', name: 'วันขอบคุณพระเจ้า', date: '2026-10-25', selfSub: 'tg' }, { key: 'b', name: 'วันคริสต์มาส', date: '2026-12-25', selfSub: 'xm' }]
    const r = applyWizard(base, rows, { v: 'a' }) as Partial<IncomeType>
    expect(r.activities).toHaveLength(2)
    const [aTg, aXm] = r.activities!
    const byId = Object.fromEntries(r.subs!.map((s) => [s.id, s]))
    expect(byId.v.actId).toBe(aTg.id)
    expect(byId.tg).toMatchObject({ actId: aTg.id, name: 'รายการทั่วไป' })
    expect(byId.xm).toMatchObject({ actId: aXm.id, name: 'รายการทั่วไป' })
    expect(applyWizard(base, [], {})).toEqual({ error: 'ต้องมีอย่างน้อย 1 กิจกรรม' })
    expect(applyWizard(base, [{ key: 'z', name: ' ', date: '2026-01-01' }], {})).toEqual({ error: 'พิมพ์ชื่อกิจกรรมให้ครบทุกแถว' })
  })
})
