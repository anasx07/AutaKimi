import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  BarChart3,
  Clock,
  Flame,
  Film,
  BookOpen,
  Lock,
  RefreshCw,
  Sparkles,
  Trophy
} from 'lucide-react'
import { DataService } from '@renderer/shared/api'
import { Badge, Button, Card, SectionHeader } from '@renderer/shared/ui'
import { cn } from '@renderer/shared/lib/utils'
import {
  computeWrappedStats,
  formatWrappedDuration,
  formatWrappedHours,
  normalizeHistoryRecord,
  type WrappedMediaFilter
} from '@common/utils/wrappedStats'

const WRAPPED_TABS: Array<{
  id: WrappedMediaFilter
  label: string
  icon: typeof BarChart3
}> = [
  { id: 'all', label: 'All', icon: Sparkles },
  { id: 'anime', label: 'Anime', icon: Film },
  { id: 'manga', label: 'Manga', icon: BookOpen }
]

export function WrappedStats(): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<WrappedMediaFilter>('all')
  const [rawData, setRawData] = useState<{
    historyEntries: any[]
    genresByMangaId: Record<string, string[]>
  } | null>(null)
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const [historyRes, libraryRes] = await Promise.all([
        DataService.db.getHistory({ limit: 5000 }).catch(() => []),
        DataService.db.getLibrary({ limit: 1000 }).catch(() => [])
      ])

      const historyEntries = Array.isArray(historyRes) ? historyRes : []
      const libraryItems = Array.isArray(libraryRes) ? libraryRes : []

      const genresByMangaId: Record<string, string[]> = {}
      for (const item of libraryItems) {
        if (item?.id && Array.isArray(item.genres) && item.genres.length > 0) {
          genresByMangaId[item.id] = item.genres
        }
      }

      // Enrich remaining titles in history from local manga_cache metadata
      const missingIds: string[] = []
      const seen = new Set<string>(Object.keys(genresByMangaId))
      for (const raw of historyEntries) {
        const normalized = normalizeHistoryRecord(raw)
        if (!normalized) continue
        if (!seen.has(normalized.mangaId)) {
          seen.add(normalized.mangaId)
          missingIds.push(normalized.mangaId)
        }
        if (missingIds.length >= 60) break
      }

      if (missingIds.length > 0) {
        const cachedResults = await Promise.all(
          missingIds.map((id) => DataService.db.getMangaCache(id).catch(() => null))
        )
        cachedResults.forEach((cached, idx) => {
          if (cached && Array.isArray(cached.genres) && cached.genres.length > 0) {
            genresByMangaId[missingIds[idx]] = cached.genres
          }
        })
      }

      setRawData({ historyEntries, genresByMangaId })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const stats = useMemo(
    () =>
      rawData
        ? computeWrappedStats({
            historyEntries: rawData.historyEntries,
            genresByMangaId: rawData.genresByMangaId,
            mediaFilter: activeTab
          })
        : null,
    [rawData, activeTab]
  )

  const maxDailySeconds = stats
    ? Math.max(60, ...stats.dailyActivity.map((d) => d.totalSeconds))
    : 60

  const heroTitle =
    activeTab === 'anime'
      ? 'Anime Wrapped • This Week'
      : activeTab === 'manga'
        ? 'Manga Wrapped • This Week'
        : "This Week's Wrapped"

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <section className="space-y-6">
        <SectionHeader title="Local Wrapped & Stats" icon={BarChart3}>
          <div className="flex items-center gap-2">
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] gap-1">
              <Lock className="h-3 w-3" /> 100% Local &amp; Private
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadStats()}
              disabled={loading}
              className="gap-1.5 h-8 text-xs"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} /> Refresh
            </Button>
          </div>
        </SectionHeader>

        {/* All / Anime / Manga Filter Tabs */}
        <div className="flex items-center bg-secondary/50 p-1 rounded-xl w-fit border border-border/40">
          {WRAPPED_TABS.map((tab) => {
            const Icon = tab.icon
            const isSelected = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center justify-center gap-2 h-9 px-5 rounded-lg text-xs transition-all duration-200 select-none',
                  isSelected
                    ? 'bg-card text-primary font-black shadow-sm border border-border/50'
                    : 'font-bold text-muted-foreground hover:text-foreground'
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        {loading && !stats ? (
          <Card className="p-10 border-border bg-card text-center text-sm text-muted-foreground">
            Calculating your local reading &amp; watching Wrapped stats...
          </Card>
        ) : !stats?.hasData ? (
          <Card className="p-12 border-border bg-card text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
              {activeTab === 'anime' ? (
                <Film className="h-6 w-6" />
              ) : activeTab === 'manga' ? (
                <BookOpen className="h-6 w-6" />
              ) : (
                <Sparkles className="h-6 w-6" />
              )}
            </div>
            <h3 className="text-lg font-bold">
              {activeTab === 'anime'
                ? 'No Anime Activity Yet'
                : activeTab === 'manga'
                  ? 'No Manga Activity Yet'
                  : 'Your Local Wrapped Awaits'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              {activeTab === 'anime'
                ? 'Watch anime episodes to unlock weekly watch hours, anime streaks, and top anime genres.'
                : activeTab === 'manga'
                  ? 'Read manga chapters to unlock weekly reading hours, reading streaks, and top manga genres.'
                  : 'Start reading manga or watching anime to track weekly hours, reading streaks, and your most-watched genres — computed strictly on your device.'}
            </p>
          </Card>
        ) : (
          <>
            {/* Spotify Wrapped style Hero Card */}
            <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/15 via-card to-amber-500/10 p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-primary">
                    <Sparkles className="h-3.5 w-3.5" /> {heroTitle}
                  </div>
                  <div className="text-4xl sm:text-5xl font-black tracking-tight text-foreground tabular-nums">
                    {formatWrappedHours(stats.weeklyTotalSeconds)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatWrappedDuration(stats.weeklyTotalSeconds)} logged across{' '}
                    <span className="font-bold text-foreground">{stats.weeklySessions}</span>{' '}
                    session{stats.weeklySessions === 1 ? '' : 's'} in the last 7 days ·{' '}
                    <span className="font-semibold text-primary">{stats.persona}</span>
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
                  <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-md px-4 py-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      <Flame className="h-3.5 w-3.5" /> Streak
                    </div>
                    <div className="text-2xl font-black mt-1 tabular-nums">
                      {stats.currentStreakDays}d
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      Best: {stats.longestStreakDays}d
                    </div>
                  </div>

                  {activeTab === 'all' ? (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-md px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-sky-400">
                          <Film className="h-3.5 w-3.5" /> Anime Week
                        </div>
                        <div className="text-2xl font-black mt-1 tabular-nums">
                          {formatWrappedDuration(stats.weeklyAnimeSeconds)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Total: {formatWrappedDuration(stats.allTimeAnimeSeconds)}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-md px-4 py-3 col-span-2 sm:col-span-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-rose-400">
                          <BookOpen className="h-3.5 w-3.5" /> Manga Week
                        </div>
                        <div className="text-2xl font-black mt-1 tabular-nums">
                          {formatWrappedDuration(stats.weeklyMangaSeconds)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          Total: {formatWrappedDuration(stats.allTimeMangaSeconds)}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-md px-4 py-3">
                        <div
                          className={cn(
                            'flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider',
                            activeTab === 'anime' ? 'text-sky-400' : 'text-rose-400'
                          )}
                        >
                          <Clock className="h-3.5 w-3.5" /> All-Time
                        </div>
                        <div className="text-2xl font-black mt-1 tabular-nums">
                          {formatWrappedDuration(stats.allTimeTotalSeconds)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {stats.totalActiveDays} active day{stats.totalActiveDays === 1 ? '' : 's'}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-background/60 backdrop-blur-md px-4 py-3 col-span-2 sm:col-span-1">
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                          {activeTab === 'anime' ? (
                            <Film className="h-3.5 w-3.5" />
                          ) : (
                            <BookOpen className="h-3.5 w-3.5" />
                          )}
                          <span>{activeTab === 'anime' ? 'Episodes' : 'Chapters'}</span>
                        </div>
                        <div className="text-2xl font-black mt-1 tabular-nums">
                          {stats.allTimeSessions}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                          {stats.uniqueTitlesCount} {activeTab === 'anime' ? 'anime' : 'manga'}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </Card>

            {/* 7-Day Activity Bar Chart & Top Genres */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 border-border bg-card space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Last 7 Days Activity
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activeTab === 'anime'
                        ? 'Daily anime watching time'
                        : activeTab === 'manga'
                          ? 'Daily manga reading time'
                          : 'Daily time split between anime watching & manga reading'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-bold">
                    {activeTab !== 'manga' && (
                      <span className="inline-flex items-center gap-1 text-sky-400">
                        <span className="w-2 h-2 rounded-full bg-sky-500" /> Anime
                      </span>
                    )}
                    {activeTab !== 'anime' && (
                      <span className="inline-flex items-center gap-1 text-rose-400">
                        <span className="w-2 h-2 rounded-full bg-rose-500" /> Manga
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 h-40 items-end pt-4">
                  {stats.dailyActivity.map((day) => {
                    const animeHeightPct =
                      day.animeSeconds > 0
                        ? Math.max(6, Math.round((day.animeSeconds / maxDailySeconds) * 100))
                        : 0
                    const mangaHeightPct =
                      day.mangaSeconds > 0
                        ? Math.max(6, Math.round((day.mangaSeconds / maxDailySeconds) * 100))
                        : 0
                    return (
                      <div
                        key={day.dateKey}
                        className="flex flex-col items-center gap-2 h-full justify-end group"
                        title={`${day.label} (${day.dateKey}): ${formatWrappedDuration(day.totalSeconds)} • ${day.sessions} sessions`}
                      >
                        <span className="text-[9px] font-mono text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                          {formatWrappedDuration(day.totalSeconds)}
                        </span>
                        <div className="w-full max-w-[28px] h-24 rounded-lg bg-secondary/40 flex flex-col justify-end overflow-hidden p-0.5 gap-0.5">
                          {animeHeightPct > 0 && (
                            <div
                              className="w-full rounded-sm bg-sky-500/90 transition-all duration-300"
                              style={{ height: `${animeHeightPct}%` }}
                            />
                          )}
                          {mangaHeightPct > 0 && (
                            <div
                              className="w-full rounded-sm bg-rose-500/90 transition-all duration-300"
                              style={{ height: `${mangaHeightPct}%` }}
                            />
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">
                          {day.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>

              <Card className="p-6 border-border bg-card space-y-5">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-400" /> Top Genres
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeTab === 'anime'
                      ? 'Top genres across your watched anime'
                      : activeTab === 'manga'
                        ? 'Top genres across your read manga'
                        : 'Ranked locally from your watched & read titles'}
                  </p>
                </div>

                {stats.topGenres.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    No genre tags cached yet — open manga or anime details pages to populate genre
                    tags locally.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stats.topGenres.map((item, idx) => (
                      <div key={item.genre} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold flex items-center gap-2">
                            <span className="text-[10px] font-mono text-primary">#{idx + 1}</span>
                            {item.genre}
                          </span>
                          <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
                            {item.percentage}% · {formatWrappedDuration(item.durationSeconds)} (
                            {item.sessions}x)
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary to-amber-500 transition-all duration-500"
                            style={{ width: `${Math.max(6, item.percentage)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </div>

            {/* Top Titles + All-Time Overview */}
            <Card className="p-6 border-border bg-card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-amber-400" />{' '}
                  {activeTab === 'anime'
                    ? 'Most Watched Anime'
                    : activeTab === 'manga'
                      ? 'Most Read Manga'
                      : 'Most Watched & Read Titles'}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {stats.uniqueTitlesCount} titles · {stats.totalActiveDays} active day
                  {stats.totalActiveDays === 1 ? '' : 's'} ·{' '}
                  {formatWrappedDuration(stats.allTimeTotalSeconds)} all-time
                </span>
              </div>

              <div className="divide-y divide-border/60">
                {stats.topTitles.map((title, idx) => (
                  <div key={title.mangaId} className="py-3 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 text-xs font-black font-mono text-primary shrink-0">
                        #{idx + 1}
                      </span>
                      {title.coverUrl ? (
                        <img
                          src={title.coverUrl}
                          alt={title.title}
                          className="w-9 h-12 object-cover rounded-lg border border-border shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-12 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          {title.mediaType === 'anime' ? (
                            <Film className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <BookOpen className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{title.title}</div>
                        <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span className="uppercase font-bold text-[10px]">{title.mediaType}</span>
                          <span>·</span>
                          <span>
                            {title.sessions} session{title.sessions === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm font-mono font-bold text-foreground shrink-0 tabular-nums">
                      {formatWrappedDuration(title.durationSeconds)}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}
      </section>
    </div>
  )
}
