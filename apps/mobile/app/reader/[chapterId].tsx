import { useEffect, useState } from 'react'
import { View, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import { Typography, Button } from '@mobile/native/ui'
import { AlertTriangle } from 'lucide-react-native'
import { MobileDB } from '../../src/mobile/db.native'

export default function ReaderChapterShimScreen() {
  const params = useLocalSearchParams<{
    chapterId: string
    mangaId?: string
    pkg?: string
    chapterUrl?: string
    chapterTitle?: string
    mangaTitle?: string
  }>()

  const { chapterId, mangaId } = params
  const [resolving, setResolving] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function resolveRoute() {
      if (!chapterId) {
        if (isMounted) {
          setError('Missing chapter ID')
          setResolving(false)
        }
        return
      }

      // If mangaId is already provided, redirect immediately
      if (mangaId) {
        router.replace({
          pathname: '/reader/[mangaId]/[chapterId]' as any,
          params: { ...params, mangaId, chapterId }
        })
        return
      }

      // Look up chapter in local database to find its manga_id
      try {
        await MobileDB.ensureReady()
        const db = (MobileDB as any).db
        if (db) {
          const row = await db.getFirstAsync(
            'SELECT manga_id, url, title, number FROM chapters WHERE id = ?;',
            [chapterId]
          )
          if (row && row.manga_id) {
            router.replace({
              pathname: '/reader/[mangaId]/[chapterId]' as any,
              params: {
                ...params,
                mangaId: row.manga_id,
                chapterId,
                chapterUrl: params.chapterUrl || row.url,
                chapterTitle: params.chapterTitle || row.title || `Chapter ${row.number}`
              }
            })
            return
          }
        }
      } catch (err: any) {
        console.error('[ReaderChapterShim] Failed to look up chapter:', err)
      }

      if (isMounted) {
        setError('Chapter details could not be resolved')
        setResolving(false)
      }
    }

    resolveRoute()

    return () => {
      isMounted = false
    }
  }, [chapterId, mangaId])

  return (
    <View className="flex-1 bg-black items-center justify-center px-6">
      <Stack.Screen options={{ headerShown: false }} />
      {resolving ? (
        <View className="items-center">
          <ActivityIndicator size="large" color="#e11d48" />
          <Typography className="text-white/60 mt-4 text-sm">
            Opening reader...
          </Typography>
        </View>
      ) : (
        <View className="items-center">
          <AlertTriangle size={48} color="#ef4444" />
          <Typography className="text-white text-lg font-semibold mt-4 text-center">
            {error || 'Chapter Not Found'}
          </Typography>
          <Typography className="text-white/60 mt-2 text-center text-sm">
            Unable to load the requested chapter.
          </Typography>
          <Button
            title="Go Back"
            variant="outline"
            className="mt-6"
            onPress={() => router.back()}
          />
        </View>
      )}
    </View>
  )
}
