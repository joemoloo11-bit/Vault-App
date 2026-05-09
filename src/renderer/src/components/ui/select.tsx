import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const Select = SelectPrimitive.Root
const SelectValue = SelectPrimitive.Value
const SelectGroup = SelectPrimitive.Group

function SelectTrigger({
  className,
  children,
  label,
  ...props
}: SelectPrimitive.SelectTriggerProps & { label?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-medium text-text-secondary">{label}</span>}
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-border bg-surface-2 px-3 py-2',
          'text-sm text-text-primary placeholder:text-text-muted',
          'focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          'transition-colors duration-150',
          '[&>span]:truncate',
          className
        )}
        {...props}
      >
        {children}
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={14} className="text-text-muted flex-shrink-0" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
    </div>
  )
}

function SelectContent({ className, children, ...props }: SelectPrimitive.SelectContentProps) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        className={cn(
          'relative z-50 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl',
          'data-[state=open]:animate-fade-in',
          className
        )}
        position="popper"
        sideOffset={4}
        {...props}
      >
        <SelectPrimitive.Viewport className="p-1">
          {children}
        </SelectPrimitive.Viewport>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
}

function SelectItem({ className, children, ...props }: SelectPrimitive.SelectItemProps) {
  return (
    <SelectPrimitive.Item
      className={cn(
        'relative flex w-full cursor-pointer select-none items-center rounded-md px-3 py-2 text-sm text-text-secondary outline-none',
        'hover:bg-surface-hover hover:text-text-primary',
        'focus:bg-surface-hover focus:text-text-primary',
        'data-[state=checked]:text-accent',
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator className="absolute right-2">
        <Check size={13} className="text-accent" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.SelectLabelProps) {
  return (
    <SelectPrimitive.Label
      className={cn('px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted', className)}
      {...props}
    />
  )
}

export { Select, SelectTrigger, SelectContent, SelectItem, SelectGroup, SelectLabel, SelectValue }
