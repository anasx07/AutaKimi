import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { DataService } from "@renderer/shared/api";
import { isAnimeExtension } from "@common/utils/mediaType";
import { resolveExtensionBadge } from "@common/services/repoIdentity";
import { Typography, Button } from "@mobile/native/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Clock,
  Trash2,
  BookOpen,
  Play,
  Film,
} from "lucide-react-native";

function groupByDate(entries: any[]) {
  const groups: Record<string, any[]> = {};
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  for (const entry of entries) {
    const date = entry.startedAt ? new Date(entry.startedAt) : new Date();
    let label: string;
    if (date.toDateString() === today.toDateString()) label = "Today";
    else if (date.toDateString() === yesterday.toDateString())
      label = "Yesterday";
    else
      label = date.toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      });
    if (!groups[label]) groups[label] = [];
    groups[label].push(entry);
  }
  return groups;
}

export default function HistoryTab() {
  const [entries, setEntries] = useState<any[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<any[]>([]);
  const [mediaFilter, setMediaFilter] = useState<"all" | "manga" | "anime">("all");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const loadHistory = useCallback(async (mode: "initial" | "refresh" | "silent" = "initial") => {
    if (mode === "refresh") setRefreshing(true);
    else if (mode === "initial" && !hasLoadedOnceRef.current) setLoading(true);
    try {
      const [result, extensions] = await Promise.all([
        DataService.db.getHistory({ limit: 100 }),
        DataService.db.getExtensions().catch(() => []),
      ]);
      setInstalledExtensions(Array.isArray(extensions) ? extensions : []);
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
        type: e.type,
      }));
      setEntries(normalized);
      hasLoadedOnceRef.current = true;
    } catch (e) {
      console.error("[History] Load failed:", e);
      if (!hasLoadedOnceRef.current) setEntries([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory(hasLoadedOnceRef.current ? "silent" : "initial");
    }, [loadHistory]),
  );

  const filteredEntries = useMemo(() => {
    if (mediaFilter === "all") return entries;
    return entries.filter((entry) => {
      const isAnime =
        entry.type === "anime" || isAnimeExtension({ pkg: entry.pkg });
      return mediaFilter === "anime" ? isAnime : !isAnime;
    });
  }, [entries, mediaFilter]);

  const groups = useMemo(() => groupByDate(filteredEntries), [filteredEntries]);

  const deleteEntry = async (id: number) => {
    try {
      await DataService.db.deleteHistoryEntry(id);
      loadHistory("silent");
    } catch (e) {
      console.error("[History] Delete failed:", e);
    }
  };

  const clearAll = () => {
    const scopeLabel =
      mediaFilter === "all"
        ? "reading and watching history"
        : mediaFilter === "anime"
          ? "anime watch history"
          : "manga reading history";
    Alert.alert("Clear History", `Clear all ${scopeLabel}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await DataService.db.clearHistory(
              mediaFilter === "all" ? undefined : mediaFilter,
            );
            loadHistory("silent");
          } catch (e) {
            console.error("[History] Clear failed:", e);
          }
        },
      },
    ]);
  };

  const isEntryAnime = (entry: any) =>
    entry.type === "anime" || isAnimeExtension({ pkg: entry.pkg });

  const openMedia = (entry: any) => {
    const anime = isEntryAnime(entry);
    router.push({
      pathname: (anime ? "/anime/[id]" : "/manga/[id]") as any,
      params: {
        id: entry.mangaId,
        title: entry.mangaTitle,
        coverUrl: entry.mangaCover || "",
        pkg: entry.pkg || "",
        url: entry.mangaUrl || "",
      },
    });
  };

  const continueMedia = async (entry: any) => {
    const anime = isEntryAnime(entry);
    try {
      const res = await DataService.db.getChapters(entry.mangaId);
      const chapters = (res as any)?.value || res || [];
      const chapter = chapters.find(
        (c: any) =>
          String(c.id) === String(entry.chapterId),
      );

      if (chapter && chapter.url) {
        if (anime) {
          router.push({
            pathname: "/player/[animeId]/[episodeId]" as any,
            params: {
              animeId: entry.mangaId,
              episodeId: String(chapter.id),
              pkg: entry.pkg || "",
              episodeUrl: chapter.url,
              episodeTitle:
                entry.chapterTitle || chapter.title || `Episode ${chapter.number}`,
              animeTitle: entry.mangaTitle || "",
              animeCover: entry.mangaCover || "",
              animeUrl: entry.mangaUrl || "",
            },
          });
        } else {
          router.push({
            pathname: "/reader/[mangaId]/[chapterId]" as any,
            params: {
              mangaId: entry.mangaId,
              chapterId: String(chapter.id),
              pkg: entry.pkg || "",
              chapterUrl: chapter.url,
              chapterTitle:
                entry.chapterTitle || chapter.title || `Ch. ${chapter.number}`,
              mangaTitle: entry.mangaTitle,
            },
          });
        }
      } else {
        // Fallback cleanly to details screen so episodes/chapters can be fetched from source (e.g. synced history)
        openMedia(entry);
      }
    } catch (e) {
      console.error("[History] continueMedia failed:", e);
      openMedia(entry);
    }
  };

  const groupEntries = Object.entries(groups) as [string, any[]][];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View>
          <Typography variant="h1">History</Typography>
          <Typography variant="muted">
            {filteredEntries.length}{" "}
            {mediaFilter === "anime"
              ? `episode${filteredEntries.length !== 1 ? "s" : ""} watched`
              : mediaFilter === "manga"
                ? `chapter${filteredEntries.length !== 1 ? "s" : ""} read`
                : `entr${filteredEntries.length !== 1 ? "ies" : "y"}`}
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

      {entries.length > 0 && (
        <View className="flex-row px-4 pt-3 gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "manga", label: "Manga" },
              { key: "anime", label: "Anime" },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setMediaFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-lg border ${
                mediaFilter === tab.key
                  ? "bg-primary border-primary"
                  : "bg-card border-border"
              }`}
            >
              <Typography
                className={
                  mediaFilter === tab.key
                    ? "text-white font-semibold text-xs"
                    : "text-muted-foreground font-medium text-xs"
                }
              >
                {tab.label}
              </Typography>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      ) : filteredEntries.length === 0 ? (
        <View className="flex-1 items-center justify-center p-8">
          <View className="w-16 h-16 rounded-2xl bg-secondary border border-border items-center justify-center mb-4">
            <Clock size={28} color="#e11d48" />
          </View>
          <Typography variant="h2" className="text-center">
            {mediaFilter === "anime"
              ? "No anime history"
              : mediaFilter === "manga"
                ? "No manga history"
                : "No history yet"}
          </Typography>
          <Typography variant="muted" className="text-center mt-1.5 px-8">
            {mediaFilter === "anime"
              ? "Your recently watched episodes will appear here."
              : "Your recently read or watched titles will appear here."}
          </Typography>
        </View>
      ) : (
        <FlatList
          className="flex-1"
          data={groupEntries}
          keyExtractor={([date]) => date}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => loadHistory("refresh")}
            />
          }
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          renderItem={({ item: [dateLabel, dateEntries] }) => (
            <View className="mb-4">
              <Typography className="font-semibold text-xs text-muted-foreground uppercase tracking-wide mb-2 px-1">
                {dateLabel}
              </Typography>
              <View className="bg-card rounded-xl border border-border overflow-hidden">
                {dateEntries.map((entry: any, idx: number) => {
                  const src = resolveExtensionBadge(
                    entry.pkg,
                    installedExtensions,
                  );
                  const anime = isEntryAnime(entry);
                  return (
                    <TouchableOpacity
                      key={entry.id || idx}
                      className={`flex-row items-center px-3 py-3 ${idx !== dateEntries.length - 1 ? "border-b border-border/50" : ""}`}
                      onPress={() => openMedia(entry)}
                    >
                      <View className="relative">
                        {entry.mangaCover ? (
                          <Image
                            source={{ uri: entry.mangaCover || undefined }}
                            className="w-12 h-16 rounded-lg"
                            contentFit="cover"
                            transition={150}
                          />
                        ) : (
                          <View className="w-12 h-16 rounded-lg bg-secondary items-center justify-center">
                            {anime ? (
                              <Film size={20} color="#94a3b8" />
                            ) : (
                              <BookOpen size={20} color="#94a3b8" />
                            )}
                          </View>
                        )}
                      </View>
                      <View className="flex-1 ml-3">
                        <View className="flex-row items-center gap-1.5">
                          {src && (
                            <View className="flex-row items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/80 border border-border/40 shrink-0">
                              <View
                                style={{
                                  width: 5,
                                  height: 5,
                                  borderRadius: 99,
                                  backgroundColor: src.color || "#e11d48",
                                }}
                              />
                              <Typography className="text-[10px] font-bold text-foreground">
                                {src.name}
                              </Typography>
                            </View>
                          )}
                          <View className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/30">
                            <Typography className="text-[9px] font-semibold uppercase text-muted-foreground">
                              {anime ? "Anime" : "Manga"}
                            </Typography>
                          </View>
                        </View>
                        <Typography
                          className="font-medium text-sm mt-0.5"
                          numberOfLines={1}
                        >
                          {entry.mangaTitle || "Unknown"}
                        </Typography>
                        <Typography className="text-xs text-muted-foreground mt-0.5">
                          {entry.chapterTitle ||
                            `${anime ? "Episode" : "Chapter"} ${String(entry.chapterId || "").slice(0, 8)}`}
                        </Typography>
                        {entry.startedAt && (
                          <Typography className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(entry.startedAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </Typography>
                        )}
                      </View>
                      <View className="flex-row items-center gap-1">
                        <TouchableOpacity
                          className="p-2"
                          onPress={() => continueMedia(entry)}
                        >
                          <Play size={18} color="#e11d48" fill="#e11d48" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          className="p-2"
                          onPress={() => deleteEntry(entry.id)}
                        >
                          <Trash2 size={16} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
