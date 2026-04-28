import { useState, useEffect, useCallback } from 'react'
import {
  View, FlatList, Image, TouchableOpacity, ActivityIndicator,
  RefreshControl
} from 'react-native'
import { router } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Typography } from '../../src/native/ui/Typography'
import { Button } from '../../src/native/ui/Button'
import { Card } from '../../src/native/ui/Card'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Download, Trash2, BookOpen, CheckCircle, AlertCircle, Loader2 } from 'lucide-react-native'
import { Manga } from '@common/types'

export default function DownloadsTab() {
  const [downloads, setDownloads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

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

  useEffect(() => { loadDownloads() }, [])

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
      case 'downloading': return <Loader2 size={16} color="#3b82f6" />
      case 'error': return <AlertCircle size={16} color="#ef4444" />
      default: return <Download size={16} color="#94a3b8" />
    }
  }

  const openManga = (mangaId: string) => {
    router.push({
      pathname: '/manga/[id]',
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
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : groupedEntries.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Download size={48} color="#94a3b8" />
          <Typography variant="h2" className="text-center mt-4">
            No downloads yet
          </Typography>
          <Typography variant="muted" className="text-center mt-2 px-8">
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
              <TouchableOpacity onPress={() => openManga(mangaId)}>
                <Typography className="font-semibold text-base mb-2">
                  {chapters[0]?.mangaTitle || mangaId.slice(0, 20)}
                </Typography>
              </TouchableOpacity>
              <View className="bg-card rounded-xl border border-border overflow-hidden">
                {chapters.map((dl: any, idx: number) => (
                  <View
                    key={dl.chapterId}
                    className={`flex-row items-center px-4 py-3 ${idx !== chapters.length - 1 ? 'border-b border-border/50' : ''}`}
                  >
                    <View className="mr-3">
                      {statusIcon(dl.status)}
                    </View>
                    <View className="flex-1">
                      <Typography className="text-sm font-medium" numberOfLines={1}>
                        Chapter {dl.chapterId?.split('-')?.pop() || dl.chapterId?.slice(0, 8) || '?'}
                      </Typography>
                      {dl.totalPages && (
                        <Typography className="text-xs text-muted-foreground">
                          {dl.totalPages} pages · {dl.mediaType}
                        </Typography>
                      )}
                    </View>
                    <TouchableOpacity
                      className="p-2"
                      onPress={() => removeDownload(mangaId, dl.chapterId)}
                    >
                      <Trash2 size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}
