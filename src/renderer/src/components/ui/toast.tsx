import { useState, useEffect, useCallback, createContext, useContext, useRef } from 'react'
import { CheckCircle2, XCircle, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

type ToastVariant = 'success' | 'danger'

interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} })

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) { clearTimeout(timer); timers.current.delete(id) }
  }, [])

  const toast = useCallback((message: string, variant: ToastVariant = 'success') => {
    const id = ++counter
    setToasts(prev => [...prev, { id, message, variant }])
    const timer = setTimeout(() => dismiss(id), 3000)
    timers.current.set(id, timer)
  }, [dismiss])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[9998] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast: t, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const show = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(show)
  }, [])

  const Icon = t.variant === 'success' ? CheckCircle2 : XCircle

  return (
    <div className={cn(
      'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border shadow-2xl',
      'transition-all duration-300',
      visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
      t.variant === 'success'
        ? 'bg-surface border-success/30 text-success'
        : 'bg-surface border-danger/30 text-danger'
    )}>
      <Icon size={15} className="flex-shrink-0" />
      <span className="text-sm text-text-primary">{t.message}</span>
      <button
        onClick={() => onDismiss(t.id)}
        className="ml-1 text-text-muted hover:text-text-primary transition-colors"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
