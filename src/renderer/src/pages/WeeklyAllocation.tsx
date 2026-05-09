import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, DollarSign } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { formatCurrency, getCurrentWeekStart, getWeekLabel } from '@renderer/lib/utils'
import { toWeeklyAmount, isPayWeek } from '@renderer/types'
import type { Account, IncomeSource, Expense, WeeklyAllocation } from '@renderer/types'
import { addDays, format, subDays } from 'date-fns'

export default function WeeklyAllocation() {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart())
  const [accounts, setAccounts] = useState<Account[]>([])
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [allocations, setAllocations] = useState<WeeklyAllocation[]>([])
  const [buffers, setBuffers] = useState<Record<number, number>>({})

  const isCurrentWeek = weekStart === getCurrentWeekStart()

  useEffect(() => { loadBase() }, [])
  useEffect(() => { loadAllocations() }, [weekStart])

  async function loadBase() {
    const [acc, inc, exp] = await Promise.all([
      window.api.accounts.getAll(),
      window.api.income.getAll(),
      window.api.expenses.getAll(),
    ])
    setAccounts(acc)
    setIncome(inc)
    setExpenses(exp)
  }

  async function loadAllocations() {
    const allocs = await window.api.allocations.getWeek(weekStart)
    setAllocations(allocs)
  }

  const weeklyIncome = income.reduce((sum, s) => sum + toWeeklyAmount(s.amount, s.frequency), 0)

  function getAccountWeeklyBase(accountId: number): number {
    return expenses
      // Match by save account (where money should land this week), with legacy account_id fallback
      .filter(e => (e.save_account_id ?? e.account_id) === accountId)
      .reduce((sum, e) => sum + toWeeklyAmount(e.allocation_amount ?? e.amount, e.frequency) + (e.weekly_extra ?? 0), 0)
  }

  function getAccountAllocation(accountId: number): WeeklyAllocation | undefined {
    return allocations.find(a => a.account_id === accountId)
  }

  function getBufferForAccount(acc: Account): number {
    return buffers[acc.id] ?? acc.buffer_percent
  }

  function getAllocatedAmount(acc: Account): number {
    const base = getAccountWeeklyBase(acc.id)
    const bufferPct = getBufferForAccount(acc)
    return base * (1 + bufferPct / 100)
  }

  const totalAllocated = accounts.reduce((sum, acc) => sum + getAllocatedAmount(acc), 0)
  const freeCashflow = weeklyIncome - totalAllocated
  const allFunded = accounts.length > 0 && accounts.every(acc => {
    const alloc = getAccountAllocation(acc.id)
    return alloc?.funded === 1
  })

  async function toggleFunded(acc: Account) {
    const alloc = getAccountAllocation(acc.id)
    const planned = getAllocatedAmount(acc)
    const bufferAmount = getAccountWeeklyBase(acc.id) * (getBufferForAccount(acc) / 100)

    if (!alloc) {
      const saved = await window.api.allocations.upsert({
        week_start: weekStart,
        account_id: acc.id,
        planned_amount: planned,
        buffer_amount: bufferAmount,
      })
      if (saved) {
        await window.api.allocations.setFunded((saved as WeeklyAllocation).id, true)
      }
    } else {
      await window.api.allocations.setFunded(alloc.id, alloc.funded !== 1)
    }
    loadAllocations()
  }

  async function markAllFunded() {
    for (const acc of accounts) {
      const alloc = getAccountAllocation(acc.id)
      const planned = getAllocatedAmount(acc)
      const bufferAmount = getAccountWeeklyBase(acc.id) * (getBufferForAccount(acc) / 100)
      if (!alloc) {
        const saved = await window.api.allocations.upsert({
          week_start: weekStart, account_id: acc.id, planned_amount: planned, buffer_amount: bufferAmount,
        })
        if (saved) await window.api.allocations.setFunded((saved as WeeklyAllocation).id, true)
      } else if (alloc.funded !== 1) {
        await window.api.allocations.setFunded(alloc.id, true)
      }
    }
    loadAllocations()
  }

  function prevWeek() {
    const d = new Date(weekStart + 'T00:00:00')
    setWeekStart(format(subDays(d, 7), 'yyyy-MM-dd'))
  }

  function nextWeek() {
    const d = new Date(weekStart + 'T00:00:00')
    setWeekStart(format(addDays(d, 7), 'yyyy-MM-dd'))
  }

  const fundedCount = accounts.filter(acc => getAccountAllocation(acc.id)?.funded === 1).length

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Weekly Allocation</h1>
          <p className="text-sm text-text-secondary mt-1">How much to move into each account this week.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="outline" onClick={prevWeek}><ChevronLeft size={15} /></Button>
          <div className="text-center min-w-[160px]">
            <p className="text-sm font-medium text-text-primary">{getWeekLabel(weekStart)}</p>
            {isCurrentWeek && <p className="text-[10px] text-accent mt-0.5">Current week</p>}
          </div>
          <Button size="icon" variant="outline" onClick={nextWeek}><ChevronRight size={15} /></Button>
        </div>
      </div>

      {/* Payday banner */}
      {(() => {
        const paying = income.filter(s => s.payday_reference && isPayWeek(s.payday_reference, s.frequency, weekStart))
        if (paying.length === 0) return null
        const names = paying.map(s => s.person_name).join(' & ')
        const totalPay = paying.reduce((sum, s) => sum + s.amount, 0)
        return (
          <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 flex items-center gap-3">
            <DollarSign size={18} className="text-accent flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                {paying.length > 1 ? 'Both get paid' : `${names} gets paid`} this week
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                {paying.map(s => `${s.person_name}: ${formatCurrency(s.amount)} (${s.frequency})`).join(' · ')}
                {paying.length > 1 && <span className="text-accent font-medium"> · {formatCurrency(totalPay)} total arriving</span>}
              </p>
            </div>
          </div>
        )
      })()}

      {/* Progress bar */}
      {accounts.length > 0 && (
        <div className="bg-surface rounded-lg p-4 border border-border flex items-center justify-between gap-6">
          <div>
            <p className="text-xs text-text-secondary">Accounts funded</p>
            <p className="text-xl font-semibold text-text-primary mt-0.5">{fundedCount} / {accounts.length}</p>
          </div>
          <div className="flex-1 bg-surface-hover rounded-full h-2">
            <div
              className="h-2 rounded-full bg-accent transition-all duration-500"
              style={{ width: `${accounts.length > 0 ? (fundedCount / accounts.length) * 100 : 0}%` }}
            />
          </div>
          {!allFunded && accounts.length > 0 && (
            <Button size="sm" variant="outline" onClick={markAllFunded}>Mark all done</Button>
          )}
          {allFunded && (
            <div className="flex items-center gap-1.5 text-success text-sm font-medium">
              <CheckCircle2 size={16} />
              All funded!
            </div>
          )}
        </div>
      )}

      {/* Accounts list */}
      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-secondary text-sm">No accounts set up yet.</p>
          <p className="text-text-muted text-xs mt-1">Go to Budget Setup → Accounts to add your first account.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => {
            const alloc = getAccountAllocation(acc.id)
            const isFunded = alloc?.funded === 1
            const base = getAccountWeeklyBase(acc.id)
            const bufferPct = getBufferForAccount(acc)
            const bufferAmount = base * (bufferPct / 100)
            const total = base + bufferAmount

            return (
              <Card
                key={acc.id}
                className={`transition-all duration-200 ${isFunded ? 'border-success/20 bg-success/5' : 'hover:border-border-subtle'}`}
              >
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-4">
                    {/* Left: account info */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => toggleFunded(acc)}
                        className="flex-shrink-0 transition-transform hover:scale-110"
                      >
                        {isFunded
                          ? <CheckCircle2 size={22} className="text-success" />
                          : <Circle size={22} className="text-text-muted" />
                        }
                      </button>
                      <div className="w-2.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                      <div className="min-w-0">
                        <p className={`text-sm font-medium ${isFunded ? 'text-text-secondary line-through' : 'text-text-primary'}`}>
                          {acc.name}
                        </p>
                        <p className="text-xs text-text-muted">
                          Base {formatCurrency(base)}{bufferPct > 0 && ` + ${bufferPct}% buffer`}
                        </p>
                      </div>
                    </div>

                    {/* Right: amount */}
                    <div className="text-right flex-shrink-0">
                      <p className={`text-lg font-semibold ${isFunded ? 'text-text-muted' : 'text-text-primary'}`}>
                        {formatCurrency(total)}
                      </p>
                      {bufferAmount > 0 && (
                        <p className="text-[11px] text-text-muted">incl. {formatCurrency(bufferAmount)} buffer</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Summary */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-2 border-t border-border">
          <SummaryItem label="Weekly Income" value={weeklyIncome} color="text-success" />
          <SummaryItem label="Total to Move" value={totalAllocated} color="text-text-primary" />
          <SummaryItem
            label="Free Cashflow"
            value={freeCashflow}
            color={freeCashflow >= 0 ? 'text-success' : 'text-danger'}
          />
        </div>
      )}
    </div>
  )
}

function SummaryItem({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center p-4 bg-surface rounded-lg border border-border">
      <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
      <p className={`text-xl font-semibold mt-1 ${color}`}>{formatCurrency(value)}</p>
    </div>
  )
}
