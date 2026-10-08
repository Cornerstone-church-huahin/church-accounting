import { HashRouter, MemoryRouter, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import Home from './pages/Home'
import Income from './pages/Income'
import Rounds from './pages/Rounds'
import RoundDetail from './pages/RoundDetail'
import Statement from './pages/Statement'
import Vouchers from './pages/Vouchers'
import VoucherDetail from './pages/VoucherDetail'
import Budget from './pages/Budget'
import Reports from './pages/Reports'
import More from './pages/More'
import Settings from './pages/Settings'
import Join from './pages/Join'

// HashRouter: ใช้ได้บนทุก Static Hosting (GitHub Pages) โดยไม่ต้องตั้งค่า rewrite
// MemoryRouter: ใช้เฉพาะไฟล์พรีวิว (npm run build:preview) ที่เปิดในกรอบซึ่งไม่มี URL จริง
const Router = import.meta.env.VITE_EMBED ? MemoryRouter : HashRouter

export default function App() {
  return (
    <Router>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          <Route path="income" element={<Income />} />
          <Route path="rounds" element={<Rounds />} />
          <Route path="rounds/statement" element={<Statement />} />
          <Route path="rounds/:date" element={<RoundDetail />} />
          <Route path="vouchers" element={<Vouchers />} />
          <Route path="vouchers/:id" element={<VoucherDetail />} />
          <Route path="budget" element={<Budget />} />
          <Route path="reports" element={<Reports />} />
          <Route path="more" element={<More />} />
          <Route path="settings" element={<Settings />} />
          <Route path="join" element={<Join />} />
          <Route path="*" element={<p className="empty">ไม่พบหน้านี้</p>} />
        </Route>
      </Routes>
    </Router>
  )
}
