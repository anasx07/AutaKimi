import { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  useWindowDimensions,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Typography, Card } from "@mobile/native/ui";
import { BookOpen, Play, Search, LayoutGrid, List, X, ArrowUpDown } from "lucide-react-native";
import { normalizeManga } from "@common/utils/mangaNormalizer";
import { isAnimeExtension } from "@common/utils/mediaType";
import { resolveExtensionBadge } from "@common/services/repoIdentity";
import { DataService } from "@renderer/shared/api";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useFocusEffect } from "expo-router";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "title">("recent");
  const syncedDisplayModeRef = useRef<string | null>(null);

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useLibraryItems(activeTab);

  const queryClient = useQueryClient();
  const { data: historyData } = useQuery({
    queryKey: ["history", activeTab],
    queryFn: () => DataService.db.getHistory({ type: activeTab }),
  });

  const { data: installedExtensions = [] } = useQuery({
    queryKey: ["extensions", "installed"],
    queryFn: () => DataService.db.getExtensions(),
  });

  const rawItems = useMemo(() => data?.pages?.flat() || [], [data]);
  const itemIdsKey = useMemo(
    () => rawItems.map((it: any) => it.id).join("|"),
    [rawItems],
  );

  const { data: unreadMap = {} } = useQuery({
    queryKey: ["library-unread", activeTab, itemIdsKey],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      await Promise.all(
        rawItems.map(async (item: any) => {
          try {
            const [chapters, progress] = await Promise.all([
              DataService.db.getChapters(item.id).catch(() => []),
              DataService.db.getProgress(item.id).catch(() => []),
            ]);
            const chList = Array.isArray(chapters) ? chapters : [];
            if (chList.length === 0) return;
            const readSet = new Set(
              (Array.isArray(progress) ? progress : [])
                .filter((p: any) => Boolean(p.is_read ?? p.isRead))
                .map((p: any) => String(p.chapter_id ?? p.chapterId)),
            );
            const unread = chList.filter(
              (ch: any) => !readSet.has(String(ch.id)),
            ).length;
            if (unread > 0) {
              counts[item.id] = unread;
            }
          } catch {}
        }),
      );
      return counts;
    },
    enabled: rawItems.length > 0,
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["history", activeTab] });
      queryClient.invalidateQueries({ queryKey: ["extensions", "installed"] });
      queryClient.invalidateQueries({ queryKey: ["library-unread", activeTab] });
      DataService.db
        .getSetting("displayMode")
        .then((res: any) => {
          const val = typeof res === "string" ? res : (res as any)?.value;
          if ((val === "grid" || val === "list") && val !== syncedDisplayModeRef.current) {
            syncedDisplayModeRef.current = val;
            setViewMode(val);
          }
        })
        .catch(() => {});
    }, [refetch, queryClient, activeTab]),
  );

  const historyMap = useMemo(() => {
    const map = new Map<string, any>();
    historyData?.forEach((h: any) => {
      if (!map.has(h.manga_id)) {
        map.set(h.manga_id, h);
      }
    });
    return map;
  }, [historyData]);

  const allItems = useMemo(() => {
    let list = [...rawItems];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((it: any) =>
        normalizeManga(it).title.toLowerCase().includes(q),
      );
    }
    if (sortBy === "title") {
      list.sort((a: any, b: any) =>
        normalizeManga(a).title.localeCompare(normalizeManga(b).title),
      );
    } else {
      list.sort((a: any, b: any) => {
        const aTime = historyMap.get(a.id)?.started_at || "";
        const bTime = historyMap.get(b.id)?.started_at || "";
        if (aTime !== bTime) return bTime.localeCompare(aTime);
        return normalizeManga(a).title.localeCompare(normalizeManga(b).title);
      });
    }
    return list;
  }, [rawItems, searchQuery, sortBy, historyMap]);

  const openMangaDetails = (item: any) => {
    const norm = normalizeManga(item);
    const isAnime =
      item.type === "anime" ||
      item.mediaType === "anime" ||
      isAnimeExtension({ pkg: item.pkg });
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
      : activeTab === "anime"
        ? "Unwatched"
        : "Unread";
    const src = resolveExtensionBadge(item.pkg, installedExtensions);
    const unreadCount = unreadMap[item.id] || 0;

    if (viewMode === "grid") {
      return (
        <TouchableOpacity
          style={{ width: cardWidth, margin: 4 }}
          onPress={() => openMangaDetails(item)}
          activeOpacity={0.8}
        >
          <Card className="aspect-[2/3] w-full overflow-hidden rounded-xl border border-border">
            <Image
              source={{ uri: norm.coverUrl || undefined }}
              className="flex-1"
              contentFit="cover"
              transition={150}
            />
            {(src || unreadCount > 0) && (
              <View className="absolute top-1.5 left-1.5 right-1.5 flex-row items-center justify-between gap-1">
                {src ? (
                  <View className="flex-row items-center gap-1 rounded-md bg-black/75 px-1.5 py-0.5 flex-shrink">
                    <View
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 99,
                        backgroundColor: src.color || "#e11d48",
                      }}
                    />
                    <Typography
                      className="text-white text-[9px] font-semibold"
                      numberOfLines={1}
                    >
                      {src.name}
                    </Typography>
                  </View>
                ) : (
                  <View />
                )}
                {unreadCount > 0 && (
                  <View className="rounded-md bg-primary px-1.5 py-0.5">
                    <Typography className="text-white text-[9px] font-bold">
                      {unreadCount}
                    </Typography>
                  </View>
                )}
              </View>
            )}
            <LinearGradient
              colors={["transparent", "rgba(9,9,11,0.55)", "rgba(9,9,11,0.92)"]}
              locations={[0, 0.45, 1]}
              className="absolute bottom-0 left-0 right-0 px-2 pb-2 pt-8"
            >
              <Typography
                className="text-white text-xs font-semibold leading-snug"
                numberOfLines={2}
              >
                {norm.title}
              </Typography>
              <Typography
                className="text-zinc-300 text-[10px] mt-0.5 font-medium"
                numberOfLines={1}
              >
                {chapterText}
              </Typography>
            </LinearGradient>
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
            {unreadCount > 0 && (
              <View className="px-2 py-0.5 rounded-md bg-primary/15 border border-primary/30">
                <Typography className="text-[11px] font-bold text-primary">
                  {unreadCount} {activeTab === "anime" ? "unwatched" : "unread"}
                </Typography>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      {/* Header */}
      <View className="px-4 pt-3 pb-2.5 flex-row items-center justify-between border-b border-border bg-background">
        <View>
          <Typography
            variant="h1"
            className="text-2xl font-bold tracking-tight text-foreground"
          >
            Library
          </Typography>
          <Typography
            variant="muted"
            className="text-xs text-muted-foreground mt-0.5"
          >
            {allItems.length} {activeTab === "manga" ? "Manga" : "Anime"} saved
          </Typography>
        </View>
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
            className="p-2 rounded-lg bg-secondary/70 border border-border"
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
            className="p-2 rounded-lg bg-secondary/70 border border-border"
            activeOpacity={0.7}
          >
            <Search size={18} color={isDark ? "#e4e4e7" : "#3f3f46"} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Segmented Media Switcher */}
      <View className="mx-4 my-2.5 p-1 rounded-xl bg-secondary/60 border border-border flex-row">
        {(["manga", "anime"] as const).map((tab) => {
          const isActive = activeTab === tab;
          const count = tab === activeTab ? allItems.length : undefined;
          return (
            <TouchableOpacity
              key={tab}
              onPress={() => setActiveTab(tab)}
              className={`flex-1 flex-row items-center justify-center py-2 rounded-lg gap-2 border ${
                isActive
                  ? "bg-card border-border"
                  : "bg-transparent border-transparent"
              }`}
              activeOpacity={0.8}
            >
              {tab === "manga" ? (
                <BookOpen
                  size={15}
                  color={isActive ? "#e11d48" : isDark ? "#a1a1aa" : "#71717a"}
                />
              ) : (
                <Play
                  size={15}
                  color={isActive ? "#e11d48" : isDark ? "#a1a1aa" : "#71717a"}
                />
              )}
              <Typography
                className={`text-xs capitalize ${
                  isActive
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground font-medium"
                }`}
              >
                {tab}
              </Typography>
              {count !== undefined && count > 0 ? (
                <View
                  key={`count-${tab}`}
                  className={`px-1.5 py-0.5 rounded-full ${isActive ? "bg-primary/15" : "bg-secondary"}`}
                >
                  <Typography
                    className={`text-[10px] font-semibold ${isActive ? "text-primary" : "text-muted-foreground"}`}
                  >
                    {count}
                  </Typography>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Search & Sort Bar */}
      {rawItems.length > 0 && (
        <View className="mx-4 mb-2 flex-row items-center gap-2">
          <View className="flex-1 px-3 py-1 bg-secondary/50 rounded-xl border border-border flex-row items-center h-10">
            <Search size={15} color="#71717a" />
            <TextInput
              className="flex-1 ml-2 text-foreground text-sm py-0"
              placeholder={`Search ${activeTab === "anime" ? "anime" : "manga"} library...`}
              placeholderTextColor="#71717a"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {!!searchQuery && (
              <TouchableOpacity onPress={() => setSearchQuery("")} className="p-1">
                <X size={14} color="#71717a" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={() => setSortBy((prev) => (prev === "recent" ? "title" : "recent"))}
            className="h-10 px-3 rounded-xl bg-secondary/60 border border-border flex-row items-center gap-1.5"
            activeOpacity={0.7}
          >
            <ArrowUpDown size={14} color="#e11d48" />
            <Typography className="text-xs font-semibold text-foreground">
              {sortBy === "recent" ? "Recent" : "A–Z"}
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* Content */}
      <View className="flex-1">
        {isLoading && allItems.length === 0 ? (
          <View
            key="loading-state"
            className="flex-1 items-center justify-center"
          >
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : allItems.length === 0 && searchQuery.trim() ? (
          <View
            key="search-empty-state"
            className="flex-1 items-center justify-center p-8"
          >
            <Search size={36} color="#71717a" />
            <Typography className="text-muted-foreground mt-3 text-center text-sm">
              No saved {activeTab} match "{searchQuery}"
            </Typography>
          </View>
        ) : allItems.length === 0 ? (
          <View
            key="empty-state"
            className="flex-1 items-center justify-center p-8"
          >
            <View className="w-16 h-16 rounded-2xl bg-secondary items-center justify-center border border-border mb-5">
              {activeTab === "manga" ? (
                <BookOpen size={28} color="#e11d48" />
              ) : (
                <Play size={28} color="#e11d48" style={{ marginLeft: 2 }} />
              )}
            </View>
            <Typography
              variant="h2"
              className="text-lg font-semibold tracking-tight text-center text-foreground"
            >
              No {activeTab === "manga" ? "Manga" : "Anime"} in Library
            </Typography>
            <Typography
              variant="muted"
              className="text-center mt-1.5 px-6 text-xs leading-relaxed text-muted-foreground"
            >
              Explore catalog sources to bookmark your favorite {activeTab}{" "}
              titles and track your progress.
            </Typography>
            <TouchableOpacity
              onPress={() => router.push("/browse")}
              className="mt-6 px-5 py-3 rounded-xl bg-primary flex-row items-center gap-2"
              activeOpacity={0.8}
            >
              <Search size={15} color="#ffffff" />
              <Typography className="text-white font-semibold text-sm">
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
