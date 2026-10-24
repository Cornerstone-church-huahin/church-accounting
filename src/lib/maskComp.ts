import { fmtBaht } from './money'
import { COMP_LABEL } from './maskPay'

const m = (x: number) => fmtBaht(x, { dec: x % 100 !== 0 })
const setText = (el: Element, text: string, undo: (() => void)[]) => {
  const kids = [...el.childNodes]
  undo.push(() => el.replaceChildren(...kids))
  el.textContent = text
}
const hide = (el: HTMLElement, undo: (() => void)[]) => { const d = el.style.display; undo.push(() => { el.style.display = d }); el.style.display = 'none' }

/**
 * ตอนพิมพ์/ส่งออก PDF/แชร์: รวมแถวเงินเดือน/สวัสดิการ/ค่าตอบแทน (แถวที่ติด data-comp + data-amt) ของแต่ละตารางเป็นแถวเดียว ไม่ระบุรายคน
 * แล้วเรียงลำดับที่ใหม่ · รายการ "ต้องเบิก" (data-pcomp) รวมเป็นรายการเดียวเช่นกัน · คืนฟังก์ชันย้อนกลับ (หน้าจอในแอปยังเห็นรายคน)
 */
export function mergeCompRows(root: ParentNode): () => void {
  const undo: (() => void)[] = []
  root.querySelectorAll('tbody').forEach((tb) => {
    const rows = [...tb.querySelectorAll<HTMLElement>(':scope > tr[data-comp]')]
    if (rows.length === 0 || tb.closest('[data-keep]')) return
    const total = rows.reduce((s, r) => s + Number(r.dataset.amt ?? 0), 0)
    rows[0].querySelectorAll('td').forEach((td) => {
      const c = td.dataset.c
      if (c === 'desc') setText(td, COMP_LABEL, undo)
      else if (c === 'amt') setText(td, m(total), undo)
      else if (c === 'x') setText(td, '', undo)
    })
    rows.slice(1).forEach((r) => hide(r, undo))
    let n = 0
    tb.querySelectorAll<HTMLElement>(':scope > tr').forEach((r) => {
      if (r.style.display === 'none') return
      const no = r.querySelector('td[data-c="no"]')
      if (no) setText(no, String(++n), undo)
    })
  })
  const pend = [...root.querySelectorAll<HTMLElement>('[data-pcomp]')]
  if (pend.length > 0) {
    const total = pend.reduce((s, r) => s + Number(r.dataset.amt ?? 0), 0)
    const d = pend[0].querySelector('[data-c="desc"]'), a = pend[0].querySelector('[data-c="amt"]')
    if (d) setText(d, COMP_LABEL, undo)
    if (a) setText(a, m(total), undo)
    pend.slice(1).forEach((r) => hide(r, undo))
  }
  return () => undo.reverse().forEach((f) => f())
}

/** ติดตัวรับเหตุการณ์พิมพ์ของเบราว์เซอร์ (ปุ่มพิมพ์/Ctrl+P): รวมแถวก่อนพิมพ์ แล้วคืนค่าหลังพิมพ์ */
export function installPrintMask(): void {
  let undo: (() => void) | null = null
  window.addEventListener('beforeprint', () => { undo?.(); undo = mergeCompRows(document.body) })
  window.addEventListener('afterprint', () => { undo?.(); undo = null })
}
