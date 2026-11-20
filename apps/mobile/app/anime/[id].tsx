import { useState, useEffect } from 'react'
import {
  View, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions
} from 'react-native'
import { Image } from 'expo-image'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Typography, Button, Card, CardContent } from '@mobile/native/ui';
import { LinearGradient } from 'expo-linear-gradient'
import { ArrowLeft, Play, ChevronRight, AlignLeft } from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const HERO_HEIGHT = SCREEN_WIDTH * 1.4

export default function AnimeDetailsScreen() {
  const { id, title: paramTitle, coverUrl: paramCover, pkg, url } = useLocalSearchParams<{
    id: string
    title?: string
    coverUrl?: string
    pkg?: string
    url?: string
  }>()

  const [extCode, setExtCode] = useState<string | null>(null)
  const [descExpanded, setDescExpanded] = useState(false)
  const [description, setDescription] = useState<string>('No description available.')

  const { data: episodes, isLoading, refetch } = useQuery({
    queryKey: ['anime-episodes', id, pkg, url],
    queryFn: async () => {
      // 1. Check local DB first
      const cached = await DataService.db.getChapters(id)
      const cachedList = (cached as any)?.value || cached || []

      // If we don't have package/url info, return cached list
      if (!pkg && !url) {
        return cachedList
      }

      // 2. Fetch fresh episodes from extension if available
      try {
        let codeToUse = extCode
        if (!codeToUse && pkg) {
          const exts = await DataService.db.getExtensions()
          const extList = (exts as any)?.value || exts || []
          const found = extList.find((e: any) => e.pkg === pkg)
          if (found?.code) codeToUse = found.code
        }

        if (pkg && codeToUse) {
          const result: any = await DataService.executeExtension({
            pkg,
            code: codeToUse,
            contextArgs: {
              type: 'fetchChapters',
              mangaUrl: url || id
            }
          })

          const rawChapters: any[] =
            result?.data || result?.chapters || result?.value || (Array.isArray(result) ? result : [])

          if (Array.isArray(rawChapters) && rawChapters.length > 0) {
            const formattedEpisodes = rawChapters.map((ch: any, idx: number) => ({
              id: String(ch.id || `${id}-ep-${ch.number ?? idx + 1}`),
              number: ch.number !== undefined && !isNaN(Number(ch.number)) ? Number(ch.number) : idx + 1,
              title: ch.title || (ch.number !== undefined ? `Episode ${ch.number}` : `Episode ${idx + 1}`),
              date: ch.date || '',
              scanlator: ch.scanlator || '',
              url: ch.url || ''
            }))

            // Persist to local SQLite for offline access
            await DataService.db.saveChapters({
              mangaId: id,
              chapters: formattedEpisodes
            })

            return formattedEpisodes
          }
        }
      } catch (err) {
        console.warn('[AnimeDetails] Failed to fetch episodes from extension:', err)
      }

      return cachedList
    },
    enabled: !!id,
  })

  // Load extension code and synopsis details
  useEffect(() => {
    if (!pkg) return
    DataService.db.getExtensions()
      .then((exts: any[]) => {
        const ext = exts.find((e: any) => e.pkg === pkg)
        if (ext?.code) setExtCode(ext.code)
      })
      .catch(() => {})
  }, [pkg])

  useEffect(() => {
    if (!id) return
    DataService.db.getMangaCache(id).then(async (cached: any) => {
      const c = (cached as any)?.value || cached
      if (c?.description && c.description !== 'No description available.') {
        setDescription(c.description)
        return
      }

      if (pkg && url) {
        let codeToUse = extCode
        if (!codeToUse) {
          const exts = await DataService.db.getExtensions()
          const extList = (exts as any)?.value || exts || []
          const found = extList.find((e: any) => e.pkg === pkg)
          if (found?.code) codeToUse = found.code
        }

        if (codeToUse) {
          try {
            const res: any = await DataService.executeExtension({
              pkg,
              code: codeToUse,
              contextArgs: {
                type: 'fetchMangaDetails',
                mangaUrl: url
              }
            })
            const details = res?.data || res
            if (details?.description) {
              setDescription(details.description)
              await DataService.db.saveMangaCache({
                id,
                title: details.title || paramTitle || 'Unknown',
                coverUrl: details.coverUrl || paramCover || '',
                description: details.description,
                url,
                pkg,
                mediaType: 'anime'
              })
            }
          } catch (_) {}
        }
      }
    }).catch(() => {})
  }, [id, pkg, url, extCode, paramTitle, paramCover])

  const sortedEpisodes = episodes
    ? [...episodes].sort((a: any, b: any) => Number(a.number || 0) - Number(b.number || 0))
    : []

  const playEpisode = async (episode: any) => {
    if (!pkg) return

    DataService.db.addHistory({
      mangaId: id,
      mangaTitle: paramTitle,
      mangaCover: paramCover,
      mangaUrl: url,
      chapterId: episode.id,
      chapterTitle: episode.title || `Episode ${episode.number}`,
      startedAt: new Date().toISOString(),
      pkg,
      type: 'anime'
    }).catch(() => {})

    router.push({
      pathname: '/player/[animeId]/[episodeId]' as any,
      params: {
        animeId: id,
        episodeId: episode.id,
        pkg: pkg,
        episodeUrl: episode.url,
        episodeTitle: episode.title || `Episode ${episode.number}`,
        animeTitle: paramTitle || ''
      }
    })
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => { refetch() }} />}
      >
        {/* Hero Image */}
        <View style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}>
          {paramCover ? (
            <Image
              source={{ uri: paramCover }}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View className="flex-1 bg-card items-center justify-center">
              <Play size={64} color="#94a3b8" />
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
            title="Start Watching"
            variant="primary"
            className="flex-1"
            onPress={() => {
              if (sortedEpisodes.length > 0) playEpisode(sortedEpisodes[0])
            }}
            disabled={sortedEpisodes.length === 0}
          />
        </View>

        {/* Genres */}
        <View className="px-4 mt-4 flex-row flex-wrap gap-2">
          <View className="bg-primary/20 px-3 py-1 rounded-full">
            <Typography className="text-primary text-xs">{pkg || 'Source'}</Typography>
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
                {description}
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

        {/* Episodes */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Play size={16} color="#94a3b8" />
              <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
                Episodes
              </Typography>
            </View>
            <Typography className="text-muted-foreground text-sm">
              {sortedEpisodes.length}
            </Typography>
          </View>

          {isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#e11d48" />
            </View>
          ) : sortedEpisodes.length === 0 ? (
            <View className="py-8 items-center bg-card rounded-xl border border-border">
              <Play size={32} color="#94a3b8" />
              <Typography className="mt-2 text-muted-foreground">
                No episodes available
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
              {sortedEpisodes.map((episode: any, idx: number) => (
                <TouchableOpacity
                  key={episode.id}
                  className={`flex-row items-center px-4 py-3.5 ${idx !== sortedEpisodes.length - 1 ? 'border-b border-border/50' : ''}`}
                  onPress={() => playEpisode(episode)}
                >
                  <View className="w-8 h-8 bg-primary/20 rounded-full items-center justify-center mr-3">
                    <Play size={12} color="#e11d48" fill="#e11d48" />
                  </View>
                  <View className="flex-1">
                    <Typography className="font-medium" numberOfLines={1}>
                      {episode.title || `Episode ${episode.number}`}
                    </Typography>
                    {episode.date && (
                      <Typography className="text-xs text-muted-foreground mt-0.5">
                        {episode.date}
                      </Typography>
                    )}
                  </View>
                  <ChevronRight size={18} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  )
}
