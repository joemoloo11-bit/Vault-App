import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, MinusCircle, ClipboardCopy, Plus, Trash2, ChevronDown, ChevronUp, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@renderer/components/ui/card'
import { Button } from '@renderer/components/ui/button'
import { Badge } from '@renderer/components/ui/badge'
import { format } from 'date-fns'

const APP_VERSION = '1.0.0'

type TestStatus = 'pending' | 'pass' | 'fail' | 'skip'

interface TestItem {
  id: string
  category: string
  label: string
  detail: string
}

interface TestResult {
  status: TestStatus
  note: string
}

interface TestRun {
  id: number
  version: string
  results: string
  notes: string | null
  run_date: string
}

const TEST_ITEMS: TestItem[] = [
  // Install & Open
  { id: 'install_open', category: 'Install & Open', label: 'App installs without errors', detail: 'Run Vault Setup 1.0.0.exe and complete installation' },
  { id: 'start_menu', category: 'Install & Open', label: 'Vault opens from Start Menu', detail: 'Find Vault in the Windows Start Menu and open it' },
  { id: 'window_controls', category: 'Install & Open', label: 'Minimise, maximise and close buttons work', detail: 'Test the three window control buttons in the top-right corner' },

  // Budget Setup
  { id: 'add_income', category: 'Budget Setup', label: 'Add income for both people', detail: 'Go to Budget Setup → Income. Add an income entry for each person with the correct pay frequency' },
  { id: 'add_accounts', category: 'Budget Setup', label: 'Add 2–3 purpose accounts', detail: 'Go to Budget Setup → Accounts. Add accounts like Bills, Groceries, Mortgage with weekly targets' },
  { id: 'account_colour', category: 'Budget Setup', label: 'Account colour picker works', detail: 'When adding an account, click different colours — the selection highlights correctly' },
  { id: 'add_expenses', category: 'Budget Setup', label: 'Add expenses and assign to accounts', detail: 'Go to Budget Setup → Expenses. Add a few bills and assign them to your accounts' },
  { id: 'cashflow_calc', category: 'Budget Setup', label: 'Free Cashflow number looks correct', detail: 'The summary strip at the top of Budget Setup shows income, expenses, and free cashflow that add up correctly' },
  { id: 'edit_delete', category: 'Budget Setup', label: 'Edit and delete items works', detail: 'Try editing an income or expense using the pencil icon, then delete one using the bin icon' },

  // Weekly Allocation
  { id: 'weekly_amounts', category: 'Weekly Allocation', label: 'Weekly amounts per account look correct', detail: 'Go to Weekly Allocation — the amounts shown match your account targets from Budget Setup' },
  { id: 'weekly_tick', category: 'Weekly Allocation', label: 'Ticking accounts updates the progress bar', detail: 'Click the circle next to an account — it turns green and the progress bar at the top moves' },
  { id: 'weekly_mark_all', category: 'Weekly Allocation', label: '"Mark all done" button works', detail: 'Click "Mark all done" — all accounts tick green and shows "All funded!"' },
  { id: 'weekly_navigate', category: 'Weekly Allocation', label: 'Previous/next week navigation works', detail: 'Use the arrow buttons to move to last week and next week' },

  // Account Tracker
  { id: 'log_balance', category: 'Account Tracker', label: 'Log a balance for an account', detail: 'Click "Log Balance", choose an account, enter an amount and save' },
  { id: 'coverage_status', category: 'Account Tracker', label: 'Coverage status shows correctly', detail: 'After logging a balance, the account card shows Covered, At Risk, or Shortfall with the right colour' },
  { id: 'shortfall_sim', category: 'Account Tracker', label: 'Shortfall Simulator updates in real time', detail: 'Click "Shortfall Simulator", choose an account, type an amount — result updates instantly' },

  // Goals
  { id: 'goal_create', category: 'Goals', label: 'Create a goal with target and deadline', detail: 'Click "New Goal", fill in the name, amount, and a deadline date' },
  { id: 'goal_approaches', category: 'Goals', label: '3 saving approaches appear', detail: 'After entering a target amount, three options appear: Aggressive, Comfortable, Slow & Steady' },
  { id: 'goal_select_approach', category: 'Goals', label: 'Selecting an approach saves correctly', detail: 'Click one of the three approaches, then click "Add Goal" — the goal appears with the approach shown' },
  { id: 'goal_deposit', category: 'Goals', label: 'Adding savings moves the progress bar', detail: 'Click "Add Savings" on a goal, enter an amount — the progress bar updates and percentage changes' },

  // Charts
  { id: 'chart_overview', category: 'Charts', label: 'Income vs Expenses bar chart appears', detail: 'Go to Charts — the first tab shows a bar chart with income and expense bars' },
  { id: 'chart_breakdown', category: 'Charts', label: 'Spending breakdown donut shows categories', detail: 'Click "Spending Breakdown" tab — a donut chart shows your expense categories' },
  { id: 'chart_balances', category: 'Charts', label: 'Account balance history shows logged data', detail: 'Click "Account Balances" — if you logged balances earlier, they appear as line charts' },
  { id: 'chart_range', category: 'Charts', label: 'Date range buttons (3m / 6m / 12m) work', detail: 'Click the time range buttons in the top-right of Charts — the charts update' },

  // Export
  { id: 'export_excel', category: 'Export', label: 'Excel export downloads and opens correctly', detail: 'Go to Export, click "Export to Excel" — a .xlsx file downloads and opens in Excel with multiple sheets' },
  { id: 'export_pdf', category: 'Export', label: 'PDF export downloads and opens correctly', detail: 'Click "Export to PDF" — a styled PDF downloads and opens with your budget summary' },

  // Dashboard
  { id: 'dashboard_loads', category: 'Dashboard', label: 'Dashboard shows data after setup', detail: 'Go to Dashboard — it shows your income, expenses, free cashflow, and account health cards' },
  { id: 'dashboard_bills', category: 'Dashboard', label: 'Bills due soon list appears', detail: 'If any expenses have a due day set, they appear in the "Bills Due Soon" section' },
  { id: 'cushion_score', category: 'Dashboard', label: 'Cushion Score circle shows', detail: 'A score from 0–100 appears in the top-right of the Dashboard with a colour ring' },
]

const CATEGORIES = [...new Set(TEST_ITEMS.map(t => t.category))]

const statusConfig = {
  pending: { label: 'Not tested', icon: MinusCircle, color: 'text-text-muted', badge: 'muted' as const },
  pass: { label: 'Pass', icon: CheckCircle2, color: 'text-success', badge: 'success' as const },
  fail: { label: 'Fail', icon: XCircle, color: 'text-danger', badge: 'danger' as const },
  skip: { label: 'Skipped', icon: MinusCircle, color: 'text-warning', badge: 'warning' as const },
}

function emptyResults(): Record<string, TestResult> {
  return Object.fromEntries(TEST_ITEMS.map(t => [t.id, { status: 'pending', note: '' }]))
}

export default function Testing() {
  const [runs, setRuns] = useState<TestRun[]>([])
  const [activeRunId, setActiveRunId] = useState<number | null>(null)
  const [results, setResults] = useState<Record<string, TestResult>>(emptyResults())
  const [runNotes, setRunNotes] = useState('')
  const [copied, setCopied] = useState(false)
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(CATEGORIES.map(c => [c, true]))
  )

  useEffect(() => { loadRuns() }, [])

  async function loadRuns() {
    const data = await window.api.tests.getAll() as TestRun[]
    setRuns(data)
    if (data.length > 0 && !activeRunId) {
      loadRun(data[0])
    }
  }

  function loadRun(run: TestRun) {
    setActiveRunId(run.id)
    setRunNotes(run.notes ?? '')
    try {
      setResults(JSON.parse(run.results))
    } catch {
      setResults(emptyResults())
    }
  }

  async function startNewRun() {
    const initial = emptyResults()
    const saved = await window.api.tests.save({
      version: APP_VERSION,
      results: JSON.stringify(initial),
      notes: '',
    }) as TestRun
    setActiveRunId(saved.id)
    setResults(initial)
    setRunNotes('')
    loadRuns()
  }

  async function updateResult(testId: string, status: TestStatus) {
    const updated = { ...results, [testId]: { ...results[testId], status } }
    setResults(updated)
    if (activeRunId) {
      await window.api.tests.update(activeRunId, { results: JSON.stringify(updated), notes: runNotes })
    }
  }

  async function updateNote(testId: string, note: string) {
    const updated = { ...results, [testId]: { ...results[testId], note } }
    setResults(updated)
    if (activeRunId) {
      await window.api.tests.update(activeRunId, { results: JSON.stringify(updated), notes: runNotes })
    }
  }

  async function saveRunNotes(notes: string) {
    setRunNotes(notes)
    if (activeRunId) {
      await window.api.tests.update(activeRunId, { results: JSON.stringify(results), notes })
    }
  }

  async function deleteRun(id: number) {
    await window.api.tests.delete(id)
    setActiveRunId(null)
    setResults(emptyResults())
    setRunNotes('')
    loadRuns()
  }

  function buildClaudeReport(): string {
    const run = runs.find(r => r.id === activeRunId)
    const date = run ? format(new Date(run.run_date), 'd MMM yyyy, h:mm a') : format(new Date(), 'd MMM yyyy, h:mm a')
    const passed = TEST_ITEMS.filter(t => results[t.id]?.status === 'pass').length
    const failed = TEST_ITEMS.filter(t => results[t.id]?.status === 'fail').length
    const skipped = TEST_ITEMS.filter(t => results[t.id]?.status === 'skip').length
    const pending = TEST_ITEMS.filter(t => results[t.id]?.status === 'pending').length

    const lines: string[] = [
      `## Vault v${APP_VERSION} — Test Results`,
      `**Date:** ${date}`,
      `**Summary:** ${passed} passed · ${failed} failed · ${skipped} skipped · ${pending} not tested`,
      '',
    ]

    for (const category of CATEGORIES) {
      const items = TEST_ITEMS.filter(t => t.category === category)
      lines.push(`### ${category}`)
      for (const item of items) {
        const r = results[item.id]
        const icon = r?.status === 'pass' ? '✅' : r?.status === 'fail' ? '❌' : r?.status === 'skip' ? '⏭️' : '⬜'
        const note = r?.note ? ` — *${r.note}*` : ''
        lines.push(`${icon} ${item.label}${note}`)
      }
      lines.push('')
    }

    if (runNotes.trim()) {
      lines.push('### Overall Notes')
      lines.push(runNotes)
    }

    return lines.join('\n')
  }

  function copyForClaude() {
    const report = buildClaudeReport()
    navigator.clipboard.writeText(report)
    setCopied(true)
    setTimeout(() => setCopied(false), 3000)
  }

  function toggleCategory(cat: string) {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  const passed = TEST_ITEMS.filter(t => results[t.id]?.status === 'pass').length
  const failed = TEST_ITEMS.filter(t => results[t.id]?.status === 'fail').length
  const total = TEST_ITEMS.length
  const pct = Math.round((passed / total) * 100)

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Release Testing</h1>
          <p className="text-sm text-text-secondary mt-1">
            Version <span className="text-accent font-semibold">v{APP_VERSION}</span> · Click Pass / Fail on each item, add a note if something's wrong, then copy the results for Claude.
          </p>
        </div>
        <Button size="sm" onClick={startNewRun}>
          <Plus size={14} /> New Test Run
        </Button>
      </div>

      {runs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-text-secondary text-sm">No test runs yet.</p>
          <p className="text-text-muted text-xs mt-1">Click "New Test Run" to start.</p>
        </div>
      )}

      {activeRunId && (
        <>
          {/* Run selector + actions */}
          {runs.length > 1 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Run:</span>
              {runs.map(run => (
                <button
                  key={run.id}
                  onClick={() => loadRun(run)}
                  className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                    run.id === activeRunId
                      ? 'border-accent bg-accent-muted text-accent'
                      : 'border-border text-text-secondary hover:border-border-subtle hover:text-text-primary'
                  }`}
                >
                  {format(new Date(run.run_date), 'd MMM, h:mm a')}
                </button>
              ))}
            </div>
          )}

          {/* Progress summary */}
          <Card>
            <CardContent className="pt-5 pb-5">
              <div className="flex items-center justify-between gap-6 mb-4">
                <div className="flex gap-6">
                  <StatPill label="Passed" value={passed} color="text-success" />
                  <StatPill label="Failed" value={failed} color="text-danger" />
                  <StatPill label="Total" value={total} color="text-text-secondary" />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold text-text-primary">{pct}%</span>
                  <Button
                    onClick={copyForClaude}
                    variant={copied ? 'success' : 'default'}
                    size="sm"
                  >
                    {copied ? <><Check size={14} /> Copied!</> : <><ClipboardCopy size={14} /> Copy for Claude</>}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteRun(activeRunId)}
                    title="Delete this run"
                  >
                    <Trash2 size={14} className="text-danger" />
                  </Button>
                </div>
              </div>
              <div className="bg-surface-hover rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-accent transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-text-muted mt-2">
                {passed} of {total} tests passed · {failed > 0 ? `${failed} failing` : 'no failures'}
              </p>
            </CardContent>
          </Card>

          {/* Overall notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-secondary">Overall notes for this run (optional)</label>
            <textarea
              className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 resize-none transition-colors"
              rows={2}
              placeholder="Anything overall to note about this test run..."
              value={runNotes}
              onChange={e => saveRunNotes(e.target.value)}
            />
          </div>

          {/* Test items by category */}
          <div className="space-y-3">
            {CATEGORIES.map(category => {
              const items = TEST_ITEMS.filter(t => t.category === category)
              const catPassed = items.filter(t => results[t.id]?.status === 'pass').length
              const catFailed = items.filter(t => results[t.id]?.status === 'fail').length
              const isExpanded = expandedCategories[category]

              return (
                <Card key={category}>
                  <button
                    onClick={() => toggleCategory(category)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-hover/50 transition-colors rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <CardTitle className="normal-case tracking-normal text-sm font-semibold text-text-primary">{category}</CardTitle>
                      <span className="text-xs text-text-muted">{catPassed}/{items.length}</span>
                      {catFailed > 0 && <Badge variant="danger">{catFailed} failing</Badge>}
                      {catPassed === items.length && <Badge variant="success">All passed</Badge>}
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-text-muted" /> : <ChevronDown size={14} className="text-text-muted" />}
                  </button>

                  {isExpanded && (
                    <CardContent className="pt-0 pb-3 space-y-2">
                      <div className="h-px bg-border mb-3" />
                      {items.map(item => {
                        const result = results[item.id] ?? { status: 'pending', note: '' }
                        const sc = statusConfig[result.status]
                        const Icon = sc.icon

                        return (
                          <div
                            key={item.id}
                            className={`rounded-lg border p-3 transition-all ${
                              result.status === 'pass' ? 'border-success/20 bg-success/5' :
                              result.status === 'fail' ? 'border-danger/20 bg-danger/5' :
                              'border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2 min-w-0 flex-1">
                                <Icon size={15} className={`${sc.color} flex-shrink-0 mt-0.5`} />
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-text-primary">{item.label}</p>
                                  <p className="text-xs text-text-muted mt-0.5">{item.detail}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button
                                  onClick={() => updateResult(item.id, 'pass')}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                                    result.status === 'pass'
                                      ? 'bg-success text-white border-success'
                                      : 'border-border text-text-muted hover:border-success hover:text-success'
                                  }`}
                                >
                                  Pass
                                </button>
                                <button
                                  onClick={() => updateResult(item.id, 'fail')}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                                    result.status === 'fail'
                                      ? 'bg-danger text-white border-danger'
                                      : 'border-border text-text-muted hover:border-danger hover:text-danger'
                                  }`}
                                >
                                  Fail
                                </button>
                                <button
                                  onClick={() => updateResult(item.id, result.status === 'skip' ? 'pending' : 'skip')}
                                  className={`px-2.5 py-1 rounded text-xs font-medium transition-all border ${
                                    result.status === 'skip'
                                      ? 'bg-warning text-white border-warning'
                                      : 'border-border text-text-muted hover:border-warning hover:text-warning'
                                  }`}
                                >
                                  Skip
                                </button>
                              </div>
                            </div>

                            {result.status === 'fail' && (
                              <input
                                className="mt-2 w-full rounded border border-danger/30 bg-danger/5 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-danger/60 transition-colors"
                                placeholder="What went wrong? (helps Claude fix it)"
                                value={result.note}
                                onChange={e => updateNote(item.id, e.target.value)}
                              />
                            )}
                          </div>
                        )
                      })}
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>

          {/* Bottom copy button */}
          <div className="flex justify-center pt-2">
            <Button onClick={copyForClaude} variant={copied ? 'success' : 'default'} className="gap-2 px-8">
              {copied
                ? <><Check size={15} /> Copied! Paste it into Claude</>
                : <><ClipboardCopy size={15} /> Copy Results for Claude</>
              }
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
    </div>
  )
}
