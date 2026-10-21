import { describe, expect, it } from 'vitest'
import { cleanTeam } from './WorkTeam'

describe('รายชื่อผู้รับผิดชอบ', () => {
  it('ตัดช่องว่าง ทิ้งแถวว่าง และคงลำดับ', () => {
    expect(cleanTeam([{ role: ' เลขา ', name: ' ก ' }, { role: '', name: '' }, { role: 'รอง', name: 'ข' }, { role: '  ', name: '  ' }])).toEqual([{ role: 'เลขา', name: 'ก' }, { role: 'รอง', name: 'ข' }])
  })
})
