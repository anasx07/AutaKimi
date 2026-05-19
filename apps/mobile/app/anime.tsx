import React, { useState, useCallback, useEffect, useMemo } from 'react'
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  RefreshControl,
  TextInput
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { Search, Play, Loader2 } from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { Typography, Card, Button } from '../../src/native/ui'

interface AnimeItem {
  id: string
  title: string
  coverUrl: string
  url: string
  [key: string]: any
}

type FeedType = 'popular' | 'latest' | 'search'

export default function AnimePage(): React.JSX.Element {
  const [activePkg, setActivePkg] = useState<string | null>(null)
  const [activeFeed, setActiveFeed] = useState<FeedType>('popular')
  const [searchQuery, setSearchQuery] = useState('')
  const [items, setItems] = useState<AnimeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [extensionCode, setExtensionCode] = useState<string | null>(null)
  const [extensions, setExtensions] = useState<any[]>([])
  const [extensionsLoading, setExtensionsLoading] = useState(true)

  const screenWidth = Dimensions.get('window').width
  const cardWidth = (screenWidth - 48) / 3

  // Load installed extensions on mount
  useEffect(() => {
    DataService.db.getExtensions().then((exts: any[]) => {
      const installed = exts.filter((e: any) => e.pkg && (e.type === 'anime' || e.pkg.toLowerCase().includes('anime')))
      setExtensions(installed)
      setExtensionsLoading(false)
    }).catch(() => setExtensionsLoading(false))
  }, [])

  // Resolve source for the selected pkg
  const activeSource = useMemo(() => {
    if (!activePkg) return null
    const installed = extensions.find((e) => e.pkg === activePkg)
    return installed ? { ...installed, code: installed.code || null } : null
  }, [activePkg, extensions])

  // Load extension code when source changes
  useEffect(() => {
    if (!activePkg) return
    DataService.db.getExtension(activePkg).then((ext: any) => {
      setExtensionCode(ext?.code || null)
    }).catch(() => setExtensionCode(null))
  }, [activePkg])

  const fetchAnime = useCallback(async (p: number, feed: FeedType, query: string) => {
    if (!extensionCode || !activePkg) return
    setLoading(true)
    setError(null)

    try {
      const contextArgs: Record<string, any> = {
        limit: 24,
        offset: (p - 1) * 24,
        activeFeed: feed,
        lang: 'all'
      }
      if (feed === 'search' && query) {
        contextArgs.query = query
      }

      const res: any = await DataService.executeExtension({
        pkg: activePkg,
        code: extensionCode,
        contextArgs
      })

      const data = (res?.data || []).map((item: any) => ({
        id: item.id || item.url?.split('/').filter(Boolean).pop() || String(Math.random()),
        title: item.title || item.name || 'Unknown',
        coverUrl: item.coverUrl || item.thumbnail || item.image || '',
        url: item.url || ''
      }))

      if (p === 1) {
        setItems(data)
      } else {
        setItems((prev) => [...prev, ...data])
      }
      setHasMore(data.length >= 24)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch anime')
    } finally {
      setLoading(false)
    }
  }, [extensionCode, activePkg])

  // Fetch when source/feed/page changes
  useEffect(() => {
    if (!activePkg || !extensionCode) return
    fetchAnime(1, activeFeed, searchQuery)
    setPage(1)
  }, [activePkg, extensionCode, activeFeed])

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setActiveFeed('popular')
      return
    }
    setActiveFeed('search')
  }, [searchQuery])

  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchAnime(nextPage, activeFeed, searchQuery)
  }, [loading, hasMore, page, activeFeed, searchQuery, fetchAnime])

  const handleRefresh = useCallback(() => {
    setPage(1)
    fetchAnime(1, activeFeed, searchQuery)
  }, [activeFeed, searchQuery, fetchAnime])

  const handleAnimePress = useCallback((item: AnimeItem) => {
    router.push({ pathname: '/anime/[id]', params: { id: item.id, pkg: activePkg!, title: item.title, coverUrl: item.coverUrl } })
  }, [activePkg])

  const feedTabs: { key: FeedType; label: string }[] = [
    { key: 'popular', label: 'Popular' },
    { key: 'latest', label: 'Latest' },
    { key: 'search', label: 'Search' }
  ]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <Play size={22} color="#3b82f6" />
        </TouchableOpacity>
        <Typography variant="h3" className="font-bold text-lg flex-1 text-center">Browse Anime</Typography>
        <View className="w-10" />
      </View>

      {!activePkg ? (
        /* Source Selection */
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
          <Typography variant="small" className="text-muted-foreground uppercase font-bold tracking-widest mb-4 px-2">
            Select an Anime Source
          </Typography>
          {extensionsLoading ? (
            <ActivityIndicator size="large" color="#3b82f6" className="mt-20" />
          ) : (
            ANIME_SOURCES.map((source) => {
              const isInstalled = extensions.some((e: any) => e.pkg === source.pkg)
              return (
                <TouchableOpacity
                  key={source.pkg}
                  onPress={() => isInstalled && setActivePkg(source.pkg)}
                  className="mb-3"
                  disabled={!isInstalled}
                >
                  <Card>
                    <View className="flex-row items-center gap-4 p-4">
                      <View className="w-12 h-12 rounded-xl bg-secondary items-center justify-center">
                        <Play size={24} color={isInstalled ? '#3b82f6' : '#94a3b8'} />
                      </View>
                      <View className="flex-1">
                        <View className="flex-row items-center gap-2">
                          <Typography className="font-bold text-base">{source.name}</Typography>
                          <View className="bg-secondary px-2 py-0.5 rounded-full">
                            <Typography variant="small" className="text-muted-foreground font-medium text-[10px]">
                              {source.lang.toUpperCase()}
                            </Typography>
                          </View>
                        </View>
                        <Typography variant="muted" className="text-xs mt-0.5">
                          {isInstalled ? 'Ready to browse' : 'Not installed — install from Extensions'}
                        </Typography>
                      </View>
                    </View>
                  </Card>
                </TouchableOpacity>
              )
            })
          )}
          <TouchableOpacity
            onPress={() => router.push('/extensions')}
            className="mt-2"
          >
            <Card>
              <View className="items-center py-6">
                <Typography className="text-primary font-bold">Browse Extensions</Typography>
                <Typography variant="muted" className="text-xs mt-1">Install new sources from the catalog</Typography>
              </View>
            </Card>
          </TouchableOpacity>
        </ScrollView>
      ) : (
        /* Catalog Browsing */
        <View className="flex-1">
          {/* Feed Tabs + Search */}
          <View className="px-4 pt-3 pb-2 border-b border-border">
            <View className="flex-row gap-2 mb-3">
              {feedTabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveFeed(tab.key)}
                  className={`px-4 py-2 rounded-full ${activeFeed === tab.key ? 'bg-primary' : 'bg-secondary'}`}
                >
                  <Typography
                    variant="small"
                    className={`font-bold ${activeFeed === tab.key ? 'text-white' : 'text-muted-foreground'}`}
                  >
                    {tab.label}
                  </Typography>
                </TouchableOpacity>
              ))}
            </View>
            {activeFeed === 'search' && (
              <View className="flex-row items-center gap-2">
                <TextInput
                  className="flex-1 bg-secondary rounded-xl px-4 py-2.5 text-foreground border border-border"
                  placeholder="Search anime..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity onPress={handleSearch} className="bg-primary rounded-xl p-2.5">
                  <Search size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          {/* Source indicator */}
          <View className="px-4 py-2 flex-row items-center gap-2">
            <TouchableOpacity onPress={() => setActivePkg(null)}>
              <Typography variant="small" className="text-primary font-bold">
                ‹ Sources
              </Typography>
            </TouchableOpacity>
            <Typography variant="muted" className="text-xs">
              · {ANIME_SOURCES.find((s) => s.pkg === activePkg)?.name}
            </Typography>
          </View>

          {/* Grid */}
          {loading && items.length === 0 ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" color="#3b82f6" />
              <Typography variant="muted" className="mt-4">Loading anime...</Typography>
            </View>
          ) : error && items.length === 0 ? (
            <View className="flex-1 items-center justify-center px-8">
              <Typography className="text-destructive font-bold text-lg mb-2">Error</Typography>
              <Typography variant="muted" className="text-center mb-4">{error}</Typography>
              <Button title="Retry" variant="outline" onPress={handleRefresh} />
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item, idx) => `${item.id}-${idx}`}
              numColumns={3}
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleAnimePress(item)}
                  className="p-1.5"
                  style={{ width: cardWidth }}
                >
                  <View className="rounded-xl overflow-hidden bg-secondary border border-border">
                    <View className="aspect-[3/4] bg-muted">
                      {item.coverUrl ? (
                        <Image
                          source={{ uri: item.coverUrl.replace('https://', 'autakimi-cache://') }}
                          className="w-full h-full"
                          resizeMode="cover"
                        />
                      ) : (
                        <View className="w-full h-full items-center justify-center">
                          <Play size={24} color="#94a3b8" />
                        </View>
                      )}
                    </View>
                    <View className="p-2">
                      <Typography variant="small" className="font-medium" numberOfLines={2}>
                        {item.title}
                      </Typography>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              onEndReached={handleLoadMore}
              onEndReachedThreshold={0.5}
              refreshControl={
                <RefreshControl refreshing={loading} onRefresh={handleRefresh} tintColor="#3b82f6" />
              }
              contentContainerStyle={{ padding: 8, paddingBottom: 40 }}
              ListEmptyComponent={
                !loading ? (
                  <View className="items-center py-20">
                    <Search size={48} color="#94a3b8" />
                    <Typography variant="muted" className="mt-4 text-center">No anime found</Typography>
                  </View>
                ) : null
              }
              ListFooterComponent={
                loading && items.length > 0 ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : null
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  )
}
