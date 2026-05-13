export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'focus'
  | 'blur'
  | 'click'
  | 'input'
  | 'keydown'
  | 'ipc'
  | 'portal'
  | 'nav'
  | 'render'

export interface DebugEntry {
  id: number
  level: LogLevel
  message: string
  detail?: string
  timestamp: Date
}

const MAX_ENTRIES = 2000
let entries: DebugEntry[] = []
let counter = 0
const sessionStart = new Date()
const listeners = new Set<() => void>()

export function addDebugEntry(level: LogLevel, message: string, detail?: string) {
  const entry: DebugEntry = { id: ++counter, level, message, detail, timestamp: new Date() }
  entries = [entry, ...entries].slice(0, MAX_ENTRIES)
  listeners.forEach(l => l())
}

export function clearEntries(level?: LogLevel) {
  entries = level ? entries.filter(e => e.level !== level) : []
  listeners.forEach(l => l())
}

export function getEntries() { return entries }
export function getSessionStart() { return sessionStart }
export function getTotalCount() { return counter }

export function subscribeToDebug(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function exportLogText(): string {
  const lines: string[] = [
    '═══════════════════════════════════════════════════════',
    ' VAULT DEBUG LOG',
    `═══════════════════════════════════════════════════════`,
    `  Session started : ${sessionStart.toLocaleString('en-AU')}`,
    `  Export time     : ${new Date().toLocaleString('en-AU')}`,
    `  Total entries   : ${counter}`,
    `  App version     : 1.0.0`,
    '═══════════════════════════════════════════════════════',
    '',
  ]

  const toLog = [...entries].reverse()
  for (const e of toLog) {
    const ts = e.timestamp.toTimeString().slice(0, 12)
    const lvl = e.level.toUpperCase().padEnd(7)
    lines.push(`[${ts}] ${lvl} ${e.message}`)
    if (e.detail) lines.push(`           ↳ ${e.detail}`)
  }

  lines.push('')
  lines.push('═══════════════════════════════════════════════════════')
  lines.push(` END OF LOG — ${toLog.length} entries`)
  lines.push('═══════════════════════════════════════════════════════')

  return lines.join('\n')
}

// ─── Install global listeners ─────────────────────────────────────────────────

let installed = false

export function installDebugListeners() {
  if (installed) return
  installed = true

  addDebugEntry('info', `Session started — Vault v1.13.0`)

  // ── JS errors ───────────────────────────────────────────────────────────────
  window.addEventListener('error', (e) => {
    addDebugEntry('error', e.message,
      `${e.filename?.split('/').pop() ?? '?'}:${e.lineno}:${e.colno}`)
  })

  window.addEventListener('unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    const stack = e.reason?.stack?.split('\n')[1]?.trim()
    addDebugEntry('error', `Unhandled rejection: ${msg}`, stack)
  })

  // ── Console capture ─────────────────────────────────────────────────────────
  const origError = console.error.bind(console)
  console.error = (...args) => {
    addDebugEntry('error', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
    origError(...args)
  }

  const origWarn = console.warn.bind(console)
  console.warn = (...args) => {
    addDebugEntry('warn', args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' '))
    origWarn(...args)
  }

  // ── Focus / blur ────────────────────────────────────────────────────────────
  document.addEventListener('focusin', (e) => {
    const el = e.target as Element
    const tag = el.tagName?.toLowerCase() ?? '?'
    const role = el.getAttribute('role') ?? ''
    const id = el.id ? `#${el.id}` : ''
    const state = el.getAttribute('data-state') ?? ''
    const label = el.getAttribute('aria-label') ?? el.getAttribute('placeholder') ?? el.textContent?.trim().slice(0, 40) ?? ''
    addDebugEntry('focus',
      `Focus → ${tag}${id}${role ? ` [role=${role}]` : ''}${state ? ` [state=${state}]` : ''}`,
      label || undefined)
  }, true)

  document.addEventListener('focusout', (e) => {
    const el = e.target as Element
    const tag = el.tagName?.toLowerCase() ?? '?'
    const role = el.getAttribute('role') ?? ''
    const id = el.id ? `#${el.id}` : ''
    const rt = (e as FocusEvent).relatedTarget as Element | null
    const nextEl = rt ? `${rt.tagName?.toLowerCase()}${rt.id ? `#${rt.id}` : ''}` : 'none (outside app?)'
    addDebugEntry('blur',
      `Blur ← ${tag}${id}${role ? ` [role=${role}]` : ''}`,
      `Focus moving to: ${nextEl}`)
  }, true)

  // ── Click ───────────────────────────────────────────────────────────────────
  document.addEventListener('click', (e) => {
    const el = e.target as Element
    const tag = el.tagName?.toLowerCase() ?? '?'
    const role = el.getAttribute('role') ?? ''
    const state = el.getAttribute('data-state') ?? ''
    const text = el.textContent?.trim().slice(0, 60) ?? ''
    const disabled = el.getAttribute('disabled') !== null || el.getAttribute('aria-disabled') === 'true'
    addDebugEntry('click',
      `Click: ${tag}${role ? ` [role=${role}]` : ''} "${text}"`,
      [state ? `data-state=${state}` : '', disabled ? 'DISABLED' : ''].filter(Boolean).join(' | ') || undefined)
  }, true)

  // ── Input / change ──────────────────────────────────────────────────────────
  document.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement
    const tag = el.tagName?.toLowerCase() ?? '?'
    const name = el.name || el.id || el.placeholder || el.getAttribute('aria-label') || ''
    const type = el.type ?? 'text'
    const valDisplay = type === 'password' ? '••••' : el.value?.slice(0, 60)
    addDebugEntry('input', `Input: ${tag} "${name}"`, `value: "${valDisplay}"`)
  }, true)

  document.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement | HTMLSelectElement
    const tag = el.tagName?.toLowerCase() ?? '?'
    const name = el.name || el.id || ''
    addDebugEntry('input', `Change: ${tag} "${name}"`, `value: "${el.value?.slice(0, 60)}"`)
  }, true)

  // ── Key events ──────────────────────────────────────────────────────────────
  document.addEventListener('keydown', (e) => {
    const important = ['Escape', 'Enter', 'Tab', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'Backspace']
    if (important.includes(e.key) || e.ctrlKey || e.altKey) {
      const el = document.activeElement
      const tag = el?.tagName?.toLowerCase() ?? '?'
      const role = el?.getAttribute('role') ?? ''
      const combo = [e.ctrlKey && 'Ctrl', e.shiftKey && 'Shift', e.altKey && 'Alt', e.key].filter(Boolean).join('+')
      addDebugEntry('keydown', `Key: ${combo} on ${tag}${role ? ` [${role}]` : ''}`)
    }
  }, true)

  // ── Mousedown (outside-click detection for modals/dropdowns) ────────────────
  document.addEventListener('mousedown', (e) => {
    const el = e.target as Element
    const isPortal = el.closest('[data-radix-popper-content-wrapper]') ||
                     el.closest('[role="dialog"]') ||
                     el.closest('[role="listbox"]') ||
                     el.closest('[role="menu"]')
    if (!isPortal) {
      const activeDialog = document.querySelector('[role="dialog"]')
      const activeListbox = document.querySelector('[role="listbox"]')
      if (activeDialog || activeListbox) {
        addDebugEntry('click',
          `Outside click while ${activeDialog ? 'dialog' : 'dropdown'} open`,
          `Clicked: ${el.tagName?.toLowerCase()} "${el.textContent?.trim().slice(0, 40)}"`)
      }
    }
  }, true)

  // ── DOM mutations — portal mount/unmount (dialogs, dropdowns, tooltips) ──────
  const portalRoles = ['dialog', 'listbox', 'menu', 'tooltip', 'alertdialog']
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue
        const role = node.getAttribute('role') ??
          node.querySelector('[role]')?.getAttribute('role') ?? ''
        const isPopper = node.hasAttribute('data-radix-popper-content-wrapper') ||
          node.querySelector('[data-radix-popper-content-wrapper]') !== null
        if (portalRoles.includes(role) || isPopper) {
          addDebugEntry('portal', `Mounted: [role="${role || 'popper'}"]`,
            node.textContent?.trim().slice(0, 80) || undefined)
        }
      }
      for (const node of mutation.removedNodes) {
        if (!(node instanceof Element)) continue
        const role = node.getAttribute('role') ??
          node.querySelector('[role]')?.getAttribute('role') ?? ''
        const isPopper = node.hasAttribute('data-radix-popper-content-wrapper') ||
          node.querySelector('[data-radix-popper-content-wrapper]') !== null
        if (portalRoles.includes(role) || isPopper) {
          addDebugEntry('portal', `Unmounted: [role="${role || 'popper'}"]`)
        }
      }
    }
  })
  observer.observe(document.body, { childList: true, subtree: true })

  // ── IPC call interception — wraps window.api once it's available ─────────────
  // contextBridge makes window.api non-writable in production; skip silently if so
  setTimeout(() => {
    if (!(window as any).api) return
    try {
      ;(window as any).api = wrapApiProxy((window as any).api, '')
    } catch {
      // read-only in installed build — IPC logging unavailable
    }
  }, 100)
}

function wrapApiProxy(target: any, prefix: string): any {
  return new Proxy(target, {
    get(obj, prop) {
      const val = obj[prop]
      if (typeof val === 'function') {
        return async (...args: any[]) => {
          const path = `${prefix}${String(prop)}`
          const argsStr = args.length
            ? JSON.stringify(args).slice(0, 120)
            : ''
          addDebugEntry('ipc', `→ api.${path}()`, argsStr || undefined)
          try {
            const result = await val.apply(obj, args)
            addDebugEntry('ipc', `← api.${path} OK`)
            return result
          } catch (err: any) {
            addDebugEntry('error', `← api.${path} FAILED: ${err?.message ?? err}`)
            throw err
          }
        }
      }
      if (typeof val === 'object' && val !== null && prop !== 'window') {
        return wrapApiProxy(val, `${prefix}${String(prop)}.`)
      }
      return val
    }
  })
}
