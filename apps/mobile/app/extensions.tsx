import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, FlatList, Image, TouchableOpacity, ActivityIndicator,
  RefreshControl
} from 'react-native'
import { router, Stack } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { Typography, Button, Card, CardContent } from '@mobile/native/ui';
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Package, Download, Trash2, CheckCircle, X,
  Loader2, Globe, Search
} from 'lucide-react-native'

const CATALOG_URL = 'https://raw.githubusercontent.com/keiyoushi/extensions-source/main/index.min.json'

const LANG_FLAGS: Record<string, string> = {
  all: '🌐', en: '🇬🇧', ar: '🇸🇦', es: '🇪🇸', fr: '🇫🇷',
  id: '🇮🇩', ja: '🇯🇵', ko: '🇰🇷', pt: '🇵🇹', ru: '🇷🇺',
  th: '🇹🇭', tr: '🇹🇷', vi: '🇻🇳', zh: '🇨🇳', hi: '🇮🇳',
  de: '🇩🇪', it: '🇮🇹', pl: '🇵🇱', nl: '🇳🇱', cs: '🇨🇿',
  bg: '🇧🇬', ca: '🇦🇩', uk: '🇺🇦'
}

const LANG_NAMES: Record<string, string> = {
  all: 'All', en: 'English', ar: 'Arabic', es: 'Spanish', fr: 'French',
  id: 'Indonesian', ja: 'Japanese', ko: 'Korean', pt: 'Portuguese',
  ru: 'Russian', th: 'Thai', tr: 'Turkish', vi: 'Vietnamese',
  zh: 'Chinese', hi: 'Hindi', de: 'German', it: 'Italian',
  pl: 'Polish', nl: 'Dutch', cs: 'Czech', bg: 'Bulgarian',
  ca: 'Catalan', uk: 'Ukrainian'
}

const LANGS = ['en', 'ar', 'es', 'fr', 'id', 'ja', 'ko', 'pt', 'ru', 'th', 'tr', 'vi', 'zh', 'de', 'it', 'pl']

export default function ExtensionsScreen() {
  const [catalog, setCatalog] = useState<any[]>([])
  const [installed, setInstalled] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [installingPkgs, setInstallingPkgs] = useState<Set<string>>(new Set())
  const [langFilter, setLangFilter] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [installedExts, catalogRes] = await Promise.all([
        DataService.db.getExtensions(),
        DataService.fetchRepo(CATALOG_URL)
      ])
      setInstalled(installedExts || [])
      const cat = Array.isArray(catalogRes) ? catalogRes : []
      setCatalog(cat)
    } catch (e: any) {
      setError(e.message || 'Failed to load extensions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadData() }, [])

  const onRefresh = () => loadData(true)

  const isInstalled = (pkg: string) => installed.some((e) => e.pkg === pkg)

  const filteredCatalog = useMemo(() => {
    if (!langFilter) return catalog
    return catalog.filter((ext) => ext.lang === langFilter)
  }, [catalog, langFilter])

  const installExt = async (ext: any) => {
    setInstallingPkgs((prev) => new Set(prev).add(ext.pkg))
    try {
      await DataService.installExtension(ext, 'local')
      await loadData()
    } catch (e: any) {
      console.error('[Extensions] Install failed:', e)
    } finally {
      setInstallingPkgs((prev) => {
        const next = new Set(prev)
        next.delete(ext.pkg)
        return next
      })
    }
  }

  const uninstallExt = async (pkg: string) => {
    try {
      await DataService.db.removeExtension(pkg)
      await loadData()
    } catch (e) {
      console.error('[Extensions] Uninstall failed:', e)
    }
  }

  const renderExtItem = ({ item }: { item: any }) => {
    const installed_ = isInstalled(item.pkg)
    const installing = installingPkgs.has(item.pkg)
    const flag = LANG_FLAGS[item.lang] || '🌐'
    const langName = LANG_NAMES[item.lang] || item.lang

    return (
      <Card className="mb-3">
        <CardContent>
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center">
              <Package size={24} color="#3b82f6" />
            </View>
            <View className="flex-1 ml-3">
              <Typography className="font-semibold" numberOfLines={1}>
                {item.name || item.pkg}
              </Typography>
              <Typography className="text-xs text-muted-foreground">
                {flag} {langName} · v{item.version}
              </Typography>
            </View>
            {installed_ ? (
              <TouchableOpacity
                className="p-2"
                onPress={() => uninstallExt(item.pkg)}
              >
                <Trash2 size={18} color="#ef4444" />
              </TouchableOpacity>
            ) : (
              <Button
                title={installing ? '' : 'Install'}
                variant="primary"
                size="sm"
                loading={installing}
                disabled={installing}
                onPress={() => installExt(item)}
              />
            )}
          </View>
        </CardContent>
      </Card>
    )
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <TouchableOpacity className="p-2 -ml-2" onPress={() => router.back()}>
            <X size={24} color="#fff" />
          </TouchableOpacity>
          <Typography variant="h1" className="ml-2">Extensions</Typography>
        </View>

        {/* Lang Filter */}
        <View className="py-2">
          <FlatList
            horizontal
            data={['all', ...LANGS]}
            keyExtractor={(l) => l}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item: lang }) => (
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 ${langFilter === lang || (!langFilter && lang === 'all') ? 'bg-primary' : 'bg-card border border-border'}`}
                onPress={() => setLangFilter(lang === 'all' ? null : lang)}
              >
                <Typography className={`text-xs ${langFilter === lang || (!langFilter && lang === 'all') ? 'text-white' : ''}`}>
                  {LANG_FLAGS[lang] || '🌐'} {LANG_NAMES[lang] || lang}
                </Typography>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Typography className="text-destructive text-lg font-semibold text-center">
              Failed to load
            </Typography>
            <Typography className="text-muted-foreground mt-2 text-center">
              {error}
            </Typography>
            <Button title="Retry" variant="outline" className="mt-4" onPress={onRefresh} />
          </View>
        ) : (
          <FlatList
            data={filteredCatalog}
            keyExtractor={(item) => item.pkg}
            renderItem={renderExtItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={
              <View className="py-12 items-center">
                <Package size={48} color="#94a3b8" />
                <Typography className="text-muted-foreground mt-4">
                  No extensions found
                </Typography>
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  )
}
