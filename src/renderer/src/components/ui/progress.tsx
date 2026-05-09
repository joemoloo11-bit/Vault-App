import * as ProgressPrimitive from '@radix-ui/react-progress'
import { cn } from '@renderer/lib/utils'

interface ProgressProps extends ProgressPrimitive.ProgressProps {
  color?: 'accent' | 'success' | 'warning' | 'danger'
  size?: 'sm' | 'md'
}

function Progress({ className, value = 0, color = 'accent', size = 'md', ...props }: ProgressProps) {
  const colorMap = {
    accent: 'bg-accent',
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
  }
  const sizeMap = { sm: 'h-1', md: 'h-2' }

  return (
    <ProgressPrimitive.Root
      className={cn('relative overflow-hidden rounded-full bg-surface-hover', sizeMap[size], className)}
      value={Math.min(100, Math.max(0, value ?? 0))}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className={cn('h-full rounded-full transition-all duration-500 ease-out', colorMap[color])}
        style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
