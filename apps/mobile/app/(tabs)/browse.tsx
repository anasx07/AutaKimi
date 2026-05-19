import { useState, useEffect, useCallback } from 'react'
import {
  View, FlatList, Image, TouchableOpacity, ActivityIndicator,
  ScrollView, TextInput
} from 'react-native'
import { router } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Typography, Button, Card } from '@mobile/native/ui';
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Search, Compass, Package, Loader2, BookOpen,
  RefreshCw, Globe
} from 'lucide-react-native'

export default function BrowseTab() {
  const [extensions, setExtensions] = useState<any[]>([])
  const [activePkg, setActivePkg] = useState<string | null>(null)
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [activeFeed, setActiveFeed] = useState<'popular' | 'latest'>('popular')
  const [searchQuery, setSearchQuery] = useState('')
  const [initialLoading, setInitialLoading] = useState(true)

  useEffect(() => {
    DataService.db.getExtensions()
      .then((exts: any[]) => {
        setExtensions(exts || [])
        if (exts?.length > 0) setActivePkg(exts[0].pkg)
      })
      .catch(() => {})
      .finally(() => setInitialLoading(false))
  }, [])

  const fetchResults = useCallback(async (pkg: string, feed: string, query?: string) => {
    const ext = extensions.find((e) => e.pkg === pkg)
    if (!ext?.code) return
    setLoading(true)
    try {
      const result = await DataService.executeExtension({
        pkg,
        code: ext.code,
        contextArgs: {
          limit: 20,
          offset: 0,
          activeFeed: query ? 'search' : feed,
          debouncedSearch: query || '',
          lang: ext.lang || 'all'
        }
      })
      setResults(result?.data || [])
    } catch (e) {
      console.error('[Browse] Fetch failed:', e)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [extensions])

  useEffect(() => {
    if (activePkg) fetchResults(activePkg, activeFeed)
  }, [activePkg, activeFeed])

  useEffect(() => {
    if (!searchQuery || !activePkg) return
    const timer = setTimeout(() => {
      fetchResults(activePkg, 'search', searchQuery)
    }, 500)
    return () => clearTimeout(timer)
  }, [searchQuery, activePkg])

  const openMangaDetails = (item: any) => {
    const norm = normalizeManga(item)
    router.push({
      pathname: '/manga/[id]',
      params: {
        id: item.id,
        title: norm.title,
        coverUrl: norm.coverUrl || '',
        pkg: activePkg || item.pkg || '',
        url: item.url || ''
      }
    })
  }

  if (initialLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-3 border-b border-border">
        <View className="flex-row items-center justify-between">
          <View>
            <Typography variant="h1">Browse</Typography>
            <Typography variant="muted">Discover new content</Typography>
          </View>
          <Button
            title="Extensions"
            variant="ghost"
            onPress={() => router.push('/extensions')}
            icon={<Package size={18} color="#3b82f6" />}
          />
        </View>
      </View>

      {/* Search Bar */}
      <View className="px-4 py-2 bg-card mx-4 mt-3 rounded-xl border border-border flex-row items-center">
        <Search size={18} color="#94a3b8" />
        <TextInput
          className="flex-1 ml-2 text-foreground py-2"
          placeholder="Search manga..."
          placeholderTextColor="#94a3b8"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Source Pills */}
      {extensions.length > 0 && (
        <View className="mt-3 mb-2">
          <FlatList
            horizontal
            data={extensions}
            keyExtractor={(item) => item.pkg}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                className={`px-4 py-2 rounded-full mr-2 border ${activePkg === item.pkg ? 'bg-primary border-primary' : 'bg-card border-border'}`}
                onPress={() => { setActivePkg(item.pkg); setSearchQuery('') }}
              >
                <Typography className={activePkg === item.pkg ? 'text-white text-sm font-medium' : 'text-sm'}>
                  {item.name || item.pkg}
                </Typography>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Feed Tabs */}
      {!searchQuery && (
        <View className="flex-row px-4 py-2 gap-2">
          <TouchableOpacity
            onPress={() => setActiveFeed('popular')}
            className={`px-4 py-1.5 rounded-full ${activeFeed === 'popular' ? 'bg-primary/20' : ''}`}
          >
            <Typography className={activeFeed === 'popular' ? 'text-primary font-semibold text-sm' : 'text-muted-foreground text-sm'}>
              Popular
            </Typography>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveFeed('latest')}
            className={`px-4 py-1.5 rounded-full ${activeFeed === 'latest' ? 'bg-primary/20' : ''}`}
          >
            <Typography className={activeFeed === 'latest' ? 'text-primary font-semibold text-sm' : 'text-muted-foreground text-sm'}>
              Latest
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      <View className="flex-1 px-4 pt-2">
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : results.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Compass size={48} color="#94a3b8" />
            <Typography className="text-muted-foreground mt-4 text-center">
              {searchQuery ? 'No results found' : 'Select a source to browse'}
            </Typography>
            {extensions.length === 0 && (
              <Button
                title="Add Extensions"
                variant="outline"
                className="mt-4"
                onPress={() => router.push('/extensions')}
              />
            )}
          </View>
        ) : (
          <FlatList
            data={results}
            numColumns={3}
            keyExtractor={(item, idx) => item.id || `${idx}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
            columnWrapperStyle={{ gap: 8 }}
            renderItem={({ item }) => {
              const norm = normalizeManga(item)
              return (
                <TouchableOpacity
                  className="flex-1 mb-3"
                  onPress={() => openMangaDetails(item)}
                >
                  <Card className="aspect-[2/3]">
                    {norm.coverUrl ? (
                      <Image
                        source={{ uri: norm.coverUrl }}
                        className="flex-1"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="flex-1 items-center justify-center bg-card">
                        <BookOpen size={24} color="#94a3b8" />
                      </View>
                    )}
                    <View className="absolute bottom-0 left-0 right-0 p-1.5 bg-black/60">
                      <Typography
                        className="text-white text-xs font-semibold"
                        numberOfLines={2}
                      >
                        {norm.title}
                      </Typography>
                    </View>
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
