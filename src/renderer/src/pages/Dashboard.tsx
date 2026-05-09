import { useState, useEffect } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Target, TrendingUp, DollarSign, ArrowRightLeft, Calendar, ListChecks } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Badge } from '@renderer/components/ui/badge'
import { Progress } from '@renderer/components/ui/progress'
import { formatCurrency, getCurrentWeekStart, getWeekLabel } from '@renderer/lib/utils'
import { toWeeklyAmount, getNextPayday, daysUntilPayday, getUpcomingPaydays } from '@renderer/types'
import type { Account, IncomeSource, Expense, BalanceLog, Goal, WeeklyAllocation } from '@renderer/types'
import { format, addDays } from 'date-fns'
import { Link } from 'react-router-dom'

function toMonthlyAmount(amount: number, freq: string): number {
  switch (freq) {
    case 'weekly': return amount * 4.33
    case 'fortnightly': return amount * 2.165
    case 'monthly': return amount
    case 'quarterly': return amount / 3
    case 'annual': return amount / 12
    default: return amount
  }
}

interface DashboardData {
  accounts: Account[]
  income: IncomeSource[]
  expenses: Expense[]
  latestLogs: BalanceLog[]
  goals: Goal[]
  weeklyAllocations: WeeklyAllocation[]
}

function getCushionScore(weeklyIncome: number, weeklyExpenses: number, latestLogs: BalanceLog[], accounts: Account[], expenses: Expense[]): number {
  if (weeklyIncome === 0) return 0
  // Savings component: how much of income is left after expenses (0–60 pts)
  const savingsRatio = Math.max(0, (weeklyIncome - weeklyExpenses) / weeklyIncome)
  const savingsScore = Math.round(savingsRatio * 60)
  // Coverage component: average months ahead across all accounts (0–40 pts)
  const coverageScores = accounts.map(acc => {
    const log = latestLogs.find(l => l.account_id === acc.id)
    if (!log) return 0
    const monthlyBills = expenses
      .filter(e => e.account_id === acc.id)
      .reduce((sum, e) => sum + toMonthlyAmount(e.amount, e.frequency), 0)
    if (monthlyBills === 0) return 40
    const months = log.balance / monthlyBills
    return Math.min(40, Math.round(months * 20))
  })
  const avgCoverage = coverageScores.length > 0
    ? coverageScores.reduce((a, b) => a + b, 0) / coverageScores.length
    : 20
  return Math.min(100, savingsScore + Math.round(avgCoverage))
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData>({
    accounts: [], income: [], expenses: [], latestLogs: [], goals: [], weeklyAllocations: [],
  })
  const [loading, setLoading] = useState(true)
  const weekStart = getCurrentWeekStart()

  useEffect(() => {
    async function load() {
      const [accounts, income, expenses, latestLogs, goals, weeklyAllocations] = await Promise.all([
        window.api.accounts.getAll(),
        window.api.income.getAll(),
        window.api.expenses.getAll(),
        window.api.balances.getLatest(),
        window.api.goals.getAll(),
        window.api.allocations.getWeek(weekStart),
      ])
      setData({ accounts, income, expenses, latestLogs, goals: goals as Goal[], weeklyAllocations: weeklyAllocations as WeeklyAllocation[] })
      setLoading(false)
    }
    load()
  }, [])

  const { accounts, income, expenses, latestLogs, goals, weeklyAllocations } = data

  const weeklyIncome = income.reduce((sum, s) => sum + toWeeklyAmount(s.amount, s.frequency), 0)
  const weeklyExpenses = expenses.reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0)
  const activeGoalContributions = (goals as Goal[])
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + g.weekly_contribution, 0)
  const freeCashflow = weeklyIncome - weeklyExpenses - activeGoalContributions
  const cushionScore = getCushionScore(weeklyIncome, weeklyExpenses, latestLogs, accounts, expenses)

  // Bills due this week (day of month 1-7 range around now)
  const today = new Date()
  const billsDueSoon = expenses
    .filter(e => e.due_day)
    .map(e => {
      const nextDue = new Date(today.getFullYear(), today.getMonth(), e.due_day!)
      if (nextDue < today) nextDue.setMonth(nextDue.getMonth() + 1)
      const daysUntil = Math.ceil((nextDue.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
      return { ...e, nextDue, daysUntil }
    })
    .filter(e => e.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 5)

  // Account health
  function getAccountHealth(acc: Account): 'covered' | 'at-risk' | 'shortfall' | 'no-data' {
    const log = latestLogs.find(l => l.account_id === acc.id)
    if (!log) return 'no-data'
    const monthlyBills = expenses
      .filter(e => e.account_id === acc.id)
      .reduce((sum, e) => sum + toMonthlyAmount(e.amount, e.frequency), 0)
    if (monthlyBills === 0) return 'covered'
    const months = log.balance / monthlyBills
    if (months >= 1) return 'covered'
    if (months >= 0.5) return 'at-risk'
    return 'shortfall'
  }

  const activeGoals = (goals as Goal[]).filter(g => g.status === 'active' && g.target_amount > 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isEmpty = income.length === 0 && accounts.length === 0 && expenses.length === 0

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-8 animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-[#0D1117] border border-accent/25 flex items-center justify-center mb-5">
          <span className="text-3xl font-black bg-gradient-to-b from-teal-300 to-teal-600 bg-clip-text text-transparent leading-none">V</span>
        </div>
        <h2 className="text-2xl font-semibold text-text-primary mb-2">Welcome to Vault</h2>
        <p className="text-text-secondary text-sm max-w-sm mb-6">
          Start by heading to <span className="text-accent font-medium">Budget Setup</span> to add your income, set up your accounts, and log your regular expenses.
        </p>
        <p className="text-xs text-text-muted">Your dashboard will come alive once you've added your data.</p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
          <p className="text-sm text-text-secondary mt-0.5">{getWeekLabel(weekStart)}</p>
        </div>
        <CushionScore score={cushionScore} />
      </div>

      {/* Key numbers */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Weekly Income" value={weeklyIncome} color="text-success" icon={DollarSign} accent="border-success" />
        <MetricCard label="Weekly Expenses" value={weeklyExpenses} color="text-warning" icon={TrendingUp} accent="border-warning" />
        <MetricCard
          label="Free Cashflow"
          value={freeCashflow}
          color={freeCashflow >= 0 ? 'text-success' : 'text-danger'}
          icon={TrendingUp}
          accent={freeCashflow >= 0 ? 'border-success' : 'border-danger'}
          sub={freeCashflow >= 0 ? 'after all expenses & goals' : 'over budget'}
          negative={freeCashflow < 0}
        />
      </div>

      {/* Payday countdown */}
      {income.some(s => s.payday_reference) && (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${income.filter(s => s.payday_reference).length}, 1fr)` }}>
          {income.filter(s => s.payday_reference).map(src => {
            const days = daysUntilPayday(src.payday_reference!, src.frequency)
            const nextDate = getNextPayday(src.payday_reference!, src.frequency)
            const urgency = days === 0 ? 'text-success' : days <= 2 ? 'text-warning' : 'text-text-secondary'
            return (
              <Card key={src.id} className="border-dashed">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs text-text-muted uppercase tracking-wider">{src.person_name}'s next pay</p>
                      <p className={`text-lg font-semibold mt-0.5 ${urgency}`}>
                        {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days} days`}
                      </p>
                      <p className="text-[11px] text-text-muted mt-0.5">{format(nextDate, 'EEE d MMM')} · {formatCurrency(src.amount)}</p>
                    </div>
                    <DollarSign size={20} className="text-text-muted flex-shrink-0" />
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* This Week — prioritized action list */}
      {(() => {
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)
        const weekEnd = new Date(todayStart)
        weekEnd.setDate(weekEnd.getDate() + 7)

        const items: { label: string; sub?: string; tone: 'accent' | 'warning' | 'danger' | 'muted'; href?: string }[] = []

        // 1. Pay arriving this week
        income.filter(s => s.payday_reference).forEach(src => {
          const next = getNextPayday(src.payday_reference!, src.frequency)
          if (next < weekEnd) {
            const days = Math.round((next.getTime() - todayStart.getTime()) / 86400000)
            const when = days === 0 ? 'today' : days === 1 ? 'tomorrow' : format(next, 'EEEE')
            items.push({
              label: `${src.person_name}'s pay arrives ${when}`,
              sub: `${formatCurrency(src.amount)} (${src.frequency})`,
              tone: days <= 1 ? 'accent' : 'muted',
            })
          }
        })

        // 2. Allocations not funded
        const fundedCount = weeklyAllocations.filter(a => a.funded === 1).length
        if (accounts.length > 0 && fundedCount < accounts.length) {
          items.push({
            label: `Move money to envelopes — ${fundedCount}/${accounts.length} done`,
            sub: 'Mark each account funded once you\'ve transferred',
            tone: fundedCount === 0 ? 'warning' : 'muted',
            href: '/weekly',
          })
        }

        // 3. Bills due in next 7 days
        const billsThisWeek = billsDueSoon.filter(b => b.daysUntil <= 7)
        if (billsThisWeek.length > 0) {
          items.push({
            label: `${billsThisWeek.length} bill${billsThisWeek.length === 1 ? '' : 's'} due this week`,
            sub: billsThisWeek.slice(0, 3).map(b => `${b.name} (${b.daysUntil}d)`).join(' · '),
            tone: billsThisWeek.some(b => b.daysUntil <= 2) ? 'danger' : 'warning',
          })
        }

        // 4. Sweep alerts
        const sweeps = accounts.filter(acc => {
          if (!acc.buffer_target || !acc.sweep_amount || !acc.sweep_to_account_id) return false
          const log = latestLogs.find(l => l.account_id === acc.id)
          if (!log) return false
          return log.balance >= acc.buffer_target + acc.sweep_amount
        })
        if (sweeps.length > 0) {
          items.push({
            label: `${sweeps.length} sweep${sweeps.length === 1 ? '' : 's'} ready to move`,
            sub: sweeps.map(s => `${s.name}: ${formatCurrency(s.sweep_amount!)}`).join(' · '),
            tone: 'accent',
            href: '/tracker',
          })
        }

        if (items.length === 0) return null

        const toneClasses = {
          accent: 'text-accent border-accent/30 bg-accent/5',
          warning: 'text-warning border-warning/30 bg-warning/5',
          danger: 'text-danger border-danger/30 bg-danger/5',
          muted: 'text-text-secondary border-border bg-surface-2/40',
        }

        return (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <ListChecks size={14} className="text-accent" />
              <CardTitle>This Week</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.map((it, i) => {
                  const inner = (
                    <div className={`rounded-lg border p-3 ${toneClasses[it.tone]}`}>
                      <p className="text-sm font-medium">{it.label}</p>
                      {it.sub && <p className="text-[11px] text-text-muted mt-0.5 truncate">{it.sub}</p>}
                    </div>
                  )
                  return it.href
                    ? <Link key={i} to={it.href} className="block hover:opacity-80 transition-opacity">{inner}</Link>
                    : <div key={i}>{inner}</div>
                })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      {/* Pay calendar — next 8 weeks */}
      {income.some(s => s.payday_reference) && (() => {
        const weeksAhead = 8
        const todayStart = new Date()
        todayStart.setHours(0, 0, 0, 0)

        // Build week buckets
        const weeks = Array.from({ length: weeksAhead }, (_, i) => {
          const start = addDays(todayStart, i * 7)
          const end = addDays(start, 7)
          return { start, end, events: [] as { person: string; amount: number; date: Date }[] }
        })

        income.filter(s => s.payday_reference).forEach(src => {
          const dates = getUpcomingPaydays(src.payday_reference!, src.frequency, weeksAhead, todayStart)
          dates.forEach(d => {
            const wk = weeks.find(w => d >= w.start && d < w.end)
            if (wk) wk.events.push({ person: src.person_name, amount: src.amount, date: d })
          })
        })

        // Compute lean weeks: pay arriving < weekly expenses
        const weeklyExpensesAmt = weeklyExpenses
        const weekTotals = weeks.map(w => w.events.reduce((s, e) => s + e.amount, 0))

        return (
          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Calendar size={14} className="text-accent" />
              <CardTitle>Pay Calendar — Next 8 Weeks</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-8 gap-2">
                {weeks.map((w, i) => {
                  const isLean = weekTotals[i] > 0 && weekTotals[i] < weeklyExpensesAmt
                  const isEmpty = w.events.length === 0
                  const baseClasses = isEmpty
                    ? 'border-border bg-surface-2/30 text-text-muted'
                    : isLean
                      ? 'border-warning/40 bg-warning/5'
                      : 'border-accent/30 bg-accent/5'
                  return (
                    <div key={i} className={`rounded-lg border p-2 min-h-[80px] flex flex-col ${baseClasses}`}>
                      <p className="text-[10px] uppercase tracking-wider text-text-muted">
                        {format(w.start, 'd MMM')}
                      </p>
                      {isEmpty ? (
                        <p className="text-[10px] text-text-muted mt-1">No pay</p>
                      ) : (
                        <div className="mt-1 space-y-0.5">
                          {w.events.map((e, j) => (
                            <div key={j}>
                              <p className="text-[11px] text-text-primary truncate">{e.person}</p>
                              <p className="text-[10px] text-text-muted tabular-nums">{formatCurrency(e.amount)}</p>
                            </div>
                          ))}
                          {isLean && (
                            <p className="text-[9px] text-warning mt-1 uppercase tracking-wider">Lean</p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <p className="text-[10px] text-text-muted mt-3">
                Lean weeks have pay arriving but less than your average weekly expenses ({formatCurrency(weeklyExpensesAmt)}).
              </p>
            </CardContent>
          </Card>
        )
      })()}

      {/* Sweep alerts */}
      {(() => {
        const sweepReady = accounts.filter(acc => {
          if (!acc.buffer_target || !acc.sweep_amount || !acc.sweep_to_account_id) return false
          const log = latestLogs.find(l => l.account_id === acc.id)
          if (!log) return false
          return log.balance >= acc.buffer_target + acc.sweep_amount
        })
        if (sweepReady.length === 0) return null
        return (
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader className="flex flex-row items-center gap-2">
              <ArrowRightLeft size={14} className="text-accent" />
              <CardTitle>Sweep Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {sweepReady.map(acc => {
                  const log = latestLogs.find(l => l.account_id === acc.id)!
                  const target = acc.sweep_to_account_id ? accounts.find(a => a.id === acc.sweep_to_account_id) : undefined
                  const excess = log.balance - acc.buffer_target!
                  return (
                    <div key={acc.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                        <div className="min-w-0">
                          <p className="text-sm text-text-primary truncate">{acc.name}</p>
                          <p className="text-[11px] text-text-muted">
                            {formatCurrency(log.balance)} · {formatCurrency(excess)} above buffer
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-semibold text-accent tabular-nums">
                          Move {formatCurrency(acc.sweep_amount!)}
                        </span>
                        {target && (
                          <span className="text-xs text-text-muted">→ {target.name}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        )
      })()}

      <div className="grid grid-cols-2 gap-4">
        {/* Account health */}
        <Card>
          <CardHeader><CardTitle>Account Health</CardTitle></CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No accounts set up yet.</p>
            ) : (
              <div className="space-y-2.5">
                {accounts.map(acc => {
                  const health = getAccountHealth(acc)
                  const log = latestLogs.find(l => l.account_id === acc.id)
                  const healthConfig = {
                    covered: { icon: CheckCircle2, color: 'text-success', label: 'Covered' },
                    'at-risk': { icon: AlertTriangle, color: 'text-warning', label: 'At risk' },
                    shortfall: { icon: XCircle, color: 'text-danger', label: 'Shortfall' },
                    'no-data': { icon: DollarSign, color: 'text-text-muted', label: 'No data' },
                  }
                  const hc = healthConfig[health]
                  const Icon = hc.icon
                  return (
                    <div key={acc.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: acc.color }} />
                        <span className="text-sm text-text-secondary truncate">{acc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {log && <span className="text-xs text-text-muted">{formatCurrency(log.balance)}</span>}
                        <Icon size={14} className={hc.color} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bills due soon */}
        <Card>
          <CardHeader><CardTitle>Bills Due Soon</CardTitle></CardHeader>
          <CardContent>
            {billsDueSoon.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">No bills due in the next 14 days.</p>
            ) : (
              <div className="space-y-2.5">
                {billsDueSoon.map(bill => (
                  <div key={bill.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {bill.account_color && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: bill.account_color }} />
                      )}
                      <span className="text-sm text-text-secondary truncate">{bill.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-text-muted">{formatCurrency(bill.amount)}</span>
                      <Badge variant={bill.daysUntil <= 3 ? 'danger' : bill.daysUntil <= 7 ? 'warning' : 'muted'}>
                        {bill.daysUntil === 0 ? 'Today' : bill.daysUntil === 1 ? 'Tomorrow' : `${bill.daysUntil}d`}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active goals */}
      {activeGoals.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Active Goals</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeGoals.map(goal => {
                const pct = Math.min(100, (goal.saved_amount / goal.target_amount) * 100)
                const remaining = goal.target_amount - goal.saved_amount
                const weeksLeft = goal.weekly_contribution > 0 ? Math.ceil(remaining / goal.weekly_contribution) : null
                return (
                  <div key={goal.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Target size={13} className="text-accent" />
                        <span className="text-sm text-text-primary">{goal.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-text-muted">{formatCurrency(goal.saved_amount)} of {formatCurrency(goal.target_amount)}</span>
                        {weeksLeft && <Badge variant="muted">{weeksLeft}w left</Badge>}
                      </div>
                    </div>
                    <Progress value={pct} size="sm" />
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({ label, value, color, icon: Icon, sub, accent, negative }: {
  label: string; value: number; color: string; icon: React.ComponentType<{ size?: number; className?: string }>; sub?: string; accent?: string; negative?: boolean
}) {
  const display = negative
    ? `(${formatCurrency(Math.abs(value))})`
    : formatCurrency(value)
  return (
    <Card className={accent ? `border-t-2 ${accent}` : ''}>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between">
          <p className="text-xs text-text-secondary uppercase tracking-wider">{label}</p>
          <Icon size={14} className="text-text-muted mt-0.5" />
        </div>
        <p className={`text-2xl font-semibold mt-2 tabular-nums ${color}`}>{display}</p>
        {sub && <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

function CushionScore({ score }: { score: number }) {
  const color = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-danger'
  const label = score >= 70 ? 'Comfortable' : score >= 40 ? 'Getting by' : 'Tight'
  const ringColor = score >= 70 ? 'border-success' : score >= 40 ? 'border-warning' : 'border-danger'

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-16 h-16 rounded-full border-4 ${ringColor} flex flex-col items-center justify-center bg-surface`}>
        <span className={`text-xl font-bold ${color}`}>{score}</span>
      </div>
      <span className="text-[10px] text-text-muted uppercase tracking-wider">Cushion</span>
      <span className={`text-[10px] font-medium ${color}`}>{label}</span>
    </div>
  )
}
