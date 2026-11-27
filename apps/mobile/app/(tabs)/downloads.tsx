import { useState, useEffect, useCallback } from 'react'
import {
  View, FlatList, TouchableOpacity, ActivityIndicator,
  RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Typography, Button, Card } from '@mobile/native/ui';
import { SafeAreaView } from 'react-native-safe-area-context'
import { Download, Trash2, BookOpen, CheckCircle, AlertCircle, Loader2 } from 'lucide-react-native'
import { Manga } from '@common/types'

export default function DownloadsTab() {
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeProgress, setActiveProgress] = useState<Record<string, { cached: number, total: number, status: string }>>({})

  const loadDownloads = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
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

  useEffect(() => {
    loadDownloads()
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
          loadDownloads()
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

  const grouped = downloads.reduce<Record<string, any[]>>((acc, d) => {
    if (!acc[d.mangaId]) acc[d.mangaId] = []
    acc[d.mangaId].push(d)
    return acc
  }, {})

  const removeDownload = async (mangaId: string, chapterId: string) => {
    try {
      await DataService.download.remove({ mangaId, chapterId })
      loadDownloads()
    } catch (e) {
      console.error('[Downloads] Remove failed:', e)
    }
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

  const groupedEntries = Object.entries(grouped) as [string, any[]][]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border">
        <Typography variant="h1">Downloads</Typography>
        <Typography variant="muted">
          {downloads.length} chapter{downloads.length !== 1 ? 's' : ''} downloaded
        </Typography>
      </View>

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
            Downloads will appear here when you save chapters for offline reading.
          </Typography>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={groupedEntries}
          keyExtractor={([mangaId]) => mangaId}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDownloads(true)} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item: [mangaId, chapters] }) => (
            <View className="mb-6">
              <TouchableOpacity onPress={() => openMedia(mangaId, chapters[0]?.mediaType)}>
                <Typography className="font-semibold text-base mb-2">
                  {chapters[0]?.mangaTitle || mangaId.slice(0, 20)}
                </Typography>
              </TouchableOpacity>
              <View className="bg-card rounded-xl border border-border overflow-hidden">
                {chapters.map((dl: any, idx: number) => {
                  const progressKey = `${mangaId}:${dl.chapterId}`
                  const progress = activeProgress[progressKey]
                  const status = progress ? progress.status : dl.status
                  const total = progress ? progress.total : dl.totalPages
                  const cached = progress ? progress.cached : dl.cachedPages

                  return (
                    <View
                      key={dl.chapterId}
                      className={`flex-row items-center px-4 py-3 ${idx !== chapters.length - 1 ? 'border-b border-border/50' : ''}`}
                    >
                      <View className="mr-3">
                        {statusIcon(status)}
                      </View>
                      <View className="flex-1">
                        <Typography className="text-sm font-medium" numberOfLines={1}>
                          Chapter {dl.chapterId?.split('-')?.pop() || dl.chapterId?.slice(0, 8) || '?'}
                        </Typography>
                        {total > 0 && (
                          <Typography className="text-xs text-muted-foreground mt-0.5">
                            {status === 'downloading' || status === 'queued'
                              ? `${cached || 0} / ${total} pages (${Math.round(((cached || 0) / total) * 100)}%)`
                              : `${total} pages`}
                            {' · '}{dl.mediaType}
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
