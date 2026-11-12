import { useState } from 'react'
import { DEFAULT_REPO, getSync } from '../lib/sync'
import { buildInviteMessage, installUrlOf } from '../lib/inviteMessage'
import type { FundActivity } from '../lib/types'

/**
 * ปุ่ม “เชิญกรรมการ” ในหน้ากิจกรรม (แอดมิน): แชร์ข้อความเชิญไปที่ไลน์ (หรือคัดลอก)
 * ผู้รับกดลิงก์ → ขอเข้าร่วม → แอดมินอนุมัติ (ระบบให้เป็นผู้ดูแลกองทุนของกิจกรรมนี้อัตโนมัติ) → เข้าหน้ากิจกรรมนี้ได้
 */
export default function InviteActButton({ fundId, act }: { fundId: string; act: FundActivity }) {
  const [msg, setMsg] = useState('')
  const cfg = getSync()
  if (!cfg) return null
  const send = async () => {
    const inviteUrl = `${location.origin}${location.pathname}?openExternalBrowser=1#/join?t=${encodeURIComponent(cfg.token)}${cfg.repo !== DEFAULT_REPO ? `&r=${encodeURIComponent(cfg.repo)}` : ''}&role=viewer&fa=${encodeURIComponent(fundId)}.${encodeURIComponent(act.id)}`
    const text = buildInviteMessage({ installUrl: installUrlOf(location.origin, location.pathname), inviteUrl, level: `กรรมการจัดงาน “${act.name}” — เห็นและบันทึกรับ-จ่ายของกิจกรรมนี้` })
    try {
      if (navigator.share) await navigator.share({ title: `เชิญกรรมการ ${act.name}`, text })
      else { await navigator.clipboard.writeText(text); setMsg('คัดลอกข้อความเชิญแล้ว — วางในไลน์ได้เลย'); window.setTimeout(() => setMsg(''), 3500) }
    } catch { /* ผู้ใช้ปิดหน้าต่างแชร์ */ }
  }
  return (
    <div className="no-print" style={{ margin: '8px 0' }}>
      <button type="button" className="btn btn--gold btn--block" onClick={() => void send()}>📨 เชิญกรรมการ (ส่งทางไลน์)</button>
      {msg && <p className="ok small" role="status" style={{ margin: '4px 0 0' }}>{msg}</p>}
    </div>
  )
}
