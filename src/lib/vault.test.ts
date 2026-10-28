import { describe, expect, it } from 'vitest'
import { decryptJson, deriveKey, encryptJson, exportKey, importKey, makeCheck, randomSalt, verifyKey } from './vault'

describe('vault', () => {
  it('เข้ารหัสแล้วถอดกลับได้ด้วยรหัสเดิม และข้อความที่เก็บอ่านไม่ออก', async () => {
    const salt = randomSalt(), key = await deriveKey('รหัส123456', salt)
    const blob = await encryptJson(key, { title: 'ส่งเอกสารเทศบาล', weight: 5 })
    expect(blob).not.toContain('เทศบาล')
    expect(await decryptJson(await deriveKey('รหัส123456', salt), blob)).toEqual({ title: 'ส่งเอกสารเทศบาล', weight: 5 })
  })
  it('รหัสผิดถอดไม่ได้ · ตรวจรหัสด้วย check', async () => {
    const salt = randomSalt(), key = await deriveKey('right-pass', salt), check = await makeCheck(key)
    expect(await verifyKey(await deriveKey('right-pass', salt), check)).toBe(true)
    expect(await verifyKey(await deriveKey('wrong-pass', salt), check)).toBe(false)
    await expect(decryptJson(await deriveKey('wrong-pass', salt), await encryptJson(key, { a: 1 }))).rejects.toBeTruthy()
  })
  it('ส่งออก/นำเข้ากุญแจ (เก็บชั่วคราวระหว่างเปิดแอป)', async () => {
    const key = await deriveKey('p@ssw0rd', randomSalt()), blob = await encryptJson(key, [1, 2, 3])
    expect(await decryptJson(await importKey(await exportKey(key)), blob)).toEqual([1, 2, 3])
  })
  it('การเข้ารหัสแต่ละครั้งไม่เหมือนกัน (iv สุ่ม)', async () => {
    const key = await deriveKey('same', randomSalt())
    expect(await encryptJson(key, 'x')).not.toBe(await encryptJson(key, 'x'))
  })
})
