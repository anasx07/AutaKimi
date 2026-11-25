import { useState, useEffect, useCallback } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Typography, Card } from "@mobile/native/ui";
import { DataService } from "@renderer/shared/api";
import {
  ArrowLeft,
  Flame,
  Film,
  BookOpen,
  Sparkles,
  Lock,
  RefreshCw,
  Trophy,
} from "lucide-react-native";
import {
  computeWrappedStats,
  formatWrappedDuration,
  formatWrappedHours,
  normalizeHistoryRecord,
  type WrappedStatsSummary,
} from "@common/utils/wrappedStats";

export default function WrappedStatsScreen() {
  const [stats, setStats] = useState<WrappedStatsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const [historyRes, libraryRes] = await Promise.all([
        DataService.db.getHistory({ limit: 5000 }).catch(() => []),
        DataService.db.getLibrary({ limit: 1000 }).catch(() => []),
      ]);

      const historyEntries = Array.isArray(historyRes) ? historyRes : [];
      const libraryItems = Array.isArray(libraryRes) ? libraryRes : [];

      const genresByMangaId: Record<string, string[]> = {};
      for (const item of libraryItems) {
        if (item?.id && Array.isArray(item.genres) && item.genres.length > 0) {
          genresByMangaId[item.id] = item.genres;
        }
      }

      const missingIds: string[] = [];
      const seen = new Set<string>(Object.keys(genresByMangaId));
      for (const raw of historyEntries) {
        const normalized = normalizeHistoryRecord(raw);
        if (!normalized) continue;
        if (!seen.has(normalized.mangaId)) {
          seen.add(normalized.mangaId);
          missingIds.push(normalized.mangaId);
        }
        if (missingIds.length >= 60) break;
      }

      if (missingIds.length > 0) {
        const cachedResults = await Promise.all(
          missingIds.map((id) =>
            DataService.db.getMangaCache(id).catch(() => null),
          ),
        );
        cachedResults.forEach((cached, idx) => {
          if (
            cached &&
            Array.isArray(cached.genres) &&
            cached.genres.length > 0
          ) {
            genresByMangaId[missingIds[idx]] = cached.genres;
          }
        });
      }

      setStats(computeWrappedStats({ historyEntries, genresByMangaId }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  const maxDailySeconds = stats
    ? Math.max(60, ...stats.dailyActivity.map((d) => d.totalSeconds))
    : 60;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <View className="px-4 py-3 border-b border-border flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="p-2 -ml-2 rounded-full active:bg-secondary"
          >
            <ArrowLeft size={22} color="#e2e8f0" />
          </TouchableOpacity>
          <View>
            <Typography variant="h2">Local Wrapped</Typography>
            <View className="flex-row items-center gap-1 mt-0.5">
              <Lock size={11} color="#10b981" />
              <Typography className="text-[11px] text-emerald-500 font-semibold">
                100% Local &amp; Private
              </Typography>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => void loadStats()}
          className="p-2 rounded-full bg-card border border-border"
        >
          <RefreshCw size={18} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {loading && !stats ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#e11d48" />
        </View>
      ) : !stats?.hasData ? (
        <View className="flex-1 items-center justify-center px-8">
          <Sparkles size={40} color="#e11d48" />
          <Typography className="text-lg font-bold mt-4 text-center">
            No Activity Logged Yet
          </Typography>
          <Typography className="text-xs text-muted-foreground text-center mt-2">
            Start watching anime or reading manga to see weekly hours, streaks,
            and top genres calculated locally on your device.
          </Typography>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-4"
          contentContainerStyle={{ paddingVertical: 16, gap: 16 }}
        >
          {/* Hero Summary */}
          <Card className="p-5 bg-primary/10 border-primary/25">
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={14} color="#e11d48" />
              <Typography className="text-[11px] font-bold uppercase tracking-widest text-primary">
                This Week&apos;s Wrapped
              </Typography>
            </View>
            <Typography className="text-4xl font-black mt-2">
              {formatWrappedHours(stats.weeklyTotalSeconds)}
            </Typography>
            <Typography className="text-xs text-muted-foreground mt-1">
              {formatWrappedDuration(stats.weeklyTotalSeconds)} across{" "}
              {stats.weeklySessions} sessions · {stats.persona}
            </Typography>

            <View className="flex-row gap-3 mt-4">
              <View className="flex-1 p-3 rounded-xl bg-background/70 border border-border">
                <View className="flex-row items-center gap-1">
                  <Flame size={14} color="#f59e0b" />
                  <Typography className="text-[10px] font-bold uppercase text-amber-400">
                    Streak
                  </Typography>
                </View>
                <Typography className="text-xl font-black mt-1">
                  {stats.currentStreakDays}d
                </Typography>
                <Typography className="text-[10px] text-muted-foreground">
                  Best: {stats.longestStreakDays}d
                </Typography>
              </View>

              <View className="flex-1 p-3 rounded-xl bg-background/70 border border-border">
                <View className="flex-row items-center gap-1">
                  <Film size={14} color="#38bdf8" />
                  <Typography className="text-[10px] font-bold uppercase text-sky-400">
                    Anime
                  </Typography>
                </View>
                <Typography className="text-xl font-black mt-1">
                  {formatWrappedDuration(stats.weeklyAnimeSeconds)}
                </Typography>
                <Typography className="text-[10px] text-muted-foreground">
                  All: {formatWrappedDuration(stats.allTimeAnimeSeconds)}
                </Typography>
              </View>

              <View className="flex-1 p-3 rounded-xl bg-background/70 border border-border">
                <View className="flex-row items-center gap-1">
                  <BookOpen size={14} color="#fb7185" />
                  <Typography className="text-[10px] font-bold uppercase text-rose-400">
                    Manga
                  </Typography>
                </View>
                <Typography className="text-xl font-black mt-1">
                  {formatWrappedDuration(stats.weeklyMangaSeconds)}
                </Typography>
                <Typography className="text-[10px] text-muted-foreground">
                  All: {formatWrappedDuration(stats.allTimeMangaSeconds)}
                </Typography>
              </View>
            </View>
          </Card>

          {/* Last 7 Days Bar Chart */}
          <Card className="p-4">
            <Typography className="text-sm font-bold mb-1">
              Last 7 Days
            </Typography>
            <Typography className="text-xs text-muted-foreground mb-4">
              Daily reading &amp; watching activity
            </Typography>
            <View className="flex-row items-end justify-between h-28 px-1">
              {stats.dailyActivity.map((day) => {
                const heightPct =
                  day.totalSeconds > 0
                    ? Math.max(
                        8,
                        Math.round((day.totalSeconds / maxDailySeconds) * 100),
                      )
                    : 4;
                return (
                  <View key={day.dateKey} className="items-center flex-1">
                    <View className="w-5 h-20 rounded-md bg-secondary/50 justify-end overflow-hidden">
                      <View
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor:
                            day.totalSeconds > 0 ? "#e11d48" : "transparent",
                        }}
                        className="w-full rounded-md"
                      />
                    </View>
                    <Typography className="text-[10px] text-muted-foreground mt-1.5 font-semibold">
                      {day.label}
                    </Typography>
                  </View>
                );
              })}
            </View>
          </Card>

          {/* Top Genres */}
          <Card className="p-4">
            <Typography className="text-sm font-bold mb-3">
              Top Genres
            </Typography>
            {stats.topGenres.length === 0 ? (
              <Typography className="text-xs text-muted-foreground">
                No genre tags cached yet for watched/read titles.
              </Typography>
            ) : (
              <View className="gap-3">
                {stats.topGenres.map((item, idx) => (
                  <View key={item.genre}>
                    <View className="flex-row justify-between mb-1">
                      <Typography className="text-xs font-bold">
                        #{idx + 1} {item.genre}
                      </Typography>
                      <Typography className="text-xs text-muted-foreground">
                        {item.percentage}% ·{" "}
                        {formatWrappedDuration(item.durationSeconds)}
                      </Typography>
                    </View>
                    <View className="h-2 rounded-full bg-secondary overflow-hidden">
                      <View
                        style={{
                          width: `${Math.max(6, item.percentage)}%`,
                          backgroundColor: "#e11d48",
                        }}
                        className="h-full rounded-full"
                      />
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>

          {/* Top Titles */}
          <Card className="p-4 mb-6">
            <View className="flex-row items-center justify-between mb-3">
              <View className="flex-row items-center gap-1.5">
                <Trophy size={15} color="#f59e0b" />
                <Typography className="text-sm font-bold">
                  Most Engaged Titles
                </Typography>
              </View>
              <Typography className="text-[11px] text-muted-foreground">
                {stats.allTimeSessions} sessions
              </Typography>
            </View>
            <View className="gap-3">
              {stats.topTitles.map((title, idx) => (
                <View
                  key={title.mangaId}
                  className="flex-row items-center justify-between border-t border-border/50 pt-2.5"
                >
                  <View className="flex-row items-center gap-2.5 flex-1 mr-3">
                    <Typography className="text-xs font-black text-primary w-5">
                      #{idx + 1}
                    </Typography>
                    <View className="flex-1">
                      <Typography
                        className="text-sm font-semibold"
                        numberOfLines={1}
                      >
                        {title.title}
                      </Typography>
                      <Typography className="text-[11px] text-muted-foreground uppercase">
                        {title.mediaType} · {title.sessions}x
                      </Typography>
                    </View>
                  </View>
                  <Typography className="text-xs font-bold font-mono">
                    {formatWrappedDuration(title.durationSeconds)}
                  </Typography>
                </View>
              ))}
            </View>
          </Card>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
