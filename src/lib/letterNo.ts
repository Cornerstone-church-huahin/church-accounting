/** เลขที่หนังสือแจ้งประชุม: ตัวย่อ + เลขลำดับ 3 หลัก (ศอ/ปด.001) */
export const padNo = (pre: string, n: number) => `${pre}.${String(n).padStart(3, '0')}`
/** เลขลำดับท้ายเลขที่ (ศอ/ปด.007 → 7) · ไม่มี = 0 */
export const noDigits = (no: string | undefined) => Number(/(\d+)\s*$/.exec((no ?? '').trim())?.[1] ?? 0)
