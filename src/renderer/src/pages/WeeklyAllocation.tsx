import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CheckCircle2, ArrowRight, DollarSign, Wallet, Coffee, Trash2, Pencil, RotateCcw } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { useToast } from '@renderer/components/ui/toast'
import { Dialog, DialogContent, DialogClose } from '@renderer/components/ui/dialog'
import { formatCurrency, getCurrentWeekStart, getWeekLabel } from '@renderer/lib/utils'
import { isPayWeek, computeWeeklyCashflow, payPeriodWeeks } from '@renderer/types'
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
  const [detailPayerId, setDetailPayerId] = useState<number | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({}) // key: `${from}-${to}` → entered amount string
  const [fillDrafts, setFillDrafts] = useState<Record<number, string>>({}) // key: envelope.id → entered fill amount
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

  // ── Unified envelope cards (combine routes + accumulators) ───────────────
  // Every envelope is the same KIND of card — auto-filled from pay. Some need a
  // manual transfer out (kind='route'), others stay in the envelope (kind='accumulator').
  type EnvelopeCard = {
    envelope: Account
    bills: Expense[]
    weeklyFill: number          // weekly equiv that the auto-split puts in
    balance: number              // latest logged balance
    kind: 'route' | 'accumulator'
    destination?: Account        // for routes
    transfers: Transfer[]        // logged transfers this week (routes only)
    transferred: number          // sum of those
  }

  const cashflow = useMemo(() => computeWeeklyCashflow(expenses, income, goals), [expenses, income, goals])

  const envelopeCards = useMemo<EnvelopeCard[]>(() => {
    // Group bills by envelope (save_account_id, with fallback to account_id)
    const byEnvelope = new Map<number, Expense[]>()
    for (const e of expenses) {
      const id = e.save_account_id ?? e.account_id
      if (!id) continue
      if (!byEnvelope.has(id)) byEnvelope.set(id, [])
      byEnvelope.get(id)!.push(e)
    }
    const cards: EnvelopeCard[] = []
    for (const [envelopeId, bills] of byEnvelope) {
      const envelope = accounts.find(a => a.id === envelopeId)
      if (!envelope) continue
      const log = latestLogs.find(l => l.account_id === envelope.id)
      const weeklyFill = bills.reduce((s, b) => s + (cashflow.effective[b.id] ?? 0), 0)
      const balance = log?.balance ?? 0

      // Determine destination: most common debit_account_id among bills (that isn't the envelope itself)
      const debitIds = bills
        .map(b => b.debit_account_id)
        .filter((id): id is number => !!id && id !== envelopeId)
      if (debitIds.length > 0) {
        // Group bills by their debit destination
        const byDestination = new Map<number, Expense[]>()
        for (const b of bills) {
          const dest = b.debit_account_id && b.debit_account_id !== envelopeId ? b.debit_account_id : null
          if (dest) {
            if (!byDestination.has(dest)) byDestination.set(dest, [])
            byDestination.get(dest)!.push(b)
          }
        }
        // One card per (envelope → destination) pair
        for (const [destId, destBills] of byDestination) {
          const destination = accounts.find(a => a.id === destId)
          if (!destination) continue
          const destFill = destBills.reduce((s, b) => s + (cashflow.effective[b.id] ?? 0), 0)
          const routeTransfers = transfers.filter(t => t.from_account_id === envelopeId && t.to_account_id === destId)
          const transferred = routeTransfers.reduce((s, t) => s + t.amount, 0)
          cards.push({
            envelope, bills: destBills, weeklyFill: destFill, balance,
            kind: 'route', destination,
            transfers: routeTransfers, transferred,
          })
        }
        // Also accumulator card for any bills WITHOUT a debit destination
        const accBills = bills.filter(b => !b.debit_account_id || b.debit_account_id === envelopeId)
        if (accBills.length > 0) {
          const accFill = accBills.reduce((s, b) => s + (cashflow.effective[b.id] ?? 0), 0)
          cards.push({
            envelope, bills: accBills, weeklyFill: accFill, balance,
            kind: 'accumulator', transfers: [], transferred: 0,
          })
        }
      } else {
        // No debit account on any bill → pure accumulator
        cards.push({
          envelope, bills, weeklyFill, balance,
          kind: 'accumulator', transfers: [], transferred: 0,
        })
      }
    }
    // Sort: routes needing action first, then completed routes, then accumulators
    return cards.sort((a, b) => {
      const aKind = a.kind === 'accumulator' ? 2 : (a.transferred >= a.weeklyFill * 0.95 ? 1 : 0)
      const bKind = b.kind === 'accumulator' ? 2 : (b.transferred >= b.weeklyFill * 0.95 ? 1 : 0)
      if (aKind !== bKind) return aKind - bKind
      return a.envelope.name.localeCompare(b.envelope.name)
    })
  }, [expenses, accounts, transfers, cashflow, latestLogs])

  // Keep "routes" name for the transfer save/delete handlers (they use fromAccount/toAccount)
  type Route = { fromAccount: Account; toAccount: Account; weeklyAmount: number; transferred: number }

  // ── Pay context (real cash arriving this week, not weekly average) ────────

  const payingThisWeek = income.filter(s =>
    s.payday_reference && isPayWeek(s.payday_reference, s.frequency, weekStart)
  )
  const cashArrivingThisWeek = payingThisWeek.reduce((s, p) => s + getEffectivePay(p), 0)

  // ── Per-pay-event attribution ───────────────────────────────────────────
  // Pay events alternate (e.g. James's fortnight, then Alex's fortnight). Each pay
  // covers ONE WEEK of shared/joint expenses (since the other week is funded by the
  // other person's next pay). Person-specific items are fully funded by that person
  // — they cover their full pay period (2 weeks for fortnightly etc).
  //
  // Per pay event:
  //   • Their attributed (funded_by = them) items × their pay period in weeks
  //   • 1 week of shared (funded_by = null) items — this pay covers this week's worth
  //   • 1 week of goal contributions (treated as shared)
  //   • James-only items don't deduct from Alex's pay, and vice versa.
  const N_PAYERS = Math.max(1, income.length)

  interface PayItemLine {
    expense: Expense
    weekly: number
    contribution: number   // dollars actually charged to this pay event
  }
  interface PayGoalLine {
    goal: Goal
    weekly: number
    contribution: number
  }
  interface PayBreakdown {
    payer: IncomeSource
    periodWeeks: number
    arriving: number
    attributedItems: PayItemLine[]
    sharedRoutedItems: PayItemLine[]      // joint items that transfer to a Bank 2 destination
    sharedAccumulatingItems: PayItemLine[] // joint items that stay in their envelope
    goalItems: PayGoalLine[]
    attributedWeekly: number
    sharedRoutedWeekly: number
    sharedAccumulatingWeekly: number
    sharedWeekly: number
    goalsWeekly: number
    attributedPay: number    // attributed × payPeriodWeeks
    sharedRoutedShare: number  // routed × 1
    sharedAccumulatingShare: number // accumulating × 1
    sharedShare: number       // routed + accumulating
    goalsShare: number       // goals × 1
    totalOutflow: number
    remaining: number
  }

  function isRoutedExpense(e: Expense): boolean {
    const fromId = e.save_account_id ?? e.account_id
    const toId = e.debit_account_id
    return !!(fromId && toId && fromId !== toId)
  }

  const payBreakdowns: PayBreakdown[] = payingThisWeek.map(payer => {
    const periodWeeks = payPeriodWeeks(payer.frequency)
    const attributedItems: PayItemLine[] = []
    const sharedRoutedItems: PayItemLine[] = []
    const sharedAccumulatingItems: PayItemLine[] = []
    let attributedWeekly = 0
    let sharedRoutedWeekly = 0
    let sharedAccumulatingWeekly = 0
    for (const e of expenses) {
      const w = cashflow.effective[e.id] ?? 0
      if (w === 0) continue
      if (e.funded_by_income_id === payer.id) {
        attributedItems.push({ expense: e, weekly: w, contribution: w * periodWeeks })
        attributedWeekly += w
      } else if (e.funded_by_income_id == null) {
        // One week of this shared expense is on this pay event
        const line: PayItemLine = { expense: e, weekly: w, contribution: w * 1 }
        if (isRoutedExpense(e)) {
          sharedRoutedItems.push(line)
          sharedRoutedWeekly += w
        } else {
          sharedAccumulatingItems.push(line)
          sharedAccumulatingWeekly += w
        }
      }
    }
    const goalItems: PayGoalLine[] = goals
      .filter(g => g.status === 'active' && g.weekly_contribution > 0)
      .map(g => ({ goal: g, weekly: g.weekly_contribution, contribution: g.weekly_contribution * 1 }))
    const goalsWeekly = cashflow.goalContributions
    const arriving = getEffectivePay(payer)
    const attributedPay = attributedWeekly * periodWeeks
    const sharedRoutedShare = sharedRoutedWeekly * 1
    const sharedAccumulatingShare = sharedAccumulatingWeekly * 1
    const sharedWeekly = sharedRoutedWeekly + sharedAccumulatingWeekly
    const sharedShare = sharedRoutedShare + sharedAccumulatingShare
    const goalsShare = goalsWeekly * 1
    const totalOutflow = attributedPay + sharedShare + goalsShare
    // Sort items by contribution descending so the biggest line items appear first
    attributedItems.sort((a, b) => b.contribution - a.contribution)
    sharedRoutedItems.sort((a, b) => b.contribution - a.contribution)
    sharedAccumulatingItems.sort((a, b) => b.contribution - a.contribution)
    return {
      payer, periodWeeks, arriving,
      attributedItems, sharedRoutedItems, sharedAccumulatingItems, goalItems,
      attributedWeekly, sharedRoutedWeekly, sharedAccumulatingWeekly, sharedWeekly, goalsWeekly,
      attributedPay, sharedRoutedShare, sharedAccumulatingShare, sharedShare,
      goalsShare, totalOutflow,
      remaining: arriving - totalOutflow,
    }
  })

  const totalArriving = payBreakdowns.reduce((s, b) => s + b.arriving, 0)
  const totalOutflow = payBreakdowns.reduce((s, b) => s + b.totalOutflow, 0)
  const totalRemaining = totalArriving - totalOutflow

  // ── Actions ───────────────────────────────────────────────────────────────

  async function handleSaveTransfer(fromAccount: Account, toAccount: Account) {
    const key = `${fromAccount.id}-${toAccount.id}`
    const raw = drafts[key]
    const amount = parseFloat(raw)
    if (!amount || amount <= 0) {
      toast('Enter an amount greater than $0', 'danger')
      return
    }
    await (window.api as any).transfers.save({
      from_account_id: fromAccount.id,
      to_account_id: toAccount.id,
      amount,
      week_start: weekStart,
    })
    toast(`Logged ${formatCurrency(amount)}: ${fromAccount.name} → ${toAccount.name}`)
    setDrafts(d => ({ ...d, [key]: '' }))
    loadWeekData()
  }

  async function handleDeleteTransfer(id: number) {
    await (window.api as any).transfers.delete(id)
    toast('Transfer removed', 'danger')
    loadWeekData()
  }

  // Confirm an envelope was filled by auto-split this week.
  // Recorded as a self-transfer (from = to = envelope) plus a balance log update.
  async function handleFillEnvelope(envelope: Account, amount: number, currentBalance: number) {
    if (!amount || amount <= 0) {
      toast('Enter a fill amount greater than $0', 'danger')
      return
    }
    await (window.api as any).transfers.save({
      from_account_id: envelope.id,
      to_account_id: envelope.id,
      amount,
      week_start: weekStart,
      notes: 'Auto-split fill confirmed',
    })
    await window.api.balances.save({
      account_id: envelope.id,
      balance: currentBalance + amount,
      notes: `Auto-split fill +${formatCurrency(amount)}`,
    })
    toast(`${envelope.name} filled +${formatCurrency(amount)}`)
    setFillDrafts(d => { const next = { ...d }; delete next[envelope.id]; return next })
    await loadBase()
    await loadWeekData()
  }

  async function handleUndoFill(transferId: number) {
    await (window.api as any).transfers.delete(transferId)
    toast('Fill undone — balance log still recorded; adjust manually if needed', 'danger')
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

      {/* Pay context — sticky so the summary stays visible as you log transfers */}
      {payingThisWeek.length > 0 ? (
        <div className="sticky top-0 z-20 bg-surface border border-accent/40 rounded-lg p-4 space-y-3 shadow-xl">
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

          {/* Per-pay breakdown — what each pay needs to fund this pay event */}
          {payBreakdowns.length > 0 && (
            <div className="pl-7 pt-3 border-t border-accent/20 space-y-3">
              {payBreakdowns.map(b => (
                <button
                  type="button"
                  key={b.payer.id}
                  onClick={() => setDetailPayerId(b.payer.id)}
                  className="w-full text-left text-xs hover:bg-accent/5 rounded-lg p-2 -m-2 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-wider text-text-muted">
                      {b.payer.person_name}'s pay — math for this pay event
                    </p>
                    <p className="text-[10px] text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                      Click for item-by-item breakdown →
                    </p>
                  </div>
                  <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 tabular-nums">
                    <span className="text-text-secondary">Arriving</span>
                    <span className="text-text-primary text-right">{formatCurrency(b.arriving)}</span>

                    {b.attributedPay > 0 && (
                      <>
                        <span className="text-text-muted pl-3">− {b.payer.person_name}-only expenses ({b.attributedItems.length} item{b.attributedItems.length === 1 ? '' : 's'} × {payPeriodWeeks(b.payer.frequency)}wk)</span>
                        <span className="text-text-secondary text-right">−{formatCurrency(b.attributedPay)}</span>
                      </>
                    )}
                    {b.sharedShare > 0 && (
                      <>
                        <span className="text-text-muted pl-3">− This week's joint expenses ({b.sharedRoutedItems.length + b.sharedAccumulatingItems.length} items × 1wk)</span>
                        <span className="text-text-secondary text-right">−{formatCurrency(b.sharedShare)}</span>
                        {b.sharedRoutedShare > 0 && (
                          <>
                            <span className="text-text-muted pl-6 text-[10px]">↳ Via transfers ({b.sharedRoutedItems.length} routed bill{b.sharedRoutedItems.length === 1 ? '' : 's'})</span>
                            <span className="text-text-muted text-right text-[10px]">{formatCurrency(b.sharedRoutedShare)}</span>
                          </>
                        )}
                        {b.sharedAccumulatingShare > 0 && (
                          <>
                            <span className="text-text-muted pl-6 text-[10px]">↳ Via accumulating envelopes ({b.sharedAccumulatingItems.length} bill{b.sharedAccumulatingItems.length === 1 ? '' : 's'})</span>
                            <span className="text-text-muted text-right text-[10px]">{formatCurrency(b.sharedAccumulatingShare)}</span>
                          </>
                        )}
                      </>
                    )}
                    {b.goalsShare > 0 && (
                      <>
                        <span className="text-text-muted pl-3">− This week's goal contributions ({b.goalItems.length} goal{b.goalItems.length === 1 ? '' : 's'})</span>
                        <span className="text-text-secondary text-right">−{formatCurrency(b.goalsShare)}</span>
                      </>
                    )}

                    <span className="text-text-primary font-semibold border-t border-accent/20 pt-1 mt-0.5">Remaining from {b.payer.person_name}'s pay</span>
                    <span className={`text-right font-semibold border-t border-accent/20 pt-1 mt-0.5 ${b.remaining >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(b.remaining)}
                    </span>
                  </div>
                </button>
              ))}

              {payBreakdowns.length > 1 && (
                <div className="pt-2 border-t border-accent/20 text-xs grid grid-cols-[1fr_auto] gap-x-3 tabular-nums">
                  <span className="text-text-primary font-semibold">Total remaining this week</span>
                  <span className={`text-right font-semibold ${totalRemaining >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatCurrency(totalRemaining)}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-2/40 border border-border rounded-lg p-4 flex items-center gap-3">
          <DollarSign size={18} className="text-text-muted flex-shrink-0" />
          <p className="text-sm text-text-secondary">No pay arriving this week — running on what's already in envelopes.</p>
        </div>
      )}

      {/* Unified envelope grid — every envelope is the same kind of card */}
      {envelopeCards.length > 0 ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">Envelopes this week</h2>
              <p className="text-[11px] text-text-muted mt-0.5">
                Each envelope auto-fills from your pay. Some need a manual transfer to Bank 2, others drain via spending or accumulate.
              </p>
            </div>
            <p className="text-[11px] text-text-muted">
              {envelopeCards.filter(c => c.kind === 'route' && c.transferred >= c.weeklyFill * 0.95).length}
              {' / '}
              {envelopeCards.filter(c => c.kind === 'route').length} transfers done
            </p>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {envelopeCards.map(card => {
              const key = card.destination
                ? `${card.envelope.id}-${card.destination.id}`
                : `acc-${card.envelope.id}-${card.bills[0]?.id ?? 0}`
              const draft = drafts[key] ?? ''
              const remaining = Math.max(0, card.weeklyFill - card.transferred)
              const isComplete = card.kind === 'route' && card.transferred >= card.weeklyFill * 0.95
              const destLog = card.destination ? latestLogs.find(l => l.account_id === card.destination!.id) : null

              return (
                <Card key={key} className={isComplete ? 'border-success/30' : ''}>
                  <CardContent className="pt-4 pb-4">
                    {/* Header: envelope name + this week's fill amount */}
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: card.envelope.color }} />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text-primary truncate">{card.envelope.name}</p>
                          {card.kind === 'route' && card.destination ? (
                            <p className="text-[11px] text-text-muted flex items-center gap-1 truncate">
                              <ArrowRight size={10} className="flex-shrink-0" />
                              <span className="truncate">{card.destination.name}</span>
                            </p>
                          ) : (
                            <p className="text-[11px] text-text-muted">Stays in envelope</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-text-muted uppercase tracking-wider">Filled this week</p>
                        <p className="text-base font-semibold text-success tabular-nums">+{formatCurrency(card.weeklyFill)}</p>
                      </div>
                    </div>

                    {/* Sub-stats: balance + bill count + destination balance (routes only) */}
                    <div className="flex items-center gap-4 text-[11px] text-text-muted mb-3 pb-3 border-b border-border">
                      <span>Balance: <span className="text-text-primary tabular-nums">{formatCurrency(card.balance)}</span></span>
                      <span>{card.bills.length} bill{card.bills.length === 1 ? '' : 's'}</span>
                      {destLog && (
                        <span>Destination: <span className="text-text-primary tabular-nums">{formatCurrency(destLog.balance)}</span></span>
                      )}
                    </div>

                    {/* Action area — varies by kind */}
                    {card.kind === 'route' ? (
                      <>
                        {!isComplete ? (
                          <div className="space-y-2">
                            <div className="flex items-baseline justify-between">
                              <p className="text-xs text-text-secondary">Move to {card.destination!.name}</p>
                              <p className="text-xs text-text-muted">Suggested {formatCurrency(remaining)}</p>
                            </div>
                            <div className="flex items-stretch gap-2">
                              <Input
                                type="number"
                                prefix="$"
                                placeholder={remaining.toFixed(2)}
                                value={draft}
                                onChange={e => setDrafts(d => ({ ...d, [key]: e.target.value }))}
                                className="flex-1"
                              />
                              <Button onClick={() => handleSaveTransfer(card.envelope, card.destination!)} disabled={!draft}>
                                Log
                              </Button>
                            </div>
                            {card.transferred > 0 && (
                              <p className="text-[10px] text-success">Already moved {formatCurrency(card.transferred)} of {formatCurrency(card.weeklyFill)}</p>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm text-success">
                            <CheckCircle2 size={16} />
                            <span>Transfer done · {formatCurrency(card.transferred)} moved</span>
                          </div>
                        )}

                        {/* Logged transfers (when any exist) */}
                        {card.transfers.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-border space-y-1">
                            {card.transfers.map(t => (
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
                      </>
                    ) : (() => {
                      // Detect if envelope has been filled this week (self-transfer)
                      const fillTransfer = transfers.find(t =>
                        t.from_account_id === card.envelope.id &&
                        t.to_account_id === card.envelope.id
                      )
                      const fillDraft = fillDrafts[card.envelope.id] ?? ''
                      if (fillTransfer) {
                        return (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2 text-sm text-success">
                              <CheckCircle2 size={16} />
                              <span>Filled +{formatCurrency(fillTransfer.amount)} this week</span>
                            </div>
                            <button
                              onClick={() => handleUndoFill(fillTransfer.id)}
                              className="text-[10px] text-text-muted hover:text-danger transition-colors"
                            >
                              Undo fill
                            </button>
                          </div>
                        )
                      }
                      return (
                        <div className="space-y-2">
                          <div className="flex items-baseline justify-between">
                            <p className="text-xs text-text-secondary">Click to fill for the week</p>
                            <p className="text-xs text-text-muted">Suggested {formatCurrency(card.weeklyFill)}</p>
                          </div>
                          <div className="flex items-stretch gap-2">
                            <Input
                              type="number"
                              prefix="$"
                              placeholder={card.weeklyFill.toFixed(2)}
                              value={fillDraft}
                              onChange={e => setFillDrafts(d => ({ ...d, [card.envelope.id]: e.target.value }))}
                              className="flex-1"
                            />
                            <Button
                              onClick={() => handleFillEnvelope(card.envelope, parseFloat(fillDraft) || card.weeklyFill, card.balance)}
                            >
                              Fill
                            </Button>
                          </div>
                          <p className="text-[10px] text-text-muted">Confirms auto-split arrived and adds this amount to the balance.</p>
                        </div>
                      )
                    })()}

                    {/* Bills list (compact, always shown) */}
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-[10px] text-text-muted uppercase tracking-wider mb-1.5">Covers</p>
                      <div className="flex flex-wrap gap-1">
                        {card.bills.map(bill => (
                          <span key={bill.id} className="text-[10px] bg-surface-2 border border-border rounded px-1.5 py-0.5 text-text-secondary">
                            {bill.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center">
            <Wallet size={28} className="text-text-muted mx-auto mb-3" />
            <p className="text-sm text-text-secondary">No envelopes set up yet.</p>
            <p className="text-xs text-text-muted mt-1">In Budget Setup → Expenses, set "Saves to" on each bill to assign it to an envelope.</p>
          </CardContent>
        </Card>
      )}

      {/* Per-pay item-by-item breakdown modal */}
      {(() => {
        const b = payBreakdowns.find(x => x.payer.id === detailPayerId)
        if (!b) return null
        return (
          <Dialog open={detailPayerId !== null} onOpenChange={(o) => !o && setDetailPayerId(null)}>
            <DialogContent
              title={`${b.payer.person_name}'s pay — item-by-item breakdown`}
              description={`Every expense contributing to the ${formatCurrency(b.totalOutflow)} deduction from this ${formatCurrency(b.arriving)} pay event.`}
              className="max-w-3xl"
            >
              <div className="space-y-5">
                {/* Attributed items */}
                {b.attributedItems.length > 0 && (
                  <section>
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        {b.payer.person_name}-only expenses
                      </h3>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatCurrency(b.attributedPay)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mb-2">
                      Each item: weekly equivalent × {b.periodWeeks} weeks (full responsibility — only {b.payer.person_name}'s pay covers these).
                    </p>
                    <div className="space-y-1">
                      {b.attributedItems.map(line => (
                        <div key={line.expense.id} className="flex items-center justify-between bg-surface-2/40 border border-border rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary truncate">{line.expense.name}</p>
                            <p className="text-[10px] text-text-muted">
                              {line.expense.is_percentage
                                ? `${line.expense.percentage_value}% of pay`
                                : `${formatCurrency(line.expense.amount)} ${line.expense.frequency}`}
                              {' · '}{formatCurrency(line.weekly)}/wk
                            </p>
                          </div>
                          <span className="text-text-primary tabular-nums font-semibold">{formatCurrency(line.contribution)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Joint expenses — via transfers (routed envelope → Bank 2) */}
                {b.sharedRoutedItems.length > 0 && (
                  <section>
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        Joint expenses — via transfers
                      </h3>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatCurrency(b.sharedRoutedShare)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mb-2">
                      Bills you manually move from a Bank 1 envelope to a Bank 2 debit account. These match what's shown under "Transfers to make".
                    </p>
                    <div className="space-y-1">
                      {b.sharedRoutedItems.map(line => (
                        <div key={line.expense.id} className="flex items-center justify-between bg-surface-2/40 border border-border rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary truncate">{line.expense.name}</p>
                            <p className="text-[10px] text-text-muted">
                              {line.expense.is_percentage
                                ? `${line.expense.percentage_value}% of pay`
                                : `${formatCurrency(line.expense.amount)} ${line.expense.frequency.replace('_', ' ')}`}
                              {' · '}{formatCurrency(line.weekly)}/wk
                              {line.expense.save_account_name && line.expense.debit_account_name && (
                                <> · {line.expense.save_account_name} → {line.expense.debit_account_name}</>
                              )}
                            </p>
                          </div>
                          <span className="text-text-primary tabular-nums font-semibold">{formatCurrency(line.contribution)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Joint expenses — accumulating envelopes (paid direct) */}
                {b.sharedAccumulatingItems.length > 0 && (
                  <section>
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        Joint expenses — accumulating envelopes
                      </h3>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatCurrency(b.sharedAccumulatingShare)}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-muted mb-2">
                      Funded by auto-split but stay in their envelope — no manual transfer needed (paid direct or building up over time).
                    </p>
                    <div className="space-y-1">
                      {b.sharedAccumulatingItems.map(line => (
                        <div key={line.expense.id} className="flex items-center justify-between bg-surface-2/40 border border-border rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary truncate">{line.expense.name}</p>
                            <p className="text-[10px] text-text-muted">
                              {line.expense.is_percentage
                                ? `${line.expense.percentage_value}% of pay`
                                : `${formatCurrency(line.expense.amount)} ${line.expense.frequency.replace('_', ' ')}`}
                              {' · '}{formatCurrency(line.weekly)}/wk
                              {(line.expense.save_account_name ?? line.expense.account_name) && (
                                <> · stays in {line.expense.save_account_name ?? line.expense.account_name}</>
                              )}
                            </p>
                          </div>
                          <span className="text-text-primary tabular-nums font-semibold">{formatCurrency(line.contribution)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Goals */}
                {b.goalItems.length > 0 && (
                  <section>
                    <div className="flex items-baseline justify-between mb-2">
                      <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
                        This week's goal contributions
                      </h3>
                      <span className="text-sm font-semibold text-text-primary tabular-nums">
                        {formatCurrency(b.goalsShare)}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {b.goalItems.map(line => (
                        <div key={line.goal.id} className="flex items-center justify-between bg-surface-2/40 border border-border rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="text-text-primary truncate">{line.goal.name}</p>
                            <p className="text-[10px] text-text-muted">{formatCurrency(line.weekly)}/wk full</p>
                          </div>
                          <span className="text-text-primary tabular-nums font-semibold">{formatCurrency(line.contribution)}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {/* Totals */}
                <div className="pt-3 border-t border-border space-y-1 text-sm tabular-nums">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Arriving</span>
                    <span className="text-text-primary">{formatCurrency(b.arriving)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Total deductions from this pay</span>
                    <span className="text-text-primary">−{formatCurrency(b.totalOutflow)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border font-semibold">
                    <span className="text-text-primary">Remaining</span>
                    <span className={b.remaining >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(b.remaining)}</span>
                  </div>
                </div>

                <DialogClose asChild>
                  <Button variant="outline" className="w-full">Close</Button>
                </DialogClose>
              </div>
            </DialogContent>
          </Dialog>
        )
      })()}
    </div>
  )
}
