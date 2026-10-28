/** ข้อความเชิญสมาชิก: ขั้น ① ติดตั้งแอป (ลิงก์ติดตั้งเดียว ตรวจ Android/iPhone ให้เอง) · ขั้น ② เปิดจากไอคอนแล้ววางลิงก์เชิญ */
export const installUrlOf = (origin: string, pathname: string) => `${origin}${pathname}?openExternalBrowser=1#/install`

export function buildInviteMessage(o: { forName?: string; installUrl: string; inviteUrl: string; level?: string }): string {
  const who = o.forName?.trim() ? ` (ถึง ${o.forName.trim()})` : ''
  return [
    `ขอเชิญร่วมใช้แอปบัญชีคริสตจักร${who}`,
    ...(o.level ? [`ระดับการใช้งานที่ตั้งไว้ให้: ${o.level}`] : []),
    '',
    '① ติดตั้งแอป (ทำครั้งเดียว) — เปิดลิงก์นี้แล้วทำตามหน้าจอ',
    'Android: กดปุ่ม “ติดตั้งแอป” · iPhone: เปิดด้วย Safari แล้วกดแชร์ ▸ เพิ่มลงหน้าจอโฮม',
    o.installUrl,
    '',
    '② เปิดแอปจากไอคอนที่ติดตั้ง แตะปุ่มรีเฟรช 🔄 มุมขวาบน แล้ววางลิงก์เชิญนี้ → พิมพ์ชื่อของท่านเพื่อส่งคำขอ (แอดมินอนุมัติแล้วจึงใช้ได้)',
    o.inviteUrl,
  ].join('\n')
}
export const buildInstallOnlyMessage = (installUrl: string) => `ติดตั้งแอปบัญชีคริสตจักร — เปิดลิงก์นี้แล้วทำตามหน้าจอ (Android กดปุ่ม “ติดตั้งแอป” · iPhone เปิดด้วย Safari แล้วกดแชร์ ▸ เพิ่มลงหน้าจอโฮม):\n${installUrl}`
