/** ไอคอนเส้นบางขนาดเล็กสำหรับแถบเครื่องมือเอกสาร (ดาวน์โหลด/ไฟล์เปล่า/แชร์/พิมพ์) */
const base = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const
export const IconDownload = () => (<svg {...base}><path d="M12 4v11" /><path d="M7.5 11 12 15.5 16.5 11" /><path d="M5 19h14" /></svg>)
export const IconBlank = () => (<svg {...base}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /></svg>)
export const IconShare = () => (<svg {...base}><circle cx="6" cy="12" r="2.2" /><circle cx="17.5" cy="6" r="2.2" /><circle cx="17.5" cy="18" r="2.2" /><path d="m8 11 7.5-4M8 13l7.5 4" /></svg>)
export const IconPrint = () => (<svg {...base}><path d="M7 9V3.5h10V9" /><rect x="4" y="9" width="16" height="8" rx="1.5" /><path d="M7 14h10v6.5H7z" /></svg>)
export const IconScan = () => (<svg {...base}><path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" /><path d="M4 12h16" /></svg>)
export const IconImage = () => (<svg {...base}><rect x="4" y="5" width="16" height="14" rx="2" /><circle cx="9" cy="10" r="1.6" /><path d="m5 17 5-4.5 3.5 3L16 13l3 3" /></svg>)
