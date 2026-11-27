import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, RefreshControl, useWindowDimensions
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
  ArrowLeft, ChevronRight, X
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

export default function BrowseTab() {
  const { pkg: paramPkg, feed: paramFeed } = useLocalSearchParams<{ pkg?: string; feed?: string }>()
  const [extensions, setExtensions] = useState<any[]>([])
  const [activePkg, setActivePkg] = useState<string | null>(null)
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

  const { width: windowWidth } = useWindowDimensions()
  const numColumns = 3
  const cardGap = 8
  const containerPadding = 16 * 2 // px-4 = 32px
  const cardWidth = Math.floor((windowWidth - containerPadding - cardGap * (numColumns - 1)) / numColumns)

  useFocusEffect(
    useCallback(() => {
      DataService.db.getExtensions()
        .then((exts: any[]) => {
          const validExts = (exts || []).filter(
            (e) => e.pkg && !/^\d+$/.test(e.pkg)
          )
          setExtensions(validExts)
        })
        .catch(() => {})
        .finally(() => setInitialLoading(false))
    }, [])
  )

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

  // Open a specific extension directly when navigated with ?pkg=... (e.g. clicking source badge in Details)
  useEffect(() => {
    const targetPkg = typeof paramPkg === 'string' ? paramPkg.trim() : ''
    if (!targetPkg) return
    const targetFeed = paramFeed === 'latest' ? 'latest' : 'popular'
    openSource(targetPkg, targetFeed)
    try {
      router.setParams({ pkg: '', feed: '' } as any)
    } catch {
      // Ignore if router param reset isn't supported in this context
    }
  }, [paramPkg, paramFeed, openSource])

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    }
  }, [])

  const openMediaDetails = (item: any) => {
    const norm = normalizeManga(item)
    const isAnime =
      item.type === 'anime' ||
      item.mediaType === 'anime' ||
      isAnimeExtension(activeExtension || { pkg: activePkg || item.pkg })
    router.push({
      pathname: (isAnime ? '/anime/[id]' : '/manga/[id]') as any,
      params: {
        id: item.id,
        title: norm.title,
        coverUrl: norm.coverUrl || '',
        pkg: activePkg || item.pkg || '',
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
  // VIEW 1: Sources List (TachiManga / Mihon default Browse)
  // ========================================================
  if (!activePkg) {
    const filteredExtensions = extensions.filter((ext) => {
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

    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        {/* Header */}
        <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
          <View>
            <Typography variant="h1">Browse</Typography>
            <Typography variant="muted">Installed sources ({extensions.length})</Typography>
          </View>
          <Button
            title="Extensions"
            variant="ghost"
            onPress={() => router.push('/extensions' as any)}
            icon={<Package size={18} color="#e11d48" />}
          />
        </View>

        {/* Media Type Filter Pills */}
        {extensions.length > 0 && (
          <View className="flex-row px-4 pt-3 gap-2">
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
                className={`px-3.5 py-1.5 rounded-lg border ${
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
        )}

        {/* Search Installed Sources */}
        {extensions.length > 0 && (
          <View className="px-3.5 py-1.5 bg-secondary/50 mx-4 mt-3 rounded-xl border border-border flex-row items-center">
            <Search size={16} color="#71717a" />
            <TextInput
              className="flex-1 ml-2 text-foreground py-2 text-sm"
              placeholder="Search installed sources..."
              placeholderTextColor="#71717a"
              value={sourceSearch}
              onChangeText={setSourceSearch}
            />
          </View>
        )}

        {/* Sources List */}
        <View className="flex-1 px-4 mt-3">
          {extensions.length === 0 ? (
            <View className="flex-1 items-center justify-center p-6">
              <View className="w-16 h-16 rounded-2xl bg-secondary border border-border items-center justify-center mb-4">
                <Package size={28} color="#e11d48" />
              </View>
              <Typography variant="h2" className="text-center">
                No sources installed
              </Typography>
              <Typography className="text-muted-foreground text-center mt-1.5 mb-6 text-xs leading-relaxed">
                Install extensions from community repositories like Keiyoushi or AutaKimi to start browsing.
              </Typography>
              <Button
                title="Browse Extensions"
                variant="primary"
                onPress={() => router.push('/extensions' as any)}
              />
            </View>
          ) : filteredExtensions.length === 0 ? (
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
      </SafeAreaView>
    )
  }

  // ========================================================
  // VIEW 2: Source Catalog View (Tapping a source in TachiManga)
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
