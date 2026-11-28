import { useState, useEffect, useCallback, useMemo } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert
} from 'react-native'
import { router, useFocusEffect } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { Typography, Button } from '@mobile/native/ui'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Download, Trash2, CheckCircle, AlertCircle, Loader2, ChevronRight } from 'lucide-react-native'

export default function DownloadsTab() {
  const [downloads, setDownloads] = useState<any[]>([])
  const [mediaFilter, setMediaFilter] = useState<'all' | 'manga' | 'anime'>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeProgress, setActiveProgress] = useState<Record<string, { cached: number, total: number, status: string }>>({})

  const loadDownloads = useCallback(async (mode: 'initial' | 'refresh' | 'silent' = 'initial') => {
    if (mode === 'refresh') setRefreshing(true)
    else if (mode === 'initial') setLoading(true)
    try {
      const result = await DataService.download.getAllMangaDownloads()
      setDownloads(result || [])
    } catch (e) {
      console.error('[Downloads] Load failed:', e)
      setDownloads([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useFocusEffect(
    useCallback(() => {
      loadDownloads(downloads.length > 0 ? 'silent' : 'initial')
    }, [loadDownloads, downloads.length])
  )

  useEffect(() => {
    const api = (window as any).api
    if (api?.download?.onEvent) {
      const unsub = api.download.onEvent((data: any) => {
        if (data.type === 'progress' || data.type === 'start' || data.type === 'queued') {
          setActiveProgress(prev => ({
            ...prev,
            [`${data.mangaId}:${data.chapterId}`]: {
              cached: data.cached || 0,
              total: data.total || 0,
              status: data.type === 'queued' ? 'queued' : 'downloading'
            }
          }))
        } else if (data.type === 'completed' || data.type === 'error' || data.type === 'canceled') {
          loadDownloads('silent')
          setActiveProgress(prev => {
            const next = { ...prev }
            delete next[`${data.mangaId}:${data.chapterId}`]
            return next
          })
        }
      })
      return () => unsub()
    }
  }, [loadDownloads])

  const filteredDownloads = useMemo(() => {
    if (mediaFilter === 'all') return downloads
    return downloads.filter((d) => (d.mediaType || 'manga') === mediaFilter)
  }, [downloads, mediaFilter])

  const grouped = useMemo(() => {
    return filteredDownloads.reduce<Record<string, any[]>>((acc, d) => {
      if (!acc[d.mangaId]) acc[d.mangaId] = []
      acc[d.mangaId].push(d)
      return acc
    }, {})
  }, [filteredDownloads])

  const removeDownload = async (mangaId: string, chapterId: string) => {
    try {
      await DataService.download.remove({ mangaId, chapterId })
      loadDownloads('silent')
    } catch (e) {
      console.error('[Downloads] Remove failed:', e)
    }
  }

  const clearDownloads = () => {
    const label = mediaFilter === 'all' ? 'all downloads' : `all ${mediaFilter} downloads`
    Alert.alert('Clear Downloads', `Remove ${label} from device storage?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await DataService.download.clearAll(mediaFilter === 'all' ? undefined : mediaFilter)
            loadDownloads('silent')
          } catch (e) {
            console.error('[Downloads] Clear failed:', e)
          }
        }
      }
    ])
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle size={16} color="#22c55e" />
      case 'downloading': return <Loader2 size={16} color="#e11d48" />
      case 'error': return <AlertCircle size={16} color="#ef4444" />
      default: return <Download size={16} color="#71717a" />
    }
  }

  const openMedia = (mangaId: string, mediaType?: string) => {
    const pathname = mediaType === 'anime' ? '/anime/[id]' : '/manga/[id]'
    router.push({
      pathname: pathname as any,
      params: { id: mangaId }
    })
  }

  const openOfflineChapter = (dl: any) => {
    if (dl.mediaType === 'anime') {
      router.push({
        pathname: '/player/[animeId]/[episodeId]' as any,
        params: {
          animeId: dl.mangaId,
          episodeId: dl.chapterId,
          episodeUrl: dl.chapterId,
          episodeTitle: dl.chapterTitle || 'Episode',
          animeTitle: dl.mangaTitle || ''
        }
      })
      return
    }
    router.push({
      pathname: '/reader/[mangaId]/[chapterId]' as any,
      params: {
        mangaId: dl.mangaId,
        chapterId: dl.chapterId,
        chapterTitle: dl.chapterTitle || `Chapter ${String(dl.chapterId || '').slice(0, 8)}`,
        mangaTitle: dl.mangaTitle || ''
      }
    })
  }

  const groupedEntries = Object.entries(grouped) as [string, any[]][]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View>
          <Typography variant="h1">Downloads</Typography>
          <Typography variant="muted">
            {filteredDownloads.length} item{filteredDownloads.length !== 1 ? 's' : ''} saved
          </Typography>
        </View>
        {filteredDownloads.length > 0 && (
          <Button
            title="Clear"
            variant="ghost"
            onPress={clearDownloads}
            icon={<Trash2 size={16} color="#ef4444" />}
          />
        )}
      </View>

      {downloads.length > 0 && (
        <View className="flex-row px-4 pt-3 gap-2">
          {(
            [
              { key: 'all', label: 'All' },
              { key: 'manga', label: 'Manga' },
              { key: 'anime', label: 'Anime' }
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setMediaFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg border ${
                mediaFilter === tab.key
                  ? 'bg-primary border-primary'
                  : 'bg-card border-border'
              }`}
            >
              <Typography
                className={
                  mediaFilter === tab.key
                    ? 'text-white font-semibold text-xs'
                    : 'text-muted-foreground font-medium text-xs'
                }
              >
                {tab.label}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      ) : groupedEntries.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-2xl bg-secondary border border-border items-center justify-center mb-4">
            <Download size={28} color="#e11d48" />
          </View>
          <Typography variant="h2" className="text-center">
            No downloads yet
          </Typography>
          <Typography variant="muted" className="text-center mt-1.5 px-8">
            Downloads will appear here when you save chapters or episodes for offline viewing.
          </Typography>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={groupedEntries}
          keyExtractor={([mangaId]) => mangaId}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDownloads('refresh')} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item: [mangaId, chapters] }) => (
            <View className="mb-6">
              <TouchableOpacity
                className="flex-row items-center justify-between mb-2"
                onPress={() => openMedia(mangaId, chapters[0]?.mediaType)}
              >
                <Typography className="font-semibold text-base flex-1 mr-2" numberOfLines={1}>
                  {chapters[0]?.mangaTitle || mangaId.slice(0, 24)}
                </Typography>
                <ChevronRight size={16} color="#94a3b8" />
              </TouchableOpacity>
              <View className="bg-card rounded-xl border border-border overflow-hidden">
                {chapters.map((dl: any, idx: number) => {
                  const progressKey = `${mangaId}:${dl.chapterId}`
                  const progress = activeProgress[progressKey]
                  const status = progress ? progress.status : dl.status
                  const total = progress ? progress.total : dl.totalPages
                  const cached = progress ? progress.cached : dl.cachedPages
                  const canOpenOffline = status === 'completed'

                  return (
                    <View
                      key={dl.chapterId}
                      className={`flex-row items-center px-4 py-3 ${idx !== chapters.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <TouchableOpacity
                        className="flex-1 flex-row items-center"
                        disabled={!canOpenOffline}
                        onPress={() => openOfflineChapter(dl)}
                        activeOpacity={0.7}
                      >
                        <View className="mr-3">
                          {statusIcon(status)}
                        </View>
                        <View className="flex-1">
                          <Typography className="text-sm font-medium" numberOfLines={1}>
                            {dl.chapterTitle || `Chapter ${String(dl.chapterId || '').split('-')?.pop() || '?'}`}
                          </Typography>
                          {total > 0 && (
                            <Typography className="text-xs text-muted-foreground mt-0.5">
                              {status === 'downloading' || status === 'queued'
                                ? dl.mediaType === 'anime'
                                  ? `${cached || 0} / ${total} (${Math.round(((cached || 0) / total) * 100)}%)`
                                  : `${cached || 0} / ${total} pages (${Math.round(((cached || 0) / total) * 100)}%)`
                                : dl.mediaType === 'anime'
                                  ? 'Saved offline · Tap to watch'
                                  : `${total} pages · Tap to read offline`}
                            </Typography>
                          )}
                          {(status === 'downloading' || status === 'queued') && total > 0 && (
                            <View className="h-1 bg-border rounded-full mt-1.5 overflow-hidden">
                              <View
                                className="h-full bg-primary"
                                style={{ width: `${((cached || 0) / total) * 100}%` }}
                              />
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="p-2 ml-2"
                        onPress={() => removeDownload(mangaId, dl.chapterId)}
                      >
                        <Trash2 size={16} color="#ef4444" />
                      </TouchableOpacity>
                    </View>
                  )
                })}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}
