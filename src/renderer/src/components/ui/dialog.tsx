import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

function DialogOverlay({ className, ...props }: DialogPrimitive.DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      className={cn(
        'fixed inset-0 z-50 bg-black/60 backdrop-blur-sm',
        'data-[state=open]:animate-fade-in',
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: DialogPrimitive.DialogContentProps & { title?: string; description?: string }) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2',
          'w-full max-w-lg rounded-xl bg-surface border border-border shadow-2xl',
          'data-[state=open]:animate-dialog-in',
          'focus:outline-none',
          className
        )}
        {...props}
      >
        {(title || description) && (
          <div className="flex items-start justify-between p-6 pb-4 border-b border-border">
            <div>
              {title && (
                <DialogPrimitive.Title className="text-base font-semibold text-text-primary">
                  {title}
                </DialogPrimitive.Title>
              )}
              {description && (
                <DialogPrimitive.Description className="text-sm text-text-secondary mt-1">
                  {description}
                </DialogPrimitive.Description>
              )}
            </div>
            <DialogClose className="text-text-muted hover:text-text-primary transition-colors rounded p-1 hover:bg-surface-hover -mr-1 -mt-1">
              <X size={16} />
            </DialogClose>
          </div>
        )}
        <div className="p-6">{children}</div>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

export { Dialog, DialogTrigger, DialogContent, DialogClose, DialogPortal }
