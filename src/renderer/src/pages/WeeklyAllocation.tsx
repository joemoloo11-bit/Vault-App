import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowRight, DollarSign, Wallet, Coffee, Trash2, Pencil, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useToast } from '@renderer/components/ui/toast'
import { formatCurrency, getCurrentWeekStart, getWeekLabel } from '@renderer/lib/utils'
import { isPayWeek, computeWeeklyCashflow } from '@renderer/types'
import type { Account, IncomeSource, Expense, Transfer, BalanceLog, PayOverride, Goal } from '@renderer/types'
import { addDays, format, subDays } from 'date-fns'

export default function WeeklyAllocation() {
  const [weekStart, setWeekStart] = useState(getCurrentWeekStart())
  const [accounts, setAccounts] = useState<Account[]>([])
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [latestLogs, setLatestLogs] = useState<BalanceLog[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [payOverrides, setPayOverrides] = useState<PayOverride[]>([])
  const [editingPayId, setEditingPayId] = useState<number | null>(null)
  const [payDraft, setPayDraft] = useState('')
  const [drafts, setDrafts] = useState<Record<string, string>>({}) // key: `${from}-${to}` → entered amount string
  const { toast } = useToast()

  const isCurrentWeek = weekStart === getCurrentWeekStart()

  useEffect(() => { loadBase() }, [])
  useEffect(() => { loadWeekData() }, [weekStart])

  async function loadBase() {
    const [acc, inc, exp, logs, gls] = await Promise.all([
      window.api.accounts.getAll(),
      window.api.income.getAll(),
      window.api.expenses.getAll(),
      window.api.balances.getLatest(),
      window.api.goals.getAll(),
    ])
    setAccounts(acc)
    setIncome(inc)
    setExpenses(exp)
    setLatestLogs(logs)
    setGoals(gls as Goal[])
  }

  async function loadWeekData() {
    const [tx, overrides] = await Promise.all([
      (window.api as any).transfers.getWeek(weekStart) as Promise<Transfer[]>,
      (window.api as any).payOverrides.getWeek(weekStart) as Promise<PayOverride[]>,
    ])
    setTransfers(tx)
    setPayOverrides(overrides)
    setDrafts({})
    setEditingPayId(null)
    setPayDraft('')
  }

  function getEffectivePay(src: IncomeSource): number {
    const override = payOverrides.find(o => o.income_source_id === src.id)
    return override ? override.amount : src.amount
  }
  function hasOverride(src: IncomeSource): boolean {
    return payOverrides.some(o => o.income_source_id === src.id)
  }

  async function savePayOverride(src: IncomeSource) {
    const amt = parseFloat(payDraft)
    if (isNaN(amt) || amt < 0) {
      toast('Enter a valid amount', 'danger')
      return
    }
    if (amt === src.amount) {
      // No override needed if matches base
      if (hasOverride(src)) {
        await (window.api as any).payOverrides.delete(src.id, weekStart)
      }
    } else {
      await (window.api as any).payOverrides.upsert({
        income_source_id: src.id,
        week_start: weekStart,
        amount: amt,
      })
    }
    toast(`${src.person_name}'s pay set to ${formatCurrency(amt)} this week`)
    setEditingPayId(null)
    setPayDraft('')
    loadWeekData()
  }

  async function resetPayOverride(src: IncomeSource) {
    await (window.api as any).payOverrides.delete(src.id, weekStart)
    toast(`${src.person_name}'s pay reset to base (${formatCurrency(src.amount)})`)
    loadWeekData()
  }

  // ── Money flow analysis ───────────────────────────────────────────────────

  // For each (envelope → debit account) routing, group bills and compute the move amount
  type Route = {
    fromAccount: Account
    toAccount: Account
    bills: Expense[]
    weeklyAmount: number
    transfers: Transfer[]   // transfers already made this week for this route
    transferred: number      // sum of those
  }

  const cashflow = useMemo(() => computeWeeklyCashflow(expenses, income, goals), [expenses, income, goals])

  const routes = useMemo<Route[]>(() => {
    const map = new Map<string, Route>()
    for (const e of expenses) {
      const fromId = e.save_account_id ?? e.account_id
      const toId = e.debit_account_id
      if (!fromId || !toId || fromId === toId) continue
      const fromAccount = accounts.find(a => a.id === fromId)
      const toAccount = accounts.find(a => a.id === toId)
      if (!fromAccount || !toAccount) continue
      const key = `${fromId}-${toId}`
      const weekly = cashflow.effective[e.id] ?? 0
      const existing = map.get(key)
      if (existing) {
        existing.bills.push(e)
        existing.weeklyAmount += weekly
      } else {
        map.set(key, { fromAccount, toAccount, bills: [e], weeklyAmount: weekly, transfers: [], transferred: 0 })
      }
    }
    // Attach transfers already made this week to their routes
    for (const t of transfers) {
      const key = `${t.from_account_id}-${t.to_account_id}`
      const r = map.get(key)
      if (r) {
        r.transfers.push(t)
        r.transferred += t.amount
      }
    }
    return Array.from(map.values()).sort((a, b) => a.toAccount.name.localeCompare(b.toAccount.name))
  }, [expenses, accounts, transfers])

  // Accumulating accounts: envelopes whose bills have NO debit account (paid direct or piling)
  type Accumulator = { account: Account; bills: Expense[]; weeklyFill: number }
  const accumulators = useMemo<Accumulator[]>(() => {
    const map = new Map<number, Accumulator>()
    for (const e of expenses) {
      const fromId = e.save_account_id ?? e.account_id
      if (!fromId) continue
      // Skip if it has a debit destination (those are routes)
      if (e.debit_account_id && e.debit_account_id !== fromId) continue
      const account = accounts.find(a => a.id === fromId)
      if (!account) continue
      const weekly = cashflow.effective[e.id] ?? 0
      const existing = map.get(account.id)
      if (existing) {
        existing.bills.push(e)
        existing.weeklyFill += weekly
      } else {
        map.set(account.id, { account, bills: [e], weeklyFill: weekly })
      }
    }
    return Array.from(map.values()).sort((a, b) => a.account.name.localeCompare(b.account.name))
  }, [expenses, accounts, cashflow])

  // ── Pay context (real cash arriving this week, not weekly average) ────────

  const payingThisWeek = income.filter(s =>
    s.payday_reference && isPayWeek(s.payday_reference, s.frequency, weekStart)
  )
  const cashArrivingThisWeek = payingThisWeek.reduce((s, p) => s + getEffectivePay(p), 0)
  // Total suggested move across all routes this week
  const totalSuggested = useMemo(() => routes.reduce((s, r) => s + r.weeklyAmount, 0), [routes])
  const remainingFromPay = cashArrivingThisWeek - totalSuggested

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSaveTransfer(route: Route) {
    const key = `${route.fromAccount.id}-${route.toAccount.id}`
    const raw = drafts[key]
    const amount = parseFloat(raw)
    if (!amount || amount <= 0) {
      toast('Enter an amount greater than $0', 'danger')
      return
    }
    await (window.api as any).transfers.save({
      from_account_id: route.fromAccount.id,
      to_account_id: route.toAccount.id,
      amount,
      week_start: weekStart,
    })
    toast(`Logged ${formatCurrency(amount)}: ${route.fromAccount.name} → ${route.toAccount.name}`)
    setDrafts(d => ({ ...d, [key]: '' }))
    loadWeekData()
  }

  async function handleDeleteTransfer(id: number) {
    await (window.api as any).transfers.delete(id)
    toast('Transfer removed', 'danger')
    loadWeekData()
  }

  function prevWeek() {
    setWeekStart(format(subDays(new Date(weekStart + 'T00:00:00'), 7), 'yyyy-MM-dd'))
  }
  function nextWeek() {
    setWeekStart(format(addDays(new Date(weekStart + 'T00:00:00'), 7), 'yyyy-MM-dd'))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Weekly Move</h1>
          <p className="text-sm text-text-secondary mt-1">Move money from envelopes (Bank 1) to debit accounts (Bank 2).</p>
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

      {/* Pay context */}
      {payingThisWeek.length > 0 ? (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <DollarSign size={18} className="text-accent flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-text-primary">
                {payingThisWeek.length > 1 ? 'Both pays arrive' : `${payingThisWeek[0].person_name}'s pay arrives`} this week
              </p>
              <p className="text-xs text-text-secondary mt-0.5">
                <span className="text-accent font-medium">{formatCurrency(cashArrivingThisWeek)} arriving total</span>
              </p>
            </div>
          </div>

          {/* Per-person editable rows */}
          <div className="space-y-2 pl-7">
            {payingThisWeek.map(src => {
              const effective = getEffectivePay(src)
              const isEditing = editingPayId === src.id
              const isOverridden = hasOverride(src)
              return (
                <div key={src.id} className="flex items-center gap-2 text-sm">
                  <span className="text-text-secondary min-w-[80px]">{src.person_name}:</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1 flex-1 max-w-[300px]">
                      <Input
                        type="number"
                        prefix="$"
                        value={payDraft}
                        onChange={e => setPayDraft(e.target.value)}
                        placeholder={String(src.amount)}
                        className="flex-1"
                      />
                      <Button size="sm" onClick={() => savePayOverride(src)}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingPayId(null); setPayDraft('') }}>Cancel</Button>
                    </div>
                  ) : (
                    <>
                      <span className="text-text-primary tabular-nums font-medium">{formatCurrency(effective)}</span>
                      {isOverridden && (
                        <span className="text-[10px] text-accent bg-accent/10 border border-accent/30 rounded px-1.5 py-0.5">
                          adjusted from {formatCurrency(src.amount)}
                        </span>
                      )}
                      <button
                        onClick={() => { setEditingPayId(src.id); setPayDraft(String(effective)) }}
                        className="text-text-muted hover:text-text-primary p-0.5"
                        title="Adjust this week's pay"
                      >
                        <Pencil size={11} />
                      </button>
                      {isOverridden && (
                        <button
                          onClick={() => resetPayOverride(src)}
                          className="text-text-muted hover:text-text-primary p-0.5"
                          title={`Reset to base (${formatCurrency(src.amount)})`}
                        >
                          <RotateCcw size={11} />
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Remaining callout */}
          {totalSuggested > 0 && (
            <div className="pl-7 pt-2 border-t border-accent/20">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div>
                  <p className="text-text-muted text-[10px] uppercase tracking-wider">Arriving</p>
                  <p className="text-text-primary tabular-nums font-semibold mt-0.5">{formatCurrency(cashArrivingThisWeek)}</p>
                </div>
                <div>
                  <p className="text-text-muted text-[10px] uppercase tracking-wider">Transfers planned</p>
                  <p className="text-text-primary tabular-nums font-semibold mt-0.5">{formatCurrency(totalSuggested)}</p>
                </div>
                <div>
                  <p className="text-text-muted text-[10px] uppercase tracking-wider">Remaining</p>
                  <p className={`tabular-nums font-semibold mt-0.5 ${remainingFromPay >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(remainingFromPay)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-2/40 border border-border rounded-lg p-4 flex items-center gap-3">
          <DollarSign size={18} className="text-text-muted flex-shrink-0" />
          <p className="text-sm text-text-secondary">No pay arriving this week — running on what's already in envelopes.</p>
        </div>
      )}

      {/* Routes (transfers to make) */}
      {routes.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Transfers to make</h2>
            <p className="text-[11px] text-text-muted">
              {routes.filter(r => r.transferred >= r.weeklyAmount * 0.95).length} / {routes.length} done
            </p>
          </div>
          {routes.map(route => {
            const key = `${route.fromAccount.id}-${route.toAccount.id}`
            const draft = drafts[key] ?? ''
            const suggested = route.weeklyAmount
            const remaining = Math.max(0, suggested - route.transferred)
            const isComplete = route.transferred >= suggested * 0.95
            const destLog = latestLogs.find(l => l.account_id === route.toAccount.id)

            return (
              <Card key={key} className={isComplete ? 'border-success/30' : ''}>
                <CardContent className="pt-4 pb-4">
                  {/* Route header */}
                  <div className="flex items-center justify-between gap-4 mb-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-6 rounded-full" style={{ backgroundColor: route.fromAccount.color }} />
                        <span className="font-medium text-text-primary">{route.fromAccount.name}</span>
                        <ArrowRight size={14} className="text-text-muted" />
                        <div className="w-2 h-6 rounded-full" style={{ backgroundColor: route.toAccount.color }} />
                        <span className="font-medium text-text-primary">{route.toAccount.name}</span>
                      </div>
                    </div>
                    {isComplete && <CheckCircle2 size={18} className="text-success flex-shrink-0" />}
                  </div>

                  {/* Numbers */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-surface-2 rounded-lg p-2.5 border border-border">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider">Suggested</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums mt-0.5">{formatCurrency(suggested)}</p>
                    </div>
                    <div className="bg-surface-2 rounded-lg p-2.5 border border-border">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider">Already moved</p>
                      <p className={`text-sm font-semibold tabular-nums mt-0.5 ${route.transferred > 0 ? 'text-success' : 'text-text-muted'}`}>
                        {formatCurrency(route.transferred)}
                      </p>
                    </div>
                    <div className="bg-surface-2 rounded-lg p-2.5 border border-border">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider">Destination balance</p>
                      <p className="text-sm font-semibold text-text-primary tabular-nums mt-0.5">
                        {destLog ? formatCurrency(destLog.balance) : '—'}
                      </p>
                    </div>
                  </div>

                  {/* Bills covered */}
                  <div className="mb-3">
                    <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Covers ({route.bills.length} bills)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {route.bills.map(bill => (
                        <span key={bill.id} className="text-[11px] bg-surface-2 border border-border rounded px-2 py-0.5 text-text-secondary">
                          {bill.name} <span className="text-text-muted">·</span> {formatCurrency(bill.amount)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Action: enter actual amount */}
                  {!isComplete && (
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Input
                          label={`Actual moved this week (suggested ${formatCurrency(remaining)})`}
                          type="number"
                          prefix="$"
                          placeholder={remaining.toFixed(2)}
                          value={draft}
                          onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                        />
                      </div>
                      <Button onClick={() => handleSaveTransfer(route)} disabled={!draft}>
                        Log transfer
                      </Button>
                    </div>
                  )}

                  {/* Logged transfers list */}
                  {route.transfers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      {route.transfers.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-[11px]">
                          <span className="text-text-secondary">
                            {format(new Date(t.transfer_date), 'EEE d MMM, h:mm a')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-text-primary tabular-nums font-medium">{formatCurrency(t.amount)}</span>
                            <button
                              onClick={() => handleDeleteTransfer(t.id)}
                              className="text-text-muted hover:text-danger transition-colors p-0.5"
                              title="Remove this transfer"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Wallet size={28} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No transfers configured yet.</p>
            <p className="text-xs text-text-muted mt-1">In Budget Setup → Expenses, set both "Saves to" and "Debits from" on each bill to build your money flow.</p>
          </CardContent>
        </Card>
      )}

      {/* Accumulating accounts */}
      {accumulators.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Accumulating</h2>
            <p className="text-[11px] text-text-muted mt-0.5">Envelopes that fill weekly but don't transfer to Bank 2 — paid direct or building up over time.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {accumulators.map(a => {
              const log = latestLogs.find(l => l.account_id === a.account.id)
              return (
                <Card key={a.account.id} className="border-l-4" style={{ borderLeftColor: a.account.color }}>
                  <CardContent className="pt-3.5 pb-3.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <Coffee size={13} className="text-text-muted" />
                          <p className="text-sm font-medium text-text-primary">{a.account.name}</p>
                        </div>
                        <p className="text-[11px] text-text-muted mt-0.5">
                          Fills {formatCurrency(a.weeklyFill)}/wk · {a.bills.length} bill{a.bills.length === 1 ? '' : 's'}
                        </p>
                      </div>
                      <p className="text-base font-semibold text-text-primary tabular-nums">
                        {log ? formatCurrency(log.balance) : '—'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
