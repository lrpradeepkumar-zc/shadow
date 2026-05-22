import { cn } from '@/utils/cn'
import { getInitials, avatarColor } from '@/utils/string'

interface AvatarProps {
  name?: string | null
  src?: string | null
  color?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  xs: 'size-5 text-[9px]',
  sm: 'size-6 text-[10px]',
  md: 'size-8 text-xs',
  lg: 'size-10 text-sm',
}

export function Avatar({ name, src, color, size = 'sm', className }: AvatarProps) {
  const bg = color ?? avatarColor(name)
  const initials = getInitials(name)

  if (src) {
    return (
      <img
        src={src}
        alt={name ?? ''}
        className={cn('rounded-full object-cover', sizeClasses[size], className)}
      />
    )
  }

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-full font-semibold text-white flex-shrink-0',
        sizeClasses[size],
        className
      )}
      style={{ backgroundColor: bg }}
      title={name ?? undefined}
    >
      {initials}
    </span>
  )
}
