import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, TextInput
} from 'react-native'
import { Image } from 'expo-image'
import { router, Stack } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { Typography, Button, Card, CardContent } from '@mobile/native/ui'
import { SafeAreaView } from 'react-native-safe-area-context'
import {
  Package, Download, Trash2, CheckCircle, X,
  Loader2, Globe, Search, ArrowLeft, Check, Compass
} from 'lucide-react-native'
import { useColorScheme } from 'nativewind'

const LANG_FLAGS: Record<string, string> = {
  all: '🌐', en: '🇬🇧', ar: '🇸🇦', es: '🇪🇸', fr: '🇫🇷',
  id: '🇮🇩', ja: '🇯🇵', ko: '🇰🇷', pt: '🇵🇹', ru: '🇷🇺',
  th: '🇹🇭', tr: '🇹🇷', vi: 'Viet', zh: '🇨🇳', hi: '🇮🇳',
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
  const { colorScheme } = useColorScheme()
  const isDark = colorScheme === 'dark'
  const [catalog, setCatalog] = useState<any[]>([])
  const [installed, setInstalled] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [installingPkgs, setInstallingPkgs] = useState<Set<string>>(new Set())
  const [activeTab, setActiveTab] = useState<'installed' | 'available'>('available')
  const [searchQuery, setSearchQuery] = useState('')
  const [langFilter, setLangFilter] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [installedExts, catalogRes] = await Promise.all([
        DataService.db.getExtensions(),
        DataService.getExtensionsCatalog()
      ])
      const validInstalled = (installedExts || []).filter((e: any) => e.pkg && !/^\d+$/.test(e.pkg))
      setInstalled(validInstalled)
      const cat = Array.isArray(catalogRes) ? catalogRes : []
      setCatalog(cat)
      
      // Auto-switch to installed if user has installed extensions on initial load
      if (!isRefresh && validInstalled.length > 0 && activeTab === 'available') {
        setActiveTab('installed')
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load extensions')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTab])

  useEffect(() => { loadData() }, [])

  const onRefresh = () => loadData(true)

  const isInstalled = (pkg: string) => {
    return installed.some((e) => e.pkg === pkg || e.pkg.endsWith(pkg) || pkg.endsWith(e.pkg))
  }

  const validInstalled = useMemo(() => {
    return installed.filter((e) => e.pkg && !/^\d+$/.test(e.pkg))
  }, [installed])

  const filteredInstalled = useMemo(() => {
    let list = validInstalled
    if (langFilter) {
      list = list.filter((ext) => ext.lang === langFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((ext) =>
        (ext.name || '').toLowerCase().includes(q) || (ext.pkg || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [validInstalled, langFilter, searchQuery])

  const filteredCatalog = useMemo(() => {
    let list = catalog
    if (langFilter) {
      list = list.filter((ext) => ext.lang === langFilter)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((ext) =>
        (ext.name || '').toLowerCase().includes(q) || (ext.pkg || '').toLowerCase().includes(q)
      )
    }
    return list
  }, [catalog, langFilter, searchQuery])

  const installExt = async (ext: any) => {
    setInstallingPkgs((prev) => new Set(prev).add(ext.pkg))
    try {
      await DataService.installExtension(ext, 'local')
      await loadData(true)
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
      await loadData(true)
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
            {item.icon ? (
              <Image source={{ uri: item.icon }} className="w-12 h-12 rounded-xl bg-secondary" contentFit="contain" transition={150} />
            ) : (
              <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center">
                <Package size={24} color="#e11d48" />
              </View>
            )}
            <View className="flex-1 ml-3">
              <Typography className="font-semibold" numberOfLines={1}>
                {item.name || item.pkg}
              </Typography>
              <Typography className="text-xs text-muted-foreground mt-0.5">
                {flag} {langName} · v{item.version || '1.0.0'}
              </Typography>
            </View>

            {activeTab === 'installed' ? (
              <View className="flex-row items-center gap-2">
                <TouchableOpacity
                  className="p-2.5 bg-destructive/10 rounded-xl"
                  onPress={() => uninstallExt(item.pkg)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : installed_ ? (
              <View className="flex-row items-center gap-2">
                <View className="px-3 py-1.5 bg-secondary rounded-xl flex-row items-center">
                  <Check size={14} color="#10b981" />
                  <Typography className="text-xs font-semibold text-emerald-500 ml-1">
                    Installed
                  </Typography>
                </View>
                <TouchableOpacity
                  className="p-2 bg-destructive/10 rounded-xl"
                  onPress={() => uninstallExt(item.pkg)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
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

  const currentList = activeTab === 'installed' ? filteredInstalled : filteredCatalog

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={['top']}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/40 bg-background">
          <View className="flex-row items-center">
            <TouchableOpacity
              className="p-2 -ml-2 rounded-xl"
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={isDark ? '#f4f4f5' : '#09090b'} />
            </TouchableOpacity>
            <Typography variant="h1" className="ml-2 text-2xl font-black text-foreground">
              Extensions
            </Typography>
          </View>
          <TouchableOpacity
            className="px-3 py-1.5 bg-secondary/50 rounded-xl border border-border/50"
            onPress={() => router.push('/repositories' as any)}
            activeOpacity={0.7}
          >
            <Typography className="text-xs font-semibold text-primary">
              Repositories
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Main Segmented Tabs: Installed / Available */}
        <View className="flex-row mx-4 mt-3 p-1 bg-secondary/30 rounded-2xl border border-border/40">
          <TouchableOpacity
            onPress={() => setActiveTab('installed')}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row ${
              activeTab === 'installed' ? 'bg-primary' : ''
            }`}
            activeOpacity={0.8}
          >
            <Typography
              className={`font-bold text-sm ${
                activeTab === 'installed' ? 'text-white' : 'text-foreground'
              }`}
            >
              Installed
            </Typography>
            <View
              className={`ml-2 px-2 py-0.5 rounded-full ${
                activeTab === 'installed' ? 'bg-white/20' : 'bg-muted'
              }`}
            >
              <Typography
                className={`text-xs font-bold ${
                  activeTab === 'installed' ? 'text-white' : 'text-muted-foreground'
                }`}
              >
                {validInstalled.length}
              </Typography>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab('available')}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row ${
              activeTab === 'available' ? 'bg-primary' : ''
            }`}
            activeOpacity={0.8}
          >
            <Typography
              className={`font-bold text-sm ${
                activeTab === 'available' ? 'text-white' : 'text-foreground'
              }`}
            >
              Available
            </Typography>
            <View
              className={`ml-2 px-2 py-0.5 rounded-full ${
                activeTab === 'available' ? 'bg-white/20' : 'bg-muted'
              }`}
            >
              <Typography
                className={`text-xs font-bold ${
                  activeTab === 'available' ? 'text-white' : 'text-muted-foreground'
                }`}
              >
                {catalog.length}
              </Typography>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="px-4 py-2 bg-card mx-4 mt-2.5 rounded-xl border border-border flex-row items-center">
          <Search size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 ml-2 text-foreground py-1 text-sm"
            placeholder={
              activeTab === 'installed'
                ? 'Search installed extensions...'
                : 'Search available extensions...'
            }
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')} className="p-1">
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
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
                className={`px-3 py-1.5 rounded-full mr-2 ${
                  langFilter === lang || (!langFilter && lang === 'all')
                    ? 'bg-primary'
                    : 'bg-card border border-border'
                }`}
                onPress={() => setLangFilter(lang === 'all' ? null : lang)}
              >
                <Typography
                  className={`text-xs font-medium ${
                    langFilter === lang || (!langFilter && lang === 'all')
                      ? 'text-white'
                      : 'text-foreground'
                  }`}
                >
                  {LANG_FLAGS[lang] || '🌐'} {LANG_NAMES[lang] || lang}
                </Typography>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#e11d48" />
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
            data={currentList}
            keyExtractor={(item) => item.pkg}
            renderItem={renderExtItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e11d48" />}
            ListEmptyComponent={
              <View className="py-12 items-center px-6">
                <Package size={48} color="#94a3b8" />
                <Typography className="text-muted-foreground mt-4 text-center font-medium">
                  {searchQuery
                    ? 'No extensions match your search'
                    : activeTab === 'installed'
                    ? 'No extensions installed yet'
                    : 'No available extensions found'}
                </Typography>
                {activeTab === 'installed' && !searchQuery && (
                  <Button
                    title="Browse Available Extensions"
                    variant="outline"
                    className="mt-4"
                    onPress={() => setActiveTab('available')}
                  />
                )}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  )
}
