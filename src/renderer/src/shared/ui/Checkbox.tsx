import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@renderer/shared/lib/utils'

interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

export function Checkbox({
  className,
  label,
  checked,
  onCheckedChange,
  ...props
}: CheckboxProps): React.JSX.Element {
  return (
    <label className={cn('group flex items-center gap-2.5 cursor-pointer select-none', className)}>
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          {...props}
        />
        <div
          className={cn(
            'h-5 w-5 rounded-md border-2 border-border bg-background transition-all duration-200',
            'peer-checked:bg-primary peer-checked:border-primary',
            'group-hover:border-primary/50 group-hover:bg-primary/5',
            'peer-checked:group-hover:bg-primary/90'
          )}
        />
        <Check
          className={cn(
            'absolute h-3.5 w-3.5 text-primary-foreground transition-all duration-200 scale-0 opacity-0',
            'peer-checked:scale-100 peer-checked:opacity-100'
          )}
          strokeWidth={3}
        />
      </div>
      {label && (
        <span
          className={cn(
            'text-sm font-medium transition-colors duration-200',
            checked ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'
          )}
        >
          {label}
        </span>
      )}
    </label>
  )
}
