import React, { useState } from 'react'
import { View, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Typography } from '../ui/Typography'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Trash2, BookOpen, Play, Search, LayoutGrid, List } from 'lucide-react-native'
import { useInfiniteLibraryItems } from '@renderer/entities/manga/api/useMangaQueries'
import { normalizeManga } from '@common/utils/mangaNormalizer'
import { SafeAreaView } from 'react-native-safe-area-context'

export const LibraryScreen = () => {
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useInfiniteLibraryItems(activeTab)

  const allItems = data?.pages?.flat() || []

  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const norm = normalizeManga(item)

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity className="flex-1 m-2">
          <Card className="aspect-[2/3]">
            <Image source={{ uri: norm.coverUrl }} className="flex-1" resizeMode="cover" />
            <View className="absolute bottom-0 left-0 right-0 p-2 bg-black/60">
              <Typography className="text-white text-xs font-semibold" numberOfLines={2}>
                {norm.title}
              </Typography>
            </View>
          </Card>
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity className="flex-row items-center p-3 border-b border-border">
        <Image
          source={{ uri: norm.coverUrl }}
          className="w-16 h-24 rounded-md"
          resizeMode="cover"
        />
        <View className="flex-1 ml-4">
          <Typography variant="h3" numberOfLines={2}>
            {norm.title}
          </Typography>
          <Typography variant="muted" className="mt-1">
            {norm.status || 'Unknown Status'}
          </Typography>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View>
          <Typography variant="h1">Library</Typography>
          <Typography variant="muted">
            {activeTab === 'manga' ? 'Saved Manga' : 'Saved Anime'}
          </Typography>
        </View>
        <View className="flex-row items-center gap-2">
          <Button
            variant="ghost"
            title=""
            onPress={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
            icon={
              viewMode === 'grid' ? (
                <List size={20} color="#666" />
              ) : (
                <LayoutGrid size={20} color="#666" />
              )
            }
          />
          <Button
            variant="ghost"
            title=""
            onPress={() => {}}
            icon={<Trash2 size={20} color="#ef4444" />}
          />
        </View>
      </View>

      {/* Tabs */}
      <View className="flex-row px-4 py-2 border-b border-border bg-card/50">
        <TouchableOpacity
          onPress={() => setActiveTab('manga')}
          className={`flex-1 py-2 items-center border-b-2 ${activeTab === 'manga' ? 'border-primary' : 'border-transparent'}`}
        >
          <Typography
            className={activeTab === 'manga' ? 'text-primary font-bold' : 'text-muted-foreground'}
          >
            Manga
          </Typography>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setActiveTab('anime')}
          className={`flex-1 py-2 items-center border-b-2 ${activeTab === 'anime' ? 'border-primary' : 'border-transparent'}`}
        >
          <Typography
            className={activeTab === 'anime' ? 'text-primary font-bold' : 'text-muted-foreground'}
          >
            Anime
          </Typography>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View className="flex-1">
        {isLoading && allItems.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#3b82f6" />
          </View>
        ) : allItems.length === 0 ? (
          <View className="flex-1 items-center justify-center p-8">
            <View className="bg-primary/10 p-6 rounded-full mb-4">
              {activeTab === 'manga' ? (
                <BookOpen size={48} color="#3b82f6" />
              ) : (
                <Play size={48} color="#3b82f6" />
              )}
            </View>
            <Typography variant="h2" className="text-center">
              No {activeTab} saved
            </Typography>
            <Typography variant="muted" className="text-center mt-2 px-8">
              Your {activeTab} library is empty. Start browsing to discover content.
            </Typography>
            <Button
              title="Browse Sources"
              className="mt-6 w-full"
              onPress={() => {}}
              variant="outline"
            />
          </View>
        ) : (
          <FlatList
            data={allItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={viewMode === 'grid' ? 3 : 1}
            key={viewMode} // Re-render when switching modes
            onEndReached={() => hasNextPage && fetchNextPage()}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ padding: 8 }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4">
                  <ActivityIndicator color="#3b82f6" />
                </View>
              ) : null
            }
            refreshing={isLoading}
            onRefresh={refetch}
          />
        )}
      </View>
    </SafeAreaView>
  )
}
