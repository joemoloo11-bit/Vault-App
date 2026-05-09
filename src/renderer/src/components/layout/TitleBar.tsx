import { Minus, Square, X } from 'lucide-react'

export default function TitleBar() {
  return (
    <div className="drag-region flex items-center justify-between h-10 px-4 bg-background border-b border-border flex-shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-5 h-5 rounded-md bg-[#0D1117] border border-accent/25 flex items-center justify-center">
          <span className="text-[10px] font-black bg-gradient-to-b from-teal-300 to-teal-600 bg-clip-text text-transparent leading-none">V</span>
        </div>
        <span className="text-xs font-semibold text-text-secondary tracking-widest uppercase">Vault</span>
      </div>
      <div className="no-drag flex items-center gap-1">
        <button
          onClick={() => window.api.window.minimize()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <Minus size={12} />
        </button>
        <button
          onClick={() => window.api.window.maximize()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-text-primary hover:bg-surface-hover transition-colors"
        >
          <Square size={11} />
        </button>
        <button
          onClick={() => window.api.window.close()}
          className="w-7 h-7 rounded flex items-center justify-center text-text-muted hover:text-white hover:bg-danger transition-colors"
        >
          <X size={13} />
        </button>
      </div>
    </div>
  )
}
