/** อ่านไฟล์ Excel (.xlsx) เป็นตารางข้อความ · โหลดไลบรารีเมื่อใช้เท่านั้น (ไม่เพิ่มขนาดหน้าแรก) */
export async function readXlsxRows(file: File): Promise<string[][]> {
  const { default: readXlsxFile } = await import('read-excel-file')
  const rows = await readXlsxFile(file) // ชีตแรก
  const pad = (n: number) => String(n).padStart(2, '0')
  return rows.map((r) => r.map((c) => {
    if (c == null) return ''
    // วันที่ใน Excel: เก็บเป็น วันที่-เวลาในเขตเวลาของเครื่อง · ปี พ.ศ. (> 2400) แปลงตอนวิเคราะห์ที่ parseDateCell
    if (c instanceof Date) return `${c.getUTCFullYear()}-${pad(c.getUTCMonth() + 1)}-${pad(c.getUTCDate())}`
    return String(c)
  }))
}
