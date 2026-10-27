/** ภาพอาหารเส้นง่าย ๆ สำหรับหัวตารางถวายอาหาร (SVG วาดเอง — แสดงเหมือนกันทุกเครื่องและตอนพิมพ์/PDF) */
export type FoodKind = 'burger' | 'taco' | 'donut' | 'sandwich'

export default function FoodIcon({ kind, size = 64 }: { kind: FoodKind; size?: number }) {
  const common = { width: size, height: (size * 48) / 64, viewBox: '0 0 64 48', 'aria-hidden': true as const, focusable: false as const, style: { display: 'block', flex: 'none' } }
  if (kind === 'burger') {
    return (
      <svg {...common}>
        <path d="M6 22 Q6 4 32 4 Q58 4 58 22 Z" fill="#e8a33d" stroke="#a86a12" strokeWidth="1.5" />
        {[[20, 12], [30, 9], [40, 12], [26, 16], [36, 16], [46, 17], [16, 17]].map(([x, y], i) => <ellipse key={i} cx={x} cy={y} rx="2.2" ry="1.2" fill="#fff3d0" transform={`rotate(${i * 25} ${x} ${y})`} />)}
        <path d="M4 24 q5 -5 9 0 t9 0 t9 0 t9 0 t9 0 t9 0 L60 29 L4 29Z" fill="#6cc04a" stroke="#3f8f2a" strokeWidth="1" />
        <rect x="5" y="29" width="54" height="7" rx="3.5" fill="#6b3b1e" />
        <path d="M7 36 H57 L51 41 L45 36 L39 41 L33 36 Z" fill="#ffd23f" stroke="#c89a00" strokeWidth="1" />
        <path d="M6 41 H58 Q58 46 50 46 H14 Q6 46 6 41Z" fill="#e8a33d" stroke="#a86a12" strokeWidth="1.5" />
      </svg>
    )
  }
  if (kind === 'taco') {
    return (
      <svg {...common}>
        <path d="M4 42 A28 28 0 0 1 60 42 Z" fill="#f6c85f" stroke="#c98a1a" strokeWidth="1.6" />
        <path d="M9 31 q4 -6 8 -1 t8 -1 t8 -1 t8 -1 t8 -1 t8 -1 L56 33 L9 35Z" fill="#6cc04a" stroke="#3f8f2a" strokeWidth="1" />
        {[[22, 27], [34, 24], [44, 27], [30, 31]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.4" fill="#e53935" stroke="#a31f1c" strokeWidth="0.8" />)}
        <path d="M12 38 Q32 30 52 38" fill="none" stroke="#fff3d0" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="1 5" />
        <path d="M4 42 H60" stroke="#c98a1a" strokeWidth="1.6" />
      </svg>
    )
  }
  if (kind === 'donut') {
    return (
      <svg {...common}>
        <ellipse cx="32" cy="25" rx="27" ry="21" fill="#e0a060" stroke="#a86a2a" strokeWidth="1.5" />
        <ellipse cx="32" cy="23" rx="24" ry="18" fill="#f48fb1" stroke="#c2587f" strokeWidth="1.2" />
        <ellipse cx="32" cy="23" rx="7.5" ry="5.5" fill="#eef5fb" stroke="#c2587f" strokeWidth="1.2" />
        {[[14, 17, '#fff', 20], [20, 30, '#ffd23f', -30], [48, 16, '#4fc3f7', 60], [50, 29, '#fff', -20], [32, 10, '#ffd23f', 80], [32, 36, '#4fc3f7', 10], [42, 36, '#fff', -50], [22, 12, '#4fc3f7', 40]].map(([x, y, c, r], i) => <rect key={i} x={Number(x) - 2.4} y={Number(y) - 0.9} width="4.8" height="1.8" rx="0.9" fill={String(c)} transform={`rotate(${r} ${x} ${y})`} />)}
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M6 12 Q6 3 18 3 H46 Q58 3 58 12 V15 H6Z" fill="#f2d49b" stroke="#b98a3a" strokeWidth="1.5" />
      <path d="M4 17 q5 -5 9 0 t9 0 t9 0 t9 0 t9 0 t9 0 L60 22 L4 22Z" fill="#6cc04a" stroke="#3f8f2a" strokeWidth="1" />
      <rect x="6" y="22" width="52" height="5" fill="#e53935" stroke="#a31f1c" strokeWidth="0.8" />
      <rect x="6" y="27" width="52" height="5" fill="#f4a6a6" stroke="#c97878" strokeWidth="0.8" />
      <rect x="6" y="32" width="52" height="4" fill="#ffd23f" stroke="#c89a00" strokeWidth="0.8" />
      <path d="M6 37 H58 V41 Q58 46 50 46 H14 Q6 46 6 41Z" fill="#f2d49b" stroke="#b98a3a" strokeWidth="1.5" />
    </svg>
  )
}
