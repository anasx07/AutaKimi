import { useState, useCallback, useEffect, useRef } from 'react'
import {
  View, FlatList, Image, TouchableOpacity, ActivityIndicator,
  Dimensions, TouchableWithoutFeedback, ViewToken
} from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import * as FileSystem from 'expo-file-system/legacy'
import { useQuery } from '@tanstack/react-query'
import { Typography, Button } from '@mobile/native/ui';
import { DataService } from '@renderer/shared/api'
import { ArrowLeft, AlertTriangle, Loader2 } from 'lucide-react-native'

const { width: SCREEN_WIDTH } = Dimensions.get('window')

// --- ReaderImage Component ---
const ReaderImage = ({ url, index }: { url: string, index: number }) => {
  const [imgHeight, setImgHeight] = useState<number>(SCREEN_WIDTH * 1.4)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let isMounted = true
    Image.getSize(
      url,
      (w, h) => {
        if (isMounted) {
          setImgHeight(SCREEN_WIDTH * (h / w))
          setLoading(false)
        }
      },
      () => {
        if (isMounted) {
          setError(true)
          setLoading(false)
        }
      }
    )
    return () => { isMounted = false }
  }, [url])

  if (error) {
    return (
      <View
        style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.4 }}
        className="bg-zinc-900 items-center justify-center"
      >
        <AlertTriangle size={24} color="#666" />
        <Typography className="text-zinc-500 text-xs mt-2">
          Page {index + 1} Failed
        </Typography>
      </View>
    )
  }

  return (
    <View style={{ width: SCREEN_WIDTH, height: imgHeight }} className="bg-black justify-center items-center">
      {loading && (
        <View className="absolute inset-0 items-center justify-center">
           <ActivityIndicator size="small" color="#333" />
        </View>
      )}
      <Image
        source={{ uri: url }}
        style={{ width: SCREEN_WIDTH, height: imgHeight }}
        resizeMode="contain"
      />
    </View>
  )
}


// --- Main Reader Screen ---
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

  const [showUI, setShowUI] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const listRef = useRef<FlatList>(null)

  // 1. Fetch Pages
  const { data: pages, isLoading, error } = useQuery({
    queryKey: ['chapter-pages', mangaId, chapterId],
    queryFn: async (): Promise<string[]> => {
      // 1. Check offline downloaded files
      try {
        const targetDirSub = `manga/${mangaId}/${chapterId}`
        const targetDirUri = `${FileSystem.documentDirectory}Downloads/${targetDirSub}/`
        const dirInfo = await FileSystem.getInfoAsync(targetDirUri)
        
        if (dirInfo.exists) {
          const files = await FileSystem.readDirectoryAsync(targetDirUri)
          const imageFiles = files.filter(f => f.endsWith('.jpg')).sort()
          if (imageFiles.length > 0) {
            console.log(`[Reader] Loaded ${imageFiles.length} pages offline from ${targetDirUri}`)
            return imageFiles.map(f => `${targetDirUri}${f}`)
          }
        }
      } catch (err) {
        console.log('[Reader] Offline check failed or directory empty:', err)
      }

      // 2. Fallback to network extension
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

  // 2. Fetch Chapters for Navigation
  const { data: allChapters } = useQuery({
    queryKey: ['manga-chapters', mangaId],
    queryFn: () => DataService.db.getChapters(mangaId),
    enabled: !!mangaId,
  })

  // Find next/prev chapters
  const sortedChapters = allChapters 
    ? [...allChapters].sort((a, b) => Number(a.number || 0) - Number(b.number || 0)) // Ascending order
    : []
  
  const currentChapterIndex = sortedChapters.findIndex(c => c.id === chapterId)
  const nextChapter = currentChapterIndex >= 0 && currentChapterIndex < sortedChapters.length - 1 ? sortedChapters[currentChapterIndex + 1] : null

  // 3. Viewability tracking for progress
  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
    minimumViewTime: 100,
  }).current

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0) {
      const firstVisible = viewableItems[0]
      const pageNum = (firstVisible.index || 0) + 1
      setCurrentPage(pageNum)

      // Save progress to DB
      if (pages) {
         DataService.db.updateProgress({
           mangaId,
           chapterId,
           isRead: pageNum === pages.length,
           lastPage: pageNum
         }).catch(console.error)
      }
    }
  }).current

  const toggleUI = () => setShowUI(prev => !prev)

  const handleNextChapter = () => {
    if (!nextChapter) return
    router.replace({
      pathname: '/reader/[mangaId]/[chapterId]' as any,
      params: {
        mangaId,
        chapterId: nextChapter.id,
        pkg: pkg || '',
        chapterUrl: nextChapter.url,
        chapterTitle: nextChapter.title || `Ch. ${nextChapter.number}`,
        mangaTitle: mangaTitle || ''
      }
    })
  }

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      {showUI && (
        <View className="absolute top-0 left-0 right-0 z-20 bg-black/80 pb-4">
          <View className="flex-row items-center px-4 py-2 pt-12">
            <TouchableOpacity
              className="p-2 -ml-2 rounded-full"
              onPress={() => router.back()}
            >
              <ArrowLeft size={24} color="#fff" />
            </TouchableOpacity>
            <View className="flex-1 ml-3">
              <Typography className="text-white text-base font-semibold" numberOfLines={1}>
                {chapterTitle || 'Chapter'}
              </Typography>
              <Typography className="text-white/70 text-xs" numberOfLines={1}>
                {mangaTitle || ''}
              </Typography>
            </View>
          </View>
        </View>
      )}

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
          <Button
             title="Go Back"
             className="mt-6"
             onPress={() => router.back()}
          />
        </View>
      ) : (
        <TouchableWithoutFeedback onPress={toggleUI}>
          <View className="flex-1">
            <FlatList
              ref={listRef}
              data={pages}
              keyExtractor={(item, index) => `${index}`}
              renderItem={({ item, index }) => <ReaderImage url={item} index={index} />}
              showsVerticalScrollIndicator={false}
              windowSize={5}
              initialNumToRender={3}
              maxToRenderPerBatch={3}
              onViewableItemsChanged={onViewableItemsChanged}
              viewabilityConfig={viewabilityConfig}
              ListFooterComponent={() => (
                 <View className="py-16 px-6 items-center">
                   <Typography className="text-white/40 text-sm mb-6">
                     End of chapter
                   </Typography>
                   {nextChapter ? (
                     <Button 
                       title={`Next: ${nextChapter.title || 'Ch. ' + nextChapter.number}`}
                       variant="primary"
                       onPress={handleNextChapter}
                       className="w-full"
                     />
                   ) : (
                     <Typography className="text-white/60">
                       No more chapters
                     </Typography>
                   )}
                 </View>
              )}
            />
          </View>
        </TouchableWithoutFeedback>
      )}

      {/* Footer */}
      {showUI && pages && !isLoading && !error && (
        <View className="absolute bottom-0 left-0 right-0 z-20 bg-black/80 pb-8 pt-4 px-6 flex-row items-center justify-center">
          <Typography className="text-white font-medium">
             Page {currentPage} / {pages.length}
          </Typography>
        </View>
      )}
    </View>
  )
}
