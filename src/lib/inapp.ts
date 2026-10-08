/**
 * เบราว์เซอร์ในแอป (Line, Facebook, Instagram ฯลฯ) มีแถบชื่อเว็บ/ลิงก์ของตัวเองครอบอยู่ ซึ่งโค้ดของเว็บลบไม่ได้
 * และติดตั้งเป็นแอปไม่ได้ → แนะนำให้เปิดใน Chrome แล้วติดตั้ง (เปิดจากไอคอนจะเต็มจอ ไม่มีแถบ)
 */
const RX = /Line\/|FBAN|FBAV|FB_IAB|Instagram|MicroMessenger|KAKAOTALK|Twitter/i
export const isInAppBrowser = (ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent) => RX.test(ua)
export const isAndroid = (ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent) => /Android/i.test(ua)

/** ลิงก์ที่ Line เปิดใน “เบราว์เซอร์หลักของเครื่อง” (ตัวช่วยของ Line: openExternalBrowser=1) */
export function lineExternalUrl(href: string): string {
  const u = new URL(href)
  u.searchParams.set('openExternalBrowser', '1')
  return u.toString()
}
/** Android: ลิงก์ที่สั่งเปิด Chrome โดยตรง (ถ้าไม่มี Chrome จะกลับมาที่ลิงก์เดิม) */
export function chromeIntentUrl(href: string): string {
  const u = new URL(href)
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(href)};end`
}
