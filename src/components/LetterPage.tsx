import { forwardRef, type ReactNode } from 'react'
import ScaledPage from './ScaledPage'
import { useLetterhead, useSettings } from '../lib/data'
import { useStoredUrl } from '../lib/useStoredUrl'

/**
 * หน้ากระดาษ A4 หัวจดหมายของคริสตจักร: หัว (รูป) บนสุด · เนื้อหาตรงกลาง · ท้าย (รูป) ล่างสุด + เครดิตผู้พัฒนาท้ายหน้า
 * ยังไม่ได้ตั้งหัวจดหมาย = ใช้หัวข้อความชื่อคริสตจักรไปก่อน (แอดมินตั้งรูปหัว/ท้ายได้ที่ปุ่ม “ตั้งค่าหัวจดหมาย”)
 */
const LetterPage = forwardRef<HTMLDivElement, { children: ReactNode }>(function LetterPage({ children }, ref) {
  const lh = useLetterhead().value
  const { settings } = useSettings()
  const head = useStoredUrl(lh?.header?.path), foot = useStoredUrl(lh?.footer?.path)
  return (
    <ScaledPage ref={ref} className="a4page a4page--letter">
      <div className="letter">
        <header className="letter__head">
          {head ? <img src={head} alt="หัวจดหมาย" /> : <div className="letter__fallback"><b>{settings.churchName}</b></div>}
        </header>
        <div className="letter__body">{children}</div>
        {foot && <footer className="letter__foot"><img src={foot} alt="ท้ายจดหมาย" /></footer>}
      </div>
    </ScaledPage>
  )
})
export default LetterPage
