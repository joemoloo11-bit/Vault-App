import { useState, useEffect } from 'react'
import { Plus, AlertTriangle, CheckCircle2, XCircle, DollarSign, TrendingUp, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@renderer/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { useToast } from '@renderer/components/ui/toast'
import { formatCurrency, getDueDayLabel } from '@renderer/lib/utils'
import { toWeeklyAmount } from '@renderer/types'
import type { Account, BalanceLog, Expense } from '@renderer/types'
import { format } from 'date-fns'

function toMonthly(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly': return amount * 4.33
    case 'fortnightly': return amount * 2.165
    case 'monthly': return amount
    case 'quarterly': return amount / 3
    case 'annual': return amount / 12
    default: return amount
  }
}

function getMonthsAhead(bill: Expense, allBills: Expense[], balance: number): number {
  const totalMonthlyAlloc = allBills.reduce((sum, b) => sum + toMonthly(b.allocation_amount ?? b.amount, b.frequency), 0)
  if (totalMonthlyAlloc === 0 || balance <= 0) return 0
  const billMonthlyAlloc = toMonthly(bill.allocation_amount ?? bill.amount, bill.frequency)
  const billShare = (billMonthlyAlloc / totalMonthlyAlloc) * balance
  const billMonthlyCost = toMonthly(bill.amount, bill.frequency)
  if (billMonthlyCost === 0) return 0
  return billShare / billMonthlyCost
}

function formatMonthsAhead(months: number): string {
  if (months >= 12) return `${(months / 12).toFixed(1)}y ahead`
  if (months >= 1) return `${months.toFixed(1)}mo ahead`
  const days = Math.round(months * 30)
  return `${days}d ahead`
}

type CoverageUnit = 'dollars' | 'weeks' | 'months'

function formatCoverage(months: number, unit: CoverageUnit, dollarValue: number): string {
  if (unit === 'dollars') return formatCurrency(dollarValue)
  if (unit === 'weeks') {
    const weeks = months * 4.33
    if (weeks >= 52) return `${(weeks / 52).toFixed(1)}y ahead`
    if (weeks >= 1) return `${weeks.toFixed(1)}wk ahead`
    return `${Math.round(weeks * 7)}d ahead`
  }
  return formatMonthsAhead(months)
}

function getCoveredUntil(months: number): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + Math.round(months * 30))
  return d
}

interface AccountWithData {
  account: Account
  latestLog?: BalanceLog
  bills: Expense[]
}

export default function AccountTracker() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [latestLogs, setLatestLogs] = useState<BalanceLog[]>([])
  const [allLogs, setAllLogs] = useState<BalanceLog[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [simulatorOpen, setSimulatorOpen] = useState(false)
  const [quickBalances, setQuickBalances] = useState<Record<number, { balance: string; notes: string }>>({})
  const [simAccountId, setSimAccountId] = useState<string>('none')
  const [simWithdraw, setSimWithdraw] = useState('')
  const [historyAccountId, setHistoryAccountId] = useState<number | null>(null)
  const [confirmDeleteLogId, setConfirmDeleteLogId] = useState<number | null>(null)
  const [coverageUnit, setCoverageUnit] = useState<CoverageUnit>('months')
  const [expandedAccounts, setExpandedAccounts] = useState<Set<number>>(new Set())
  const { toast } = useToast()

  function toggleExpanded(id: number) {
    setExpandedAccounts(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [acc, logs, allLog, exp] = await Promise.all([
      window.api.accounts.getAll(),
      window.api.balances.getLatest(),
      window.api.balances.getAll(),
      window.api.expenses.getAll(),
    ])
    setAccounts(acc)
    setLatestLogs(logs)
    setAllLogs(allLog as BalanceLog[])
    setExpenses(exp)
  }

  function getAccountHistory(accountId: number): BalanceLog[] {
    return allLogs
      .filter(l => l.account_id === accountId)
      .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
  }

  async function handleDeleteLog(id: number) {
    await (window.api as any).balances.delete(id)
    toast('Log entry deleted', 'danger')
    await loadAll()
  }

  function openQuickLog() {
    const initial: Record<number, { balance: string; notes: string }> = {}
    accounts.forEach(acc => {
      const latest = latestLogs.find(l => l.account_id === acc.id)
      initial[acc.id] = { balance: latest ? String(latest.balance) : '', notes: '' }
    })
    setQuickBalances(initial)
    setLogOpen(true)
  }

  async function handleQuickLogSave() {
    const saves = Object.entries(quickBalances)
      .filter(([, v]) => v.balance !== '')
      .map(([id, v]) => window.api.balances.save({
        account_id: parseInt(id),
        balance: parseFloat(v.balance),
        notes: v.notes || undefined,
      }))
    await Promise.all(saves)
    setLogOpen(false)
    loadAll()
  }

  function getAccountData(): AccountWithData[] {
    return accounts.map(acc => ({
      account: acc,
      latestLog: latestLogs.find(l => l.account_id === acc.id),
      // Bills belong to the account they actually DEBIT from. For routed bills,
      // that's debit_account_id. For accumulating bills (no debit_account), they
      // pay from the save_account. Pre-v1.5 data falls back to legacy account_id.
      // Net effect: pure transit envelopes show no bills (correct — they're just
      // conduits, the bills are covered by their debit account's balance).
      bills: expenses.filter(e => {
        const homeId = e.debit_account_id ?? e.save_account_id ?? e.account_id
        return homeId === acc.id
      }),
    }))
  }

  function getCoverageStatus(data: AccountWithData): 'covered' | 'at-risk' | 'shortfall' | 'unknown' | 'envelope' {
    // Envelopes are transient — they fill on pay day and drain on transfer day. Judging
    // them by current balance vs bills is misleading. Until v1.10.0 records transfer
    // events and can derive proper envelope state, just mark them as 'envelope' (neutral).
    if (data.account.type === 'envelope') return 'envelope'
    if (!data.latestLog) return 'unknown'
    const monthlyBills = data.bills.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0)
    if (monthlyBills === 0) return 'covered'
    const monthsOfCoverage = data.latestLog.balance / monthlyBills
    if (monthsOfCoverage >= 1) return 'covered'
    if (monthsOfCoverage >= 0.5) return 'at-risk'
    return 'shortfall'
  }

  // Shortfall simulator
  const simAccount = simAccountId !== 'none' ? accounts.find(a => a.id === parseInt(simAccountId)) : undefined
  const simLog = simAccount ? latestLogs.find(l => l.account_id === simAccount.id) : null
  const simBills = simAccount ? expenses.filter(e => e.account_id === simAccount.id) : []
  const simWeeklyBills = simBills.reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0)
  const simMonthlyBills = simBills.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0)
  const simCurrentBalance = simLog?.balance ?? 0
  const simAfterWithdraw = simCurrentBalance - (parseFloat(simWithdraw) || 0)
  const simMonthsAfter = simMonthlyBills > 0 ? simAfterWithdraw / simMonthlyBills : Infinity
  const simStatus = simMonthsAfter >= 1 ? 'covered' : simMonthsAfter >= 0.5 ? 'at-risk' : 'shortfall'

  const statusConfig = {
    covered: { label: 'Covered', variant: 'success' as const, icon: CheckCircle2, color: 'text-success' },
    'at-risk': { label: 'At Risk', variant: 'warning' as const, icon: AlertTriangle, color: 'text-warning' },
    shortfall: { label: 'Shortfall', variant: 'danger' as const, icon: XCircle, color: 'text-danger' },
    unknown: { label: 'No data', variant: 'muted' as const, icon: DollarSign, color: 'text-text-muted' },
    envelope: { label: 'Envelope', variant: 'muted' as const, icon: DollarSign, color: 'text-text-muted' },
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Account Tracker</h1>
          <p className="text-sm text-text-secondary mt-1">Log balances and see what's covered by your upcoming bills.</p>
        </div>
        <div className="flex gap-2 items-center">
          <div className="flex items-center bg-surface-2 rounded-md border border-border p-0.5 mr-1">
            {(['dollars', 'weeks', 'months'] as const).map(unit => (
              <button
                key={unit}
                onClick={() => setCoverageUnit(unit)}
                className={`text-[11px] px-2 py-1 rounded transition-colors capitalize ${
                  coverageUnit === unit
                    ? 'bg-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {unit === 'dollars' ? '$' : unit}
              </button>
            ))}
          </div>
          <Dialog open={simulatorOpen} onOpenChange={setSimulatorOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Shortfall Simulator</Button>
            </DialogTrigger>
            <DialogContent title="Shortfall Simulator" description="See what happens to an account if you take money out of it.">
              <div className="space-y-4">
                <Select value={simAccountId} onValueChange={setSimAccountId}>
                  <SelectTrigger label="Account"><SelectValue placeholder="Choose an account" /></SelectTrigger>
                  <SelectContent>
                    {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                {simAccount && (
                  <>
                    <div className="bg-surface-2 rounded-lg p-3 border border-border text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-text-muted">Current balance</span>
                        <span className="text-text-primary font-medium">{formatCurrency(simCurrentBalance)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Weekly bills</span>
                        <span className="text-text-primary">{formatCurrency(simWeeklyBills)}/wk</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-text-muted">Monthly bills</span>
                        <span className="text-text-primary">{formatCurrency(simMonthlyBills)}/mo</span>
                      </div>
                    </div>

                    <Input
                      label="If I take out..."
                      type="number"
                      prefix="$"
                      placeholder="0.00"
                      value={simWithdraw}
                      onChange={e => setSimWithdraw(e.target.value)}
                    />

                    {simWithdraw && parseFloat(simWithdraw) > 0 && (
                      <div className={`rounded-lg p-4 border ${
                        simStatus === 'covered' ? 'bg-success/10 border-success/30' :
                        simStatus === 'at-risk' ? 'bg-warning/10 border-warning/30' :
                        'bg-danger/10 border-danger/30'
                      }`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-text-primary">Remaining balance</span>
                          <span className={`text-sm font-semibold ${statusConfig[simStatus].color}`}>
                            {formatCurrency(simAfterWithdraw)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={statusConfig[simStatus].variant}>
                            {statusConfig[simStatus].label}
                          </Badge>
                          <span className="text-xs text-text-secondary">
                            {simMonthlyBills > 0 && isFinite(simMonthsAfter)
                              ? `${formatMonthsAhead(simMonthsAfter)} of bills`
                              : 'No bills assigned to this account'
                            }
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={logOpen} onOpenChange={setLogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openQuickLog}><Plus size={14} /> Log Balances</Button>
            </DialogTrigger>
            <DialogContent title="Log Account Balances" description="Update all your account balances in one go. Leave blank to skip an account.">
              <div className="space-y-3">
                {accounts.map(acc => (
                  <div key={acc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-surface-2">
                    <div className="w-1 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary mb-1.5">{acc.name}</p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          prefix="$"
                          placeholder="Balance"
                          value={quickBalances[acc.id]?.balance ?? ''}
                          onChange={e => setQuickBalances(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], balance: e.target.value } }))}
                          className="flex-1"
                        />
                        <Input
                          placeholder="Notes (optional)"
                          value={quickBalances[acc.id]?.notes ?? ''}
                          onChange={e => setQuickBalances(prev => ({ ...prev, [acc.id]: { ...prev[acc.id], notes: e.target.value } }))}
                          className="flex-1"
                        />
                      </div>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button onClick={handleQuickLogSave} className="flex-1">Save All Balances</Button>
                  <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-secondary text-sm">No accounts set up yet.</p>
          <p className="text-text-muted text-xs mt-1">Go to Budget Setup → Accounts to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {getAccountData().map(data => {
            const { account, latestLog, bills } = data
            const status = getCoverageStatus(data)
            const sc = statusConfig[status]
            const StatusIcon = sc.icon
            const weeklyBills = bills.reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0)
            const monthlyBills = bills.reduce((sum, e) => sum + toMonthly(e.amount, e.frequency), 0)
            const balance = latestLog?.balance ?? 0

            return (
              <Card key={account.id} className="overflow-hidden transition-colors border-l-4" style={{ borderLeftColor: account.color }}>
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-base font-semibold text-text-primary">{account.name}</p>
                          {account.type && (
                            <span className="text-[10px] uppercase tracking-wider text-text-muted bg-surface-2 border border-border rounded px-1.5 py-0.5">
                              {account.type}
                            </span>
                          )}
                          {(() => {
                            if (!account.buffer_target || !account.sweep_amount || !account.sweep_to_account_id) return null
                            if (!latestLog) return null
                            const threshold = account.buffer_target + account.sweep_amount
                            if (latestLog.balance >= threshold) {
                              const sweepTo = accounts.find(a => a.id === account.sweep_to_account_id)
                              return (
                                <span className="text-[10px] uppercase tracking-wider text-accent bg-accent/10 border border-accent/30 rounded px-1.5 py-0.5">
                                  Sweep {formatCurrency(account.sweep_amount)} → {sweepTo?.name ?? 'savings'}
                                </span>
                              )
                            }
                            return null
                          })()}
                        </div>
                        {latestLog ? (
                          <p className="text-xs text-text-muted mt-0.5">
                            Logged {format(new Date(latestLog.logged_at), 'd MMM yyyy')}
                            {latestLog.notes && ` · ${latestLog.notes}`}
                          </p>
                        ) : (
                          <p className="text-xs text-text-muted mt-0.5">No balance logged yet</p>
                        )}
                      </div>
                    </div>
                    {/* Sparkline (clickable → history). Hide below 4 logs — too few to show a meaningful trend. */}
                    {(() => {
                      const history = getAccountHistory(account.id)
                      if (history.length < 4) return null
                      const sparkData = history.slice(-12).map(l => ({ balance: l.balance }))
                      return (
                        <button
                          onClick={() => setHistoryAccountId(account.id)}
                          className="hidden md:block w-32 h-10 hover:opacity-80 transition-opacity flex-shrink-0"
                          title="Click to see full history"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={sparkData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
                              <Line
                                type="monotone"
                                dataKey="balance"
                                stroke={account.color}
                                strokeWidth={1.5}
                                dot={false}
                                isAnimationActive={false}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </button>
                      )
                    })()}

                    <div className="text-right flex items-start gap-3">
                      <div>
                        <p className="text-2xl font-semibold text-text-primary tabular-nums">
                          {latestLog ? formatCurrency(latestLog.balance) : '—'}
                        </p>
                        {weeklyBills > 0 && (
                          <p className="text-xs text-text-muted mt-0.5">{formatCurrency(weeklyBills)}/wk · {formatCurrency(monthlyBills)}/mo</p>
                        )}
                      </div>
                      <Badge variant={sc.variant}>
                        <StatusIcon size={10} />
                        {sc.label}
                      </Badge>
                    </div>
                  </div>

                  {(() => {
                    const history = getAccountHistory(account.id)
                    if (history.length === 0) return null
                    return (
                      <div className="mt-3">
                        <button
                          onClick={() => setHistoryAccountId(account.id)}
                          className="text-[11px] text-accent hover:text-accent/80 inline-flex items-center gap-1 transition-colors"
                        >
                          <TrendingUp size={11} />
                          View balance history ({history.length} {history.length === 1 ? 'log' : 'logs'})
                        </button>
                      </div>
                    )
                  })()}

                  {bills.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <button
                        onClick={() => toggleExpanded(account.id)}
                        className="w-full flex items-center justify-between text-left mb-3 group"
                      >
                        <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider group-hover:text-text-secondary transition-colors">
                          {bills.length} {bills.length === 1 ? 'bill' : 'bills'} assigned
                        </p>
                        {expandedAccounts.has(account.id) ? (
                          <ChevronDown size={14} className="text-text-muted group-hover:text-text-secondary transition-colors" />
                        ) : (
                          <ChevronRight size={14} className="text-text-muted group-hover:text-text-secondary transition-colors" />
                        )}
                      </button>
                      {expandedAccounts.has(account.id) && (
                      <div className="space-y-2">
                        {bills.map(bill => {
                          const months = latestLog ? getMonthsAhead(bill, bills, balance) : null
                          const hasAlloc = bill.allocation_amount != null && bill.allocation_amount !== bill.amount
                          const aheadColor = months === null ? 'text-text-muted' :
                            months >= 1 ? 'text-success' :
                            months >= 0.5 ? 'text-warning' : 'text-danger'
                          // Per-bill dollar share of balance (proportional to its monthly allocation)
                          const totalMonthlyAlloc = bills.reduce((s, b) => s + toMonthly(b.allocation_amount ?? b.amount, b.frequency), 0)
                          const billMonthlyAlloc = toMonthly(bill.allocation_amount ?? bill.amount, bill.frequency)
                          const billDollarShare = totalMonthlyAlloc > 0 ? (billMonthlyAlloc / totalMonthlyAlloc) * balance : 0
                          const coveredUntil = months !== null && months > 0 ? getCoveredUntil(months) : null
                          return (
                            <div key={bill.id} className="flex items-center gap-3 bg-surface-2 rounded-lg px-3 py-2 border border-border">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-text-primary">{bill.name}</span>
                                  <span className="text-xs text-text-muted">{bill.frequency}</span>
                                  {bill.due_day && <span className="text-xs text-text-muted">due {getDueDayLabel(bill.due_day)}</span>}
                                  {bill.debit_account_name && bill.debit_account_name !== (bill.save_account_name ?? bill.account_name) && (
                                    <span className="text-[10px] text-text-muted bg-surface border border-border rounded px-1.5 py-0.5">
                                      → {bill.debit_account_name}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-xs text-text-secondary">{formatCurrency(bill.amount)}</span>
                                  {hasAlloc && (
                                    <>
                                      <span className="text-xs text-text-muted">·</span>
                                      <span className="text-xs text-accent">allocating {formatCurrency(bill.allocation_amount!)}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {months !== null ? (
                                  <>
                                    <span className={`text-sm font-semibold ${aheadColor}`}>
                                      {formatCoverage(months, coverageUnit, billDollarShare)}
                                    </span>
                                    {coveredUntil && (
                                      <p className="text-[10px] text-text-muted mt-0.5">until {format(coveredUntil, 'd MMM yyyy')}</p>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-xs text-text-muted">log balance to see</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Balance history modal */}
      {(() => {
        const account = accounts.find(a => a.id === historyAccountId)
        if (!account) return null
        const history = getAccountHistory(account.id)
        const accountBills = expenses.filter(e => (e.save_account_id ?? e.account_id) === account.id)
        const weeklyBillsForAcc = accountBills.reduce((s, e) => s + toWeeklyAmount(e.amount, e.frequency), 0)
        const weeklyTarget = account.weekly_target * (1 + (account.buffer_percent ?? 0) / 100)
        const netWeekly = weeklyTarget - weeklyBillsForAcc

        // Build chart data: history then 4-week projection
        const chartData = history.map(l => ({
          date: format(new Date(l.logged_at), 'd MMM'),
          balance: l.balance,
          projected: null as number | null,
        }))
        const lastBalance = history.length > 0 ? history[history.length - 1].balance : 0
        const lastDate = history.length > 0 ? new Date(history[history.length - 1].logged_at) : new Date()
        // Pin the last historical point as the start of the projection so the dashed line is continuous
        if (chartData.length > 0) chartData[chartData.length - 1].projected = lastBalance
        for (let w = 1; w <= 4; w++) {
          const projDate = new Date(lastDate)
          projDate.setDate(projDate.getDate() + w * 7)
          chartData.push({
            date: format(projDate, 'd MMM'),
            balance: null as any,
            projected: lastBalance + netWeekly * w,
          })
        }

        return (
          <Dialog open={historyAccountId !== null} onOpenChange={(o) => !o && setHistoryAccountId(null)}>
            <DialogContent
              title={`${account.name} — Balance History`}
              description="Past logs as a solid line; the dashed line projects 4 weeks ahead based on weekly target minus assigned bills."
              className="max-w-3xl"
            >
              <div className="space-y-4">
                <div className="h-64 -mx-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                      <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#64748B" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v / 1000).toFixed(1)}k`} width={50} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#161B22', border: '1px solid #21262D', borderRadius: 8, fontSize: 12, color: '#F0F6FC' }}
                        formatter={(v: number | null) => v == null ? null : formatCurrency(v)}
                      />
                      {history.length > 0 && (
                        <ReferenceLine x={format(lastDate, 'd MMM')} stroke="#64748B" strokeDasharray="2 2" />
                      )}
                      <Line type="monotone" dataKey="balance" stroke={account.color} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} isAnimationActive={false} name="Logged" />
                      <Line type="monotone" dataKey="projected" stroke={account.color} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={true} isAnimationActive={false} name="Projected" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="bg-surface-2 rounded-lg p-2.5 border border-border">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">Latest</p>
                    <p className="text-text-primary font-semibold mt-0.5 tabular-nums">{formatCurrency(lastBalance)}</p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-2.5 border border-border">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">In 4 weeks (projected)</p>
                    <p className={`font-semibold mt-0.5 tabular-nums ${netWeekly >= 0 ? 'text-success' : 'text-danger'}`}>
                      {formatCurrency(lastBalance + netWeekly * 4)}
                    </p>
                  </div>
                  <div className="bg-surface-2 rounded-lg p-2.5 border border-border">
                    <p className="text-text-muted text-[10px] uppercase tracking-wider">Net per week</p>
                    <p className={`font-semibold mt-0.5 tabular-nums ${netWeekly >= 0 ? 'text-success' : 'text-danger'}`}>
                      {netWeekly >= 0 ? '+' : ''}{formatCurrency(netWeekly)}
                    </p>
                  </div>
                </div>

                <div className="border-t border-border pt-3">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wider mb-2">All logs ({history.length})</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {[...history].reverse().map(log => (
                      <div key={log.id} className="flex items-center justify-between gap-2 bg-surface-2 rounded-lg px-3 py-2 border border-border">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm tabular-nums text-text-primary">{formatCurrency(log.balance)}</p>
                          <p className="text-[10px] text-text-muted">
                            {format(new Date(log.logged_at), 'EEE d MMM yyyy, h:mm a')}
                            {log.notes && ` · ${log.notes}`}
                          </p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDeleteLogId(log.id)}>
                          <Trash2 size={13} className="text-danger" />
                        </Button>
                      </div>
                    ))}
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

      <ConfirmDialog
        open={confirmDeleteLogId !== null}
        onOpenChange={o => !o && setConfirmDeleteLogId(null)}
        title="Delete this balance log?"
        description="This will permanently remove this entry from the account's history. The chart and projection will recalculate."
        onConfirm={() => confirmDeleteLogId !== null && handleDeleteLog(confirmDeleteLogId)}
      />
    </div>
  )
}
