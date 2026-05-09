import { forwardRef, type InputHTMLAttributes } from 'react'
import { cn } from '@renderer/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  hint?: string
  error?: string
  prefix?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, prefix, type, ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label className="text-xs font-medium text-text-secondary">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-sm text-text-muted select-none pointer-events-none">
              {prefix}
            </span>
          )}
          <input
            type={type}
            className={cn(
              'flex h-9 w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-muted',
              'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
              'transition-colors duration-150',
              'disabled:opacity-40 disabled:cursor-not-allowed',
              error && 'border-danger focus:border-danger focus:ring-danger/30',
              prefix && 'pl-7',
              className
            )}
            ref={ref}
            {...props}
          />
        </div>
        {hint && !error && <p className="text-[11px] text-text-muted">{hint}</p>}
        {error && <p className="text-[11px] text-danger">{error}</p>}
      </div>
    )
  }
)
Input.displayName = 'Input'

export { Input }
