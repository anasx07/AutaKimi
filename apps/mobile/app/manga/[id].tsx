import { useState, useEffect } from 'react'
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions, TextInput
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Typography, Button, Card, CardContent } from '@mobile/native/ui'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft, BookOpen, ChevronRight, AlignLeft,
  Download, CheckCircle, Loader2, Bookmark, AlertTriangle, RefreshCw,
  ArrowUpDown, Search, X
} from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { Chapter } from '@common/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HERO_HEIGHT = Math.min(Math.round(SCREEN_WIDTH * 0.75), 300)

export default function MangaDetailsScreen() {
  const {
    id,
    title: paramTitle,
    coverUrl: paramCover,
    pkg: paramPkg,
    url: paramUrl
  } = useLocalSearchParams<{
    id: string
    title?: string
    coverUrl?: string
    pkg?: string
    url?: string
  }>()

  const queryClient = useQueryClient()
  const [descExpanded, setDescExpanded] = useState(false)
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, string>>({})
  const [downloadingChapters, setDownloadingChapters] = useState<Set<string>>(new Set())
  const [activeProgress, setActiveProgress] = useState<Record<string, { cached: number; total: number; status: string }>>({})
  const [sortAsc, setSortAsc] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Fetch cached manga info from SQLite
  const { data: cachedManga } = useQuery({
    queryKey: ['manga-cache', id],
    queryFn: async () => {
      const res = await DataService.db.getMangaCache(id)
      return (res as any)?.value || res || null
    },
    enabled: !!id
  })

  // 2. Fetch library items to check membership and retrieve stored metadata
  const { data: libraryItems } = useQuery({
    queryKey: ['library'],
    queryFn: async () => {
      const res = await DataService.db.getLibrary()
      return (res as any)?.value || res || []
    }
  })
  const libraryItem = libraryItems?.find((item: any) => String(item.id) === String(id))
  const isInLibrary = !!libraryItem

  // 3. Fetch reading history for continue reading and fallback metadata
  const { data: history } = useQuery({
    queryKey: ['manga-history', id],
    queryFn: async () => {
      const res = await DataService.db.getHistory({ limit: 500 })
      const entries = (res as any)?.value || res || []
      return entries.find((e: any) => String(e.mangaId || e.manga_id) === String(id)) || null
    },
    enabled: !!id
  })

  // 4. Fetch installed extensions
  const { data: installedExtensions } = useQuery({
    queryKey: ['installed-extensions'],
    queryFn: async () => {
      const res = await DataService.db.getExtensions()
      return (res as any)?.value || res || []
    }
  })

  // --- Resolve metadata with comprehensive fallback waterfall ---
  let resolvedPkg = paramPkg || cachedManga?.pkg || libraryItem?.pkg || history?.pkg || null
  let resolvedUrl = paramUrl || cachedManga?.url || libraryItem?.url || history?.mangaUrl || (id?.startsWith('http') ? id : '')

  // If pkg is still missing, attempt domain match with installed extensions
  if (!resolvedPkg && resolvedUrl && installedExtensions?.length) {
    try {
      const parsedUrl = new URL(resolvedUrl)
      const matched = installedExtensions.find((ext: any) => {
        if (!ext.baseUrl) return false
        try {
          return new URL(ext.baseUrl).hostname === parsedUrl.hostname
        } catch {
          return resolvedUrl.includes(ext.baseUrl)
        }
      })
      if (matched?.pkg) {
        resolvedPkg = matched.pkg
      }
    } catch (_) {}
  }

  const matchedExt = installedExtensions?.find((e: any) => e.pkg === resolvedPkg)
  const extCode = matchedExt?.code || null

  const displayTitle =
    (paramTitle && paramTitle !== 'Unknown' ? paramTitle : null) ||
    cachedManga?.title ||
    libraryItem?.title ||
    history?.mangaTitle ||
    'Unknown'

  const displayCover =
    paramCover ||
    cachedManga?.cover_url ||
    cachedManga?.coverUrl ||
    libraryItem?.coverUrl ||
    history?.mangaCover ||
    null

  const displayDescription = cachedManga?.description || null

  const displayGenres: string[] = (() => {
    if (cachedManga?.genres) {
      if (Array.isArray(cachedManga.genres)) return cachedManga.genres
      try {
        const parsed = JSON.parse(cachedManga.genres)
        if (Array.isArray(parsed)) return parsed
      } catch (_) {}
    }
    return []
  })()

  // 5. Fetch fresh manga details in background if not already cached
  useQuery({
    queryKey: ['manga-fresh-details', id, resolvedPkg, resolvedUrl],
    queryFn: async () => {
      if (!resolvedPkg || !resolvedUrl) return null
      try {
        const res: any = await DataService.executeExtension({
          pkg: resolvedPkg,
          code: extCode || '',
          contextArgs: {
            type: 'fetchMangaDetails',
            mangaUrl: resolvedUrl
          }
        })
        const details = res?.data || res
        if (details && (details.description || details.title || details.genres)) {
          await DataService.db.saveMangaCache({
            id,
            title: details.title || displayTitle,
            coverUrl: details.coverUrl || displayCover,
            description: details.description || '',
            author: details.author || '',
            artist: details.artist || '',
            status: details.status || '',
            genres: details.genres || [],
            url: resolvedUrl,
            pkg: resolvedPkg,
            mediaType: 'manga'
          })
          queryClient.invalidateQueries({ queryKey: ['manga-cache', id] })
          return details
        }
      } catch (err) {
        console.warn('[MangaDetails] Failed to fetch fresh details:', err)
      }
      return null
    },
    enabled: !!id && !!resolvedPkg && (!cachedManga?.description || cachedManga?.description === 'No description available.'),
    staleTime: 1000 * 60 * 60
  })

  // 6. Fetch chapters with extension + local SQLite cache and robust error handling
  const {
    data: chapters,
    isLoading: chaptersLoading,
    isRefetching: chaptersRefetching,
    isError: chaptersIsError,
    error: chaptersError,
    refetch: refetchChapters
  } = useQuery({
    queryKey: ['manga-chapters', id, resolvedPkg, resolvedUrl],
    queryFn: async (): Promise<Chapter[]> => {
      // 1. Check local DB first
      const cached = await DataService.db.getChapters(id)
      const cachedList: Chapter[] = (cached as any)?.value || cached || []

      // If we don't have a package, return cached list or throw helpful error
      if (!resolvedPkg) {
        if (cachedList.length > 0) return cachedList
        throw new Error('No source extension found for this manga. Please open it from Browse.')
      }

      // 2. Fetch fresh chapters from extension
      try {
        let codeToUse = extCode
        if (!codeToUse) {
          const exts = await DataService.db.getExtensions()
          const extList = (exts as any)?.value || exts || []
          const found = extList.find((e: any) => e.pkg === resolvedPkg)
          if (found?.code) {
            codeToUse = found.code
          }
        }

        const result: any = await DataService.executeExtension({
          pkg: resolvedPkg,
          code: codeToUse || '',
          contextArgs: {
            type: 'fetchChapters',
            mangaUrl: resolvedUrl || id
          }
        })

        if (!result) {
          throw new Error('No response received from source extension.')
        }

        if (result.ok === false || result.error) {
          throw new Error(result.error || 'Failed to fetch chapters.')
        }

        const rawChapters: any[] =
          result.data || result.chapters || result.value || (Array.isArray(result) ? result : [])

        if (Array.isArray(rawChapters) && rawChapters.length > 0) {
          const formattedChapters: Chapter[] = rawChapters.map((ch: any, idx: number) => ({
            id: String(ch.id || `${id}-ch-${ch.number ?? idx}`),
            number: ch.number !== undefined && !isNaN(Number(ch.number)) ? Number(ch.number) : idx + 1,
            title: ch.title || (ch.number !== undefined ? `Chapter ${ch.number}` : `Chapter ${idx + 1}`),
            date: ch.date || '',
            scanlator: ch.scanlator || '',
            url: ch.url || ''
          }))

          // Persist to SQLite for offline access
          await DataService.db.saveChapters({
            mangaId: id,
            chapters: formattedChapters
          })

          return formattedChapters
        }

        if (cachedList.length > 0) {
          return cachedList
        }

        throw new Error('No chapters found for this title.')
      } catch (err: any) {
        console.error('[MangaDetails] Chapter fetch error:', err)
        // If extension fetch fails (e.g. offline or challenge), fallback to cached chapters if present
        if (cachedList.length > 0) {
          return cachedList
        }
        throw err
      }
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 15,
    retry: 2
  })

  // 7. Track Download statuses
  useEffect(() => {
    if (!id) return
    DataService.download
      .getMangaDownloads(id)
      .then((result: any[]) => {
        const statuses: Record<string, string> = {}
        for (const dl of result || []) {
          statuses[dl.chapterId] = dl.status
        }
        setDownloadStatuses(statuses)
      })
      .catch(() => {})

    const api = (window as any).api
    if (api?.download?.onEvent) {
      const unsub = api.download.onEvent((data: any) => {
        if (data.mangaId !== id) return
        if (data.type === 'progress' || data.type === 'start' || data.type === 'queued') {
          setActiveProgress((prev) => ({
            ...prev,
            [data.chapterId]: {
              cached: data.cached || 0,
              total: data.total || 0,
              status: data.type === 'queued' ? 'queued' : 'downloading'
            }
          }))
          setDownloadStatuses((prev) => ({
            ...prev,
            [data.chapterId]: data.type === 'queued' ? 'queued' : 'downloading'
          }))
        } else if (data.type === 'completed' || data.type === 'error' || data.type === 'canceled') {
          setActiveProgress((prev) => {
            const next = { ...prev }
            delete next[data.chapterId]
            return next
          })
          setDownloadStatuses((prev) => ({
            ...prev,
            [data.chapterId]: data.type === 'canceled' ? '' : data.type
          }))
          setDownloadingChapters((prev) => {
            const next = new Set(prev)
            next.delete(data.chapterId)
            return next
          })
        }
      })
      return () => unsub()
    }
  }, [id])

  const addHistory = useMutation({
    mutationFn: (chapter: { id: string; title?: string; url?: string }) =>
      DataService.db.addHistory({
        mangaId: id,
        mangaTitle: displayTitle,
        mangaCover: displayCover || undefined,
        mangaUrl: resolvedUrl,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        startedAt: new Date().toISOString(),
        pkg: resolvedPkg || undefined,
        type: 'manga'
      })
  })

  const filteredChapters = chapters
    ? [...chapters]
        .filter((ch) => {
          if (!searchQuery.trim()) return true
          const q = searchQuery.trim().toLowerCase()
          return (
            (ch.title && ch.title.toLowerCase().includes(q)) ||
            (ch.number !== undefined && String(ch.number).includes(q))
          )
        })
        .sort((a, b) => {
          const numA = Number(a.number || 0)
          const numB = Number(b.number || 0)
          return sortAsc ? numA - numB : numB - numA
        })
    : []

  const toggleLibrary = useMutation({
    mutationFn: async () => {
      return DataService.db.toggleLibrary({
        id,
        title: displayTitle,
        coverUrl: displayCover || undefined,
        url: resolvedUrl,
        pkg: resolvedPkg || undefined,
        mediaType: 'manga'
      } as any)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library'] })
    }
  })

  const openReader = (chapter: Chapter) => {
    addHistory.mutate(chapter)
    router.push({
      pathname: '/reader/[mangaId]/[chapterId]' as any,
      params: {
        mangaId: id,
        chapterId: chapter.id,
        pkg: resolvedPkg || '',
        chapterUrl: chapter.url,
        chapterTitle: chapter.title || `Ch. ${chapter.number}`,
        mangaTitle: displayTitle || ''
      }
    })
  }

  const downloadChapter = async (chapter: Chapter) => {
    const pkgToUse = resolvedPkg
    if (!pkgToUse) return

    let codeToUse = extCode
    if (!codeToUse) {
      const exts = await DataService.db.getExtensions()
      const extList = (exts as any)?.value || exts || []
      const found = extList.find((e: any) => e.pkg === pkgToUse)
      if (found?.code) codeToUse = found.code
    }

    const chapterId = chapter.id
    if (downloadingChapters.has(chapterId)) return
    if (downloadStatuses[chapterId] === 'completed') return

    setDownloadingChapters((prev) => new Set(prev).add(chapterId))
    setDownloadStatuses((prev) => ({ ...prev, [chapterId]: 'downloading' }))

    try {
      const result = await DataService.executeExtension({
        pkg: pkgToUse,
        code: codeToUse || '',
        contextArgs: { type: 'fetchPages', chapterUrl: chapter.url }
      })
      const pageUrls: string[] = result?.pages || result?.data || []
      if (pageUrls.length === 0) throw new Error('No pages returned')

      await DataService.download.start({
        mangaId: id,
        chapterId,
        pageUrls,
        type: 'manga',
        mangaTitle: displayTitle,
        chapterTitle: chapter.title || `Ch. ${chapter.number}`
      })
    } catch (e) {
      console.error('[MangaDetails] Download failed:', e)
      setDownloadStatuses((prev) => ({ ...prev, [chapterId]: 'error' }))
      setDownloadingChapters((prev) => {
        const next = new Set(prev)
        next.delete(chapterId)
        return next
      })
    }
  }

  const errorMessage =
    (chaptersError as Error)?.message || 'An error occurred while connecting to the source extension.'
  const isCloudflareIssue =
    errorMessage.toLowerCase().includes('cloudflare') ||
    errorMessage.includes('403') ||
    errorMessage.includes('challenge')

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={chaptersLoading || chaptersRefetching}
            onRefresh={() => {
              refetchChapters()
            }}
          />
        }
      >
        {/* Hero Image */}
        <View style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}>
          {displayCover ? (
            <Image
              source={{ uri: displayCover }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View className="flex-1 bg-card items-center justify-center">
              <BookOpen size={64} color="#94a3b8" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: HERO_HEIGHT * 0.65 }}
          />
          <TouchableOpacity
            className="absolute top-12 left-4 z-10 bg-black/40 rounded-full p-2"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View className="px-4 -mt-14 relative z-10">
          <Typography className="text-white text-2xl font-bold mb-1" numberOfLines={2}>
            {displayTitle}
          </Typography>
          {!!cachedManga?.author && (
            <Typography className="text-white/80 text-sm mb-1">
              {cachedManga.author}
            </Typography>
          )}
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-3 flex-row gap-3">
          <Button
            title={history ? 'Continue Reading' : 'Start Reading'}
            variant="primary"
            className="flex-1"
            onPress={() => {
              if (history && (chapters?.length || 0) > 0) {
                const ch = chapters?.find(
                  (c) => String(c.id) === String(history.chapterId || history.chapter_id)
                )
                if (ch) openReader(ch)
                else openReader(filteredChapters[0] || chapters![0])
              } else if (filteredChapters.length > 0) {
                openReader(filteredChapters[0])
              } else if (chapters && chapters.length > 0) {
                openReader(chapters[0])
              }
            }}
            disabled={!chapters || chapters.length === 0}
          />
          <TouchableOpacity
            className={`w-12 h-12 rounded-xl items-center justify-center border border-border ${
              isInLibrary ? 'bg-primary/20 border-primary' : 'bg-card'
            }`}
            onPress={() => toggleLibrary.mutate()}
            disabled={toggleLibrary.isPending}
          >
            {toggleLibrary.isPending ? (
              <ActivityIndicator size="small" color="#e11d48" />
            ) : (
              <Bookmark
                size={24}
                color={isInLibrary ? '#e11d48' : '#94a3b8'}
                fill={isInLibrary ? '#e11d48' : 'none'}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Extension / Genres Badges */}
        <View className="px-4 mt-4 flex-row flex-wrap gap-2">
          {!!resolvedPkg && (
            <View className="bg-primary/20 px-3 py-1 rounded-full">
              <Typography className="text-primary text-xs">{resolvedPkg}</Typography>
            </View>
          )}
          {!!cachedManga?.status && (
            <View className="bg-muted px-3 py-1 rounded-full">
              <Typography className="text-muted-foreground text-xs uppercase font-medium">
                {cachedManga.status}
              </Typography>
            </View>
          )}
          {displayGenres.map((genre, idx) => (
            <View key={idx} className="bg-card px-3 py-1 rounded-full border border-border">
              <Typography className="text-muted-foreground text-xs">{genre}</Typography>
            </View>
          ))}
        </View>

        {/* Description */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center mb-2">
            <AlignLeft size={16} color="#94a3b8" />
            <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
              Synopsis
            </Typography>
          </View>
          <Card>
            <CardContent>
              <Typography
                className="leading-relaxed"
                numberOfLines={descExpanded ? undefined : 4}
              >
                {displayDescription || 'No description available.'}
              </Typography>
              {!!(displayDescription && displayDescription.length > 120) && (
                <TouchableOpacity
                  className="mt-2"
                  onPress={() => setDescExpanded(!descExpanded)}
                >
                  <Typography className="text-primary text-sm">
                    {descExpanded ? 'Show less' : 'Read more'}
                  </Typography>
                </TouchableOpacity>
              )}
            </CardContent>
          </Card>
        </View>

        {/* Chapters */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <BookOpen size={16} color="#94a3b8" />
              <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
                Chapters
              </Typography>
            </View>
            <View className="flex-row items-center gap-2">
              {chaptersRefetching && <ActivityIndicator size="small" color="#e11d48" />}
              <Typography className="text-muted-foreground text-sm font-medium">
                {searchQuery.trim()
                  ? `${filteredChapters.length} / ${chapters?.length || 0}`
                  : `${chapters?.length || 0}`}
              </Typography>
            </View>
          </View>

          {/* Chapter Search & Sort Controls */}
          {(chapters?.length ?? 0) > 0 && (
            <View className="flex-row items-center gap-2 mb-3">
              <View className="flex-1 flex-row items-center bg-card border border-border rounded-xl px-3 py-1.5 h-10">
                <Search size={16} color="#94a3b8" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search chapter..."
                  placeholderTextColor="#71717a"
                  className="flex-1 ml-2 text-foreground text-sm py-0"
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!searchQuery && (
                  <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
                    <X size={14} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setSortAsc((prev) => !prev)}
                className={`h-10 px-3 rounded-xl border flex-row items-center gap-1.5 ${
                  sortAsc ? 'bg-primary/15 border-primary/40' : 'bg-card border-border'
                }`}
                activeOpacity={0.7}
              >
                <ArrowUpDown size={15} color={sortAsc ? '#e11d48' : '#94a3b8'} />
                <Typography
                  className={`text-xs font-medium ${
                    sortAsc ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {sortAsc ? 'Oldest' : 'Newest'}
                </Typography>
              </TouchableOpacity>
            </View>
          )}

          {chaptersLoading && filteredChapters.length === 0 && !searchQuery ? (
            <View className="py-12 items-center justify-center bg-card rounded-xl border border-border">
              <ActivityIndicator size="large" color="#e11d48" />
              <Typography className="text-muted-foreground text-sm mt-3">
                Loading chapters...
              </Typography>
            </View>
          ) : chaptersIsError && filteredChapters.length === 0 && !searchQuery ? (
            <View className="py-8 px-4 items-center bg-card rounded-xl border border-destructive/30">
              <AlertTriangle size={36} color="#ef4444" />
              <Typography className="text-foreground font-semibold text-base mt-3 text-center">
                Failed to Load Chapters
              </Typography>
              <Typography className="text-muted-foreground text-xs mt-1 text-center px-2">
                {errorMessage}
              </Typography>
              <View className="flex-row gap-2 mt-4">
                <Button
                  title="Retry"
                  variant="primary"
                  className="px-6"
                  onPress={() => refetchChapters()}
                />
                {!!isCloudflareIssue && (
                  <Button
                    title="Bypass Cloudflare"
                    variant="outline"
                    onPress={() => router.push('/cf-bypass' as any)}
                  />
                )}
              </View>
            </View>
          ) : filteredChapters.length === 0 && !searchQuery ? (
            <View className="py-8 items-center bg-card rounded-xl border border-border">
              <BookOpen size={32} color="#94a3b8" />
              <Typography className="mt-2 text-muted-foreground">
                No chapters available
              </Typography>
              <Button
                title="Check Again"
                variant="outline"
                className="mt-4"
                onPress={() => refetchChapters()}
              />
            </View>
          ) : filteredChapters.length === 0 && searchQuery.trim() ? (
            <View className="py-8 items-center bg-card rounded-xl border border-border">
              <Search size={28} color="#94a3b8" />
              <Typography className="mt-2 text-muted-foreground text-sm">
                No chapters match "{searchQuery}"
              </Typography>
              <TouchableOpacity
                className="mt-3 px-4 py-2 bg-muted rounded-lg"
                onPress={() => setSearchQuery('')}
              >
                <Typography className="text-primary text-xs font-medium">Clear search</Typography>
              </TouchableOpacity>
            </View>
          ) : (
            <View className="bg-card rounded-xl border border-border overflow-hidden">
              {filteredChapters.map((chapter, idx) => {
                const chapterKey = String(chapter.id || `ch-${idx}`)
                const dlStatus = downloadStatuses[chapterKey]
                const isDownloading = downloadingChapters.has(chapterKey)
                const titleText = typeof chapter.title === 'string' && chapter.title.trim()
                  ? chapter.title
                  : (typeof (chapter as any)?.attributes?.title === 'string' && (chapter as any).attributes.title.trim())
                  ? (chapter as any).attributes.title
                  : `Chapter ${chapter.number ?? idx + 1}`
                const dateText = typeof chapter.date === 'string' && chapter.date.trim() ? chapter.date : null

                return (
                  <View
                    key={`${chapterKey}-${idx}`}
                    className={`flex-row items-center px-4 py-3.5 ${
                      idx !== filteredChapters.length - 1 ? 'border-b border-border/50' : ''
                    }`}
                  >
                    <TouchableOpacity
                      className="flex-1 flex-row items-center"
                      onPress={() => openReader(chapter)}
                    >
                      <View className="flex-1">
                        <Typography className="font-medium" numberOfLines={1}>
                          {titleText}
                        </Typography>
                        {!!dateText && (
                          <Typography className="text-xs text-muted-foreground mt-0.5">
                            {dateText}
                          </Typography>
                        )}
                      </View>
                      <ChevronRight size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    <View className="ml-2">
                      {dlStatus === 'completed' ? (
                        <CheckCircle size={18} color="#22c55e" />
                      ) : isDownloading || dlStatus === 'queued' || dlStatus === 'downloading' ? (
                        <View className="flex-row items-center">
                          {!!(activeProgress[chapterKey]?.total > 0) && (
                            <Typography className="text-xs text-primary mr-2">
                              {`${Math.round(
                                ((activeProgress[chapterKey].cached || 0) /
                                  activeProgress[chapterKey].total) *
                                  100
                              )}%`}
                            </Typography>
                          )}
                          <Loader2 size={18} color="#e11d48" />
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => downloadChapter(chapter)}
                          className="p-1"
                        >
                          <Download size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
