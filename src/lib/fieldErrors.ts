/**
 * กรอบแดงบอกว่าไม่ผ่านตรงไหน (ทั้งแอป): เมื่อมีข้อความผิดพลาด (role="alert") โผล่ในฟอร์ม
 * ระบบหาช่องที่ข้อความนั้นพูดถึง (เทียบกับป้ายชื่อช่อง) แล้วทำกรอบแดง + ข้อความใต้ช่อง + เลื่อนมาให้เห็น · แก้ช่องนั้นเมื่อไรกรอบแดงหายเอง
 * ข้อความที่ไม่เกี่ยวกับช่องใด (เช่น ไม่มีสิทธิ์ ออฟไลน์) ไม่ทำกรอบ
 */
export interface FieldCandidate { label: string; empty: boolean }

const PUNCT = /[\s()[\]{}:;,.·…“”"'/\\\-–—_*•|!?]+/g
export const squash = (s: string) => s.replace(PUNCT, '')

/** ความยาวข้อความร่วมที่ยาวที่สุดของสองข้อความ (นับเป็นตัวอักษร) */
export function lcs(a: string, b: string): number {
  if (!a || !b) return 0
  let best = 0
  let prev = new Array<number>(b.length + 1).fill(0)
  for (let i = 1; i <= a.length; i++) {
    const cur = new Array<number>(b.length + 1).fill(0)
    for (let j = 1; j <= b.length; j++) if (a[i - 1] === b[j - 1]) { cur[j] = prev[j - 1] + 1; if (cur[j] > best) best = cur[j] }
    prev = cur
  }
  return best
}

const MIN_MATCH = 4
const INVALID = /ไม่(ถูกต้อง|อยู่|เกิน|ครบ|ตรง|ซ้ำ|ผ่าน|พอ)|เกิน|ซ้ำ|ใหญ่เกิน|ต้อง/
/**
 * เลือกช่องที่ข้อความผิดพลาดพูดถึง: คะแนน = ความยาวข้อความร่วมกับป้ายชื่อช่อง (≥ 4 ตัวอักษร)
 * ช่องที่ยังว่างได้ก่อน (ข้อความทำนอง "ใส่…/เลือก…") · ถ้าไม่มีช่องว่างที่ตรง ใช้ช่องคะแนนสูงสุดเฉพาะข้อความที่บอกว่า "ไม่ถูกต้อง/เกิน/ซ้ำ"
 * คืนดัชนีของช่อง หรือ -1 = ไม่ทำกรอบ
 */
export function pickField(message: string, fields: FieldCandidate[]): number {
  const m = squash(message)
  let bestEmpty = -1, bestEmptyScore = 0, bestAny = -1, bestAnyScore = 0
  fields.forEach((f, i) => {
    const sc = lcs(m, squash(f.label))
    if (sc < MIN_MATCH) return
    if (f.empty && sc > bestEmptyScore) { bestEmpty = i; bestEmptyScore = sc }
    if (sc > bestAnyScore) { bestAny = i; bestAnyScore = sc }
  })
  if (bestEmpty >= 0 && /^(ใส่|เลือก|กรอก|ระบุ|พิมพ์|ลงชื่อ|แนบ)/.test(message.trim())) return bestEmpty
  if (bestEmpty >= 0) return bestEmpty
  return bestAny >= 0 && INVALID.test(message) ? bestAny : -1
}

// ---------- ส่วนที่ทำงานกับหน้าเว็บ ----------
const CONTROLS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select'
const marks = new WeakMap<Element, { ctrl: HTMLElement; note: HTMLElement }[]>()

const labelOf = (c: HTMLElement): string => {
  const parts = [c.getAttribute('aria-label') ?? '', c.getAttribute('placeholder') ?? '']
  const id = c.id
  if (id) { const l = c.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`); if (l) parts.push(l.textContent ?? '') }
  const wrap = c.closest('label'); if (wrap) parts.push(wrap.textContent ?? '')
  const field = c.closest('.field'); const fl = field?.querySelector('label'); if (fl) parts.push(fl.textContent ?? '')
  return parts.join(' ')
}
const isEmpty = (c: HTMLElement): boolean => {
  if (c instanceof HTMLInputElement && c.type === 'file') return !c.files?.length
  const v = (c as HTMLInputElement).value.trim()
  return v === '' || (c.classList.contains('input--money') && /^0([.,]0+)?$/.test(v))
}
const visible = (c: HTMLElement) => c.offsetParent !== null || c.getClientRects().length > 0

function clearMarks(alert: Element) {
  for (const m of marks.get(alert) ?? []) { m.ctrl.removeAttribute('aria-invalid'); m.note.remove() }
  marks.delete(alert)
}

function apply(alert: HTMLElement) {
  clearMarks(alert)
  if (alert.classList.contains('role-toast')) return
  // ข้อความผิดพลาดหลายข้อ (บรรทัดละข้อ) → ทำกรอบแดงทุกช่องที่ผิดพร้อมกัน
  const msgs = (alert.textContent ?? '').split('\n').map((x) => x.trim()).filter(Boolean)
  const scope = alert.closest('[role=dialog], .sheet, form, .card, section') ?? alert.parentElement
  if (!msgs.length || !scope) return
  const ctrls = [...scope.querySelectorAll<HTMLElement>(CONTROLS)].filter((c) => visible(c) && !alert.contains(c) && !c.hasAttribute('data-no-field-error'))
  const used = new Set<HTMLElement>()
  const made: { ctrl: HTMLElement; note: HTMLElement }[] = []
  for (const msg of msgs) {
    const free = ctrls.filter((c) => !used.has(c))
    const i = pickField(msg, free.map((c) => ({ label: labelOf(c), empty: isEmpty(c) })))
    if (i < 0) continue
    const ctrl = free[i]
    used.add(ctrl)
    ctrl.setAttribute('aria-invalid', 'true')
    const note = document.createElement('p')
    note.className = 'field-err'; note.setAttribute('data-field-err', ''); note.textContent = `⚠ ${msg}`
    ctrl.after(note)
    made.push({ ctrl, note })
  }
  if (!made.length) return
  marks.set(alert, made)
  const first = made.map((m) => m.ctrl).sort((x, y) => x.getBoundingClientRect().top - y.getBoundingClientRect().top)[0]
  first.scrollIntoView({ block: 'center', behavior: 'smooth' })
  if (!(first instanceof HTMLInputElement && first.type === 'file')) first.focus({ preventScroll: true })
}

let installed = false
/** ติดตั้งครั้งเดียวทั้งแอป */
export function installFieldErrors() {
  if (installed || typeof document === 'undefined') return
  installed = true
  let queued = false
  const seen = new WeakMap<Element, string>()
  const scan = () => {
    queued = false
    document.querySelectorAll<HTMLElement>('[role=alert]').forEach((a) => {
      const t = a.textContent ?? ''
      if (seen.get(a) !== t) { seen.set(a, t); apply(a) }
    })
    // ข้อความผิดพลาดหายไป = เอากรอบแดงออก
    document.querySelectorAll<HTMLElement>('[data-field-err]').forEach((n) => { if (![...document.querySelectorAll('[role=alert]')].some((a) => marks.get(a)?.some((m) => m.note === n))) { n.previousElementSibling?.removeAttribute('aria-invalid'); n.remove() } })
  }
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(scan) } }).observe(document.body, { childList: true, subtree: true, characterData: true })
  // แก้ช่องที่ติดกรอบแดงแล้ว กรอบหายทันที
  const fix = (e: Event) => {
    const t = e.target as HTMLElement | null
    if (!t || t.getAttribute?.('aria-invalid') !== 'true') return
    t.removeAttribute('aria-invalid')
    if (t.nextElementSibling?.hasAttribute('data-field-err')) t.nextElementSibling.remove()
  }
  document.addEventListener('input', fix, true)
  document.addEventListener('change', fix, true)
}
