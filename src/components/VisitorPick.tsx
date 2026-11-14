import { useMemo } from 'react'
import MultiPick from './MultiPick'
import { useChurchMembers, useVisitorNames, useWorkTeams } from '../lib/data'
import { isLive } from '../lib/pastoral'
import { usePeople } from '../lib/usePeople'
import { newId } from '../lib/money'
import { visitorRoster } from '../lib/visits'

/**
 * ตัวเลือก “ผู้ออกเยี่ยม / ผู้ไปทำกิจกรรม” แบบเดียวกันทุกหน้า: เปิดมาเห็นรายชื่อที่ตั้งค่าไว้ (ทีมงาน + ที่เพิ่มเอง) ติ๊กได้ทันที
 * พิมพ์ในช่องค้นหาเพื่อหาจากทะเบียนสมาชิกเพิ่ม (ชื่อจริง/นามสกุล/ชื่อเล่น/ญาติ) · เพิ่ม/ลบชื่อเก็บไว้ใช้ซ้ำได้
 */
export default function VisitorPick({ id, title, value, onChange, empty }: { id: string; title: string; value: string[]; onChange: (v: string[]) => void; empty?: string }) {
  const team = useWorkTeams().of(4).map((t) => t.name).filter(Boolean)
  const names = useVisitorNames()
  const members = useChurchMembers()
  const people = usePeople(useMemo(() => members.items.filter((m) => !m.deleted && isLive(m)), [members.items]))
  const roster = visitorRoster(team, names.items)
  const addName = (raw: string) => {
    const n = raw.trim().replace(/,/g, ' ')
    if (!n) return
    const hid = names.items.find((x) => x.hide && x.name === n)
    if (hid) names.remove(hid.id)
    if (!roster.includes(n) && !names.items.some((x) => !x.hide && x.name === n)) names.put([{ id: newId('vn'), name: n, updated: 0 }])
    onChange(value.includes(n) ? value : [...value, n])
  }
  const dropName = (n: string) => {
    for (const x of names.items.filter((y) => !y.hide && y.name === n)) names.remove(x.id)
    if (team.includes(n)) names.put([{ id: `hide-${n}`, name: n, hide: true, updated: 0 }])
    onChange(value.filter((x) => x !== n))
  }
  return (
    <MultiPick id={id} title={title} options={[...new Set([...roster, ...value])].map(people.optOf)} value={value} onChange={onChange} empty={empty ?? '— เลือก —'}
      search={{ find: people.find, placeholder: '🔎 ค้นจากทะเบียน: ชื่อจริง / นามสกุล / ชื่อเล่น / ญาติ' }}
      onAdd={addName} onRemove={dropName} addHint="พิมพ์ชื่อใหม่ แล้วกด เพิ่ม (เก็บไว้เลือกได้ทุกครั้ง)" />
  )
}
