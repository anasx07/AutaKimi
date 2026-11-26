import { useState, useCallback } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, RefreshControl, useWindowDimensions
} from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router, useFocusEffect } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { normalizeManga, isValidMediaCatalogItem } from '@common/utils/mangaNormalizer'
import { Typography, Button, Card, CardContent } from '@mobile/native/ui'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Search, Compass, Package, BookOpen,
  ArrowLeft, ChevronRight, RefreshCw, X
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
  const [extensions, setExtensions] = useState<any[]>([])
  const [activePkg, setActivePkg] = useState<string | null>(null)
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
        const result = await DataService.executeExtension({
          pkg,
          code: ext.code || '',
          contextArgs: {
            page: pageNum,
            limit,
            offset,
            activeFeed: query ? 'search' : feed,
            debouncedSearch: query || '',
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

  const openSource = (pkg: string, feed: 'popular' | 'latest' = 'popular') => {
    setActivePkg(pkg)
    setActiveFeed(feed)
    setSearchQuery('')
    setError(null)
    setPage(1)
    setHasMore(true)
    fetchResults(pkg, feed, '', 1, false)
  }

  const openMangaDetails = (item: any) => {
    const norm = normalizeManga(item)
    router.push({
      pathname: '/manga/[id]' as any,
      params: {
        id: item.id,
        title: norm.title,
        coverUrl: norm.coverUrl || '',
        pkg: activePkg || item.pkg || '',
        url: item.url || item.id || ''
      }
    })
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
  // VIEW 1: Sources List (TachiManga / Mihon default Browse)
  // ========================================================
  if (!activePkg) {
    const filteredExtensions = extensions.filter((ext) => {
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
                Install extensions from community repositories like Keiyoushi to start browsing.
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
                No installed sources match "{sourceSearch}"
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
                            <BookOpen size={20} color="#e11d48" />
                          </View>
                        )}
                        <View className="flex-1 ml-3">
                          <Typography className="font-semibold text-sm" numberOfLines={1}>
                            {item.name || item.pkg}
                          </Typography>
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
          onChangeText={(text) => {
            setSearchQuery(text)
            if (activePkg) {
              setPage(1)
              setHasMore(true)
              fetchResults(activePkg, activeFeed, text, 1, false)
            }
          }}
        />
        {searchQuery ? (
          <TouchableOpacity
            onPress={() => {
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

      {/* Manga Grid Results */}
      <View className="flex-1 px-4 pt-2">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center p-6">
            <Compass size={48} color={error ? '#ef4444' : '#94a3b8'} />
            <Typography className={`mt-4 text-center ${error ? 'text-red-500 font-medium' : 'text-muted-foreground'}`}>
              {error ? error : searchQuery ? 'No results found' : 'No manga returned from this source'}
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
                    Loading more manga...
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
                  onPress={() => openMangaDetails(item)}
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
                        <BookOpen size={24} color="#71717a" />
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
