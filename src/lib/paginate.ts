/** แบ่งรายการเป็นหน้าๆ ละ perPage (อย่างน้อย 1 หน้าเสมอ แม้ว่าง) */
export function paginate<T>(items: T[], perPage: number): T[][] {
  const n = Math.max(1, Math.floor(perPage))
  const out: T[][] = []
  for (let i = 0; i < items.length; i += n) out.push(items.slice(i, i + n))
  return out.length ? out : [[]]
}
