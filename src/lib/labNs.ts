import { createContext, useContext } from 'react'

/** ชุดข้อมูลของหน้าตารางเยี่ยมรุ่นใหม่: '-lab' = แท็บทดลอง (ข้อมูลแยก) · '' = ข้อมูลจริง (แท็บ 4 งานเยี่ยมใหม่) */
export const VisitNs = createContext<string>('-lab')
export const useVisitNs = () => useContext(VisitNs)
