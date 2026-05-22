import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/utils/cn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
}

export function Modal({ open, onClose, title, children, size = 'md', className }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open) {
      el.showModal()
    } else {
      el.close()
    }
  }, [open])

  // Close on backdrop click
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) onClose()
  }

  // Close on Escape
  const handleCancel = (e: React.SyntheticEvent) => {
    e.preventDefault()
    onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      onClick={handleClick}
      onCancel={handleCancel}
      className={cn(
        'rounded-xl shadow-modal backdrop:bg-black/40 backdrop:backdrop-blur-sm',
        'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100',
        'p-0 w-full',
        sizeClasses[size],
        className
      )}
    >
      <div className="flex flex-col max-h-[85vh]">
        {title ? (
          <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
            <h2 className="text-base font-semibold">{title}</h2>
            <button
              onClick={onClose}
              className="size-7 flex items-center justify-center rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Close"
            >
              ×
            </button>
          </div>
        ) : null}
        <div className="overflow-y-auto flex-1 p-5">{children}</div>
      </div>
    </dialog>
  )
}
