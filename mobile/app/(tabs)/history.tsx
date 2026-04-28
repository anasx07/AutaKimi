import { useState, useEffect, useCallback } from 'react'
import {
  View, FlatList, Image, TouchableOpacity, ActivityIndicator,
  RefreshControl, Alert
} from 'react-native'
import { router } from 'expo-router'
import { DataService } from '@renderer/shared/api'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { Typography } from '../../src/native/ui/Typography'
import { Button } from '../../src/native/ui/Button'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Clock, Trash2, BookOpen, Play, ChevronRight } from 'lucide-react-native'

function groupByDate(entries: any[]) {
  const groups: Record<string, any[]> = {}
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  for (const entry of entries) {
    const date = entry.startedAt ? new Date(entry.startedAt) : new Date()
    let label: string
    if (date.toDateString() === today.toDateString()) label = 'Today'
    else if (date.toDateString() === yesterday.toDateString()) label = 'Yesterday'
    else label = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
    if (!groups[label]) groups[label] = []
    groups[label].push(entry)
  }
  return groups
}

export default function HistoryTab() {
  const [entries, setEntries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    try {
      const [result] = await Promise.all([
        DataService.db.getHistory({ limit: 100 })
      ])
      // Normalize snake_case DB columns to camelCase
      const normalized = (result || []).map((e: any) => ({
        id: e.id ?? e.Id,
        mangaId: e.mangaId || e.manga_id,
        mangaTitle: e.mangaTitle || e.manga_title,
        mangaCover: e.mangaCover || e.manga_cover,
        mangaUrl: e.mangaUrl || e.manga_url,
        chapterId: e.chapterId || e.chapter_id,
        chapterTitle: e.chapterTitle || e.chapter_title,
        startedAt: e.startedAt || e.started_at,
        durationSeconds: e.durationSeconds ?? e.duration_seconds,
        pkg: e.pkg,
        type: e.type
      }))
      setEntries(normalized)
    } catch (e) {
      console.error('[History] Load failed:', e)
      setEntries([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { loadHistory() }, [])

  const groups = groupByDate(entries)

  const deleteEntry = async (id: number) => {
    try {
      await DataService.db.deleteHistoryEntry(id)
      loadHistory()
    } catch (e) {
      console.error('[History] Delete failed:', e)
    }
  }

  const clearAll = () => {
    Alert.alert('Clear History', 'Clear all reading history?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          try {
            await DataService.db.clearHistory()
            loadHistory()
          } catch (e) {
            console.error('[History] Clear failed:', e)
          }
        }
      }
    ])
  }

  const openManga = (entry: any) => {
    router.push({
      pathname: '/manga/[id]',
      params: {
        id: entry.mangaId,
        title: entry.mangaTitle,
        coverUrl: entry.mangaCover,
        pkg: entry.pkg || '',
        url: entry.mangaUrl || ''
      }
    })
  }

  const groupEntries = Object.entries(groups) as [string, any[]][]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View>
          <Typography variant="h1">History</Typography>
          <Typography variant="muted">
            {entries.length} chapter{entries.length !== 1 ? 's' : ''} read
          </Typography>
        </View>
        {entries.length > 0 && (
          <Button
            title="Clear"
            variant="ghost"
            onPress={clearAll}
            icon={<Trash2 size={16} color="#ef4444" />}
          />
        )}
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : entries.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <Clock size={48} color="#94a3b8" />
          <Typography variant="h2" className="text-center mt-4">
            No reading history
          </Typography>
          <Typography variant="muted" className="text-center mt-2 px-8">
            Your recently read chapters will appear here.
          </Typography>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={groupEntries}
          keyExtractor={([date]) => date}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadHistory(true)} />}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item: [dateLabel, dateEntries] }) => (
            <View className="mb-4">
              <Typography className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-2 px-1">
                {dateLabel}
              </Typography>
              <View className="bg-card rounded-xl border border-border overflow-hidden">
                {dateEntries.map((entry: any, idx: number) => (
                  <TouchableOpacity
                    key={entry.id || idx}
                    className={`flex-row items-center px-3 py-3 ${idx !== dateEntries.length - 1 ? 'border-b border-border/50' : ''}`}
                    onPress={() => openManga(entry)}
                  >
                    {entry.mangaCover ? (
                      <Image
                        source={{ uri: entry.mangaCover }}
                        className="w-12 h-16 rounded-lg"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="w-12 h-16 rounded-lg bg-card items-center justify-center">
                        <BookOpen size={20} color="#94a3b8" />
                      </View>
                    )}
                    <View className="flex-1 ml-3">
                      <Typography className="font-medium text-sm" numberOfLines={1}>
                        {entry.mangaTitle || 'Unknown'}
                      </Typography>
                      <Typography className="text-xs text-muted-foreground mt-0.5">
                        {entry.chapterTitle || `Chapter ${entry.chapterId?.slice(0, 8)}`}
                      </Typography>
                      {entry.startedAt && (
                        <Typography className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(entry.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </Typography>
                      )}
                    </View>
                    <View className="flex-row items-center gap-2">
                      <ChevronRight size={16} color="#94a3b8" />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  )
}
