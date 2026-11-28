import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  TextInput,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import {
  useLocalSearchParams,
  router,
  Stack,
  useFocusEffect,
} from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Typography, Button, Card, CardContent } from "@mobile/native/ui";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  Play,
  ChevronRight,
  AlignLeft,
  Bookmark,
  CheckCircle,
  Search,
  ArrowUpDown,
  X,
  Link2,
  Download,
  Loader2,
} from "lucide-react-native";
import { DataService } from "@renderer/shared/api";
import { resolveExtensionBadge } from "@common/services/repoIdentity";
import {
  extractRawStreamUrls,
  normalizeStreamServers,
} from "@common/services/episodePrefetch.service";
import { TrackingModal } from "../../src/native/components/TrackingModal";
import { buildImageSource } from "../../src/mobile/cf-cookies";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const HERO_HEIGHT = Math.min(Math.round(SCREEN_WIDTH * 1.15), 420);

function formatResumeTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem}`;
}

export default function AnimeDetailsScreen() {
  const {
    id,
    title: paramTitle,
    coverUrl: paramCover,
    pkg: paramPkg,
    url: paramUrl,
  } = useLocalSearchParams<{
    id: string;
    title?: string;
    coverUrl?: string;
    pkg?: string;
    url?: string;
  }>();

  const queryClient = useQueryClient();
  const [descExpanded, setDescExpanded] = useState(false);
  const [description, setDescription] = useState<string>(
    "No description available.",
  );
  const [genres, setGenres] = useState<string[]>([]);
  const [mediaStatus, setMediaStatus] = useState<string>("");
  const [displayTitle, setDisplayTitle] = useState<string>(
    paramTitle || "Unknown",
  );
  const [displayCover, setDisplayCover] = useState<string>(paramCover || "");
  const displayMetaRef = useRef({ title: displayTitle, cover: displayCover });
  displayMetaRef.current = { title: displayTitle, cover: displayCover };
  const [seasons, setSeasons] = useState<any[]>([]);
  const [activeSeasonUrl, setActiveSeasonUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [filterMode, setFilterMode] = useState<"all" | "unwatched">("all");
  const [showTrackingModal, setShowTrackingModal] = useState(false);
  const [downloadStatuses, setDownloadStatuses] = useState<Record<string, string>>({});
  const [resolvingEpisodes, setResolvingEpisodes] = useState<Set<string>>(new Set());
  const [activeDownloadProgress, setActiveDownloadProgress] = useState<
    Record<string, { cached: number; total: number; status: string }>
  >({});
  const [batchDownloading, setBatchDownloading] = useState(false);

  const effectiveEpisodeSourceUrl = activeSeasonUrl || paramUrl || id;
  const effectiveMediaId = activeSeasonUrl || id;
  const isAlternateSeason = Boolean(
    activeSeasonUrl && activeSeasonUrl !== (paramUrl || id),
  );

  // Installed extensions for code resolution and clickable source badge
  const { data: installedExtensions = [] } = useQuery({
    queryKey: ["installed-extensions"],
    queryFn: async () => {
      const res = await DataService.db.getExtensions();
      return (res as any)?.value || res || [];
    },
  });

  // Library items (track membership per season via effectiveMediaId)
  const { data: libraryItems = [] } = useQuery({
    queryKey: ["library"],
    queryFn: async () => {
      const res = await DataService.db.getLibrary();
      return (res as any)?.value || res || [];
    },
  });
  const libraryItem = libraryItems.find(
    (item: any) => String(item.id) === String(effectiveMediaId),
  );
  const isInLibrary = Boolean(libraryItem);

  // Watch history for this season/anime
  const { data: historyEntries = [] } = useQuery({
    queryKey: ["anime-history", effectiveMediaId],
    queryFn: async () => {
      const res = await DataService.db.getHistory({ limit: 500 });
      const entries = (res as any)?.value || res || [];
      return entries.filter(
        (e: any) => String(e.mangaId || e.manga_id) === String(effectiveMediaId),
      );
    },
    enabled: !!effectiveMediaId,
  });

  // Episode watch progress for this season/anime
  const { data: progressRows = [], refetch: refetchProgress } = useQuery({
    queryKey: ["anime-progress", effectiveMediaId],
    queryFn: async () => {
      const res = await DataService.db.getProgress(effectiveMediaId);
      return (res as any)?.value || res || [];
    },
    enabled: !!effectiveMediaId,
  });

  const { data: trackersList = [], refetch: refetchTrackers } = useQuery({
    queryKey: ["anime-trackers", effectiveMediaId],
    queryFn: async () => {
      const res = await DataService.tracker.getByManga(effectiveMediaId);
      return (res as any)?.value || res || [];
    },
    enabled: !!effectiveMediaId,
  });
  const isTracked = trackersList.some((t: any) => t.provider === "anilist");

  useFocusEffect(
    useCallback(() => {
      refetchProgress();
      queryClient.invalidateQueries({
        queryKey: ["anime-history", effectiveMediaId],
      });
      queryClient.invalidateQueries({ queryKey: ["library"] });
    }, [refetchProgress, queryClient, effectiveMediaId]),
  );

  // Resolve pkg & url waterfall
  const resolvedPkg =
    paramPkg ||
    libraryItem?.pkg ||
    historyEntries[0]?.pkg ||
    "";
  const matchedExt = installedExtensions.find(
    (e: any) => e.pkg === resolvedPkg,
  );
  const extCode = matchedExt?.code || null;
  const sourceBadge = resolveExtensionBadge(resolvedPkg, installedExtensions);

  const {
    data: episodes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "anime-episodes",
      effectiveMediaId,
      resolvedPkg,
      effectiveEpisodeSourceUrl,
    ],
    queryFn: async () => {
      const cached = await DataService.db.getChapters(effectiveMediaId);
      const cachedList = (cached as any)?.value || cached || [];

      if (!resolvedPkg && !effectiveEpisodeSourceUrl) {
        return cachedList;
      }

      try {
        let codeToUse = extCode;
        if (!codeToUse && resolvedPkg) {
          const exts = await DataService.db.getExtensions();
          const extList = (exts as any)?.value || exts || [];
          const found = extList.find((e: any) => e.pkg === resolvedPkg);
          if (found?.code) codeToUse = found.code;
        }

        if (resolvedPkg && codeToUse) {
          const result: any = await DataService.executeExtension({
            pkg: resolvedPkg,
            code: codeToUse,
            contextArgs: {
              type: "fetchChapters",
              mangaUrl: effectiveEpisodeSourceUrl,
            },
          });

          const rawChapters: any[] =
            result?.data ||
            result?.chapters ||
            result?.value ||
            (Array.isArray(result) ? result : []);

          if (Array.isArray(rawChapters) && rawChapters.length > 0) {
            const formattedEpisodes = rawChapters.map(
              (ch: any, idx: number) => ({
                id: String(
                  ch.id || `${effectiveMediaId}-ep-${ch.number ?? idx + 1}`,
                ),
                number:
                  ch.number !== undefined && !isNaN(Number(ch.number))
                    ? Number(ch.number)
                    : idx + 1,
                title:
                  ch.title ||
                  (ch.number !== undefined
                    ? `Episode ${ch.number}`
                    : `Episode ${idx + 1}`),
                date: ch.date || "",
                scanlator: ch.scanlator || "",
                url: ch.url || "",
              }),
            );

            // Persist episodes for EVERY season so Player Prev/Next and History Continue work across seasons
            await DataService.db.saveChapters({
              mangaId: effectiveMediaId,
              chapters: formattedEpisodes,
            });

            return formattedEpisodes;
          }
        }
      } catch (err) {
        console.warn(
          "[AnimeDetails] Failed to fetch episodes from extension:",
          err,
        );
      }

      return cachedList;
    },
    enabled: !!effectiveMediaId,
  });

  // Load metadata & seasons for current season selection
  useEffect(() => {
    if (!effectiveMediaId) return;
    let cancelled = false;

    // Reset metadata cleanly when switching to an alternate season before async load finishes
    if (isAlternateSeason) {
      setDescription("No description available.");
      setGenres([]);
      setMediaStatus("");
    }

    DataService.db
      .getMangaCache(effectiveMediaId)
      .then(async (cached: any) => {
        if (cancelled) return;
        const c = (cached as any)?.value || cached;
        if (c?.description && c.description !== "No description available.") {
          setDescription(c.description);
        } else if (!isAlternateSeason) {
          setDescription("No description available.");
        }
        if (c?.title) setDisplayTitle(c.title);
        if (c?.coverUrl || c?.cover_url) {
          setDisplayCover(c.coverUrl || c.cover_url);
        }
        if (c?.status) setMediaStatus(c.status);
        if (c?.genres) {
          try {
            const parsed = Array.isArray(c.genres)
              ? c.genres
              : JSON.parse(c.genres);
            if (Array.isArray(parsed)) setGenres(parsed);
          } catch {}
        }

        if (resolvedPkg && effectiveEpisodeSourceUrl) {
          let codeToUse = extCode;
          if (!codeToUse) {
            const exts = await DataService.db.getExtensions();
            const extList = (exts as any)?.value || exts || [];
            const found = extList.find((e: any) => e.pkg === resolvedPkg);
            if (found?.code) codeToUse = found.code;
          }

          if (codeToUse && !cancelled) {
            try {
              const res: any = await DataService.executeExtension({
                pkg: resolvedPkg,
                code: codeToUse,
                contextArgs: {
                  type: "fetchMangaDetails",
                  mangaUrl: effectiveEpisodeSourceUrl,
                },
              });
              if (cancelled) return;
              const details = res?.data || res;
              if (
                Array.isArray(details?.seasons) &&
                details.seasons.length > 0
              ) {
                setSeasons((prev) => {
                  if (!prev.length) return details.seasons;
                  const prevById = new Map(prev.map((s: any) => [s.id, s]));
                  return details.seasons.map((s: any) => {
                    const old = prevById.get(s.id);
                    const keepOldUrl =
                      old?.url &&
                      String(s.url).includes("risto_season=") &&
                      !String(old.url).includes("risto_season=");
                    return {
                      ...s,
                      url: keepOldUrl ? old.url : s.url,
                      coverUrl: s.coverUrl || old?.coverUrl,
                    };
                  });
                });
              }
              if (details?.title) setDisplayTitle(details.title);
              if (details?.coverUrl) setDisplayCover(details.coverUrl);
              if (details?.status) setMediaStatus(details.status);
              if (Array.isArray(details?.genres)) setGenres(details.genres);
              if (details?.description) {
                setDescription(details.description);
              }

              await DataService.db.saveMangaCache({
                id: effectiveMediaId,
                title:
                  details?.title ||
                  displayMetaRef.current.title ||
                  paramTitle ||
                  "Unknown",
                coverUrl:
                  details?.coverUrl ||
                  displayMetaRef.current.cover ||
                  paramCover ||
                  "",
                description: details?.description || "",
                status: details?.status || "",
                genres: Array.isArray(details?.genres) ? details.genres : [],
                url: effectiveEpisodeSourceUrl,
                pkg: resolvedPkg,
                mediaType: "anime",
              });
            } catch (_) {}
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [
    effectiveMediaId,
    effectiveEpisodeSourceUrl,
    isAlternateSeason,
    resolvedPkg,
    extCode,
    paramTitle,
    paramCover,
  ]);

  const progressMap = useMemo(() => {
    const map = new Map<string, { isRead: boolean; lastPage: number }>();
    for (const row of progressRows || []) {
      const chId = String(row.chapter_id || row.chapterId || "");
      if (!chId) continue;
      map.set(chId, {
        isRead: Boolean(row.is_read ?? row.isRead),
        lastPage: Number(row.last_page ?? row.lastPage ?? 0),
      });
    }
    return map;
  }, [progressRows]);

  const sortedEpisodes = useMemo(() => {
    if (!episodes || !Array.isArray(episodes)) return [];
    return [...episodes].sort(
      (a: any, b: any) => Number(a.number || 0) - Number(b.number || 0),
    );
  }, [episodes]);

  const unwatchedCount = useMemo(() => {
    return sortedEpisodes.filter(
      (ep: any) => !progressMap.get(String(ep.id))?.isRead,
    ).length;
  }, [sortedEpisodes, progressMap]);

  const filteredEpisodes = useMemo(() => {
    let list = [...sortedEpisodes];
    if (filterMode === "unwatched") {
      list = list.filter((ep: any) => !progressMap.get(String(ep.id))?.isRead);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (ep: any) =>
          (ep.title && ep.title.toLowerCase().includes(q)) ||
          (ep.number !== undefined && String(ep.number).includes(q)),
      );
    }
    if (!sortAsc) {
      list.reverse();
    }
    return list;
  }, [sortedEpisodes, filterMode, progressMap, searchQuery, sortAsc]);

  // Determine Continue / Start episode
  const { targetEpisode, primaryButtonLabel } = useMemo(() => {
    if (sortedEpisodes.length === 0) {
      return { targetEpisode: null, primaryButtonLabel: "Start Watching" };
    }
    const lastHistory = historyEntries[0];
    if (lastHistory) {
      const lastEpIdx = sortedEpisodes.findIndex(
        (ep: any) =>
          String(ep.id) ===
          String(lastHistory.chapterId || lastHistory.chapter_id),
      );
      if (lastEpIdx >= 0) {
        const lastEp = sortedEpisodes[lastEpIdx];
        const prog = progressMap.get(String(lastEp.id));
        if (prog?.isRead && lastEpIdx + 1 < sortedEpisodes.length) {
          const nextEp = sortedEpisodes[lastEpIdx + 1];
          return {
            targetEpisode: nextEp,
            primaryButtonLabel: `Continue · Ep ${nextEp.number}`,
          };
        }
        return {
          targetEpisode: lastEp,
          primaryButtonLabel: `Continue · Ep ${lastEp.number}`,
        };
      }
    }
    const firstUnwatched = sortedEpisodes.find(
      (ep: any) => !progressMap.get(String(ep.id))?.isRead,
    );
    const chosen = firstUnwatched || sortedEpisodes[0];
    const hasAnyProgress = progressMap.size > 0;
    return {
      targetEpisode: chosen,
      primaryButtonLabel: hasAnyProgress
        ? `Continue · Ep ${chosen.number}`
        : "Start Watching",
    };
  }, [sortedEpisodes, historyEntries, progressMap]);

  const toggleLibrary = useMutation({
    mutationFn: async () => {
      return DataService.db.toggleLibrary({
        id: effectiveMediaId,
        title: displayTitle,
        coverUrl: displayCover || undefined,
        url: effectiveEpisodeSourceUrl,
        pkg: resolvedPkg || undefined,
        mediaType: "anime",
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library"] });
    },
  });

  const handleBrowseSource = () => {
    if (!resolvedPkg) return;
    router.push({
      pathname: "/(tabs)/browse" as any,
      params: { pkg: resolvedPkg },
    });
  };

  const playEpisode = async (episode: any) => {
    if (!resolvedPkg) return;

    DataService.db
      .addHistory({
        mangaId: effectiveMediaId,
        mangaTitle: displayTitle || paramTitle,
        mangaCover: displayCover || paramCover,
        mangaUrl: effectiveEpisodeSourceUrl,
        chapterId: episode.id,
        chapterTitle: episode.title || `Episode ${episode.number}`,
        startedAt: new Date().toISOString(),
        pkg: resolvedPkg,
        type: "anime",
      })
      .catch(() => {});

    router.push({
      pathname: "/player/[animeId]/[episodeId]" as any,
      params: {
        animeId: effectiveMediaId,
        episodeId: episode.id,
        pkg: resolvedPkg,
        episodeUrl: episode.url,
        episodeTitle: episode.title || `Episode ${episode.number}`,
        animeTitle: displayTitle || paramTitle || "",
        animeCover: displayCover || paramCover || "",
        animeUrl: effectiveEpisodeSourceUrl || "",
      },
    });
  };

  useEffect(() => {
    if (!effectiveMediaId) return;
    DataService.download
      .getMangaDownloads(effectiveMediaId)
      .then((result: any[]) => {
        const statuses: Record<string, string> = {};
        for (const dl of result || []) {
          statuses[dl.chapterId] = dl.status;
        }
        setDownloadStatuses(statuses);
      })
      .catch(() => {});

    const api = (window as any).api;
    if (api?.download?.onEvent) {
      const unsub = api.download.onEvent((data: any) => {
        if (data.mangaId !== effectiveMediaId) return;
        if (
          data.type === "progress" ||
          data.type === "start" ||
          data.type === "queued"
        ) {
          setActiveDownloadProgress((prev) => ({
            ...prev,
            [data.chapterId]: {
              cached: data.cached || 0,
              total: data.total || 0,
              status: data.type === "queued" ? "queued" : "downloading",
            },
          }));
          setDownloadStatuses((prev) => ({
            ...prev,
            [data.chapterId]: data.type === "queued" ? "queued" : "downloading",
          }));
        } else if (
          data.type === "completed" ||
          data.type === "error" ||
          data.type === "canceled"
        ) {
          setActiveDownloadProgress((prev) => {
            const next = { ...prev };
            delete next[data.chapterId];
            return next;
          });
          setDownloadStatuses((prev) => ({
            ...prev,
            [data.chapterId]: data.type === "canceled" ? "" : data.type,
          }));
          setResolvingEpisodes((prev) => {
            const next = new Set(prev);
            next.delete(data.chapterId);
            return next;
          });
        }
      });
      return () => unsub();
    }
    return undefined;
  }, [effectiveMediaId]);

  const downloadEpisode = async (
    episode: any,
    options?: { silent?: boolean },
  ): Promise<boolean> => {
    const pkgToUse = resolvedPkg;
    if (!pkgToUse || !episode?.url) return false;

    const epId = String(episode.id);
    if (resolvingEpisodes.has(epId)) return false;
    const existingStatus = downloadStatuses[epId];
    if (
      existingStatus === "completed" ||
      existingStatus === "downloading" ||
      existingStatus === "queued"
    ) {
      return false;
    }

    setResolvingEpisodes((prev) => new Set(prev).add(epId));
    setDownloadStatuses((prev) => ({ ...prev, [epId]: "queued" }));

    try {
      let codeToUse = extCode;
      if (!codeToUse) {
        const exts = await DataService.db.getExtensions();
        const extList = (exts as any)?.value || exts || [];
        const found = extList.find((e: any) => e.pkg === pkgToUse);
        if (found?.code) codeToUse = found.code;
      }

      const result: any = await DataService.executeExtension({
        pkg: pkgToUse,
        code: codeToUse || "",
        contextArgs: { type: "fetchPages", chapterUrl: episode.url },
      });

      const rawUrls = extractRawStreamUrls(result);
      const servers = normalizeStreamServers(rawUrls);
      const directServers = servers.filter(
        (srv) => srv.type === "mp4" || srv.type === "hls",
      );

      if (directServers.length === 0) {
        throw new Error(
          servers.length > 0
            ? "Offline download requires a direct MP4 or HLS stream (only web embeds returned)."
            : "No streaming servers found for this episode.",
        );
      }

      // Prefer alive MP4 first (fastest single-file download), then alive HLS, then untested direct
      const prioritized = [
        ...directServers.filter((s) => s.type === "mp4"),
        ...directServers.filter((s) => s.type === "hls"),
      ];

      let chosen = prioritized[0];
      for (const candidate of prioritized) {
        try {
          const probe = await DataService.probeStream(
            candidate.url,
            candidate.headers,
            3500,
          );
          if (probe.alive) {
            chosen = candidate;
            break;
          }
        } catch {
          /* continue trying candidates */
        }
      }

      await DataService.download.start({
        mangaId: effectiveMediaId,
        chapterId: epId,
        pageUrls: [chosen.url],
        type: "anime",
        mangaTitle: displayTitle || paramTitle || "Anime",
        chapterTitle: episode.title || `Episode ${episode.number}`,
        headers: chosen.headers,
      });
      return true;
    } catch (e: any) {
      console.error("[AnimeDetails] Episode download failed:", e);
      setDownloadStatuses((prev) => ({ ...prev, [epId]: "error" }));
      if (!options?.silent) {
        Alert.alert(
          "Download Unavailable",
          e?.message || "Could not find a downloadable stream for this episode.",
        );
      }
      return false;
    } finally {
      setResolvingEpisodes((prev) => {
        const next = new Set(prev);
        next.delete(epId);
        return next;
      });
    }
  };

  const handleDownloadActionPress = (episode: any) => {
    const epId = String(episode.id);
    const dlStatus = downloadStatuses[epId];
    const epLabel = episode.title || `Episode ${episode.number}`;

    if (dlStatus === "completed") {
      Alert.alert(
        "Remove Offline Episode",
        `Delete downloaded files for ${epLabel}?`,
        [
          { text: "Keep", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              await DataService.download.remove({
                mangaId: effectiveMediaId,
                chapterId: epId,
              });
              setDownloadStatuses((prev) => {
                const next = { ...prev };
                delete next[epId];
                return next;
              });
            },
          },
        ],
      );
      return;
    }

    if (dlStatus === "downloading" || dlStatus === "queued") {
      Alert.alert("Cancel Download", `Stop downloading ${epLabel}?`, [
        { text: "Continue", style: "cancel" },
        {
          text: "Cancel Download",
          style: "destructive",
          onPress: () => {
            DataService.download
              .cancel({ mangaId: effectiveMediaId, chapterId: epId })
              .catch(() => {});
          },
        },
      ]);
      return;
    }

    void downloadEpisode(episode);
  };

  const downloadNextUnwatched = async () => {
    if (batchDownloading || !resolvedPkg) return;
    const targets = sortedEpisodes
      .filter((ep: any) => {
        const epId = String(ep.id);
        const isWatched = Boolean(progressMap.get(epId)?.isRead);
        const dl = downloadStatuses[epId];
        return (
          !isWatched &&
          dl !== "completed" &&
          dl !== "downloading" &&
          dl !== "queued"
        );
      })
      .slice(0, 3);

    if (targets.length === 0) {
      Alert.alert(
        "Nothing to Download",
        "All unwatched episodes are already downloaded or queued.",
      );
      return;
    }

    setBatchDownloading(true);
    let queuedCount = 0;
    try {
      for (const ep of targets) {
        const ok = await downloadEpisode(ep, { silent: true });
        if (ok) queuedCount++;
      }
      if (queuedCount === 0) {
        Alert.alert(
          "No Direct Streams Found",
          "These episodes only returned web embeds rather than downloadable MP4/HLS streams.",
        );
      }
    } finally {
      setBatchDownloading(false);
    }
  };

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              refetch();
            }}
          />
        }
      >
        {/* Hero Image */}
        <View style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}>
          {displayCover ? (
            <Image
              source={buildImageSource(displayCover, effectiveEpisodeSourceUrl)}
              style={{ width: SCREEN_WIDTH, height: HERO_HEIGHT }}
              contentFit="cover"
              transition={150}
            />
          ) : (
            <View className="flex-1 bg-card items-center justify-center">
              <Play size={64} color="#94a3b8" />
            </View>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.88)"]}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: HERO_HEIGHT * 0.6,
            }}
          />
          <TouchableOpacity
            className="absolute top-12 left-4 z-10 bg-black/40 rounded-full p-2"
            onPress={() => router.back()}
          >
            <ArrowLeft size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Info Section */}
        <View className="px-4 -mt-16 relative z-10">
          <Typography
            className="text-white text-2xl font-bold mb-1"
            numberOfLines={3}
          >
            {displayTitle || "Unknown"}
          </Typography>
        </View>

        {/* Quick Actions: Continue/Start Watching + Track + Bookmark */}
        <View className="px-4 mt-4 flex-row gap-3">
          <Button
            title={primaryButtonLabel}
            variant="primary"
            className="flex-1"
            onPress={() => {
              if (targetEpisode) playEpisode(targetEpisode);
            }}
            disabled={!targetEpisode}
          />
          <TouchableOpacity
            className={`w-12 h-12 rounded-xl items-center justify-center border ${
              isTracked
                ? "bg-[#02A9FF]/20 border-[#02A9FF]"
                : "bg-card border-border"
            }`}
            onPress={() => setShowTrackingModal(true)}
            accessibilityLabel="Track on AniList"
          >
            <Link2 size={20} color={isTracked ? "#02A9FF" : "#94a3b8"} />
          </TouchableOpacity>
          <TouchableOpacity
            className={`w-12 h-12 rounded-xl items-center justify-center border border-border ${
              isInLibrary ? "bg-primary/20 border-primary" : "bg-card"
            }`}
            onPress={() => toggleLibrary.mutate()}
            disabled={toggleLibrary.isPending}
          >
            {toggleLibrary.isPending ? (
              <ActivityIndicator size="small" color="#e11d48" />
            ) : (
              <Bookmark
                size={22}
                color={isInLibrary ? "#e11d48" : "#94a3b8"}
                fill={isInLibrary ? "#e11d48" : "none"}
              />
            )}
          </TouchableOpacity>
        </View>

        {/* Clickable Source Badge + Status & Genres */}
        <View className="px-4 mt-4 flex-row flex-wrap gap-2 items-center">
          {!!resolvedPkg && (
            <TouchableOpacity
              onPress={handleBrowseSource}
              activeOpacity={0.75}
              className="flex-row items-center gap-1.5 bg-primary/15 border border-primary/30 px-3 py-1 rounded-full"
            >
              {sourceBadge?.color && (
                <View
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 99,
                    backgroundColor: sourceBadge.color,
                  }}
                />
              )}
              <Typography className="text-primary text-xs font-semibold">
                {sourceBadge?.name || resolvedPkg}
              </Typography>
              <ChevronRight size={12} color="#e11d48" />
            </TouchableOpacity>
          )}
          {!!mediaStatus && (
            <View className="bg-muted px-3 py-1 rounded-full">
              <Typography className="text-muted-foreground text-xs uppercase font-medium">
                {mediaStatus}
              </Typography>
            </View>
          )}
          {genres.map((genre, idx) => (
            <View
              key={idx}
              className="bg-card px-3 py-1 rounded-full border border-border"
            >
              <Typography className="text-muted-foreground text-xs">
                {genre}
              </Typography>
            </View>
          ))}
        </View>

        {/* Description */}
        <View className="px-4 mt-6">
          <View className="flex-row items-center mb-2">
            <AlignLeft size={16} color="#94a3b8" />
            <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
              Synopsis
            </Typography>
          </View>
          <Card>
            <CardContent>
              <Typography
                className="leading-relaxed"
                numberOfLines={descExpanded ? undefined : 4}
              >
                {description}
              </Typography>
              {description.length > 120 && (
                <TouchableOpacity
                  className="mt-2"
                  onPress={() => setDescExpanded(!descExpanded)}
                >
                  <Typography className="text-primary text-sm">
                    {descExpanded ? "Show less" : "Read more"}
                  </Typography>
                </TouchableOpacity>
              )}
            </CardContent>
          </Card>
        </View>

        {/* Seasons */}
        {seasons.length > 1 && (
          <View className="mt-6">
            <Typography className="px-4 mb-2 font-semibold text-muted-foreground uppercase text-xs tracking-wide">
              Seasons
            </Typography>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
            >
              {seasons.map((season: any) => {
                const currentUrl =
                  activeSeasonUrl ||
                  seasons.find((s: any) => s.isCurrent)?.url ||
                  seasons[0]?.url;
                const isActive = season.url === currentUrl;
                return (
                  <TouchableOpacity
                    key={season.id || season.url}
                    onPress={() => {
                      setActiveSeasonUrl(season.url);
                      if (season.title) setDisplayTitle(season.title);
                      if (season.coverUrl) setDisplayCover(season.coverUrl);
                    }}
                    className={`px-3.5 py-2 rounded-lg border ${
                      isActive
                        ? "bg-primary border-primary"
                        : "bg-card border-border"
                    }`}
                  >
                    <Typography
                      className={
                        isActive
                          ? "text-white text-xs font-semibold"
                          : "text-foreground text-xs font-medium"
                      }
                    >
                      {season.title}
                    </Typography>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Episodes */}
        <View className="px-4 mt-6 mb-8">
          <View className="flex-row items-center justify-between mb-3">
            <View className="flex-row items-center">
              <Play size={16} color="#94a3b8" />
              <Typography className="ml-2 font-semibold text-muted-foreground uppercase text-xs tracking-widest">
                Episodes
              </Typography>
            </View>
            <View className="flex-row items-center gap-2">
              <TouchableOpacity
                onPress={() => setFilterMode("all")}
                className={`px-2.5 py-1 rounded-lg border ${
                  filterMode === "all"
                    ? "bg-primary/15 border-primary/40"
                    : "bg-card border-border"
                }`}
              >
                <Typography
                  className={`text-xs font-medium ${
                    filterMode === "all"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  All ({sortedEpisodes.length})
                </Typography>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setFilterMode("unwatched")}
                className={`px-2.5 py-1 rounded-lg border ${
                  filterMode === "unwatched"
                    ? "bg-primary/15 border-primary/40"
                    : "bg-card border-border"
                }`}
              >
                <Typography
                  className={`text-xs font-medium ${
                    filterMode === "unwatched"
                      ? "text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  Unwatched ({unwatchedCount})
                </Typography>
              </TouchableOpacity>
            </View>
          </View>

          {/* Batch Download Next Unwatched Episodes */}
          {sortedEpisodes.length > 0 && !!resolvedPkg && unwatchedCount > 0 && (
            <TouchableOpacity
              onPress={downloadNextUnwatched}
              disabled={batchDownloading}
              className="h-9 px-3 rounded-xl bg-card border border-border flex-row items-center justify-center gap-1.5 mb-3"
              activeOpacity={0.7}
            >
              {batchDownloading ? (
                <ActivityIndicator size="small" color="#e11d48" />
              ) : (
                <Download size={14} color="#e11d48" />
              )}
              <Typography className="text-xs font-semibold text-foreground">
                Download Next 3 Unwatched
              </Typography>
            </TouchableOpacity>
          )}

          {/* Episode Search & Sort Controls */}
          {sortedEpisodes.length > 0 && (
            <View className="flex-row items-center gap-2 mb-3">
              <View className="flex-1 flex-row items-center bg-card border border-border rounded-xl px-3 py-1.5 h-10">
                <Search size={16} color="#94a3b8" />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search episode..."
                  placeholderTextColor="#71717a"
                  className="flex-1 ml-2 text-foreground text-sm py-0"
                  returnKeyType="search"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {!!searchQuery && (
                  <TouchableOpacity
                    onPress={() => setSearchQuery("")}
                    className="p-1"
                  >
                    <X size={14} color="#94a3b8" />
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity
                onPress={() => setSortAsc((prev) => !prev)}
                className={`h-10 px-3 rounded-xl border flex-row items-center gap-1.5 ${
                  !sortAsc
                    ? "bg-primary/15 border-primary/40"
                    : "bg-card border-border"
                }`}
                activeOpacity={0.7}
              >
                <ArrowUpDown
                  size={15}
                  color={!sortAsc ? "#e11d48" : "#94a3b8"}
                />
                <Typography
                  className={`text-xs font-medium ${
                    !sortAsc ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {sortAsc ? "Oldest" : "Newest"}
                </Typography>
              </TouchableOpacity>
            </View>
          )}

          {isLoading ? (
            <View className="py-8 items-center">
              <ActivityIndicator size="large" color="#e11d48" />
            </View>
          ) : sortedEpisodes.length === 0 ? (
            <View className="py-8 items-center bg-card rounded-xl border border-border">
              <Play size={32} color="#94a3b8" />
              <Typography className="mt-2 text-muted-foreground">
                No episodes available
              </Typography>
              <Button
                title="Refresh"
                variant="outline"
                className="mt-4"
                onPress={() => refetch()}
              />
            </View>
          ) : filteredEpisodes.length === 0 ? (
            <View className="py-8 items-center bg-card rounded-xl border border-border">
              <Search size={28} color="#94a3b8" />
              <Typography className="mt-2 text-muted-foreground text-sm">
                {searchQuery.trim()
                  ? `No episodes match "${searchQuery}"`
                  : "All episodes have been watched"}
              </Typography>
            </View>
          ) : (
            <View className="bg-card rounded-xl border border-border overflow-hidden">
              {filteredEpisodes.map((episode: any, idx: number) => {
                const epKey = String(episode.id);
                const prog = progressMap.get(epKey);
                const isWatched = Boolean(prog?.isRead);
                const resumeSec = prog?.lastPage || 0;
                const dlStatus = downloadStatuses[epKey];
                const isResolving = resolvingEpisodes.has(epKey);
                const dlProg = activeDownloadProgress[epKey];
                const dlPct =
                  dlProg && dlProg.total > 0
                    ? Math.round(((dlProg.cached || 0) / dlProg.total) * 100)
                    : null;

                return (
                  <View
                    key={episode.id}
                    className={`flex-row items-center px-4 py-3.5 ${
                      idx !== filteredEpisodes.length - 1
                        ? "border-b border-border/50"
                        : ""
                    }`}
                  >
                    <TouchableOpacity
                      className="flex-1 flex-row items-center"
                      onPress={() => playEpisode(episode)}
                    >
                      <View
                        className={`w-8 h-8 rounded-full items-center justify-center mr-3 ${
                          isWatched ? "bg-emerald-500/15" : "bg-primary/20"
                        }`}
                      >
                        {isWatched ? (
                          <CheckCircle size={15} color="#10b981" />
                        ) : (
                          <Play size={12} color="#e11d48" fill="#e11d48" />
                        )}
                      </View>
                      <View className="flex-1">
                        <Typography
                          className={`font-medium ${isWatched ? "text-muted-foreground" : ""}`}
                          numberOfLines={1}
                        >
                          {episode.title || `Episode ${episode.number}`}
                        </Typography>
                        <View className="flex-row items-center gap-2 mt-0.5">
                          {isWatched && (
                            <Typography className="text-[11px] font-semibold text-emerald-500">
                              Watched
                            </Typography>
                          )}
                          {!isWatched && resumeSec > 10 && (
                            <Typography className="text-[11px] font-semibold text-primary">
                              Paused at {formatResumeTime(resumeSec)}
                            </Typography>
                          )}
                          {dlStatus === "completed" && (
                            <Typography className="text-[11px] font-semibold text-emerald-500">
                              Offline
                            </Typography>
                          )}
                          {!!episode.date && (
                            <Typography className="text-xs text-muted-foreground">
                              {episode.date}
                            </Typography>
                          )}
                        </View>
                      </View>
                      <ChevronRight size={18} color="#94a3b8" />
                    </TouchableOpacity>

                    <View className="ml-2">
                      {dlStatus === "completed" ? (
                        <TouchableOpacity
                          onPress={() => handleDownloadActionPress(episode)}
                          className="p-1"
                          accessibilityLabel="Downloaded offline"
                        >
                          <CheckCircle size={18} color="#22c55e" />
                        </TouchableOpacity>
                      ) : isResolving ||
                        dlStatus === "queued" ||
                        dlStatus === "downloading" ? (
                        <TouchableOpacity
                          onPress={() => handleDownloadActionPress(episode)}
                          className="flex-row items-center p-1"
                          accessibilityLabel="Cancel episode download"
                        >
                          {dlPct !== null && (
                            <Typography className="text-xs text-primary font-semibold mr-1.5">
                              {dlPct}%
                            </Typography>
                          )}
                          <Loader2 size={18} color="#e11d48" />
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          onPress={() => handleDownloadActionPress(episode)}
                          className="p-1"
                          accessibilityLabel="Download episode"
                        >
                          <Download size={18} color="#94a3b8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      <TrackingModal
        visible={showTrackingModal}
        onClose={() => setShowTrackingModal(false)}
        mediaId={effectiveMediaId}
        mediaTitle={displayTitle || paramTitle || "Anime"}
        mediaType="anime"
        suggestedProgress={sortedEpisodes.reduce((max: number, ep: any) => {
          if (progressMap.get(String(ep.id))?.isRead) {
            return Math.max(max, Math.floor(Number(ep.number || 0)));
          }
          return max;
        }, 0)}
        onTrackerChanged={() => {
          refetchTrackers();
        }}
      />
    </View>
  );
}
