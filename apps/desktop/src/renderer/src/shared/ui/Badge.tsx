import { cn } from '@renderer/shared/lib/utils'

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success'
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-primary text-primary-foreground border-transparent hover:bg-primary/80',
    secondary: 'bg-secondary text-secondary-foreground border-transparent hover:bg-secondary/80',
    destructive: 'bg-destructive/10 text-destructive border-destructive/20',
    outline: 'text-foreground border-border hover:bg-secondary/50',
    success: 'bg-green-500/10 text-green-500 border-green-500/20'
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
        variants[variant],
        className
      )}
      {...props}
    />
  )
}
