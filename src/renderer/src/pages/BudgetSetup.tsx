import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, User, Wallet, Receipt, Search, ChevronDown, ChevronRight, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Input } from '@renderer/components/ui/input'
import { Badge } from '@renderer/components/ui/badge'
import { Dialog, DialogContent, DialogTrigger, DialogClose } from '@renderer/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@renderer/components/ui/select'
import { formatCurrency } from '@renderer/lib/utils'
import { toWeeklyAmount, ACCOUNT_COLORS, EXPENSE_CATEGORIES, ACCOUNT_TYPE_OPTIONS, computeWeeklyCashflow } from '@renderer/types'
import type { Account, IncomeSource, Expense, AccountType, Goal } from '@renderer/types'
import { ConfirmDialog } from '@renderer/components/ui/confirm-dialog'
import { useToast } from '@renderer/components/ui/toast'

type Tab = 'income' | 'accounts' | 'expenses'

const FREQ_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'annual', label: 'Annual' },
]

const EXPENSE_FREQ_OPTIONS = [
  ...FREQ_OPTIONS,
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
]

export default function BudgetSetup() {
  const [tab, setTab] = useState<Tab>('income')
  const [income, setIncome] = useState<IncomeSource[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [goals, setGoals] = useState<Goal[]>([])

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [inc, acc, exp, gls] = await Promise.all([
      window.api.income.getAll(),
      window.api.accounts.getAll(),
      window.api.expenses.getAll(),
      window.api.goals.getAll(),
    ])
    setIncome(inc)
    setAccounts(acc)
    setExpenses(exp)
    setGoals(gls as Goal[])
  }

  const cf = computeWeeklyCashflow(expenses, income, goals)
  const weeklyIncome = cf.weeklyIncome
  const weeklyExpenses = expenses.reduce((sum, e) => sum + toWeeklyAmount(e.amount, e.frequency), 0)
  const weeklyAllocations = cf.totalAllocations
  const activeGoalContributions = cf.goalContributions
  const freeCashflow = cf.freeCashflow

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Budget Setup</h1>
        <p className="text-sm text-text-secondary mt-1">Set up your income, accounts, and regular expenses.</p>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        <SummaryCard
          label="Weekly Income"
          value={weeklyIncome}
          color="success"
          hint={income.length > 1 ? `Combined from ${income.length} sources` : undefined}
        />
        <SummaryCard
          label="Weekly Allocations"
          value={weeklyAllocations}
          color="warning"
          hint={cf.percentageAllocations > 0
            ? `${formatCurrency(cf.fixedAllocations)} fixed + ${formatCurrency(cf.percentageAllocations)} from %`
            : `Bills + buffers (raw cost ${formatCurrency(weeklyExpenses)})`}
        />
        <SummaryCard
          label="Free Cashflow"
          value={freeCashflow}
          color={freeCashflow >= 0 ? 'success' : 'danger'}
          hint={`${formatCurrency(weeklyIncome)} income − ${formatCurrency(weeklyAllocations)} allocations${activeGoalContributions > 0 ? ` − ${formatCurrency(activeGoalContributions)} goals` : ''}`}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface rounded-lg p-1 w-fit border border-border">
        {([
          { key: 'income', label: 'Income', icon: User },
          { key: 'accounts', label: 'Accounts', icon: Wallet },
          { key: 'expenses', label: 'Expenses', icon: Receipt },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-150 ${
              tab === key
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-secondary hover:text-text-primary hover:bg-surface-hover'
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'income' && (
        <IncomeTab income={income} onRefresh={loadAll} />
      )}
      {tab === 'accounts' && (
        <AccountsTab accounts={accounts} onRefresh={loadAll} />
      )}
      {tab === 'expenses' && (
        <ExpensesTab expenses={expenses} accounts={accounts} income={income} effective={cf.effective} onRefresh={loadAll} />
      )}
    </div>
  )
}

function SummaryCard({ label, value, color, hint }: { label: string; value: number; color: 'success' | 'warning' | 'danger'; hint?: string }) {
  const colorMap = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
  }
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-text-secondary uppercase tracking-wider">{label}</p>
        <p className={`text-2xl font-semibold mt-1 tabular-nums ${colorMap[color]}`}>{formatCurrency(value)}</p>
        <p className="text-[11px] text-text-muted mt-0.5">{hint ?? 'per week'}</p>
      </CardContent>
    </Card>
  )
}

// ─── Income Tab ───────────────────────────────────────────────────────────────

function IncomeTab({ income, onRefresh }: { income: IncomeSource[]; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<IncomeSource | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState({ person_name: '', amount: '', frequency: 'fortnightly', payday_reference: '' })
  const { toast } = useToast()

  function openAdd() {
    setEditing(null)
    setForm({ person_name: '', amount: '', frequency: 'fortnightly', payday_reference: '' })
    setOpen(true)
  }

  function openEdit(src: IncomeSource) {
    setEditing(src)
    setForm({ person_name: src.person_name, amount: String(src.amount), frequency: src.frequency, payday_reference: src.payday_reference ?? '' })
    setOpen(true)
  }

  async function handleSave() {
    const data = {
      person_name: form.person_name,
      amount: parseFloat(form.amount) || 0,
      frequency: form.frequency as IncomeSource['frequency'],
      payday_reference: form.payday_reference || undefined,
    }
    if (editing) {
      await window.api.income.update(editing.id, data)
      toast('Income source updated')
    } else {
      await window.api.income.save(data)
      toast('Income source added')
    }
    setOpen(false)
    onRefresh()
  }

  async function handleDelete(id: number) {
    await window.api.income.delete(id)
    toast('Income source deleted', 'danger')
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">Add each person's income. We handle the maths.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} /> Add Income
            </Button>
          </DialogTrigger>
          <DialogContent title={editing ? 'Edit Income' : 'Add Income Source'}>
            <div className="space-y-4">
              <Input label="Person's name" placeholder="e.g. James" value={form.person_name} onChange={e => setForm(f => ({ ...f, person_name: e.target.value }))} />
              <Input label="Amount" type="number" prefix="$" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
              <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                <SelectTrigger label="Pay frequency"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                label="First payday date (optional)"
                type="date"
                value={form.payday_reference}
                onChange={e => setForm(f => ({ ...f, payday_reference: e.target.value }))}
                hint="Set this to see payday countdowns and pay-week highlights"
              />
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1">{editing ? 'Save Changes' : 'Add Income'}</Button>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {income.length === 0 ? (
        <EmptyState icon={User} text="No income sources yet" sub="Add your first income source above" />
      ) : (
        <div className="space-y-2">
          {income.map(src => (
            <Card key={src.id} className="hover:border-border-subtle transition-colors">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-surface-hover flex items-center justify-center">
                    <User size={15} className="text-text-secondary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-primary">{src.person_name}</p>
                    <p className="text-xs text-text-secondary">
                      {formatCurrency(src.amount)} · {src.frequency}
                      {src.payday_reference && <span className="text-text-muted"> · payday set</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-success">{formatCurrency(src.amount)}</p>
                    <p className="text-[10px] text-text-muted">
                      {src.frequency}
                      {src.frequency !== 'weekly' && (
                        <span> · {formatCurrency(toWeeklyAmount(src.amount, src.frequency))}/wk</span>
                      )}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(src)}><Pencil size={13} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmId(src.id)}><Trash2 size={13} className="text-danger" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={o => !o && setConfirmId(null)}
        title="Delete income source?"
        description="This will remove the income source permanently. Your weekly totals will update immediately."
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
      />
    </div>
  )
}

// ─── Accounts Tab ─────────────────────────────────────────────────────────────

function AccountsTab({ accounts, onRefresh }: { accounts: Account[]; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [form, setForm] = useState({
    name: '', color: ACCOUNT_COLORS[0], weekly_target: '', buffer_percent: '0', current_balance: '',
    type: 'envelope' as AccountType, buffer_target: '', sweep_amount: '', sweep_to_account_id: '',
  })
  const { toast } = useToast()

  function openAdd() {
    setEditing(null)
    setForm({
      name: '', color: ACCOUNT_COLORS[0], weekly_target: '', buffer_percent: '0', current_balance: '',
      type: 'envelope', buffer_target: '', sweep_amount: '', sweep_to_account_id: '',
    })
    setOpen(true)
  }

  function openEdit(acc: Account) {
    setEditing(acc)
    setForm({
      name: acc.name, color: acc.color,
      weekly_target: String(acc.weekly_target), buffer_percent: String(acc.buffer_percent),
      current_balance: '',
      type: acc.type ?? 'envelope',
      buffer_target: acc.buffer_target != null ? String(acc.buffer_target) : '',
      sweep_amount: acc.sweep_amount != null ? String(acc.sweep_amount) : '',
      sweep_to_account_id: acc.sweep_to_account_id != null ? String(acc.sweep_to_account_id) : '',
    })
    setOpen(true)
  }

  async function handleSave() {
    const bufferTarget = parseFloat(form.buffer_target)
    const sweepAmt = parseFloat(form.sweep_amount)
    const data = {
      name: form.name,
      color: form.color,
      weekly_target: parseFloat(form.weekly_target) || 0,
      buffer_percent: parseFloat(form.buffer_percent) || 0,
      type: form.type,
      buffer_target: !isNaN(bufferTarget) && bufferTarget > 0 ? bufferTarget : undefined,
      sweep_amount: !isNaN(sweepAmt) && sweepAmt > 0 ? sweepAmt : undefined,
      sweep_to_account_id: form.sweep_to_account_id ? parseInt(form.sweep_to_account_id) : undefined,
    }
    let accountId: number | undefined
    if (editing) {
      await window.api.accounts.update(editing.id, data)
      accountId = editing.id
      toast('Account updated')
    } else {
      const saved = await window.api.accounts.save(data) as { id: number } | undefined
      accountId = saved?.id
      toast('Account added')
    }
    const balanceVal = parseFloat(form.current_balance)
    if (accountId && form.current_balance !== '' && !isNaN(balanceVal)) {
      await window.api.balances.save({ account_id: accountId, balance: balanceVal })
      toast('Balance logged')
    }
    setOpen(false)
    onRefresh()
  }

  async function handleDelete(id: number) {
    await window.api.accounts.delete(id)
    toast('Account deleted', 'danger')
    onRefresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">Each account is a separate purpose (e.g. bills, groceries, mortgage).</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Account</Button>
          </DialogTrigger>
          <DialogContent title={editing ? 'Edit Account' : 'Add Account'} description="Define a purpose account that you move money into each week.">
            <div className="space-y-4">
              <Input label="Account name" placeholder="e.g. Bills, Groceries, Mortgage" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              <Input label="Weekly target ($)" type="number" prefix="$" placeholder="0.00" value={form.weekly_target} onChange={e => setForm(f => ({ ...f, weekly_target: e.target.value }))} hint="How much to move into this account each week" />
              <Input label="Buffer (%)" type="number" placeholder="0" value={form.buffer_percent} onChange={e => setForm(f => ({ ...f, buffer_percent: e.target.value }))} hint="Extra % to add on top (e.g. 5 = move 5% more than needed)" />

              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as AccountType }))}>
                <SelectTrigger label="Account type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>
                      <div>
                        <div className="text-sm">{o.label}</div>
                        <div className="text-[10px] text-text-muted">{o.hint}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
                <p className="text-[11px] text-text-muted">
                  <span className="font-medium text-text-secondary">Sweep rule (optional)</span> — when this account exceeds the buffer + sweep amount, Vault flags that you can move the sweep amount to another account.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Buffer target ($)" type="number" prefix="$" placeholder="—" value={form.buffer_target} onChange={e => setForm(f => ({ ...f, buffer_target: e.target.value }))} hint="Always keep this much" />
                  <Input label="Sweep amount ($)" type="number" prefix="$" placeholder="—" value={form.sweep_amount} onChange={e => setForm(f => ({ ...f, sweep_amount: e.target.value }))} hint="Move this when triggered" />
                </div>
                <Select value={form.sweep_to_account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, sweep_to_account_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger label="Sweep to"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.filter(a => a.id !== editing?.id).map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <Input
                label={editing ? 'Update balance ($) — optional' : 'Current balance ($) — optional'}
                type="number"
                prefix="$"
                placeholder="0.00"
                value={form.current_balance}
                onChange={e => setForm(f => ({ ...f, current_balance: e.target.value }))}
                hint={editing ? 'Logs a new balance entry. Leave blank to skip.' : 'Sets the starting balance. Leave blank to skip.'}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-text-secondary">Colour</label>
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setForm(f => ({ ...f, color: c }))}
                      className={`w-7 h-7 rounded-full transition-transform ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1">{editing ? 'Save Changes' : 'Add Account'}</Button>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {accounts.length === 0 ? (
        <EmptyState icon={Wallet} text="No accounts yet" sub="Add your first purpose account above" />
      ) : (
        <div className="space-y-2">
          {accounts.map(acc => (
            <Card key={acc.id} className="hover:border-border-subtle transition-colors">
              <CardContent className="pt-4 pb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-8 rounded-full" style={{ backgroundColor: acc.color }} />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{acc.name}</p>
                    <p className="text-xs text-text-secondary">
                      <span className="capitalize">{acc.type ?? 'envelope'}</span>
                      {acc.buffer_percent > 0 && ` · +${acc.buffer_percent}% buffer`}
                      {acc.buffer_target && acc.sweep_amount && acc.sweep_to_account_id && (
                        <span className="text-accent"> · sweep ${acc.sweep_amount} when over ${acc.buffer_target + acc.sweep_amount}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold text-text-primary">{formatCurrency(acc.weekly_target * (1 + acc.buffer_percent / 100))}</p>
                    <p className="text-[10px] text-text-muted">per week</p>
                  </div>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(acc)}><Pencil size={13} /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmId(acc.id)}><Trash2 size={13} className="text-danger" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={o => !o && setConfirmId(null)}
        title="Delete account?"
        description="This will permanently delete the account and remove it from any assigned expenses. This cannot be undone."
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
      />
    </div>
  )
}

// ─── Expenses Tab ─────────────────────────────────────────────────────────────

function ExpensesTab({ expenses, accounts, income, effective, onRefresh }: { expenses: Expense[]; accounts: Account[]; income: IncomeSource[]; effective: Record<number, number>; onRefresh: () => void }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [didDefaultCollapse, setDidDefaultCollapse] = useState(false)
  const { toast } = useToast()
  const [form, setForm] = useState({
    name: '', amount: '', allocation_amount: '', weekly_extra: '', frequency: 'monthly', due_day: '',
    save_account_id: '', debit_account_id: '', funded_by_income_id: '', category: 'Bills & Utilities',
    is_percentage: false,
    percentage_basis: 'free_cashflow' as 'free_cashflow' | 'combined_income' | 'specific_pay',
    percentage_value: '',
    percentage_pay_id: '',
  })

  function toggleCategory(cat: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat); else next.add(cat)
      return next
    })
  }

  function openAdd() {
    setEditing(null)
    setForm({
      name: '', amount: '', allocation_amount: '', weekly_extra: '', frequency: 'monthly', due_day: '',
      save_account_id: '', debit_account_id: '', funded_by_income_id: '', category: 'Bills & Utilities',
      is_percentage: false, percentage_basis: 'free_cashflow', percentage_value: '', percentage_pay_id: '',
    })
    setOpen(true)
  }

  function openEdit(exp: Expense) {
    setEditing(exp)
    setForm({
      name: exp.name, amount: String(exp.amount),
      allocation_amount: exp.allocation_amount ? String(exp.allocation_amount) : '',
      weekly_extra: exp.weekly_extra ? String(exp.weekly_extra) : '',
      frequency: exp.frequency,
      due_day: exp.due_day ? String(exp.due_day) : '',
      save_account_id: exp.save_account_id ? String(exp.save_account_id) : (exp.account_id ? String(exp.account_id) : ''),
      debit_account_id: exp.debit_account_id ? String(exp.debit_account_id) : '',
      funded_by_income_id: exp.funded_by_income_id ? String(exp.funded_by_income_id) : '',
      category: exp.category,
      is_percentage: !!exp.is_percentage,
      percentage_basis: (exp.percentage_basis ?? 'free_cashflow') as any,
      percentage_value: exp.percentage_value != null ? String(exp.percentage_value) : '',
      percentage_pay_id: exp.percentage_pay_id ? String(exp.percentage_pay_id) : '',
    })
    setOpen(true)
  }

  async function handleSave() {
    const parsedAmount = parseFloat(form.amount) || 0
    const parsedAlloc = parseFloat(form.allocation_amount) || 0
    const parsedExtra = parseFloat(form.weekly_extra) || 0
    const data = {
      name: form.name,
      amount: parsedAmount,
      allocation_amount: parsedAlloc > 0 && parsedAlloc !== parsedAmount ? parsedAlloc : undefined,
      weekly_extra: parsedExtra > 0 ? parsedExtra : undefined,
      frequency: form.frequency as Expense['frequency'],
      due_day: form.due_day ? parseInt(form.due_day) : undefined,
      save_account_id: form.save_account_id ? parseInt(form.save_account_id) : undefined,
      debit_account_id: form.debit_account_id ? parseInt(form.debit_account_id) : undefined,
      funded_by_income_id: form.funded_by_income_id ? parseInt(form.funded_by_income_id) : undefined,
      category: form.category,
      is_percentage: form.is_percentage,
      percentage_basis: form.is_percentage ? form.percentage_basis : undefined,
      percentage_value: form.is_percentage ? (parseFloat(form.percentage_value) || 0) : undefined,
      percentage_pay_id: form.is_percentage && form.percentage_basis === 'specific_pay' && form.percentage_pay_id
        ? parseInt(form.percentage_pay_id)
        : undefined,
    }
    if (editing) {
      await window.api.expenses.update(editing.id, data)
      toast('Expense updated')
    } else {
      await window.api.expenses.save(data)
      toast('Expense added')
    }
    setOpen(false)
    onRefresh()
  }

  async function handleDelete(id: number) {
    await window.api.expenses.delete(id)
    toast('Expense deleted', 'danger')
    onRefresh()
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? expenses.filter(e =>
        e.name.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q) ||
        (e.save_account_name?.toLowerCase().includes(q) ?? false) ||
        (e.account_name?.toLowerCase().includes(q) ?? false)
      )
    : expenses

  const grouped = EXPENSE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filtered.filter(e => e.category === cat)
    return acc
  }, {} as Record<string, Expense[]>)

  // Categories present (sorted by item count desc — biggest first)
  const activeCategories = EXPENSE_CATEGORIES
    .filter(cat => grouped[cat].length > 0)
    .sort((a, b) => grouped[b].length - grouped[a].length)

  // On first load with data, collapse everything except the biggest category.
  // Keeps the page short by default; user can toggle as they wish.
  useEffect(() => {
    if (didDefaultCollapse) return
    if (expenses.length === 0) return
    const cats = EXPENSE_CATEGORIES
      .filter(cat => expenses.some(e => e.category === cat))
      .map(cat => ({ cat, count: expenses.filter(e => e.category === cat).length }))
      .sort((a, b) => b.count - a.count)
    if (cats.length <= 1) {
      setDidDefaultCollapse(true)
      return
    }
    setCollapsed(new Set(cats.slice(1).map(c => c.cat)))
    setDidDefaultCollapse(true)
  }, [expenses, didDefaultCollapse])

  // When searching, force-expand all categories
  function isExpanded(cat: string): boolean {
    if (q) return true
    return !collapsed.has(cat)
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">Log every regular expense — bills, groceries, subscriptions, everything.</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={openAdd}><Plus size={14} /> Add Expense</Button>
          </DialogTrigger>
          <DialogContent title={editing ? 'Edit Expense' : 'Add Expense'}>
            <div className="space-y-4">
              <Input label="Expense name" placeholder="e.g. Electricity, Netflix, Car Insurance" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

              {/* Fixed vs percentage toggle */}
              <div className="flex items-center bg-surface-2 rounded-lg border border-border p-1">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_percentage: false }))}
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                    !form.is_percentage ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  Fixed amount
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, is_percentage: true }))}
                  className={`flex-1 text-xs py-1.5 rounded transition-colors ${
                    form.is_percentage ? 'bg-accent text-white' : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  % of pay
                </button>
              </div>

              {/* Percentage-mode fields */}
              {form.is_percentage && (
                <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
                  <Select value={form.percentage_basis} onValueChange={v => setForm(f => ({ ...f, percentage_basis: v as any }))}>
                    <SelectTrigger label="Take % of"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="free_cashflow">Free cashflow (what's left after fixed bills + goals)</SelectItem>
                      <SelectItem value="combined_income">Combined weekly income</SelectItem>
                      {income.length > 0 && <SelectItem value="specific_pay">A specific person's pay</SelectItem>}
                    </SelectContent>
                  </Select>
                  {form.percentage_basis === 'specific_pay' && income.length > 0 && (
                    <Select value={form.percentage_pay_id || (income[0] ? String(income[0].id) : '')} onValueChange={v => setForm(f => ({ ...f, percentage_pay_id: v }))}>
                      <SelectTrigger label="Whose pay"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {income.map(src => <SelectItem key={src.id} value={String(src.id)}>{src.person_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  <Input
                    label="Percentage (%)"
                    type="number"
                    placeholder="5"
                    value={form.percentage_value}
                    onChange={e => setForm(f => ({ ...f, percentage_value: e.target.value }))}
                    hint="e.g. 5 = 5% of the chosen basis"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.frequency} onValueChange={v => setForm(f => ({ ...f, frequency: v }))}>
                  <SelectTrigger label="Frequency"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {EXPENSE_FREQ_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input label="Due day of month" type="number" placeholder="e.g. 15" value={form.due_day} onChange={e => setForm(f => ({ ...f, due_day: e.target.value }))} hint="Leave blank if not monthly" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Actual cost ($)" type="number" prefix="$" placeholder="0.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} hint="What the bill actually costs" />
                <Input label="Allocate ($)" type="number" prefix="$" placeholder="Same as cost" value={form.allocation_amount} onChange={e => setForm(f => ({ ...f, allocation_amount: e.target.value }))} hint="Set higher to get ahead faster" />
              </div>
              <Input
                label="Weekly buffer ($)"
                type="number"
                prefix="$"
                placeholder="0.00"
                value={form.weekly_extra}
                onChange={e => setForm(f => ({ ...f, weekly_extra: e.target.value }))}
                hint="Extra $/week on top of the allocation (builds a buffer faster)"
              />
              <div className="rounded-lg border border-border bg-surface-2/40 p-3 space-y-3">
                <p className="text-[11px] text-text-muted">
                  <span className="font-medium text-text-secondary">Money flow</span> — where money saves up vs where the bill is actually paid from. Leave "Debits from" blank if the bill comes out of the same account it accumulates in.
                </p>
                <Select value={form.save_account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, save_account_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger label="Saves to (envelope)"><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={form.debit_account_id || 'none'} onValueChange={v => setForm(f => ({ ...f, debit_account_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger label="Debits from (optional)"><SelectValue placeholder="Same as save account" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Same as save account</SelectItem>
                    {accounts.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {income.length > 0 && (
                <Select value={form.funded_by_income_id || 'shared'} onValueChange={v => setForm(f => ({ ...f, funded_by_income_id: v === 'shared' ? '' : v }))}>
                  <SelectTrigger label="Funded by"><SelectValue placeholder="Shared (default)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Shared (both pays)</SelectItem>
                    {income.map(src => <SelectItem key={src.id} value={String(src.id)}>{src.person_name} only</SelectItem>)}
                  </SelectContent>
                </Select>
              )}

              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger label="Category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="flex gap-2 pt-2">
                <Button onClick={handleSave} className="flex-1">{editing ? 'Save Changes' : 'Add Expense'}</Button>
                <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {expenses.length === 0 ? (
        <EmptyState icon={Receipt} text="No expenses yet" sub="Add your first expense above" />
      ) : (
        <div className="space-y-3">
          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={`Search ${expenses.length} expenses…`}
              className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent transition-colors"
            />
            {q && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary text-xs"
              >
                Clear
              </button>
            )}
          </div>

          {activeCategories.length === 0 ? (
            <p className="text-center text-sm text-text-muted py-8">No expenses match "{search}".</p>
          ) : activeCategories.map(cat => {
            const items = grouped[cat]
            const weeklyTotal = items.reduce((s, e) => s + (effective[e.id] ?? 0), 0)
            const expanded = isExpanded(cat)
            return (
              <div key={cat} className="rounded-xl border border-border bg-surface overflow-hidden">
                {/* Category header */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    {expanded
                      ? <ChevronDown size={15} className="text-text-muted group-hover:text-text-secondary" />
                      : <ChevronRight size={15} className="text-text-muted group-hover:text-text-secondary" />
                    }
                    <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">{cat}</span>
                    <span className="text-[11px] text-text-muted ml-1">{items.length} item{items.length === 1 ? '' : 's'}</span>
                  </div>
                  <span className="text-sm font-semibold text-text-primary tabular-nums">
                    {formatCurrency(weeklyTotal)}<span className="text-[10px] text-text-muted">/wk</span>
                  </span>
                </button>

                {/* Expanded grid */}
                {expanded && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 p-3 pt-0 border-t border-border">
                    {items.map(exp => {
                      const dotColor = exp.save_account_color ?? exp.account_color
                      const dueLabel = exp.due_day
                        ? `${exp.due_day}${['th','st','nd','rd'][((exp.due_day % 100) - 20) % 10] || ['th','st','nd','rd'][exp.due_day % 100] || 'th'}`
                        : null
                      return (
                        <div
                          key={exp.id}
                          className="group bg-surface-2/40 hover:bg-surface-2 border border-border rounded-lg p-3 transition-colors flex items-start gap-3"
                        >
                          {dotColor && <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: dotColor }} />}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className="text-sm font-medium text-text-primary truncate">{exp.name}</p>
                              <p className="text-sm font-semibold text-text-primary tabular-nums flex-shrink-0">
                                {formatCurrency(effective[exp.id] ?? 0)}
                                <span className="text-[10px] text-text-muted">/wk</span>
                              </p>
                            </div>
                            <p className="text-[11px] text-text-muted mt-0.5">
                              {exp.is_percentage ? (
                                <>
                                  <span className="text-accent">{exp.percentage_value}% of {
                                    exp.percentage_basis === 'free_cashflow' ? 'free cashflow'
                                    : exp.percentage_basis === 'combined_income' ? 'combined income'
                                    : exp.percentage_basis === 'specific_pay' && exp.percentage_pay_id
                                      ? (income.find(i => i.id === exp.percentage_pay_id)?.person_name ?? 'pay') + "'s pay"
                                      : 'pay'
                                  }</span>
                                </>
                              ) : (
                                <>
                                  {formatCurrency(exp.amount)} · {exp.frequency}
                                  {dueLabel && ` · due ${dueLabel}`}
                                  {exp.allocation_amount && exp.allocation_amount !== exp.amount && (
                                    <span className="text-accent"> · alloc {formatCurrency(exp.allocation_amount)}</span>
                                  )}
                                  {exp.weekly_extra && exp.weekly_extra > 0 && (
                                    <span className="text-accent"> · +{formatCurrency(exp.weekly_extra)}/wk</span>
                                  )}
                                </>
                              )}
                            </p>
                            <div className="flex items-center gap-1 mt-1 text-[10px] text-text-secondary flex-wrap">
                              {(exp.save_account_name || exp.account_name) && (
                                <>
                                  <span className="bg-surface border border-border rounded px-1.5 py-0.5">{exp.save_account_name ?? exp.account_name}</span>
                                  {exp.debit_account_name && exp.debit_account_name !== (exp.save_account_name ?? exp.account_name) && (
                                    <>
                                      <ArrowRight size={9} className="text-text-muted" />
                                      <span className="bg-surface border border-border rounded px-1.5 py-0.5">{exp.debit_account_name}</span>
                                    </>
                                  )}
                                </>
                              )}
                              {exp.funded_by_person_name && (
                                <span className="bg-accent/10 border border-accent/30 text-accent rounded px-1.5 py-0.5">
                                  {exp.funded_by_person_name} only
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-0.5 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button size="icon" variant="ghost" onClick={() => openEdit(exp)}><Pencil size={12} /></Button>
                            <Button size="icon" variant="ghost" onClick={() => setConfirmId(exp.id)}><Trash2 size={12} className="text-danger" /></Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      <ConfirmDialog
        open={confirmId !== null}
        onOpenChange={o => !o && setConfirmId(null)}
        title="Delete expense?"
        description="This will permanently remove the expense and its allocation. Any assigned account will no longer include it in coverage calculations."
        onConfirm={() => confirmId !== null && handleDelete(confirmId)}
      />
    </div>
  )
}

function EmptyState({ icon: Icon, text, sub }: { icon: React.ComponentType<{ size?: number; className?: string }>; text: string; sub: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mb-3">
        <Icon size={20} className="text-text-muted" />
      </div>
      <p className="text-sm font-medium text-text-secondary">{text}</p>
      <p className="text-xs text-text-muted mt-1">{sub}</p>
    </div>
  )
}
