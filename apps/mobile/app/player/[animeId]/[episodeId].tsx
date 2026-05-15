import { useEffect, useState } from 'react'
import { View, ActivityIndicator, TouchableOpacity } from 'react-native'
import { useLocalSearchParams, router, Stack } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { Typography, Button } from '@mobile/native/ui';
import { DataService } from '@renderer/shared/api'
import { ArrowLeft, AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react-native'

export default function PlayerScreen() {
  const { animeId, episodeId, pkg, episodeUrl, episodeTitle, animeTitle } =
    useLocalSearchParams<{
      animeId: string
      episodeId: string
      pkg?: string
      episodeUrl?: string
      episodeTitle?: string
      animeTitle?: string
    }>()

  const [status, setStatus] = useState<'loading' | 'opening' | 'error' | 'done'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [streamUrl, setStreamUrl] = useState<string | null>(null)

  const fetchStream = async () => {
    if (!pkg || !episodeUrl) {
      setStatus('error')
      setErrorMsg('Missing extension or URL')
      return
    }

    setStatus('loading')
    try {
      const allExts = await DataService.db.getExtensions()
      const ext = allExts.find((e: any) => e.pkg === pkg)
      if (!ext?.code) throw new Error('Extension not found')

      const result = await DataService.executeExtension({
        pkg,
        code: ext.code,
        contextArgs: { type: 'fetchPages', chapterUrl: episodeUrl }
      })

      const urls: string[] = result?.pages || result?.data || []
      if (urls.length === 0) throw new Error('No stream URLs returned')

      const targetUrl = urls[0]
      setStreamUrl(targetUrl)
      setStatus('opening')

      await WebBrowser.openBrowserAsync(targetUrl, {
        toolbarColor: '#09090b',
        controlsColor: '#ffffff'
      })

      setStatus('done')
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message || 'Failed to load stream')
    }
  }

  useEffect(() => {
    fetchStream()
  }, [])

  const retry = () => {
    setStatus('loading')
    setErrorMsg('')
    fetchStream()
  }

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
              {episodeTitle || 'Episode'}
            </Typography>
            <Typography className="text-white/60 text-xs" numberOfLines={1}>
              {animeTitle || ''}
            </Typography>
          </View>
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 items-center justify-center px-8">
        {status === 'loading' ? (
          <>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Typography className="text-white/60 mt-4 text-center">
              Loading stream...
            </Typography>
          </>
        ) : status === 'opening' ? (
          <>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Typography className="text-white/60 mt-4 text-center">
              Opening in browser...
            </Typography>
            <Button
              title="Tap to Open Manually"
              variant="outline"
              className="mt-4"
              onPress={async () => {
                if (streamUrl) {
                  await WebBrowser.openBrowserAsync(streamUrl, {
                    toolbarColor: '#09090b',
                    controlsColor: '#ffffff'
                  })
                }
              }}
              icon={<ExternalLink size={16} color="#fff" />}
            />
          </>
        ) : status === 'error' ? (
          <>
            <AlertTriangle size={48} color="#ef4444" />
            <Typography className="text-white text-lg font-semibold mt-4 text-center">
              Failed to load stream
            </Typography>
            <Typography className="text-white/60 mt-2 text-center text-sm">
              {errorMsg}
            </Typography>
            <View className="flex-row gap-3 mt-6">
              <Button
                title="Retry"
                variant="primary"
                onPress={retry}
                icon={<RefreshCw size={16} color="#fff" />}
              />
              <Button
                title="Go Back"
                variant="outline"
                onPress={() => router.back()}
              />
            </View>
          </>
        ) : (
          <>
            <ExternalLink size={48} color="#22c55e" />
            <Typography className="text-white text-lg font-semibold mt-4 text-center">
              Stream opened
            </Typography>
            <Typography className="text-white/60 mt-2 text-center">
              The video should be playing in your browser.
            </Typography>
            <Button
              title="Done"
              variant="primary"
              className="mt-6"
              onPress={() => router.back()}
            />
          </>
        )}
      </View>
    </View>
  )
}
