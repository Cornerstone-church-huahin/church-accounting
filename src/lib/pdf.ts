/** แปลงส่วนของหน้าเว็บ (ใบสรุป) เป็นไฟล์ PDF A4 ในเครื่อง — โหลดไลบรารีเมื่อกดครั้งแรกเท่านั้น */
export async function downloadPdf(el: HTMLElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])
  const canvas = await html2canvas(el, {
    scale: 2,
    backgroundColor: '#ffffff',
    ignoreElements: (e) => e.classList?.contains('no-print') ?? false,
    // จัดหน้าให้กว้างพอสำหรับกระดาษ ไม่ใช่ความกว้างของมือถือ
    onclone: (_doc, cloned) => { cloned.style.width = '720px'; cloned.style.maxWidth = '720px'; cloned.style.boxShadow = 'none'; cloned.style.position = 'static'; cloned.style.left = 'auto'; cloned.style.top = 'auto' },
  })
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 12
  const w = pw - 2 * m
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
