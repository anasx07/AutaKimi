import { useState, useCallback } from 'react'
import {
  View, ScrollView, Image, TouchableOpacity, ActivityIndicator,
  Dimensions
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { Typography } from '../../../src/native/ui/Typography'
import { DataService } from '@renderer/shared/api'
import { ArrowLeft, AlertTriangle } from 'lucide-react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

export default function ReaderScreen() {
  const { mangaId, chapterId, pkg, chapterUrl, chapterTitle, mangaTitle } =
    useLocalSearchParams<{
      mangaId: string
      chapterId: string
      pkg?: string
      chapterUrl?: string
      chapterTitle?: string
      mangaTitle?: string
    }>()

  const { data: pages, isLoading, error } = useQuery({
    queryKey: ['chapter-pages', mangaId, chapterId],
    queryFn: async (): Promise<string[]> => {
      if (!pkg || !chapterUrl) throw new Error('Missing extension info')

      const allExts = await DataService.db.getExtensions()
      const ext = allExts.find((e: any) => e.pkg === pkg)
      if (!ext?.code) throw new Error('Extension not found or missing code')

      const result = await DataService.executeExtension({
        pkg: pkg,
        code: ext.code,
        contextArgs: { type: 'fetchPages', chapterUrl }
      })

      const urls: string[] = result?.pages || result?.data || []
      if (urls.length === 0) throw new Error('No pages returned')
      return urls
    },
    enabled: !!pkg && !!chapterUrl,
    staleTime: 1000 * 60 * 60,
    retry: 2,
  })

  const [imgErrors, setImgErrors] = useState<Set<number>>(new Set())

  const handleImageLoadError = useCallback((idx: number) => {
    setImgErrors(prev => new Set(prev).add(idx))
  }, [])

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="absolute top-0 left-0 right-0 z-20 bg-black/60">
        <View className="flex-row items-center px-2 py-2 pt-10">
          <TouchableOpacity
            className="p-2 rounded-full"
            onPress={() => router.back()}
          >
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View className="flex-1 ml-2">
            <Typography className="text-white text-sm font-medium" numberOfLines={1}>
              {chapterTitle || `Chapter`}
            </Typography>
            <Typography className="text-white/60 text-xs" numberOfLines={1}>
              {mangaTitle || ''}
            </Typography>
          </View>
        </View>
      </View>

      {/* Content */}
      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
          <Typography className="text-white/60 mt-4">
            Loading pages...
          </Typography>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-8">
          <AlertTriangle size={48} color="#ef4444" />
          <Typography className="text-white text-lg font-semibold mt-4 text-center">
            Failed to load pages
          </Typography>
          <Typography className="text-white/60 mt-2 text-center">
            {(error as Error)?.message || 'An error occurred'}
          </Typography>
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingTop: 80, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {pages?.map((url, idx) => (
            <View key={`${idx}`} className="mb-0.5">
              {imgErrors.has(idx) ? (
                <View
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.4 }}
                  className="bg-zinc-900 items-center justify-center"
                >
                  <AlertTriangle size={24} color="#666" />
                  <Typography className="text-zinc-500 text-xs mt-2">
                    Page {idx + 1}
                  </Typography>
                </View>
              ) : (
                <Image
                  source={{ uri: url }}
                  style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.4 }}
                  resizeMode="contain"
                  onError={() => handleImageLoadError(idx)}
                />
              )}
            </View>
          ))}

          {/* End of chapter */}
          <View className="py-8 items-center">
            <Typography className="text-white/40 text-sm">
              End of chapter
            </Typography>
          </View>
        </ScrollView>
      )}
    </View>
  )
}
