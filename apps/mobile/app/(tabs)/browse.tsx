import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, RefreshControl, useWindowDimensions, ScrollView
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { normalizeManga, isValidMediaCatalogItem } from '@common/utils/mangaNormalizer'
import { isAnimeExtension } from '@common/utils/mediaType'
import { resolveExtensionBadge } from '@common/services/repoIdentity'
import { Typography, Button, Card, CardContent } from '@mobile/native/ui'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Search, Compass, Package, BookOpen, Film,
  ArrowLeft, ChevronRight, X, Globe, Pin, RotateCcw
} from 'lucide-react-native'

const LANG_FLAGS: Record<string, string> = {
  ar: '🇸🇦',
  en: '🇬🇧',
  es: '🇪🇸',
  fr: '🇫🇷',
  id: '🇮🇩',
  ja: '🇯🇵',
  ko: '🇰🇷',
  pt: '🇵🇹',
  ru: '🇷🇺',
  all: '🌐'
}

const LANG_NAMES: Record<string, string> = {
  ar: 'Arabic',
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  id: 'Indonesian',
  ja: 'Japanese',
  ko: 'Korean',
  pt: 'Portuguese',
  ru: 'Russian',
  all: 'All'
}

interface GlobalSearchResult {
  item: any
  extension: any
}

export default function BrowseTab() {
  const { pkg: paramPkg, feed: paramFeed } = useLocalSearchParams<{ pkg?: string; feed?: string }>()
  const [extensions, setExtensions] = useState<any[]>([])
  const [pinnedPkgs, setPinnedPkgs] = useState<string[]>([])
  const [activePkg, setActivePkg] = useState<string | null>(null)
  const [browseMode, setBrowseMode] = useState<'sources' | 'global'>('sources')
  const [mediaFilter, setMediaFilter] = useState<'all' | 'manga' | 'anime'>('all')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest'>('popular')
  const [searchQuery, setSearchQuery] = useState('')
  const [sourceSearch, setSourceSearch] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Global Search state
  const [globalQuery, setGlobalQuery] = useState('')
  const [globalOnlyPinned, setGlobalOnlyPinned] = useState(false)
  const [globalSearching, setGlobalSearching] = useState(false)
  const [globalResults, setGlobalResults] = useState<GlobalSearchResult[]>([])
  const [globalStatuses, setGlobalStatuses] = useState<
    Record<string, 'pending' | 'searching' | 'done' | 'error'>
  >({})
  const globalSearchIdRef = useRef(0)

  const { width: windowWidth } = useWindowDimensions()
  const numColumns = 3
  const cardGap = 8
  const containerPadding = 16 * 2 // px-4 = 32px
  const cardWidth = Math.floor((windowWidth - containerPadding - cardGap * (numColumns - 1)) / numColumns)

  useFocusEffect(
    useCallback(() => {
      Promise.all([
        DataService.db.getExtensions().catch(() => []),
        DataService.db.getSetting('pinned_extensions').catch(() => null)
      ])
        .then(([exts, pinnedRaw]) => {
          const validExts = (Array.isArray(exts) ? exts : []).filter(
            (e) => e.pkg && !/^\d+$/.test(e.pkg)
          )
          setExtensions(validExts)
          const rawStr =
            typeof pinnedRaw === 'string' ? pinnedRaw : (pinnedRaw as any)?.value
          if (typeof rawStr === 'string' && rawStr) {
            try {
              const parsed = JSON.parse(rawStr)
              if (Array.isArray(parsed)) setPinnedPkgs(parsed)
            } catch {}
          }
        })
        .finally(() => setInitialLoading(false))
    }, [])
  )

  const togglePinSource = async (pkg: string) => {
    const next = pinnedPkgs.includes(pkg)
      ? pinnedPkgs.filter((p) => p !== pkg)
      : [...pinnedPkgs, pkg]
    setPinnedPkgs(next)
    const json = JSON.stringify(next)
    await Promise.all([
      DataService.db.setSetting('pinned_extensions', json),
      DataService.db.setSetting('pinned_anime_sources', json)
    ]).catch(() => {})
  }

  const activeExtension = extensions.find((e) => e.pkg === activePkg)
  const isActiveSourceAnime = isAnimeExtension(
    activeExtension || (activePkg ? { pkg: activePkg } : undefined)
  )

  const fetchResults = useCallback(
    async (pkg: string, feed: string, query?: string, pageNum = 1, isLoadMore = false) => {
      let ext = extensions.find((e) => e.pkg === pkg)
      if (!ext) {
        try {
          const allExts = await DataService.db.getExtensions()
          ext = (allExts || []).find((e: any) => e.pkg === pkg)
        } catch (_) { /* ignore */ }
      }
      if (!ext) return

      if (isLoadMore) {
        setLoadingMore(true)
      } else {
        setLoading(true)
        setError(null)
      }

      try {
        const limit = 24
        const offset = (pageNum - 1) * limit
        const trimmedQuery = (query || '').trim()
        const result = await DataService.executeExtension({
          pkg,
          code: ext.code || '',
          contextArgs: {
            page: pageNum,
            limit,
            offset,
            activeFeed: trimmedQuery ? 'search' : feed,
            debouncedSearch: trimmedQuery,
            query: trimmedQuery,
            lang: ext.lang || 'all'
          }
        })
        const rawItems = Array.isArray(result) ? result : (result?.data || result?.manga || result?.items || [])
        const items = rawItems.filter(isValidMediaCatalogItem)

        if (isLoadMore) {
          if (items.length === 0) {
            setHasMore(false)
          } else {
            setResults((prev) => {
              const existingIds = new Set(prev.map((it: any) => it.id))
              const newItems = items.filter((it: any) => !existingIds.has(it.id))
              return [...prev, ...newItems]
            })
            setPage(pageNum)
            setHasMore(items.length >= 8)
          }
        } else {
          setResults(items)
          setPage(1)
          setHasMore(items.length >= 8)
        }
      } catch (e: any) {
        console.error('[Browse] Fetch failed:', e)
        if (!isLoadMore) {
          setError(e.message || 'Fetch failed')
          setResults([])
        } else {
          setHasMore(false)
        }
      } finally {
        if (isLoadMore) {
          setLoadingMore(false)
        } else {
          setLoading(false)
        }
      }
    },
    [extensions]
  )

  const loadMore = useCallback(() => {
    if (!activePkg || loading || loadingMore || !hasMore) return
    fetchResults(activePkg, activeFeed, searchQuery, page + 1, true)
  }, [activePkg, loading, loadingMore, hasMore, fetchResults, activeFeed, searchQuery, page])

  const openSource = useCallback((pkg: string, feed: 'popular' | 'latest' = 'popular') => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
      searchDebounceRef.current = null
    }
    setActivePkg(pkg)
    setActiveFeed(feed)
    setSearchQuery('')
    setError(null)
    setPage(1)
    setHasMore(true)
    fetchResults(pkg, feed, '', 1, false)
  }, [fetchResults])

  // Open a specific extension directly when navigated with ?pkg=...
  useEffect(() => {
    const targetPkg = typeof paramPkg === 'string' ? paramPkg.trim() : ''
    if (!targetPkg) return
    const targetFeed = paramFeed === 'latest' ? 'latest' : 'popular'
    openSource(targetPkg, targetFeed)
    try {
      router.setParams({ pkg: '', feed: '' } as any)
    } catch {}
  }, [paramPkg, paramFeed, openSource])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const openMediaDetails = (item: any, explicitExt?: any) => {
    const norm = normalizeManga(item)
    const extMeta = explicitExt || activeExtension || { pkg: activePkg || item.pkg }
    const isAnime =
      item.type === 'anime' ||
      item.mediaType === 'anime' ||
      isAnimeExtension(extMeta)
    router.push({
      pathname: (isAnime ? '/anime/[id]' : '/manga/[id]') as any,
      params: {
        id: item.id,
        title: norm.title,
        coverUrl: norm.coverUrl || '',
        pkg: extMeta?.pkg || activePkg || item.pkg || '',
        url: item.url || item.id || ''
      }
    })
  }

  const mangaCount = useMemo(
    () => extensions.filter((ext) => !isAnimeExtension(ext)).length,
    [extensions]
  )
  const animeCount = useMemo(
    () => extensions.filter((ext) => isAnimeExtension(ext)).length,
    [extensions]
  )

  const filteredExtensions = useMemo(() => {
    const list = extensions.filter((ext) => {
      const extIsAnime = isAnimeExtension(ext)
      if (mediaFilter === 'anime' && !extIsAnime) return false
      if (mediaFilter === 'manga' && extIsAnime) return false
      if (!sourceSearch.trim()) return true
      const q = sourceSearch.toLowerCase()
      return (
        (ext.name && ext.name.toLowerCase().includes(q)) ||
        (ext.pkg && ext.pkg.toLowerCase().includes(q))
      )
    })
    return list.sort((a, b) => {
      const aPinned = pinnedPkgs.includes(a.pkg) ? 1 : 0
      const bPinned = pinnedPkgs.includes(b.pkg) ? 1 : 0
      if (aPinned !== bPinned) return bPinned - aPinned
      return (a.name || a.pkg).localeCompare(b.name || b.pkg)
    })
  }, [extensions, mediaFilter, sourceSearch, pinnedPkgs])

  const searchOneExtension = async (ext: any, trimmedQuery: string) => {
    const res = await DataService.executeExtension({
      pkg: ext.pkg,
      code: ext.code || '',
      contextArgs: {
        page: 1,
        limit: 12,
        offset: 0,
        activeFeed: 'search',
        debouncedSearch: trimmedQuery,
        query: trimmedQuery,
        lang: ext.lang || 'all'
      }
    })
    const rawItems = Array.isArray(res) ? res : (res?.data || res?.manga || res?.items || [])
    return rawItems.filter(isValidMediaCatalogItem).slice(0, 12)
  }

  const runGlobalSearch = async () => {
    const trimmed = globalQuery.trim()
    if (!trimmed) return

    const targets = extensions.filter((ext) => {
      const extIsAnime = isAnimeExtension(ext)
      if (mediaFilter === 'anime' && !extIsAnime) return false
      if (mediaFilter === 'manga' && extIsAnime) return false
      if (globalOnlyPinned && !pinnedPkgs.includes(ext.pkg)) return false
      return true
    })

    const searchId = ++globalSearchIdRef.current
    setGlobalSearching(true)
    setGlobalResults([])

    if (targets.length === 0) {
      setGlobalStatuses({})
      setGlobalSearching(false)
      return
    }

    const initialStatuses: Record<string, 'pending' | 'searching' | 'done' | 'error'> = {}
    for (const t of targets) initialStatuses[t.pkg] = 'pending'
    setGlobalStatuses(initialStatuses)

    let idx = 0
    const worker = async () => {
      while (idx < targets.length) {
        if (searchId !== globalSearchIdRef.current) return
        const ext = targets[idx++]
        setGlobalStatuses((prev) => ({ ...prev, [ext.pkg]: 'searching' }))
        try {
          const validItems = await searchOneExtension(ext, trimmed)
          if (searchId === globalSearchIdRef.current) {
            if (validItems.length > 0) {
              setGlobalResults((prev) => [
                ...prev,
                ...validItems.map((it: any) => ({ item: it, extension: ext }))
              ])
            }
            setGlobalStatuses((prev) => ({ ...prev, [ext.pkg]: 'done' }))
          }
        } catch {
          if (searchId === globalSearchIdRef.current) {
            setGlobalStatuses((prev) => ({ ...prev, [ext.pkg]: 'error' }))
          }
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(3, targets.length) }, worker))
    if (searchId === globalSearchIdRef.current) {
      setGlobalSearching(false)
    }
  }

  const retryGlobalSource = async (ext: any) => {
    const trimmed = globalQuery.trim()
    if (!trimmed) return
    const searchId = globalSearchIdRef.current
    setGlobalStatuses((prev) => ({ ...prev, [ext.pkg]: 'searching' }))
    setGlobalResults((prev) => prev.filter((r) => r.extension.pkg !== ext.pkg))
    try {
      const validItems = await searchOneExtension(ext, trimmed)
      if (searchId === globalSearchIdRef.current) {
        if (validItems.length > 0) {
          setGlobalResults((prev) => [
            ...prev,
            ...validItems.map((it: any) => ({ item: it, extension: ext }))
          ])
        }
        setGlobalStatuses((prev) => ({ ...prev, [ext.pkg]: 'done' }))
      }
    } catch {
      if (searchId === globalSearchIdRef.current) {
        setGlobalStatuses((prev) => ({ ...prev, [ext.pkg]: 'error' }))
      }
    }
  }

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      </SafeAreaView>
    )
  }

  // ========================================================
  // VIEW 1: Sources List / Global Search
  // ========================================================
  if (!activePkg) {
    const statusEntries = Object.entries(globalStatuses)
    const completedCount = statusEntries.filter(([, s]) => s === 'done' || s === 'error').length
    const failedExts = statusEntries
      .filter(([, s]) => s === 'error')
      .map(([pkg]) => extensions.find((e) => e.pkg === pkg))
      .filter(Boolean)

    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        {/* Header */}
        <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
          <View>
            <Typography variant="h1">Browse</Typography>
            <Typography variant="muted">Installed sources ({extensions.length})</Typography>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={() => router.push('/repositories' as any)}
              className="p-2 rounded-lg bg-secondary/70 border border-border"
              activeOpacity={0.7}
              accessibilityLabel="Repositories"
            >
              <Globe size={18} color="#e11d48" />
            </TouchableOpacity>
            <Button
              title="Extensions"
              variant="ghost"
              onPress={() => router.push('/extensions' as any)}
              icon={<Package size={18} color="#e11d48" />}
            />
          </View>
        </View>

        {/* Browse Mode Switcher: Sources | Global Search */}
        {extensions.length > 0 && (
          <View className="mx-4 mt-3 p-1 rounded-xl bg-secondary/60 border border-border flex-row">
            <TouchableOpacity
              onPress={() => setBrowseMode('sources')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center ${
                browseMode === 'sources' ? 'bg-card border border-border' : ''
              }`}
            >
              <Typography
                className={`text-xs font-semibold ${
                  browseMode === 'sources' ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                Sources ({extensions.length})
              </Typography>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setBrowseMode('global')}
              className={`flex-1 py-1.5 rounded-lg items-center justify-center flex-row gap-1.5 ${
                browseMode === 'global' ? 'bg-card border border-border' : ''
              }`}
            >
              <Search size={13} color={browseMode === 'global' ? '#e11d48' : '#71717a'} />
              <Typography
                className={`text-xs font-semibold ${
                  browseMode === 'global' ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                Global Search
              </Typography>
            </TouchableOpacity>
          </View>
        )}

        {/* Media Type Filter Pills */}
        {extensions.length > 0 && (
          <View className="flex-row items-center justify-between px-4 pt-2.5 gap-2">
            <View className="flex-row gap-2">
              {(
                [
                  { key: 'all', label: `All (${extensions.length})` },
                  { key: 'manga', label: `Manga (${mangaCount})` },
                  { key: 'anime', label: `Anime (${animeCount})` }
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  onPress={() => setMediaFilter(opt.key)}
                  className={`px-3 py-1.5 rounded-lg border ${
                    mediaFilter === opt.key
                      ? 'bg-primary border-primary'
                      : 'bg-card border-border'
                  }`}
                >
                  <Typography
                    className={
                      mediaFilter === opt.key
                        ? 'text-white font-semibold text-xs'
                        : 'text-muted-foreground font-medium text-xs'
                    }
                  >
                    {opt.label}
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>

            {browseMode === 'global' && pinnedPkgs.length > 0 && (
              <TouchableOpacity
                onPress={() => setGlobalOnlyPinned((p) => !p)}
                className={`px-2.5 py-1.5 rounded-lg border flex-row items-center gap-1 ${
                  globalOnlyPinned
                    ? 'bg-primary/15 border-primary/40'
                    : 'bg-card border-border'
                }`}
              >
                <Pin size={12} color={globalOnlyPinned ? '#e11d48' : '#71717a'} />
                <Typography
                  className={`text-xs font-medium ${
                    globalOnlyPinned ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Pinned
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        )}

        {extensions.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <View className="w-16 h-16 rounded-2xl bg-secondary border border-border items-center justify-center mb-4">
              <Package size={28} color="#e11d48" />
            </View>
            <Typography variant="h2" className="text-center">
              No sources installed
            </Typography>
            <Typography className="text-muted-foreground text-center mt-1.5 mb-6 text-xs leading-relaxed">
              Add a community repository first, then install extensions to start browsing.
            </Typography>
            <View className="flex-row gap-3">
              <Button
                title="Repositories"
                variant="outline"
                onPress={() => router.push('/repositories' as any)}
                icon={<Globe size={16} color="#e11d48" />}
              />
              <Button
                title="Extensions"
                variant="primary"
                onPress={() => router.push('/extensions' as any)}
              />
            </View>
          </View>
        ) : browseMode === 'global' ? (
          /* Global Search Panel */
          <View className="flex-1">
            <View className="px-4 mt-2.5 flex-row items-center gap-2">
              <View className="flex-1 px-3.5 py-1.5 bg-secondary/50 rounded-xl border border-border flex-row items-center">
                <Search size={16} color="#71717a" />
                <TextInput
                  className="flex-1 ml-2 text-foreground py-2 text-sm"
                  placeholder="Search title across all sources..."
                  placeholderTextColor="#71717a"
                  value={globalQuery}
                  onChangeText={setGlobalQuery}
                  returnKeyType="search"
                  onSubmitEditing={runGlobalSearch}
                />
                {!!globalQuery && (
                  <TouchableOpacity
                    onPress={() => {
                      setGlobalQuery('')
                      setGlobalResults([])
                      setGlobalStatuses({})
                    }}
                    className="p-1"
                  >
                    <X size={15} color="#71717a" />
                  </TouchableOpacity>
                )}
              </View>
              <Button
                title="Search"
                variant="primary"
                size="sm"
                onPress={runGlobalSearch}
                disabled={!globalQuery.trim() || globalSearching}
              />
            </View>

            {/* Progress & Failed Sources Retry */}
            {statusEntries.length > 0 && (
              <View className="px-4 mt-2.5 gap-2">
                <View className="flex-row items-center justify-between">
                  <Typography className="text-xs text-muted-foreground font-medium">
                    {globalSearching
                      ? `Searching sources (${completedCount}/${statusEntries.length})...`
                      : `Searched ${statusEntries.length} sources · ${globalResults.length} results`}
                  </Typography>
                  {globalSearching && <ActivityIndicator size="small" color="#e11d48" />}
                </View>

                {failedExts.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <View className="flex-row gap-1.5">
                      {failedExts.map((ext: any) => (
                        <TouchableOpacity
                          key={ext.pkg}
                          onPress={() => retryGlobalSource(ext)}
                          className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-destructive/10 border border-destructive/30"
                        >
                          <RotateCcw size={11} color="#ef4444" />
                          <Typography className="text-[11px] font-medium text-destructive">
                            Retry {ext.name || ext.pkg}
                          </Typography>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            )}

            <View className="flex-1 px-4 pt-3">
              {globalResults.length === 0 ? (
                <View className="flex-1 items-center justify-center p-6">
                  <Search size={36} color="#71717a" />
                  <Typography className="text-muted-foreground mt-3 text-center text-sm">
                    {globalSearching
                      ? 'Searching across installed sources...'
                      : statusEntries.length > 0
                        ? `No matches found for "${globalQuery}"`
                        : 'Type a manga or anime name and press Search.'}
                  </Typography>
                </View>
              ) : (
                <FlatList
                  data={globalResults}
                  numColumns={3}
                  keyExtractor={(entry, idx) =>
                    `${entry.extension.pkg}::${entry.item.id || idx}-${idx}`
                  }
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 40 }}
                  columnWrapperStyle={{ gap: 8 }}
                  renderItem={({ item: entry }) => {
                    const norm = normalizeManga(entry.item)
                    const badge = resolveExtensionBadge(entry.extension.pkg, extensions)
                    const anime = isAnimeExtension(entry.extension)
                    return (
                      <TouchableOpacity
                        style={{ width: cardWidth }}
                        className="mb-3"
                        onPress={() => openMediaDetails(entry.item, entry.extension)}
                        activeOpacity={0.8}
                      >
                        <Card className="aspect-[2/3] w-full overflow-hidden">
                          {norm.coverUrl ? (
                            <Image
                              source={{ uri: norm.coverUrl }}
                              className="flex-1"
                              contentFit="cover"
                              transition={150}
                            />
                          ) : (
                            <View className="flex-1 items-center justify-center bg-card">
                              {anime ? (
                                <Film size={24} color="#71717a" />
                              ) : (
                                <BookOpen size={24} color="#71717a" />
                              )}
                            </View>
                          )}
                          <View className="absolute top-1.5 left-1.5 right-1.5 flex-row items-center">
                            <View className="flex-row items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 max-w-full">
                              <View
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 99,
                                  backgroundColor: badge?.color || '#e11d48'
                                }}
                              />
                              <Typography
                                className="text-white text-[9px] font-semibold"
                                numberOfLines={1}
                              >
                                {badge?.name || entry.extension.name}
                              </Typography>
                            </View>
                          </View>
                          <LinearGradient
                            colors={['transparent', 'rgba(9,9,11,0.55)', 'rgba(9,9,11,0.92)']}
                            locations={[0, 0.45, 1]}
                            className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-7"
                          >
                            <Typography
                              className="text-white text-xs font-semibold leading-snug"
                              numberOfLines={2}
                            >
                              {norm.title}
                            </Typography>
                          </LinearGradient>
                        </Card>
                      </TouchableOpacity>
                    )
                  }}
                />
              )}
            </View>
          </View>
        ) : (
          /* Sources List */
          <View className="flex-1">
            <View className="px-3.5 py-1.5 bg-secondary/50 mx-4 mt-2.5 rounded-xl border border-border flex-row items-center">
              <Search size={16} color="#71717a" />
              <TextInput
                className="flex-1 ml-2 text-foreground py-2 text-sm"
                placeholder="Filter installed sources..."
                placeholderTextColor="#71717a"
                value={sourceSearch}
                onChangeText={setSourceSearch}
              />
            </View>

            <View className="flex-1 px-4 mt-3">
              {filteredExtensions.length === 0 ? (
                <View className="flex-1 items-center justify-center p-6">
                  <Search size={36} color="#71717a" />
                  <Typography className="text-muted-foreground mt-3 text-center text-sm">
                    {sourceSearch.trim()
                      ? `No installed sources match "${sourceSearch}"`
                      : `No ${mediaFilter} sources installed`}
                  </Typography>
                </View>
              ) : (
                <FlatList
                  data={filteredExtensions}
                  keyExtractor={(item) => item.pkg}
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: 24 }}
                  renderItem={({ item }) => {
                    const flag = LANG_FLAGS[item.lang] || '🌐'
                    const langName = LANG_NAMES[item.lang] || item.lang
                    const isAnime = isAnimeExtension(item)
                    const badge = resolveExtensionBadge(item.pkg, extensions)
                    const isPinned = pinnedPkgs.includes(item.pkg)

                    return (
                      <Card className="mb-2.5">
                        <CardContent className="p-3.5">
                          <TouchableOpacity
                            className="flex-row items-center"
                            onPress={() => openSource(item.pkg, 'popular')}
                            activeOpacity={0.75}
                          >
                            {item.icon ? (
                              <Image
                                source={{ uri: item.icon }}
                                className="w-11 h-11 rounded-xl bg-secondary"
                                contentFit="contain"
                                transition={150}
                              />
                            ) : (
                              <View className="w-11 h-11 bg-primary/10 rounded-xl items-center justify-center">
                                {isAnime ? (
                                  <Film size={20} color="#e11d48" />
                                ) : (
                                  <BookOpen size={20} color="#e11d48" />
                                )}
                              </View>
                            )}
                            <View className="flex-1 ml-3">
                              <View className="flex-row items-center gap-1.5">
                                <Typography className="font-semibold text-sm flex-shrink" numberOfLines={1}>
                                  {item.name || badge?.name || item.pkg}
                                </Typography>
                                <View className="px-1.5 py-0.5 rounded bg-secondary border border-border/50">
                                  <Typography className="text-[9px] font-bold uppercase text-muted-foreground">
                                    {isAnime ? 'Anime' : 'Manga'}
                                  </Typography>
                                </View>
                              </View>
                              <Typography className="text-xs text-muted-foreground mt-0.5">
                                {flag} {langName} {item.version ? `· v${item.version}` : ''}
                              </Typography>
                            </View>
                            <TouchableOpacity
                              onPress={() => togglePinSource(item.pkg)}
                              className="p-2 mr-1"
                              accessibilityLabel={isPinned ? 'Unpin source' : 'Pin source'}
                            >
                              <Pin
                                size={15}
                                color={isPinned ? '#e11d48' : '#71717a'}
                                fill={isPinned ? '#e11d48' : 'none'}
                              />
                            </TouchableOpacity>
                            <TouchableOpacity
                              className="px-3 py-1 rounded-lg bg-secondary border border-border mr-2"
                              onPress={() => openSource(item.pkg, 'latest')}
                            >
                              <Typography className="text-xs font-medium text-foreground">
                                Latest
                              </Typography>
                            </TouchableOpacity>
                            <ChevronRight size={16} color="#71717a" />
                          </TouchableOpacity>
                        </CardContent>
                      </Card>
                    )
                  }}
                />
              )}
            </View>
          </View>
        )}
      </SafeAreaView>
    )
  }

  // ========================================================
  // VIEW 2: Source Catalog View
  // ========================================================
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header with Back button */}
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View className="flex-row items-center flex-1">
          <TouchableOpacity
            onPress={() => {
              setActivePkg(null)
              setResults([])
              setSearchQuery('')
            }}
            className="p-1 mr-2 rounded-lg"
          >
            <ArrowLeft size={22} color="#e11d48" />
          </TouchableOpacity>
          <View className="flex-1">
            <Typography variant="h2" numberOfLines={1}>
              {activeExtension?.name || activePkg}
            </Typography>
            <Typography variant="muted" className="text-xs">
              {LANG_FLAGS[activeExtension?.lang] || '🌐'} {LANG_NAMES[activeExtension?.lang] || activeExtension?.lang || 'Catalog'}
            </Typography>
          </View>
        </View>
        <Button
          title="Extensions"
          variant="ghost"
          onPress={() => router.push('/extensions' as any)}
          icon={<Package size={18} color="#e11d48" />}
        />
      </View>

      {/* Search Bar inside this source */}
      <View className="px-3.5 py-1.5 bg-secondary/50 mx-4 mt-3 rounded-xl border border-border flex-row items-center">
        <Search size={16} color="#71717a" />
        <TextInput
          className="flex-1 ml-2 text-foreground py-2 text-sm"
          placeholder={`Search in ${activeExtension?.name || 'source'}...`}
          placeholderTextColor="#71717a"
          value={searchQuery}
          returnKeyType="search"
          onSubmitEditing={() => {
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
            if (activePkg) {
              setPage(1)
              setHasMore(true)
              fetchResults(activePkg, activeFeed, searchQuery, 1, false)
            }
          }}
          onChangeText={(text) => {
            setSearchQuery(text)
            if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
            if (activePkg) {
              searchDebounceRef.current = setTimeout(() => {
                setPage(1)
                setHasMore(true)
                fetchResults(activePkg, activeFeed, text, 1, false)
              }, 350)
            }
          }}
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => {
              if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
              setSearchQuery('')
              if (activePkg) {
                setPage(1)
                setHasMore(true)
                fetchResults(activePkg, activeFeed, '', 1, false)
              }
            }}
            className="p-1"
          >
            <X size={16} color="#71717a" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Popular / Latest Feed Tabs */}
      {!searchQuery && (
        <View className="flex-row px-4 py-2 gap-2 mt-1">
          <TouchableOpacity
            onPress={() => {
              setActiveFeed('popular')
              if (activePkg) {
                setPage(1)
                setHasMore(true)
                fetchResults(activePkg, 'popular', '', 1, false)
              }
            }}
            className={`px-4 py-1.5 rounded-lg ${activeFeed === 'popular' ? 'bg-primary' : 'bg-card border border-border'}`}
          >
            <Typography className={activeFeed === 'popular' ? 'text-white font-semibold text-xs' : 'text-muted-foreground font-medium text-xs'}>
              Popular
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setActiveFeed('latest')
              if (activePkg) {
                setPage(1)
                setHasMore(true)
                fetchResults(activePkg, 'latest', '', 1, false)
              }
            }}
            className={`px-4 py-1.5 rounded-lg ${activeFeed === 'latest' ? 'bg-primary' : 'bg-card border border-border'}`}
          >
            <Typography className={activeFeed === 'latest' ? 'text-white font-semibold text-xs' : 'text-muted-foreground font-medium text-xs'}>
              Latest
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* Catalog Grid Results */}
      <View className="flex-1 px-4 pt-2">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <Compass size={48} color={error ? '#ef4444' : '#94a3b8'} />
            <Typography className={`mt-4 text-center ${error ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              {error ? error : searchQuery ? 'No results found' : `No ${isActiveSourceAnime ? 'anime' : 'manga'} returned from this source`}
            </Typography>
            <Button
              title="Retry"
              variant="outline"
              className="mt-4"
              onPress={() => {
                if (activePkg) {
                  setPage(1)
                  setHasMore(true)
                  fetchResults(activePkg, activeFeed, searchQuery, 1, false)
                }
              }}
            />
          </View>
        ) : (
          <FlatList
            data={results}
            numColumns={3}
            keyExtractor={(item, idx) => item.id ? `${item.id}-${idx}` : `${idx}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 40 }}
            columnWrapperStyle={{ gap: 8 }}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              loadingMore ? (
                <View className="py-6 items-center justify-center">
                  <ActivityIndicator size="small" color="#e11d48" />
                  <Typography className="text-xs text-muted-foreground mt-2">
                    Loading more...
                  </Typography>
                </View>
              ) : undefined
            }
            refreshControl={
              <RefreshControl
                refreshing={loading}
                onRefresh={() => {
                  if (activePkg) {
                    setPage(1)
                    setHasMore(true)
                    fetchResults(activePkg, activeFeed, searchQuery, 1, false)
                  }
                }}
                tintColor="#e11d48"
              />
            }
            renderItem={({ item }) => {
              const norm = normalizeManga(item)
              return (
                <TouchableOpacity
                  style={{ width: cardWidth }}
                  className="mb-3"
                  onPress={() => openMediaDetails(item)}
                  activeOpacity={0.8}
                >
                  <Card className="aspect-[2/3] w-full overflow-hidden">
                    {norm.coverUrl ? (
                      <Image
                        source={{ uri: norm.coverUrl }}
                        className="flex-1"
                        contentFit="cover"
                        transition={150}
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center bg-card">
                        {isActiveSourceAnime ? (
                          <Film size={24} color="#71717a" />
                        ) : (
                          <BookOpen size={24} color="#71717a" />
                        )}
                      </View>
                    )}
                    <LinearGradient
                      colors={['transparent', 'rgba(9,9,11,0.55)', 'rgba(9,9,11,0.92)']}
                      locations={[0, 0.45, 1]}
                      className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-7"
                    >
                      <Typography
                        className="text-white text-xs font-semibold leading-snug"
                        numberOfLines={2}
                      >
                        {norm.title}
                      </Typography>
                    </LinearGradient>
                  </Card>
                </TouchableOpacity>
              )
            }}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
