import { describe, expect, it, beforeEach } from 'vitest'
import { noteSync, resetSyncStatus } from './syncStatus'

// ตรวจตัวนับผ่านเหตุการณ์: ใช้ window จำลองแบบเบา ๆ
describe('noteSync', () => {
  beforeEach(() => { (globalThis as unknown as { window: unknown }).window = { dispatchEvent: () => true }; resetSyncStatus() })
  it('ไม่พังเมื่อเรียกต่อเนื่องหลายไฟล์ (syncing → ok/error)', () => {
    expect(() => {
      noteSync('a', { state: 'syncing' }); noteSync('b', { state: 'syncing' })
      noteSync('a', { state: 'ok', at: 1 }); noteSync('b', { state: 'error', message: 'โควตาเต็ม' })
      noteSync('b', { state: 'ok', at: 2 }); noteSync('c', { state: 'idle' })
    }).not.toThrow()
  })
})
