/** แปลงส่วนของหน้าเว็บ (ใบสรุป) เป็นไฟล์ PDF A4 ในเครื่อง — โหลดไลบรารีเมื่อกดครั้งแรกเท่านั้น */
/** fullPage: ใช้ทั้งหน้า A4 ตามขนาด 794×1123 px ของ element (ไม่เว้นขอบ ไม่ตัดหน้า) */
export async function downloadPdf(el: HTMLElement, filename: string, opts: { fullPage?: boolean; fitOnePage?: boolean } = {}): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    ignoreElements: (e) => e.classList?.contains('no-print') ?? false,
    // จัดหน้าให้กว้างพอสำหรับกระดาษ ไม่ใช่ความกว้างของมือถือ
    onclone: (_doc, cloned) => { cloned.style.width = opts.fullPage ? '794px' : '720px'; cloned.style.maxWidth = cloned.style.width; cloned.style.boxShadow = 'none'; cloned.style.position = 'static'; cloned.style.transform = 'none'; cloned.style.left = 'auto'; cloned.style.top = 'auto' },
  })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  if (opts.fullPage) {
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight())
    pdf.save(filename)
    return
  }
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 12
  const w = pw - 2 * m
  if (opts.fitOnePage) {
    // ย่อให้พอดี 1 หน้า (ถ้าสูงเกิน) จัดกึ่งกลาง
    const hFull = (canvas.height * w) / canvas.width, hMax = ph - 2 * m
    const k = Math.min(1, hMax / hFull)
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', m + (w - w * k) / 2, m, w * k, hFull * k)
    pdf.save(filename)
    return
  }
  const sliceH = Math.floor(((ph - 2 * m) * canvas.width) / w) // ความสูงต่อหน้า (px ของแคนวาส)
  for (let y = 0, page = 0; y < canvas.height; y += sliceH, page++) {
    const h = Math.min(sliceH, canvas.height - y)
    const part = document.createElement('canvas')
    part.width = canvas.width; part.height = h
    part.getContext('2d')?.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h)
    if (page > 0) pdf.addPage()
    pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', m, m, w, (h * w) / canvas.width)
  }
  pdf.save(filename)
}
