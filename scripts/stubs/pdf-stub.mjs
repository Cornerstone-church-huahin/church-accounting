// พรีวิวไฟล์เดียวไม่รวมตัวสร้าง PDF (ใหญ่) — ใช้ได้เฉพาะบนเว็บจริง
const no = () => { throw new Error('ตัวสร้าง PDF ใช้ได้เฉพาะบนเว็บจริง ไม่มีในพรีวิว') }
export default no
export const jsPDF = function () { no() }
