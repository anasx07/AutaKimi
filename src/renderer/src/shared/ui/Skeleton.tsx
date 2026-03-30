import { cn } from '../lib/utils'

interface SkeletonProps {
  className?: string
  variant?: 'rectangular' | 'circular' | 'text'
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse bg-muted/40',
        variant === 'rectangular' && 'rounded-lg',
        variant === 'circular' && 'rounded-full',
        variant === 'text' && 'rounded h-4 w-full',
        className
      )}
    />
  )
}

export function MediaCardSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="aspect-[3/4.5] w-full rounded-xl" />
      <div className="space-y-2 px-1">
        <Skeleton variant="text" className="w-5/6 h-3" />
        <Skeleton variant="text" className="w-2/5 h-2 opacity-50" />
      </div>
    </div>
  )
}

export function ChapterItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b border-border/10">
      <div className="flex-1 space-y-2">
        <Skeleton variant="text" className="w-1/4 h-3" />
        <Skeleton variant="text" className="w-1/3 h-2 opacity-50" />
      </div>
      <div className="flex gap-2">
        <Skeleton variant="circular" className="w-8 h-8" />
        <Skeleton variant="circular" className="w-8 h-8 opacity-50" />
      </div>
    </div>
  )
}

export function HeroSkeleton() {
  return (
    <div className="relative h-[450px] w-full bg-card overflow-hidden">
      <Skeleton className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-x-0 bottom-0 p-8 space-y-4 max-w-7xl mx-auto">
        <Skeleton variant="text" className="w-1/3 h-8" />
        <div className="flex gap-2">
          <Skeleton variant="rectangular" className="w-20 h-6" />
          <Skeleton variant="rectangular" className="w-24 h-6 opacity-60" />
        </div>
        <Skeleton variant="text" className="w-1/2 h-4 opacity-40" />
      </div>
    </div>
  )
}

export function HistoryItemSkeleton() {
  return (
    <div className="flex items-start rounded-md gap-4 p-4 bg-card border border-border/40">
      <Skeleton className="w-24 h-32 rounded flex-shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col justify-center space-y-3 pt-1">
        <Skeleton variant="text" className="w-3/4 h-4" />
        <Skeleton variant="text" className="w-1/3 h-3 opacity-70" />
        <div className="flex flex-col pt-2 space-y-2">
          <Skeleton variant="text" className="w-1/4 h-2 opacity-50" />
          <Skeleton variant="text" className="w-1/5 h-2 opacity-50" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Skeleton variant="circular" className="w-8 h-8 opacity-40" />
      </div>
    </div>
  )
}
