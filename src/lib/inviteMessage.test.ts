import { describe, expect, it } from 'vitest'
import { buildInstallOnlyMessage, buildInviteMessage, installUrlOf } from './inviteMessage'

describe('ข้อความเชิญ 2 ขั้น', () => {
  const m = buildInviteMessage({ forName: 'สมชาย', installUrl: 'https://x/app/?openExternalBrowser=1#/install', inviteUrl: 'https://x/app/#/join?t=abc' })
  it('มีขั้น ① ติดตั้ง (ลิงก์ติดตั้ง + วิธี Android/iPhone) และขั้น ② เชิญ (ลิงก์เชิญ) เรียงตามลำดับ', () => {
    expect(m.indexOf('① ')).toBeLessThan(m.indexOf('② '))
    expect(m).toContain('(ถึง สมชาย)')
    expect(m).toMatch(/Android.*iPhone/)
    expect(m.indexOf('#/install')).toBeLessThan(m.indexOf('#/join'))
  })
  it('ไม่ใส่ชื่อ = ไม่มีวงเล็บ · ลิงก์ติดตั้งมี openExternalBrowser (เปิดนอกแอป LINE)', () => {
    expect(buildInviteMessage({ installUrl: 'a', inviteUrl: 'b' })).not.toContain('(ถึง')
    expect(installUrlOf('https://x', '/app/')).toBe('https://x/app/?openExternalBrowser=1#/install')
    expect(buildInstallOnlyMessage('u')).toContain('\nu')
  })
})
