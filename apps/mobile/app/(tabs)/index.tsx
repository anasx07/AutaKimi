import { useState, useMemo } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { Image } from "expo-image";
import { Typography, Card } from "@mobile/native/ui";
import { BookOpen, Play, Search, LayoutGrid, List } from "lucide-react-native";
import { normalizeManga } from "@common/utils/mangaNormalizer";
import { resolveExtensionBadge } from "@common/services/repoIdentity";
import { DataService } from "@renderer/shared/api";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useColorScheme } from "nativewind";

// Local hook — avoids importing shared useMangaQueries which pulls in
// Vite-specific SourceRegistry (import.meta.glob) that Metro can't handle
function useLibraryItems(type?: "manga" | "anime") {
  return useInfiniteQuery({
    queryKey: ["library", type],
    queryFn: async ({ pageParam = 0 }) => {
      const result = await DataService.db.getLibrary({
        limit: 50,
        offset: pageParam as number,
        type,
      });
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
        ...(e.metadata
          ? typeof e.metadata === "string"
            ? JSON.parse(e.metadata)
            : e.metadata
          : {}),
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
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = Math.floor((windowWidth - 16 - 24) / 3);
  const [activeTab, setActiveTab] = useState<"manga" | "anime">("manga");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useLibraryItems(activeTab);

  const { data: historyData } = useQuery({
    queryKey: ["history", activeTab],
    queryFn: () => DataService.db.getHistory({ type: activeTab }),
  });

  const { data: installedExtensions = [] } = useQuery({
    queryKey: ["extensions", "installed"],
    queryFn: () => DataService.db.getExtensions(),
  });

  const historyMap = useMemo(() => {
    const map = new Map<string, any>();
    historyData?.forEach((h: any) => {
      if (!map.has(h.manga_id)) {
        map.set(h.manga_id, h);
      }
    });
    return map;
  }, [historyData]);

  const allItems = data?.pages?.flat() || [];

  const openMangaDetails = (item: any) => {
    const norm = normalizeManga(item);
    const isAnime = item.type === "anime" || item.mediaType === "anime";
    router.push({
      pathname: (isAnime ? "/anime/[id]" : "/manga/[id]") as any,
      params: {
        id: item.id,
        title: norm.title,
        coverUrl: norm.coverUrl || "",
        pkg: item.pkg || "",
        url: item.url || "",
      },
    });
  };

  const renderItem = ({ item }: { item: any; index: number }) => {
    const norm = normalizeManga(item);
    const history = historyMap.get(item.id);
    const chapterText = history?.chapter_title
      ? history.chapter_title
      : "Unread";
    const src = resolveExtensionBadge(item.pkg, installedExtensions);

    if (viewMode === "grid") {
      return (
        <TouchableOpacity
          style={{ width: cardWidth, margin: 4 }}
          onPress={() => openMangaDetails(item)}
          activeOpacity={0.8}
        >
          <Card className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border/50">
            <Image
              source={{ uri: norm.coverUrl || undefined }}
              className="flex-1"
              contentFit="cover"
              transition={150}
            />
            {src && (
              <View className="absolute top-1.5 left-1.5 right-1.5 flex-row items-center">
                <View className="flex-row items-center gap-1 rounded-md bg-black/70 px-1.5 py-0.5 max-w-full">
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 99,
                      backgroundColor: src.color || "#e11d48",
                    }}
                  />
                  <Typography
                    className="text-white text-[9px] font-bold"
                    numberOfLines={1}
                  >
                    {src.name}
                  </Typography>
                </View>
              </View>
            )}
            <View className="absolute bottom-0 left-0 right-0 p-2 bg-black/75">
              <Typography
                className="text-white text-xs font-bold"
                numberOfLines={2}
              >
                {norm.title}
              </Typography>
              <Typography
                className="text-white/70 text-[10px] mt-0.5 font-medium"
                numberOfLines={1}
              >
                {chapterText}
              </Typography>
            </View>
          </Card>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        className="flex-row items-center p-3.5 border-b border-border/40"
        onPress={() => openMangaDetails(item)}
        activeOpacity={0.7}
      >
        <Image
          source={{ uri: norm.coverUrl || undefined }}
          className="w-16 h-24 rounded-xl border border-border/40"
          contentFit="cover"
          transition={150}
        />
        <View className="flex-1 ml-4">
          <Typography
            variant="h3"
            numberOfLines={2}
            className="text-base font-bold text-foreground"
          >
            {norm.title}
          </Typography>
          <View className="mt-1.5 flex-row items-center flex-wrap gap-2">
            {src && (
              <View className="flex-row items-center gap-1 px-2 py-0.5 rounded-md bg-secondary/80 border border-border/40">
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: src.color || "#e11d48",
                  }}
                />
                <Typography
                  className="text-[11px] font-semibold text-foreground"
                  numberOfLines={1}
                >
                  {src.name}
                </Typography>
              </View>
            )}
            <View className="px-2 py-0.5 rounded-md bg-secondary border border-border/30">
              <Typography variant="muted" className="text-xs font-medium">
                {chapterText}
              </Typography>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-5 pt-3 pb-3 flex-row items-center justify-between border-b border-border/40 bg-background">
        <View>
          <Typography
            variant="h1"
            className="text-2xl font-black tracking-tight text-foreground"
          >
            Library
          </Typography>
          <Typography
            variant="muted"
            className="text-xs font-medium text-muted-foreground mt-0.5"
          >
            {allItems.length} {activeTab === "manga" ? "Manga" : "Anime"} saved
          </Typography>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="p-2.5 rounded-xl bg-secondary/50 border border-border/40"
            activeOpacity={0.7}
          >
            {viewMode === "grid" ? (
              <List size={18} color={isDark ? "#e4e4e7" : "#3f3f46"} />
            ) : (
              <LayoutGrid size={18} color={isDark ? "#e4e4e7" : "#3f3f46"} />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push("/browse")}
            className="p-2.5 rounded-xl bg-secondary/50 border border-border/40"
            activeOpacity={0.7}
          >
            <Search size={18} color={isDark ? "#e4e4e7" : "#3f3f46"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Pill Media Switcher */}
      <View className="mx-4 my-3 p-1 rounded-2xl bg-secondary/40 border border-border/40 flex-row">
        {(["manga", "anime"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === activeTab ? allItems.length : undefined;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-xl gap-2 border ${
                isActive
                  ? "bg-card border-border/60 shadow-sm"
                  : "bg-transparent border-transparent"
              }`}
              activeOpacity={0.8}
            >
              {tab === "manga" ? (
                <BookOpen
                  size={16}
                  color={isActive ? "#e11d48" : isDark ? "#a1a1aa" : "#71717a"}
                />
              ) : (
                <Play
                  size={16}
                  color={isActive ? "#e11d48" : isDark ? "#a1a1aa" : "#71717a"}
                />
              )}
              <Typography
                className={`text-xs capitalize ${
                  isActive
                    ? "text-primary font-black"
                    : "text-muted-foreground font-semibold"
                }`}
              >
                {tab}
              </Typography>
              {count !== undefined && count > 0 ? (
                <View
                  key={`count-${tab}`}
                  className={`px-2 py-0.5 rounded-full ${isActive ? "bg-primary/10" : "bg-secondary"}`}
                >
                  <Typography
                    className={`text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {count}
                  </Typography>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      <View className="flex-1">
        {isLoading && allItems.length === 0 ? (
          <View
            key="loading-state"
            className="flex-1 items-center justify-center"
          >
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : allItems.length === 0 ? (
          <View
            key="empty-state"
            className="flex-1 items-center justify-center p-8"
          >
            <View className="w-24 h-24 rounded-full bg-primary/10 items-center justify-center border border-primary/20 mb-6">
              <View className="w-16 h-16 rounded-full bg-primary/15 items-center justify-center">
                {activeTab === "manga" ? (
                  <BookOpen size={32} color="#e11d48" />
                ) : (
                  <Play size={32} color="#e11d48" style={{ marginLeft: 2 }} />
                )}
              </View>
            </View>
            <Typography
              variant="h2"
              className="text-xl font-bold tracking-tight text-center text-foreground"
            >
              No {activeTab === "manga" ? "Manga" : "Anime"} in Library
            </Typography>
            <Typography
              variant="muted"
              className="text-center mt-2 px-6 text-sm leading-relaxed text-muted-foreground"
            >
              Explore catalog sources to bookmark your favorite {activeTab}{" "}
              titles and track your progress.
            </Typography>
            <TouchableOpacity
              onPress={() => router.push("/browse")}
              className="mt-8 px-6 py-3.5 rounded-xl bg-primary flex-row items-center gap-2.5 shadow-lg shadow-primary/30"
              activeOpacity={0.8}
            >
              <Search size={16} color="#ffffff" />
              <Typography className="text-white font-bold text-sm tracking-wide">
                Browse Sources
              </Typography>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            key={`list-${viewMode}`}
            data={allItems}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={viewMode === "grid" ? 3 : 1}
            onEndReached={() => hasNextPage && fetchNextPage()}
            onEndReachedThreshold={0.5}
            contentContainerStyle={{ padding: 8 }}
            ListFooterComponent={
              isFetchingNextPage ? (
                <View className="py-4">
                  <ActivityIndicator color="#e11d48" />
                </View>
              ) : undefined
            }
            refreshing={isLoading}
            onRefresh={() => {
              refetch();
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
