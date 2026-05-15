import { useState, useEffect } from 'react'
import {
  View, ScrollView, Image, TouchableOpacity, ActivityIndicator,
  RefreshControl, Dimensions
} from 'react-native'
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

  const { data: episodes, isLoading, refetch } = useQuery({
    queryKey: ['anime-episodes', id],
    queryFn: () => DataService.db.getChapters(id),
    enabled: !!id,
  })

  useEffect(() => {
    if (!pkg) return
    DataService.db.getExtensions()
      .then((exts: any[]) => {
        const ext = exts.find((e: any) => e.pkg === pkg)
        if (ext?.code) setExtCode(ext.code)
      })
      .catch(() => {})
  }, [pkg])

  const sortedEpisodes = episodes
    ? [...episodes].sort((a: any, b: any) => Number(a.number || 0) - Number(b.number || 0))
    : []

  const playEpisode = async (episode: any) => {
    if (!pkg || !extCode) return

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
      pathname: '/player/[animeId]/[episodeId]',
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
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
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
                No description available.
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
              <ActivityIndicator size="large" color="#3b82f6" />
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
                    <Play size={12} color="#3b82f6" fill="#3b82f6" />
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
