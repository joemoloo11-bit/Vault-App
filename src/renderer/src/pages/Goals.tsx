import { useState, useEffect } from 'react'
import { Plus, Target, Zap, Coffee, Turtle, CheckCircle2, Trash2, Pencil, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardContent } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Progress } from '@renderer/components/ui/progress'
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@renderer/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { formatCurrency, getDaysUntil } from '@renderer/lib/utils'
import { toWeeklyAmount } from '@renderer/types'
import type { Goal, IncomeSource, Expense } from '@renderer/types'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { useToast } from '@renderer/components/ui/toast'

interface GoalApproach {
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
  weeklyAmount: number
  weeksToGoal: number
  cashflowRemaining: number
  color: string
  description: string
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [open, setOpen] = useState(false)
  const [depositOpen, setDepositOpen] = useState(false)
  const [depositGoal, setDepositGoal] = useState<Goal | null>(null)
  const [depositAmount, setDepositAmount] = useState('')
  const [approaches, setApproaches] = useState<GoalApproach[] | null>(null)
  const [selectedApproach, setSelectedApproach] = useState<GoalApproach | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: '', target_amount: '', deadline: '', priority: 'want' as const,
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [g, inc, exp] = await Promise.all([
      window.api.goals.getAll(),
      window.api.income.getAll(),
      window.api.expenses.getAll(),
    ])
    setGoals(g as Goal[])
    setIncome(inc)
    setExpenses(exp)
  }

  const weeklyIncome = income.reduce((sum, s) => sum + toWeeklyAmount(s.amount, s.frequency), 0)
  const weeklyExpenses = expenses.reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0)
  const activeGoalContributions = (goals as Goal[])
    .filter(g => g.status === 'active')
    .reduce((sum, g) => sum + g.weekly_contribution, 0)
  const freeCashflow = weeklyIncome - weeklyExpenses - activeGoalContributions

  function calculateApproaches(targetAmount: number, deadline: string): GoalApproach[] {
    const remaining = targetAmount
    const daysLeft = deadline ? getDaysUntil(deadline) : 365
    const weeksLeft = Math.max(1, Math.ceil(daysLeft / 7))
    const maxWeekly = Math.min(freeCashflow * 0.9, remaining / weeksLeft)
    const comfWeekly = Math.min(freeCashflow * 0.5, remaining / weeksLeft)
    const slowWeekly = Math.min(freeCashflow * 0.2, Math.max(10, remaining / 104))

    return [
      {
        label: 'Aggressive',
        icon: Zap,
        weeklyAmount: Math.max(1, maxWeekly),
        weeksToGoal: Math.ceil(remaining / Math.max(1, maxWeekly)),
        cashflowRemaining: freeCashflow - Math.max(1, maxWeekly),
        color: 'text-accent',
        description: 'Fastest path. Biggest impact on spending money.',
      },
      {
        label: 'Comfortable',
        icon: Coffee,
        weeklyAmount: Math.max(1, comfWeekly),
        weeksToGoal: Math.ceil(remaining / Math.max(1, comfWeekly)),
        cashflowRemaining: freeCashflow - Math.max(1, comfWeekly),
        color: 'text-success',
        description: 'Balanced. You\'ll still have money to spend.',
      },
      {
        label: 'Slow & Steady',
        icon: Turtle,
        weeklyAmount: Math.max(1, slowWeekly),
        weeksToGoal: Math.ceil(remaining / Math.max(1, slowWeekly)),
        cashflowRemaining: freeCashflow - Math.max(1, slowWeekly),
        color: 'text-warning',
        description: 'Minimal impact. Takes longer but barely noticeable.',
      },
    ]
  }

  function handleFormChange() {
    if (form.target_amount && parseFloat(form.target_amount) > 0) {
      const calced = calculateApproaches(parseFloat(form.target_amount), form.deadline)
      setApproaches(calced)
    } else {
      setApproaches(null)
    }
  }

  async function handleSave() {
    if (!form.name || !form.target_amount) return
    await window.api.goals.save({
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      deadline: form.deadline || undefined,
      priority: form.priority,
      weekly_contribution: selectedApproach?.weeklyAmount ?? 0,
      approach: selectedApproach
        ? (['Aggressive', 'Comfortable', 'Slow & Steady'].indexOf(selectedApproach.label) === 0 ? 'aggressive'
          : ['Aggressive', 'Comfortable', 'Slow & Steady'].indexOf(selectedApproach.label) === 1 ? 'comfortable'
          : 'steady')
        : undefined,
    })
    setOpen(false)
    setForm({ name: '', target_amount: '', deadline: '', priority: 'want' })
    setApproaches(null)
    setSelectedApproach(null)
    loadAll()
  }

  async function handleDeposit() {
    if (!depositGoal || !depositAmount) return
    const newSaved = depositGoal.saved_amount + parseFloat(depositAmount)
    const isComplete = newSaved >= depositGoal.target_amount
    await window.api.goals.update(depositGoal.id, {
      saved_amount: newSaved,
      status: isComplete ? 'completed' : 'active',
    })
    await window.api.goals.saveSnapshot({ goal_id: depositGoal.id, saved_amount: newSaved })
    setDepositOpen(false)
    setDepositAmount('')
    setDepositGoal(null)
    loadAll()
  }

  async function handleDelete(id: number) {
    await window.api.goals.delete(id)
    toast('Goal deleted', 'danger')
    loadAll()
  }

  async function toggleStatus(goal: Goal) {
    await window.api.goals.update(goal.id, {
      status: goal.status === 'active' ? 'paused' : 'active',
    })
    loadAll()
  }

  const active = (goals as Goal[]).filter(g => g.status === 'active')
  const paused = (goals as Goal[]).filter(g => g.status === 'paused')
  const completed = (goals as Goal[]).filter(g => g.status === 'completed')

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Goals</h1>
          <p className="text-sm text-text-secondary mt-1">Save for things you want and need. We'll find the best approach.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setApproaches(null); setSelectedApproach(null) } }}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus size={14} /> New Goal</Button>
          </DialogTrigger>
          <DialogContent title="Add a Goal" description="Tell us what you're saving for and we'll show you how to get there.">
            <div className="space-y-4">
              <Input
                label="What are you saving for?"
                placeholder="e.g. New TV, Holiday, Car tyres"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); handleFormChange() }}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Target amount"
                  type="number"
                  prefix="$"
                  placeholder="0.00"
                  value={form.target_amount}
                  onChange={e => { setForm(f => ({ ...f, target_amount: e.target.value })); setTimeout(handleFormChange, 0) }}
                />
                <Input
                  label="Need it by (optional)"
                  type="date"
                  value={form.deadline}
                  onChange={e => { setForm(f => ({ ...f, deadline: e.target.value })); setTimeout(handleFormChange, 0) }}
                />
              </div>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as 'want' | 'need' }))}>
                <SelectTrigger label="Priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="want">Want — nice to have</SelectItem>
                  <SelectItem value="need">Need — important</SelectItem>
                </SelectContent>
              </Select>

              {/* Approach cards */}
              {approaches && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Choose your approach</p>
                  <p className="text-xs text-text-muted">Available cashflow: {formatCurrency(freeCashflow)}/week</p>
                  {approaches.map(approach => {
                    const Icon = approach.icon
                    const isSelected = selectedApproach?.label === approach.label
                    return (
                      <button
                        key={approach.label}
                        onClick={() => setSelectedApproach(approach)}
                        className={`w-full text-left rounded-lg p-3 border transition-all ${
                          isSelected ? 'border-accent bg-accent-muted' : 'border-border bg-surface-2 hover:border-border-subtle'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon size={16} className={approach.color} />
                            <span className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                              {approach.label}
                            </span>
                          </div>
                          <div className="text-right text-xs">
                            <p className="text-text-primary font-semibold">{formatCurrency(approach.weeklyAmount)}/wk</p>
                            <p className="text-text-muted">{approach.weeksToGoal} weeks</p>
                          </div>
                        </div>
                        <p className="text-xs text-text-muted mt-1">{approach.description}</p>
                        <p className="text-xs text-text-secondary mt-1">
                          Leaves <span className={approach.cashflowRemaining >= 0 ? 'text-success' : 'text-danger'}>{formatCurrency(approach.cashflowRemaining)}</span>/week free
                        </p>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1" disabled={!form.name || !form.target_amount}>
                  Add Goal
                </Button>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Free cashflow after goals */}
      {goals.length > 0 && (
        <div className="bg-surface rounded-lg p-4 border border-border flex items-center justify-between">
          <div>
            <p className="text-xs text-text-muted">Weekly going to active goals</p>
            <p className="text-lg font-semibold text-text-primary">{formatCurrency(activeGoalContributions)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-text-muted">Remaining free cashflow</p>
            <p className={`text-lg font-semibold ${freeCashflow >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatCurrency(freeCashflow)}
            </p>
          </div>
        </div>
      )}

      {/* Deposit dialog */}
      <Dialog open={depositOpen} onOpenChange={setDepositOpen}>
        <DialogContent title={`Add savings — ${depositGoal?.name}`}>
          <div className="space-y-4">
            {depositGoal && (
              <div className="bg-surface-2 rounded-lg p-3 border border-border text-sm">
                <div className="flex justify-between mb-2">
                  <span className="text-text-muted">Progress</span>
                  <span className="text-text-primary">{formatCurrency(depositGoal.saved_amount)} of {formatCurrency(depositGoal.target_amount)}</span>
                </div>
                <Progress value={(depositGoal.saved_amount / depositGoal.target_amount) * 100} />
              </div>
            )}
            <Input label="Amount to add" type="number" prefix="$" placeholder="0.00" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
            <div className="flex gap-2">
              <Button onClick={handleDeposit} className="flex-1">Add Savings</Button>
              <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {goals.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-full bg-surface flex items-center justify-center mb-3 border border-border">
            <Target size={20} className="text-text-muted" />
          </div>
          <p className="text-sm font-medium text-text-secondary">No goals yet</p>
          <p className="text-xs text-text-muted mt-1">Add your first goal — a holiday, new appliance, whatever you're working towards.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && <GoalSection title="Active" goals={active} onDeposit={(g) => { setDepositGoal(g); setDepositOpen(true) }} onToggle={toggleStatus} onDelete={id => setConfirmId(id)} />}
          {paused.length > 0 && <GoalSection title="Paused" goals={paused} onDeposit={(g) => { setDepositGoal(g); setDepositOpen(true) }} onToggle={toggleStatus} onDelete={id => setConfirmId(id)} />}
          {completed.length > 0 && <GoalSection title="Completed" goals={completed} onDeposit={(g) => { setDepositGoal(g); setDepositOpen(true) }} onToggle={toggleStatus} onDelete={id => setConfirmId(id)} />}
        </div>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={o => !o && setConfirmId(null)}
        title="Delete goal?"
        description="This will permanently delete the goal and all its saved progress snapshots. This cannot be undone."
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
      />
    </div>
  )
}

function GoalSection({ title, goals, onDeposit, onToggle, onDelete }: {
  title: string
  goals: Goal[]
  onDeposit: (g: Goal) => void
  onToggle: (g: Goal) => void
  onDelete: (id: number) => void
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">{title}</p>
      <div className="space-y-3">
        {goals.map(goal => {
          const pct = Math.min(100, (goal.saved_amount / goal.target_amount) * 100)
          const remaining = goal.target_amount - goal.saved_amount
          const weeksLeft = goal.weekly_contribution > 0 ? Math.ceil(remaining / goal.weekly_contribution) : null
          const daysLeft = goal.deadline ? getDaysUntil(goal.deadline) : null
          const isComplete = goal.status === 'completed'

          return (
            <Card key={goal.id} className={isComplete ? 'border-success/20' : ''}>
              <CardContent className="pt-4 pb-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    {isComplete
                      ? <CheckCircle2 size={18} className="text-success flex-shrink-0" />
                      : <Target size={18} className="text-accent flex-shrink-0" />
                    }
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{goal.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={goal.priority === 'need' ? 'warning' : 'muted'}>{goal.priority}</Badge>
                        {goal.approach && <Badge variant="default">{goal.approach}</Badge>}
                        {daysLeft !== null && !isComplete && (
                          <span className={`text-[10px] ${daysLeft < 0 ? 'text-danger' : daysLeft < 14 ? 'text-warning' : 'text-text-muted'}`}>
                            {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-lg font-semibold text-text-primary">{formatCurrency(goal.saved_amount)}</p>
                    <p className="text-xs text-text-muted">of {formatCurrency(goal.target_amount)}</p>
                  </div>
                </div>

                <div className="space-y-1">
                  <Progress value={pct} color={isComplete ? 'success' : pct > 60 ? 'accent' : 'accent'} />
                  <div className="flex justify-between text-[10px] text-text-muted">
                    <span>{pct.toFixed(0)}% saved</span>
                    {!isComplete && <span>
                      {remaining > 0 ? `${formatCurrency(remaining)} to go` : 'Complete!'}
                      {weeksLeft && remaining > 0 ? ` · ~${weeksLeft}w at ${formatCurrency(goal.weekly_contribution)}/wk` : ''}
                    </span>}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {!isComplete && (
                    <Button size="sm" variant="outline" onClick={() => onDeposit(goal)} className="flex-1">
                      <Plus size={12} /> Add Savings
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => onToggle(goal)}>
                    {goal.status === 'active' ? 'Pause' : 'Resume'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDelete(goal.id)}>
                    <Trash2 size={13} className="text-danger" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
