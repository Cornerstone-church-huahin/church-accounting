import { useMemo } from 'react'
import MultiPick from './MultiPick'
import { useActivityLog, useChurchMembers, useVisitorNames, useVisits, useWorkTeams } from '../lib/data'
import { isLive } from '../lib/pastoral'
import { usePeople } from '../lib/usePeople'
import { newId } from '../lib/money'
import { renameDoersIn, renameVisitorIn, splitVisitors, visitorRoster } from '../lib/visits'

/**
 * ตัวเลือก “ผู้ออกเยี่ยม / ผู้ไปทำกิจกรรม” แบบเดียวกันทุกหน้า: เปิดมาเห็นรายชื่อที่ตั้งค่าไว้ (ทีมงาน + ที่เพิ่มเอง) ติ๊กได้ทันที
 * พิมพ์ในช่องค้นหาเพื่อหาจากทะเบียนสมาชิกเพิ่ม (ชื่อจริง/นามสกุล/ชื่อเล่น/ญาติ) · เพิ่ม/ลบชื่อเก็บไว้ใช้ซ้ำได้
 */
export default function VisitorPick({ id, title, value, onChange, empty, canEdit = true }: { id: string; title: string; value: string[]; onChange: (v: string[]) => void; empty?: string; /** false = เลือกได้อย่างเดียว เพิ่ม/แก้/ลบชื่อไม่ได้ */ canEdit?: boolean }) {
  const team = useWorkTeams().of(4).map((t) => t.name).filter(Boolean)
  const names = useVisitorNames()
  const members = useChurchMembers()
  const people = usePeople(useMemo(() => members.items.filter((m) => !m.deleted && isLive(m)), [members.items]))
  const roster = visitorRoster(team, names.items)
  const allVisits = useVisits(true)
  const allActs = useActivityLog()
  /** แก้ชื่อ: เปลี่ยนในรายชื่อ + การเยี่ยมและกิจกรรมที่เคยบันทึกไว้ทั้งหมด (ผู้ออกเยี่ยม/ผู้ไปทำ) */
  const renameName = (oldN: string, raw: string) => {
    const n = raw.trim().replace(/,/g, ' ')
    if (!n || n === oldN) return
    const ups = names.items.filter((y) => !y.hide && y.name === oldN).map((x) => ({ ...x, name: n }))
    if (team.includes(oldN)) { names.put([{ id: `hide-${oldN}`, name: oldN, hide: true, updated: 0 }]); names.put([{ id: newId('vn'), name: n, updated: 0 }]) }
    if (ups.length) names.put(ups)
    const vs = allVisits.list.filter((v) => splitVisitors(v.visitor ?? '').includes(oldN))
    if (vs.length) allVisits.put(vs.map((v) => ({ ...v, visitor: renameVisitorIn(v.visitor ?? '', oldN, n), updated: 0 })))
    const as = allActs.list.filter((a) => a.doers?.includes(oldN))
    if (as.length) allActs.put(as.map((a) => ({ ...a, doers: renameDoersIn(a.doers ?? [], oldN, n), updated: 0 })))
    onChange(value.map((x) => (x === oldN ? n : x)))
  }
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
      pending={canEdit ? value.filter((v) => !roster.includes(v)) : []} onAddPending={(ns) => { for (const n of ns) { const hid = names.items.find((x) => x.hide && x.name === n); if (hid) names.remove(hid.id); if (!names.items.some((x) => !x.hide && x.name === n)) names.put([{ id: newId('vn'), name: n, updated: 0 }]) } }}
      {...(canEdit ? { onAdd: addName, onRemove: dropName, onRename: renameName } : {})} addHint="พิมพ์ชื่อ → ระบบหาจากทะเบียนให้ · ไม่พบ = กด เพิ่ม เป็นชื่อใหม่" />
  )
}
