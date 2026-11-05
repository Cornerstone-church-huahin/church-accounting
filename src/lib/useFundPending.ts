import { useMemo } from 'react'
import { useFundDeposits, useIncomeTypes } from './data'
import { activityMoney, activitySubIds } from './fundActs'
import { fundPending, fundSplit } from './fundPending'
import type { FundAccount } from './fundAccounts'

/** เตรียมนำฝาก + แตกยอดกองทุน โดยไม่นับเงินกิจกรรม (รับ-จ่ายผ่านระหว่างจัดงาน) เป็นเงินที่ต้องนำฝาก */
export function useFundPending(funds: FundAccount[]) {
  const dep = useFundDeposits()
  const types = useIncomeTypes()
  return useMemo(() => {
    const subs = activitySubIds(types.list)
    const sum = fundPending(funds, dep.items, (fid, sub) => !!sub && !!subs.get(fid)?.has(sub))
    const actMoney = activityMoney(funds, types.list)
    return { sum, split: fundSplit(funds, sum, actMoney.per), act: actMoney.total, deposits: dep }
  }, [funds, dep.items, types.list]) // eslint-disable-line react-hooks/exhaustive-deps
}
