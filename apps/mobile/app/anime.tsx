import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import {
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
  TextInput
} from 'react-native'
import { Image } from 'expo-image'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { Search, Play, ArrowLeft, X } from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { isAnimeExtension } from '@common/utils/mediaType'
import { normalizeManga, isValidMediaCatalogItem } from '@common/utils/mangaNormalizer'
import { Typography, Card, Button } from '../src/native/ui'
import { useColorScheme } from 'nativewind'

interface AnimeItem {
  id: string
  title: string
  coverUrl: string
  url: string
  [key: string]: any
}

type FeedType = 'popular' | 'latest'

export default function AnimePage(): React.JSX.Element {
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === 'dark'
  const [activePkg, setActivePkg] = useState<string | null>(null)
  const [activeFeed, setActiveFeed] = useState<FeedType>('popular')
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [items, setItems] = useState<AnimeItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [extensionCode, setExtensionCode] = useState<string | null>(null)
  const [extensions, setExtensions] = useState<any[]>([])
  const [extensionsLoading, setExtensionsLoading] = useState(true)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const screenWidth = Dimensions.get('window').width
  const cardWidth = (screenWidth - 48) / 3

  // Load installed anime extensions dynamically
  useEffect(() => {
    DataService.db.getExtensions().then((exts: any[]) => {
      const installed = (exts || []).filter((e: any) => e.pkg && isAnimeExtension(e))
      setExtensions(installed)
      setExtensionsLoading(false)
    }).catch(() => setExtensionsLoading(false))
  }, [])

  // Resolve source for the selected pkg
  const activeSource = useMemo(() => {
    if (!activePkg) return null
    return extensions.find((e) => e.pkg === activePkg) || null
  }, [activePkg, extensions])

  // Load extension code when source changes
  useEffect(() => {
    if (!activePkg) {
      setExtensionCode(null)
      return
    }
    DataService.db.getExtension(activePkg).then((ext: any) => {
      setExtensionCode(ext?.code || '')
    }).catch(() => setExtensionCode(''))
  }, [activePkg])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(searchQuery.trim())
    }, 350)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [searchQuery])

  const fetchAnime = useCallback(async (p: number, feed: FeedType, query: string) => {
    if (!activePkg) return
    setLoading(true)
    setError(null)

    try {
      const trimmed = query.trim()
      const contextArgs: Record<string, any> = {
        page: p,
        limit: 24,
        offset: (p - 1) * 24,
        activeFeed: trimmed ? 'search' : feed,
        debouncedSearch: trimmed,
        query: trimmed,
        lang: activeSource?.lang || 'all'
      }

      const res: any = await DataService.executeExtension({
        pkg: activePkg,
        code: extensionCode || '',
        contextArgs
      })

      const raw = Array.isArray(res) ? res : (res?.data || res?.items || [])
      const data = raw
        .filter(isValidMediaCatalogItem)
        .map((item: any) => {
          const norm = normalizeManga(item)
          return {
            id: item.id || item.url?.split('/').filter(Boolean).pop() || String(Math.random()),
            title: norm.title,
            coverUrl: norm.coverUrl || '',
            url: item.url || item.id || ''
          }
        })

      if (p === 1) {
        setItems(data)
      } else {
        setItems((prev) => {
          const seen = new Set(prev.map((x) => x.id))
          return [...prev, ...data.filter((x: AnimeItem) => !seen.has(x.id))]
        })
      }
      setHasMore(data.length >= 8)
    } catch (err: any) {
      setError(err.message || 'Failed to fetch anime')
    } finally {
      setLoading(false)
    }
  }, [extensionCode, activePkg, activeSource])

  // Fetch when source/feed/search changes
  useEffect(() => {
    if (!activePkg || extensionCode === null) return
    setPage(1)
    fetchAnime(1, activeFeed, debouncedQuery)
  }, [activePkg, extensionCode, activeFeed, debouncedQuery, fetchAnime])

  const handleLoadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchAnime(nextPage, activeFeed, debouncedQuery)
  }, [loading, hasMore, page, activeFeed, debouncedQuery, fetchAnime])

  const handleRefresh = useCallback(() => {
    setPage(1)
    fetchAnime(1, activeFeed, debouncedQuery)
  }, [activeFeed, debouncedQuery, fetchAnime])

  const handleAnimePress = useCallback((item: AnimeItem) => {
    router.push({
      pathname: '/anime/[id]' as any,
      params: {
        id: item.id,
        pkg: activePkg!,
        title: item.title,
        coverUrl: item.coverUrl,
        url: item.url || item.id || ''
      }
    })
  }, [activePkg])

  const feedTabs: { key: FeedType; label: string }[] = [
    { key: 'popular', label: 'Popular' },
    { key: 'latest', label: 'Latest' }
  ]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-border/40 bg-background">
        <TouchableOpacity
          onPress={() => {
            if (activePkg) {
              setActivePkg(null)
              setItems([])
              setSearchQuery('')
            } else {
              router.back()
            }
          }}
          className="p-2 -ml-2 rounded-xl"
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={isDark ? '#f4f4f5' : '#09090b'} />
        </TouchableOpacity>
        <Typography variant="h3" className="font-bold text-lg flex-1 text-center" numberOfLines={1}>
          {activeSource?.name || 'Browse Anime'}
        </Typography>
        <View className="w-10" />
      </View>

      {!activePkg ? (
        /* Source Selection */
        <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
          <Typography variant="small" className="text-muted-foreground uppercase font-semibold tracking-wide mb-3 px-1">
            Installed Anime Sources ({extensions.length})
          </Typography>
          {extensionsLoading ? (
            <ActivityIndicator size="large" color="#e11d48" className="mt-20" />
          ) : extensions.length === 0 ? (
            <Card className="mb-3">
              <View className="items-center py-8 px-4">
                <Play size={32} color="#71717a" />
                <Typography className="font-semibold mt-3 text-center">No anime sources installed</Typography>
                <Typography variant="muted" className="text-xs mt-1 text-center">
                  Install an anime extension from Extensions to start watching.
                </Typography>
              </View>
            </Card>
          ) : (
            extensions.map((source) => (
              <TouchableOpacity
                key={source.pkg}
                onPress={() => {
                  setActivePkg(source.pkg)
                  setActiveFeed('popular')
                  setSearchQuery('')
                }}
                className="mb-3"
              >
                <Card>
                  <View className="flex-row items-center gap-3.5 p-4">
                    {source.icon ? (
                      <Image
                        source={{ uri: source.icon }}
                        className="w-11 h-11 rounded-xl bg-secondary"
                        contentFit="contain"
                        transition={150}
                      />
                    ) : (
                      <View className="w-11 h-11 rounded-xl bg-secondary border border-border items-center justify-center">
                        <Play size={20} color="#e11d48" />
                      </View>
                    )}
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Typography className="font-bold text-base" numberOfLines={1}>
                          {source.name || source.pkg}
                        </Typography>
                        {source.lang && (
                          <View className="bg-secondary px-2 py-0.5 rounded-full">
                            <Typography variant="small" className="text-muted-foreground font-medium text-[10px]">
                              {String(source.lang).toUpperCase()}
                            </Typography>
                          </View>
                        )}
                      </View>
                      <Typography variant="muted" className="text-xs mt-0.5">
                        {source.version ? `v${source.version} · ` : ''}Tap to browse catalog
                      </Typography>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))
          )}
          <TouchableOpacity
            onPress={() => router.push('/extensions' as any)}
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
          {/* Quick Search Bar + Feed Tabs */}
          <View className="px-4 pt-3 pb-2 border-b border-border">
            <View className="flex-row items-center bg-secondary rounded-xl px-3.5 py-1.5 border border-border mb-2.5">
              <Search size={16} color="#94a3b8" />
              <TextInput
                className="flex-1 ml-2 py-1.5 text-foreground text-sm"
                placeholder={`Search in ${activeSource?.name || 'anime'}...`}
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                onSubmitEditing={() => setDebouncedQuery(searchQuery.trim())}
              />
              {!!searchQuery && (
                <TouchableOpacity
                  onPress={() => {
                    setSearchQuery('')
                    setDebouncedQuery('')
                  }}
                  className="p-1"
                >
                  <X size={16} color="#94a3b8" />
                </TouchableOpacity>
              )}
            </View>
            {!debouncedQuery && (
              <View className="flex-row gap-2">
                {feedTabs.map((tab) => (
                  <TouchableOpacity
                    key={tab.key}
                    onPress={() => setActiveFeed(tab.key)}
                    className={`px-4 py-1.5 rounded-full ${activeFeed === tab.key ? 'bg-primary' : 'bg-secondary'}`}
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
              · {activeSource?.name || activePkg}
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
                          source={{ uri: item.coverUrl }}
                          className="w-full h-full"
                          contentFit="cover"
                          transition={150}
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
                ) : undefined
              }
              ListFooterComponent={
                loading && items.length > 0 ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator size="small" color="#3b82f6" />
                  </View>
                ) : undefined
              }
            />
          )}
        </View>
      )}
    </SafeAreaView>
  )
}
