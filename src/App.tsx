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
import Land from './pages/Land'
import Notes from './pages/Notes'
import Meeting from './pages/Meeting'
import FundAccountsPage from './pages/FundAccounts'
import FundDetailPage from './pages/FundDetail'
import BalancePage from './pages/Balance'
import Reports from './pages/Reports'
import More from './pages/More'
import Members from './pages/Members'
import DetailGate from './components/DetailGate'
import Settings from './pages/Settings'
import Join from './pages/Join'

// HashRouter: ใช้ได้บนทุก Static Hosting (GitHub Pages) โดยไม่ต้องตั้งค่า rewrite
// MemoryRouter: ใช้เฉพาะไฟล์พรีวิว (npm run build:preview) ที่เปิดในกรอบซึ่งไม่มี URL จริง
const Router = import.meta.env.VITE_EMBED ? MemoryRouter : HashRouter
// พรีวิวเปิดที่หน้าที่ระบุได้: VITE_START=/members npm run build:preview
const startAt = (import.meta.env.VITE_START as string | undefined) || '/'

export default function App() {
  return (
    <Router {...(import.meta.env.VITE_EMBED ? { initialEntries: [startAt] } : {})}>
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
          <Route path="funds" element={<DetailGate><FundAccountsPage /></DetailGate>} />
          <Route path="funds/:id" element={<DetailGate><FundDetailPage /></DetailGate>} />
          <Route path="balance/:kind" element={<DetailGate><BalancePage /></DetailGate>} />
          <Route path="land" element={<DetailGate><Land /></DetailGate>} />
          <Route path="meeting" element={<Meeting />} />
          <Route path="meeting/notes" element={<Notes />} />
          <Route path="meeting/:n" element={<Meeting />} />
          <Route path="meeting/:n/:k" element={<Meeting />} />
          <Route path="meeting/:n/:k/:s" element={<Meeting />} />
          <Route path="members" element={<Members />} />
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
