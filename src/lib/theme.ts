/** รูปแบบหน้าจอ: auto = ตามเครื่อง · light = สว่าง (กลางวัน) · dark = มืด (กลางคืน) — จำไว้ในเครื่องนั้นๆ */
export type ThemePref = 'auto' | 'light' | 'dark'
export const THEME_KEY = 'acct.theme'
export const getTheme = (): ThemePref => { try { const v = localStorage.getItem(THEME_KEY); return v === 'light' || v === 'dark' ? v : 'auto' } catch { return 'auto' } }
export const applyTheme = (t: ThemePref) => { const r = document.documentElement; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t) }
export const setTheme = (t: ThemePref) => { try { if (t === 'auto') localStorage.removeItem(THEME_KEY); else localStorage.setItem(THEME_KEY, t) } catch { /* ignore */ } applyTheme(t) }
export const nextTheme = (t: ThemePref): ThemePref => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto')
export const THEME_LABEL: Record<ThemePref, { icon: string; text: string }> = { auto: { icon: '🌓', text: 'ตามเครื่อง' }, light: { icon: '☀️', text: 'สว่าง' }, dark: { icon: '🌙', text: 'มืด' } }
