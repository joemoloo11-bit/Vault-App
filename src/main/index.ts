import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import { statSync, writeFileSync, readdirSync, existsSync } from 'fs'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  dbGetAccounts, dbSaveAccount, dbUpdateAccount, dbDeleteAccount,
  dbGetIncomeSources, dbSaveIncomeSource, dbUpdateIncomeSource, dbDeleteIncomeSource,
  dbGetExpenses, dbSaveExpense, dbUpdateExpense, dbDeleteExpense,
  dbGetBalanceLogs, dbGetLatestBalances, dbSaveBalanceLog,
  dbGetWeeklyAllocations, dbUpsertWeeklyAllocation, dbSetAllocationFunded,
  dbGetGoals, dbSaveGoal, dbUpdateGoal, dbDeleteGoal,
  dbSaveGoalSnapshot, dbGetGoalSnapshots,
  dbGetTestRuns, dbSaveTestRun, dbUpdateTestRun, dbDeleteTestRun
} from './database'

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0D1117',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Window control IPC
  ipcMain.on('window:minimize', () => mainWindow.minimize())
  ipcMain.on('window:maximize', () => {
    if (mainWindow.isMaximized()) mainWindow.unmaximize()
    else mainWindow.maximize()
  })
  ipcMain.on('window:close', () => mainWindow.close())

  return mainWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.vault.budget')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // ─── Accounts ──────────────────────────────────────────────────────────────
  ipcMain.handle('accounts:getAll', () => dbGetAccounts())
  ipcMain.handle('accounts:save', (_, data) => dbSaveAccount(data))
  ipcMain.handle('accounts:update', (_, id, data) => dbUpdateAccount(id, data))
  ipcMain.handle('accounts:delete', (_, id) => dbDeleteAccount(id))

  // ─── Income Sources ────────────────────────────────────────────────────────
  ipcMain.handle('income:getAll', () => dbGetIncomeSources())
  ipcMain.handle('income:save', (_, data) => dbSaveIncomeSource(data))
  ipcMain.handle('income:update', (_, id, data) => dbUpdateIncomeSource(id, data))
  ipcMain.handle('income:delete', (_, id) => dbDeleteIncomeSource(id))

  // ─── Expenses ──────────────────────────────────────────────────────────────
  ipcMain.handle('expenses:getAll', () => dbGetExpenses())
  ipcMain.handle('expenses:save', (_, data) => dbSaveExpense(data))
  ipcMain.handle('expenses:update', (_, id, data) => dbUpdateExpense(id, data))
  ipcMain.handle('expenses:delete', (_, id) => dbDeleteExpense(id))

  // ─── Balance Logs ──────────────────────────────────────────────────────────
  ipcMain.handle('balances:getAll', (_, accountId) => dbGetBalanceLogs(accountId))
  ipcMain.handle('balances:getLatest', () => dbGetLatestBalances())
  ipcMain.handle('balances:save', (_, data) => dbSaveBalanceLog(data))

  // ─── Weekly Allocations ────────────────────────────────────────────────────
  ipcMain.handle('allocations:getWeek', (_, weekStart) => dbGetWeeklyAllocations(weekStart))
  ipcMain.handle('allocations:upsert', (_, data) => dbUpsertWeeklyAllocation(data))
  ipcMain.handle('allocations:setFunded', (_, id, funded) => dbSetAllocationFunded(id, funded))

  // ─── Goals ────────────────────────────────────────────────────────────────
  ipcMain.handle('goals:getAll', () => dbGetGoals())
  ipcMain.handle('goals:save', (_, data) => dbSaveGoal(data))
  ipcMain.handle('goals:update', (_, id, data) => dbUpdateGoal(id, data))
  ipcMain.handle('goals:delete', (_, id) => dbDeleteGoal(id))
  ipcMain.handle('goals:saveSnapshot', (_, data) => dbSaveGoalSnapshot(data))
  ipcMain.handle('goals:getSnapshots', (_, goalId) => dbGetGoalSnapshots(goalId))

  // ─── Test Runs ────────────────────────────────────────────────────────────
  ipcMain.handle('tests:getAll', () => dbGetTestRuns())
  ipcMain.handle('tests:save', (_, data) => dbSaveTestRun(data))
  ipcMain.handle('tests:update', (_, id, data) => dbUpdateTestRun(id, data))
  ipcMain.handle('tests:delete', (_, id) => dbDeleteTestRun(id))

  // ─── Debug ────────────────────────────────────────────────────────────────
  // ─── Updates ──────────────────────────────────────────────────────────────
  ipcMain.handle('app:checkForUpdates', (_, folderPath: string) => {
    try {
      const files = readdirSync(folderPath)
      const pattern = /^Vault Setup (\d+\.\d+\.\d+)\.exe$/
      const found = files
        .map(f => ({ f, m: f.match(pattern) }))
        .filter(({ m }) => m !== null)
        .map(({ f, m }) => ({ version: m![1], path: join(folderPath, f) }))
        .sort((a, b) => compareVersions(b.version, a.version))
      const current = app.getVersion()
      if (found.length === 0) return { hasUpdate: false, currentVersion: current }
      const latest = found[0]
      return {
        hasUpdate: compareVersions(latest.version, current) > 0,
        latestVersion: latest.version,
        currentVersion: current,
        path: latest.path,
      }
    } catch {
      return { error: 'Could not read that folder — check the path is correct.' }
    }
  })

  ipcMain.handle('app:installUpdate', async (_, exePath: string) => {
    if (!existsSync(exePath)) {
      return { success: false, error: `Installer not found: ${exePath}` }
    }
    try {
      const child = spawn(exePath, [], { detached: true, stdio: 'ignore' })
      child.on('error', (err) => {
        console.error('Failed to launch installer:', err)
      })
      child.unref()
      setTimeout(() => app.quit(), 1500)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to launch installer' }
    }
  })

  ipcMain.handle('debug:getInfo', () => {
    const dbPath = join(app.getPath('userData'), 'vault.db')
    let dbSizeKb = 0
    try { dbSizeKb = statSync(dbPath).size / 1024 } catch {}
    return {
      appVersion: app.getVersion(),
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node,
      chromeVersion: process.versions.chrome,
      platform: process.platform,
      dbPath,
      dbSizeKb,
      uptimeSeconds: process.uptime(),
    }
  })

  const ALLOWED_TABLES = ['accounts','income_sources','expenses','balance_logs','weekly_allocations','goals','goal_snapshots','test_runs']

  ipcMain.handle('debug:getTableCounts', () => {
    const { getDb } = require('./database')
    return ALLOWED_TABLES.reduce((acc: Record<string, number>, t) => {
      acc[t] = (getDb().prepare(`SELECT COUNT(*) as count FROM ${t}`).get() as { count: number }).count
      return acc
    }, {})
  })

  ipcMain.handle('debug:getTableRows', (_, table: string) => {
    if (!ALLOWED_TABLES.includes(table)) return []
    const { getDb } = require('./database')
    return getDb().prepare(`SELECT * FROM ${table} ORDER BY id DESC LIMIT 20`).all()
  })

  ipcMain.handle('debug:saveLog', (_, text: string) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filename = `vault-debug-${timestamp}.txt`
    const savePath = join(app.getPath('downloads'), filename)
    writeFileSync(savePath, text, 'utf-8')
    return savePath
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map(Number)
  const pb = b.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if ((pa[i] ?? 0) > (pb[i] ?? 0)) return 1
    if ((pa[i] ?? 0) < (pb[i] ?? 0)) return -1
  }
  return 0
}
