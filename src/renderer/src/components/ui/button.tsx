import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@renderer/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-background',
  {
    variants: {
      variant: {
        default: 'bg-accent text-white hover:bg-accent-hover shadow-sm',
        outline: 'border border-border-subtle text-text-secondary hover:text-text-primary hover:bg-surface-hover hover:border-accent',
        ghost: 'text-text-secondary hover:text-text-primary hover:bg-surface-hover',
        danger: 'bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20',
        success: 'bg-success/10 text-success border border-success/30 hover:bg-success/20',
        subtle: 'bg-surface-hover text-text-secondary hover:text-text-primary',
      },
      size: {
        sm: 'h-7 px-3 text-xs rounded',
        md: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-8 w-8 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'md',
    },
  }
)

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
