import { useState, useEffect } from 'react'
import {
  View, ScrollView, Image, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Typography } from '../../../src/native/ui/Typography'
import { Button } from '../../../src/native/ui/Button'
import { Card, CardContent } from '../../../src/native/ui/Card'
import { LinearGradient } from 'expo-linear-gradient'
import {
  ArrowLeft, BookOpen, ChevronRight, AlignLeft,
  Download, CheckCircle, Loader2
} from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { Chapter } from '@common/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_WIDTH * 1.4

export default function MangaDetailsScreen() {
  const { id, title: paramTitle, coverUrl: paramCover, pkg, url } = useLocalSearchParams<{
    id: string
    title?: string
    coverUrl?: string
    pkg?: string
    url?: string
  }>()

  const [descExpanded, setDescExpanded] = useState(false)
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, string>>({})
  const [downloadingChapters, setDownloadingChapters] = useState<Set<string>>(new Set())
  const [extCode, setExtCode] = useState<string | null>(null)

  const { data: chapters, isLoading: chaptersLoading, refetch } = useQuery({
    queryKey: ['manga-chapters', id],
    queryFn: () => DataService.db.getChapters(id),
    enabled: !!id,
  })

  useEffect(() => {
    if (pkg && id) {
      DataService.db.getMangaCache(id).catch(() => {})
    }
  }, [id, pkg])

  useEffect(() => {
    if (!pkg) return
    DataService.db.getExtensions().then((exts: any[]) => {
      const ext = exts.find((e: any) => e.pkg === pkg)
      if (ext?.code) setExtCode(ext.code)
    }).catch(() => {})
  }, [pkg])

  useEffect(() => {
    if (!id) return
    DataService.download.getMangaDownloads(id)
      .then((result: any[]) => {
        const statuses: Record<string, string> = {}
        for (const dl of result || []) {
          statuses[dl.chapterId] = dl.status
        }
        setDownloadStatuses(statuses)
      })
      .catch(() => {})
  }, [id])

  const addHistory = useMutation({
    mutationFn: (chapter: { id: string; title?: string; url?: string }) =>
      DataService.db.addHistory({
        mangaId: id,
        mangaTitle: paramTitle,
        mangaCover: paramCover,
        mangaUrl: url,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        startedAt: new Date().toISOString(),
        pkg: pkg,
        type: 'manga'
      })
  })

  const sortedChapters = chapters
    ? [...chapters].sort((a, b) => Number(b.number || 0) - Number(a.number || 0))
    : []

  const openReader = (chapter: Chapter) => {
    addHistory.mutate(chapter)
    router.push({
      pathname: '/reader/[mangaId]/[chapterId]',
      params: {
        mangaId: id,
        chapterId: chapter.id,
        pkg: pkg || '',
        chapterUrl: chapter.url,
        chapterTitle: chapter.title || `Ch. ${chapter.number}`,
        mangaTitle: paramTitle || ''
      }
    })
  }

  const downloadChapter = async (chapter: Chapter) => {
    if (!pkg || !extCode) return
    const chapterId = chapter.id
    if (downloadingChapters.has(chapterId)) return
    if (downloadStatuses[chapterId] === 'completed') return

    setDownloadingChapters(prev => new Set(prev).add(chapterId))
    setDownloadStatuses(prev => ({ ...prev, [chapterId]: 'downloading' }))

    try {
      const result = await DataService.executeExtension({
        pkg,
        code: extCode,
        contextArgs: { type: 'fetchPages', chapterUrl: chapter.url }
      })
      const pageUrls: string[] = result?.pages || result?.data || []
      if (pageUrls.length === 0) throw new Error('No pages returned')

      await DataService.download.start({
        mangaId: id,
        chapterId,
        pageUrls,
        type: 'manga',
        mangaTitle: paramTitle,
        chapterTitle: chapter.title || `Ch. ${chapter.number}`
      })

      setDownloadStatuses(prev => ({ ...prev, [chapterId]: 'completed' }))
    } catch (e) {
      console.error('[MangaDetails] Download failed:', e)
      setDownloadStatuses(prev => ({ ...prev, [chapterId]: 'error' }))
    } finally {
      setDownloadingChapters(prev => {
        const next = new Set(prev)
        next.delete(chapterId)
        return next
      })
    }
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={chaptersLoading} onRefresh={refetch} />}
      >
        {/* Hero Image */}
        <View style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}>
          {paramCover ? (
            <Image
              source={{ uri: paramCover }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              resizeMode="cover"
            />
          ) : (
            <View className="flex-1 bg-card items-center justify-center">
              <BookOpen size={64} color="#94a3b8" />
            </View>
          )}
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: HERO_HEIGHT * 0.5 }}
          />
          <TouchableOpacity
            className="absolute top-12 left-4 z-10 bg-black/40 rounded-full p-2"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View className="px-4 -mt-16 relative z-10">
          <Typography className="text-white text-2xl font-bold mb-1" numberOfLines={3}>
            {paramTitle || 'Unknown'}
          </Typography>
        </View>

        {/* Quick Actions */}
        <View className="px-4 mt-4 flex-row gap-3">
          <Button
            title="Start Reading"
            variant="primary"
            className="flex-1"
            onPress={() => {
              if (sortedChapters.length > 0) openReader(sortedChapters[0])
            }}
            disabled={sortedChapters.length === 0}
          />
        </View>

        {/* Genres */}
        <View className="px-4 mt-4 flex-row flex-wrap gap-2">
          <View className="bg-primary/20 px-3 py-1 rounded-full">
            <Typography className="text-primary text-xs">{pkg || 'Extension'}</Typography>
          </View>
        </View>

        {/* Description */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center mb-2">
            <AlignLeft size={16} color="#94a3b8" />
            <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
              Synopsis
            </Typography>
          </View>
          <Card>
            <CardContent>
              <Typography
                className="leading-relaxed"
                numberOfLines={descExpanded ? undefined : 4}
              >
                {'No description available.'}
              </Typography>
              <TouchableOpacity
                className="mt-2"
                onPress={() => setDescExpanded(!descExpanded)}
              >
                <Typography className="text-primary text-sm">
                  {descExpanded ? 'Show less' : 'Read more'}
                </Typography>
              </TouchableOpacity>
            </CardContent>
          </Card>
        </View>

        {/* Chapters */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <BookOpen size={16} color="#94a3b8" />
              <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
                Chapters
              </Typography>
            </View>
            <Typography className="text-muted-foreground text-sm">
              {sortedChapters.length}
            </Typography>
          </View>

          {chaptersLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#3b82f6" />
            </View>
          ) : sortedChapters.length === 0 ? (
            <View className="py-8 items-center bg-card rounded-xl border border-border">
              <BookOpen size={32} color="#94a3b8" />
              <Typography className="mt-2 text-muted-foreground">
                No chapters available
              </Typography>
              <Button
                title="Refresh"
                variant="outline"
                className="mt-4"
                onPress={() => refetch()}
              />
            </View>
          ) : (
            <View className="bg-card rounded-xl border border-border overflow-hidden">
              {sortedChapters.map((chapter, idx) => {
                const dlStatus = downloadStatuses[chapter.id]
                const isDownloading = downloadingChapters.has(chapter.id)
                return (
                  <View
                    key={chapter.id}
                    className={`flex-row items-center px-4 py-3.5 ${idx !== sortedChapters.length - 1 ? 'border-b border-border/50' : ''}`}
                  >
                    <TouchableOpacity
                      className="flex-1 flex-row items-center"
                      onPress={() => openReader(chapter)}
                    >
                      <View className="flex-1">
                        <Typography className="font-medium" numberOfLines={1}>
                          {chapter.title || `Chapter ${chapter.number}`}
                        </Typography>
                        {chapter.date && (
                          <Typography className="text-xs text-muted-foreground mt-0.5">
                            {chapter.date}
                          </Typography>
                        )}
                      </View>
                      <ChevronRight size={18} color="#94a3b8" />
                    </TouchableOpacity>
                    <View className="ml-2">
                      {dlStatus === 'completed' ? (
                        <CheckCircle size={18} color="#22c55e" />
                      ) : isDownloading ? (
                        <Loader2 size={18} color="#3b82f6" />
                      ) : (
                        <TouchableOpacity
                          onPress={() => downloadChapter(chapter)}
                          className="p-1"
                        >
                          <Download size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
