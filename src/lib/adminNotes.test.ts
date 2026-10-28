import { describe, expect, it } from 'vitest'
import { nextStatus, relief } from './adminNotes'

describe('relief', () => {
  it('ว่าง = 0%', () => expect(relief([])).toEqual({ pct: 0, done: 0, total: 0, hoursSaved: 0, hoursAll: 0 }))
  it('ถ่วงน้ำหนัก: แบ่งเบาแล้ว 5 + บางส่วน 5 จาก 20 = 38%', () => {
    const r = relief([{ weight: 5, status: 'done', hours: 4 }, { weight: 5, status: 'part', hours: 2 }, { weight: 10, status: 'todo', hours: 10 }])
    expect(r.pct).toBe(38); expect(r.done).toBe(1); expect(r.hoursSaved).toBe(5); expect(r.hoursAll).toBe(16)
  })
  it('ไม่ใส่น้ำหนัก = เท่ากันทุกรายการ', () => expect(relief([{ status: 'done' }, { status: 'todo' }]).pct).toBe(50))
  it('วนสถานะ', () => { expect(nextStatus(undefined)).toBe('part'); expect(nextStatus('part')).toBe('done'); expect(nextStatus('done')).toBe('todo') })
})
