import { describe, expect, it } from 'vitest'
import { paginate } from './paginate'

describe('paginate', () => {
  it('แบ่งหน้า', () => { expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]) })
  it('ว่าง = 1 หน้าว่าง', () => { expect(paginate([], 3)).toEqual([[]]) })
})
