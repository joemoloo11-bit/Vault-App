import { app, BrowserWindow, ipcMain, shell, safeStorage } from 'electron'
import { join } from 'path'
import { statSync, writeFileSync, readFileSync, existsSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { spawn } from 'child_process'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import {
  dbGetAccounts, dbSaveAccount, dbUpdateAccount, dbDeleteAccount,
  dbGetIncomeSources, dbSaveIncomeSource, dbUpdateIncomeSource, dbDeleteIncomeSource,
  dbGetExpenses, dbSaveExpense, dbUpdateExpense, dbDeleteExpense,
  dbGetBalanceLogs, dbGetLatestBalances, dbSaveBalanceLog, dbDeleteBalanceLog,
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
  ipcMain.handle('balances:delete', (_, id) => dbDeleteBalanceLog(id))

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

  // ─── Updates (GitHub Releases) ───────────────────────────────────────────
  // The repo is private — needs a PAT with read access to download release assets.

  const REPO_OWNER = 'joemoloo11-bit'
  const REPO_NAME = 'Vault-App'
  const tokenPath = () => join(app.getPath('userData'), 'github-token.dat')

  function saveToken(token: string): void {
    if (!token) {
      try { writeFileSync(tokenPath(), '') } catch {}
      return
    }
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(token)
      writeFileSync(tokenPath(), encrypted)
    } else {
      // Fallback: store plaintext (acceptable for personal app on personal machine)
      writeFileSync(tokenPath(), token, 'utf-8')
    }
  }

  function loadToken(): string | null {
    try {
      const path = tokenPath()
      if (!existsSync(path)) return null
      const data = readFileSync(path)
      if (data.length === 0) return null
      if (safeStorage.isEncryptionAvailable()) {
        try { return safeStorage.decryptString(data) } catch {
          // Maybe stored as plaintext from a fallback save
          return data.toString('utf-8') || null
        }
      }
      return data.toString('utf-8') || null
    } catch {
      return null
    }
  }

  ipcMain.handle('app:setGitHubToken', (_, token: string) => {
    try {
      saveToken(token)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Failed to save token' }
    }
  })

  ipcMain.handle('app:hasGitHubToken', () => {
    return loadToken() !== null
  })

  ipcMain.handle('app:checkForUpdates', async () => {
    const token = loadToken()
    if (!token) {
      return { error: 'No GitHub token set. Paste a Personal Access Token in the dialog to enable update checks.' }
    }
    try {
      const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'Vault-App',
        },
      })
      if (res.status === 401 || res.status === 403) {
        return { error: 'GitHub rejected the token (401/403). Check it has read access to the repo.' }
      }
      if (res.status === 404) {
        return { error: 'No releases found yet. The first release will appear once GitHub Actions finishes building it.' }
      }
      if (!res.ok) {
        return { error: `GitHub API error: ${res.status} ${res.statusText}` }
      }
      const release = await res.json() as {
        tag_name: string
        name: string
        assets: { id: number; name: string; browser_download_url: string; url: string }[]
      }
      const tagVersion = release.tag_name.replace(/^v/, '')
      const current = app.getVersion()
      // GitHub replaces spaces with dots in uploaded asset names, so accept both.
      // Local build: "Vault Setup 1.7.2.exe" — GitHub upload: "Vault.Setup.1.7.2.exe"
      const exeAsset = release.assets.find(a => /^Vault[ .]Setup[ .].+\.exe$/.test(a.name))
      if (!exeAsset) {
        return { error: 'Latest release has no Windows installer attached.' }
      }
      return {
        hasUpdate: compareVersions(tagVersion, current) > 0,
        latestVersion: tagVersion,
        currentVersion: current,
        assetUrl: exeAsset.url, // API URL — required for private repo download
        assetName: exeAsset.name,
      }
    } catch (err: any) {
      return { error: `Network error: ${err?.message ?? 'unknown'}` }
    }
  })

  ipcMain.handle('app:installUpdate', async (_, assetUrl: string, assetName: string) => {
    const token = loadToken()
    if (!token) return { success: false, error: 'No GitHub token set.' }
    try {
      const res = await fetch(assetUrl, {
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/octet-stream',
          'User-Agent': 'Vault-App',
        },
      })
      if (!res.ok) {
        return { success: false, error: `Download failed: ${res.status} ${res.statusText}` }
      }
      const buf = Buffer.from(await res.arrayBuffer())
      const dir = mkdtempSync(join(tmpdir(), 'vault-update-'))
      const exePath = join(dir, assetName)
      writeFileSync(exePath, buf)

      const child = spawn(exePath, [], { detached: true, stdio: 'ignore' })
      child.on('error', (err) => console.error('Failed to launch installer:', err))
      child.unref()
      setTimeout(() => app.quit(), 1500)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Install failed' }
    }
  })

  // ─── Debug ────────────────────────────────────────────────────────────────

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
