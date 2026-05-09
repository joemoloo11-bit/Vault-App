import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) {
    const userDataPath = app.getPath('userData')
    const dbPath = path.join(userDataPath, 'vault.db')
    db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    initSchema(db)
  }
  return db
}

function initSchema(db: Database.Database): void {
  // Migrations for existing installs
  try { db.exec('ALTER TABLE expenses ADD COLUMN allocation_amount REAL') } catch {}
  try { db.exec('ALTER TABLE expenses ADD COLUMN weekly_extra REAL') } catch {}
  try { db.exec('ALTER TABLE income_sources ADD COLUMN payday_reference TEXT') } catch {}
  // v1.5.0 — money flow architecture
  try { db.exec('ALTER TABLE expenses ADD COLUMN save_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL') } catch {}
  try { db.exec('ALTER TABLE expenses ADD COLUMN debit_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL') } catch {}
  try { db.exec("ALTER TABLE accounts ADD COLUMN type TEXT NOT NULL DEFAULT 'envelope'") } catch {}
  try { db.exec('ALTER TABLE accounts ADD COLUMN buffer_target REAL') } catch {}
  try { db.exec('ALTER TABLE accounts ADD COLUMN sweep_amount REAL') } catch {}
  try { db.exec('ALTER TABLE accounts ADD COLUMN sweep_to_account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL') } catch {}
  // Backfill: copy account_id into save_account_id for any expense that doesn't have one yet
  try { db.exec('UPDATE expenses SET save_account_id = account_id WHERE save_account_id IS NULL AND account_id IS NOT NULL') } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#14B8A6',
      weekly_target REAL NOT NULL DEFAULT 0,
      buffer_percent REAL NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS income_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      person_name TEXT NOT NULL,
      amount REAL NOT NULL,
      frequency TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      allocation_amount REAL,
      frequency TEXT NOT NULL,
      due_day INTEGER,
      account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL,
      category TEXT NOT NULL DEFAULT 'Other',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS balance_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      balance REAL NOT NULL,
      notes TEXT,
      logged_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS weekly_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week_start TEXT NOT NULL,
      account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      planned_amount REAL NOT NULL,
      actual_amount REAL,
      buffer_amount REAL NOT NULL DEFAULT 0,
      funded INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      saved_amount REAL NOT NULL DEFAULT 0,
      deadline TEXT,
      priority TEXT NOT NULL DEFAULT 'want',
      status TEXT NOT NULL DEFAULT 'active',
      weekly_contribution REAL NOT NULL DEFAULT 0,
      approach TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goal_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      saved_amount REAL NOT NULL,
      snapshot_date TEXT NOT NULL DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS test_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      version TEXT NOT NULL,
      results TEXT NOT NULL DEFAULT '{}',
      notes TEXT,
      run_date TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
}

// ─── Accounts ────────────────────────────────────────────────────────────────

export function dbGetAccounts() {
  return getDb().prepare('SELECT * FROM accounts ORDER BY sort_order, name').all()
}

export function dbSaveAccount(data: {
  name: string; color: string; weekly_target: number; buffer_percent: number; sort_order?: number;
  type?: string; buffer_target?: number; sweep_amount?: number; sweep_to_account_id?: number
}) {
  const stmt = getDb().prepare(
    'INSERT INTO accounts (name, color, weekly_target, buffer_percent, sort_order, type, buffer_target, sweep_amount, sweep_to_account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const result = stmt.run(
    data.name, data.color, data.weekly_target, data.buffer_percent, data.sort_order ?? 0,
    data.type ?? 'envelope', data.buffer_target ?? null, data.sweep_amount ?? null, data.sweep_to_account_id ?? null
  )
  return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(result.lastInsertRowid)
}

export function dbUpdateAccount(id: number, data: Partial<{
  name: string; color: string; weekly_target: number; buffer_percent: number; sort_order: number;
  type: string; buffer_target: number | null; sweep_amount: number | null; sweep_to_account_id: number | null
}>) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  getDb().prepare(`UPDATE accounts SET ${fields} WHERE id = ?`).run(...values)
  return getDb().prepare('SELECT * FROM accounts WHERE id = ?').get(id)
}

export function dbDeleteAccount(id: number) {
  getDb().prepare('DELETE FROM accounts WHERE id = ?').run(id)
}

// ─── Income Sources ───────────────────────────────────────────────────────────

export function dbGetIncomeSources() {
  return getDb().prepare('SELECT * FROM income_sources ORDER BY person_name').all()
}

export function dbSaveIncomeSource(data: { person_name: string; amount: number; frequency: string; payday_reference?: string }) {
  const stmt = getDb().prepare(
    'INSERT INTO income_sources (person_name, amount, frequency, payday_reference) VALUES (?, ?, ?, ?)'
  )
  const result = stmt.run(data.person_name, data.amount, data.frequency, data.payday_reference ?? null)
  return getDb().prepare('SELECT * FROM income_sources WHERE id = ?').get(result.lastInsertRowid)
}

export function dbUpdateIncomeSource(id: number, data: Partial<{ person_name: string; amount: number; frequency: string }>) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  getDb().prepare(`UPDATE income_sources SET ${fields} WHERE id = ?`).run(...values)
  return getDb().prepare('SELECT * FROM income_sources WHERE id = ?').get(id)
}

export function dbDeleteIncomeSource(id: number) {
  getDb().prepare('DELETE FROM income_sources WHERE id = ?').run(id)
}

// ─── Expenses ─────────────────────────────────────────────────────────────────

export function dbGetExpenses() {
  return getDb().prepare(`
    SELECT e.*,
      sa.name as save_account_name, sa.color as save_account_color,
      da.name as debit_account_name, da.color as debit_account_color,
      COALESCE(sa.name, a.name) as account_name,
      COALESCE(sa.color, a.color) as account_color
    FROM expenses e
    LEFT JOIN accounts a ON e.account_id = a.id
    LEFT JOIN accounts sa ON e.save_account_id = sa.id
    LEFT JOIN accounts da ON e.debit_account_id = da.id
    ORDER BY e.name
  `).all()
}

export function dbSaveExpense(data: {
  name: string; amount: number; allocation_amount?: number; weekly_extra?: number; frequency: string;
  due_day?: number; account_id?: number; save_account_id?: number; debit_account_id?: number; category: string
}) {
  const saveId = data.save_account_id ?? data.account_id ?? null
  const stmt = getDb().prepare(
    'INSERT INTO expenses (name, amount, allocation_amount, weekly_extra, frequency, due_day, account_id, save_account_id, debit_account_id, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  )
  const result = stmt.run(
    data.name, data.amount, data.allocation_amount ?? null, data.weekly_extra ?? null,
    data.frequency, data.due_day ?? null,
    saveId, saveId, data.debit_account_id ?? null,
    data.category
  )
  return getDb().prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid)
}

export function dbUpdateExpense(id: number, data: Partial<{
  name: string; amount: number; allocation_amount: number | null; weekly_extra: number | null;
  frequency: string; due_day: number; account_id: number; save_account_id: number;
  debit_account_id: number; category: string
}>) {
  const entries = Object.entries(data).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return getDb().prepare('SELECT * FROM expenses WHERE id = ?').get(id)
  const fields = entries.map(([k]) => `${k} = ?`).join(', ')
  const values = [...entries.map(([, v]) => v), id]
  getDb().prepare(`UPDATE expenses SET ${fields} WHERE id = ?`).run(...values)
  return getDb().prepare('SELECT * FROM expenses WHERE id = ?').get(id)
}

export function dbDeleteExpense(id: number) {
  getDb().prepare('DELETE FROM expenses WHERE id = ?').run(id)
}

// ─── Balance Logs ─────────────────────────────────────────────────────────────

export function dbGetBalanceLogs(accountId?: number) {
  if (accountId) {
    return getDb().prepare(
      'SELECT * FROM balance_logs WHERE account_id = ? ORDER BY logged_at DESC'
    ).all(accountId)
  }
  return getDb().prepare(
    'SELECT bl.*, a.name as account_name, a.color as account_color FROM balance_logs bl JOIN accounts a ON bl.account_id = a.id ORDER BY logged_at DESC'
  ).all()
}

export function dbGetLatestBalances() {
  return getDb().prepare(`
    SELECT bl.*, a.name as account_name, a.color as account_color, a.weekly_target, a.buffer_percent
    FROM balance_logs bl
    JOIN accounts a ON bl.account_id = a.id
    WHERE bl.id = (
      SELECT id FROM balance_logs WHERE account_id = bl.account_id ORDER BY logged_at DESC LIMIT 1
    )
    ORDER BY a.sort_order, a.name
  `).all()
}

export function dbSaveBalanceLog(data: { account_id: number; balance: number; notes?: string }) {
  const stmt = getDb().prepare(
    'INSERT INTO balance_logs (account_id, balance, notes) VALUES (?, ?, ?)'
  )
  const result = stmt.run(data.account_id, data.balance, data.notes ?? null)
  return getDb().prepare('SELECT * FROM balance_logs WHERE id = ?').get(result.lastInsertRowid)
}

// ─── Weekly Allocations ───────────────────────────────────────────────────────

export function dbGetWeeklyAllocations(weekStart: string) {
  return getDb().prepare(`
    SELECT wa.*, a.name as account_name, a.color as account_color
    FROM weekly_allocations wa
    JOIN accounts a ON wa.account_id = a.id
    WHERE wa.week_start = ?
    ORDER BY a.sort_order, a.name
  `).all(weekStart)
}

export function dbUpsertWeeklyAllocation(data: {
  week_start: string; account_id: number; planned_amount: number; buffer_amount: number; actual_amount?: number
}) {
  const existing = getDb().prepare(
    'SELECT id FROM weekly_allocations WHERE week_start = ? AND account_id = ?'
  ).get(data.week_start, data.account_id) as { id: number } | undefined

  if (existing) {
    getDb().prepare(`
      UPDATE weekly_allocations
      SET planned_amount = ?, buffer_amount = ?, actual_amount = COALESCE(?, actual_amount)
      WHERE id = ?
    `).run(data.planned_amount, data.buffer_amount, data.actual_amount ?? null, existing.id)
    return getDb().prepare('SELECT * FROM weekly_allocations WHERE id = ?').get(existing.id)
  } else {
    const result = getDb().prepare(`
      INSERT INTO weekly_allocations (week_start, account_id, planned_amount, buffer_amount, actual_amount)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.week_start, data.account_id, data.planned_amount, data.buffer_amount, data.actual_amount ?? null)
    return getDb().prepare('SELECT * FROM weekly_allocations WHERE id = ?').get(result.lastInsertRowid)
  }
}

export function dbSetAllocationFunded(id: number, funded: boolean) {
  getDb().prepare('UPDATE weekly_allocations SET funded = ? WHERE id = ?').run(funded ? 1 : 0, id)
}

// ─── Goals ───────────────────────────────────────────────────────────────────

export function dbGetGoals() {
  return getDb().prepare('SELECT * FROM goals ORDER BY status, deadline').all()
}

export function dbSaveGoal(data: {
  name: string; target_amount: number; deadline?: string; priority: string;
  weekly_contribution?: number; approach?: string
}) {
  const stmt = getDb().prepare(`
    INSERT INTO goals (name, target_amount, deadline, priority, weekly_contribution, approach)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const result = stmt.run(
    data.name, data.target_amount, data.deadline ?? null, data.priority,
    data.weekly_contribution ?? 0, data.approach ?? null
  )
  return getDb().prepare('SELECT * FROM goals WHERE id = ?').get(result.lastInsertRowid)
}

export function dbUpdateGoal(id: number, data: Partial<{
  name: string; target_amount: number; saved_amount: number; deadline: string;
  priority: string; status: string; weekly_contribution: number; approach: string
}>) {
  const fields = Object.keys(data).map(k => `${k} = ?`).join(', ')
  const values = [...Object.values(data), id]
  getDb().prepare(`UPDATE goals SET ${fields} WHERE id = ?`).run(...values)
  return getDb().prepare('SELECT * FROM goals WHERE id = ?').get(id)
}

export function dbDeleteGoal(id: number) {
  getDb().prepare('DELETE FROM goals WHERE id = ?').run(id)
}

export function dbSaveGoalSnapshot(data: { goal_id: number; saved_amount: number }) {
  getDb().prepare(
    'INSERT INTO goal_snapshots (goal_id, saved_amount) VALUES (?, ?)'
  ).run(data.goal_id, data.saved_amount)
}

export function dbGetGoalSnapshots(goalId: number) {
  return getDb().prepare(
    'SELECT * FROM goal_snapshots WHERE goal_id = ? ORDER BY snapshot_date'
  ).all(goalId)
}

// ─── Test Runs ────────────────────────────────────────────────────────────────

export function dbGetTestRuns() {
  return getDb().prepare('SELECT * FROM test_runs ORDER BY run_date DESC').all()
}

export function dbSaveTestRun(data: { version: string; results: string; notes?: string }) {
  const result = getDb().prepare(
    'INSERT INTO test_runs (version, results, notes) VALUES (?, ?, ?)'
  ).run(data.version, data.results, data.notes ?? null)
  return getDb().prepare('SELECT * FROM test_runs WHERE id = ?').get(result.lastInsertRowid)
}

export function dbUpdateTestRun(id: number, data: { results: string; notes?: string }) {
  getDb().prepare('UPDATE test_runs SET results = ?, notes = ? WHERE id = ?')
    .run(data.results, data.notes ?? null, id)
  return getDb().prepare('SELECT * FROM test_runs WHERE id = ?').get(id)
}

export function dbDeleteTestRun(id: number) {
  getDb().prepare('DELETE FROM test_runs WHERE id = ?').run(id)
}
