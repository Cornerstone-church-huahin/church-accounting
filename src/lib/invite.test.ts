import { describe, expect, it } from 'vitest'
import { parseInviteLink } from './invite'

describe('parseInviteLink', () => {
  const link = 'https://cornerstone-church-huahin.github.io/church-accounting/?openExternalBrowser=1#/join?t=github_pat_AbC123_x&role=bookkeeper&for=%E0%B8%9B%E0%B8%B4%E0%B9%8B%E0%B8%A1'
  it('ดึงพารามิเตอร์จากลิงก์เปล่า', () => expect(parseInviteLink(link)).toBe('t=github_pat_AbC123_x&role=bookkeeper&for=%E0%B8%9B%E0%B8%B4%E0%B9%8B%E0%B8%A1'))
  it('ดึงจากข้อความทั้งก้อนที่แอดมินแชร์ (มีข้อความรอบลิงก์)', () => {
    expect(parseInviteLink(`ขอเชิญร่วมใช้แอปบัญชีคริสตจักร (ถึง ปิ๋ม) — เปิดลิงก์นี้:\n${link}\nขอบคุณครับ`)).toContain('t=github_pat_AbC123_x')
  })
  it('ไม่ใช่ลิงก์เชิญ/ไม่มีรหัส = null', () => {
    expect(parseInviteLink('https://example.com/#/home')).toBeNull()
    expect(parseInviteLink('https://x/#/join?role=viewer')).toBeNull()
    expect(parseInviteLink('')).toBeNull()
  })
})
