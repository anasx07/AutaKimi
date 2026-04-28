import { useState } from 'react';
import { View, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Typography } from '../../src/native/ui/Typography';
import { Button } from '../../src/native/ui/Button';
import { Card } from '../../src/native/ui/Card';
import { Trash2, BookOpen, Play, Search, LayoutGrid, List } from 'lucide-react-native';
import { normalizeManga } from '@common/utils/mangaNormalizer';
import { DataService } from '@renderer/shared/api';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

// Local hook — avoids importing shared useMangaQueries which pulls in
// Vite-specific SourceRegistry (import.meta.glob) that Metro can't handle
function useLibraryItems(type?: 'manga' | 'anime') {
  return useInfiniteQuery({
    queryKey: ['library', type],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await DataService.db.getLibrary({ limit: 50, offset: pageParam as number, type });
      // Normalize snake_case DB columns to camelCase
      const items = (result as any[]) || [];
      return items.map((e: any) => ({
        id: e.id ?? e.Id,
        title: e.title,
        coverUrl: e.coverUrl || e.cover_url,
        status: e.status,
        type: e.type,
        pkg: e.pkg,
        url: e.url,
        description: e.description,
        author: e.author,
        artist: e.artist,
        genres: e.genres,
        ...(e.metadata ? (typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata) : {})
      }));
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage || lastPage.length < 50) return undefined;
      return allPages.reduce((acc, p) => acc + (p?.length || 0), 0);
    },
    staleTime: 1000 * 60 * 5,
  });
}

export default function LibraryTab() {
  const [activeTab, setActiveTab] = useState<'manga' | 'anime'>('manga');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { data, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useLibraryItems(activeTab);

  const allItems = data?.pages?.flat() || [];

  const openMangaDetails = (item: any) => {
    const norm = normalizeManga(item);
    const isAnime = item.type === 'anime' || item.mediaType === 'anime';
    router.push({
      pathname: isAnime ? '/anime/[id]' : '/manga/[id]',
      params: {
        id: item.id,
        title: norm.title,
        coverUrl: norm.coverUrl || '',
        pkg: item.pkg || '',
        url: item.url || ''
      }
    });
  };

  const renderItem = ({ item }: { item: any; index: number }) => {
    const norm = normalizeManga(item);

    if (viewMode === 'grid') {
      return (
        <TouchableOpacity className="flex-1 m-2" onPress={() => openMangaDetails(item)}>
          <Card className="aspect-[2/3]">
            <Image source={{ uri: norm.coverUrl }} className="flex-1" resizeMode="cover" />
            <View className="absolute bottom-0 left-0 right-0 p-2 bg-black/60">
              <Typography className="text-white text-xs font-semibold" numberOfLines={2}>
                {norm.title}
              </Typography>
            </View>
          </Card>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity className="flex-row items-center p-3 border-b border-border" onPress={() => openMangaDetails(item)}>
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
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
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
            key={viewMode}
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
  );
}
