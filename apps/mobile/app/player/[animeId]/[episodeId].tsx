import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useEventListener } from "expo";
import { useVideoPlayer, VideoView, type VideoContentFit } from "expo-video";
import { WebView } from "react-native-webview";
import * as WebBrowser from "expo-web-browser";
import { LinearGradient } from "expo-linear-gradient";
import { Typography, Button } from "@mobile/native/ui";
import { DataService } from "@renderer/shared/api";
import {
  ArrowLeft,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Server,
  Play,
  X,
  SkipForward,
  List,
  Lock,
  Unlock,
  Maximize2,
  CheckCircle,
} from "lucide-react-native";
import {
  parseEpisodeNumber,
  evaluateSkipUIState,
  type EpisodeSkipTimes,
} from "@common/services/skipTimes.service";
import {
  extractRawStreamUrls,
  isAdStreamUrl,
  normalizeStreamServers,
  selectPreferredServerIndex,
  makeEpisodePrefetchKey,
  shouldPrefetchNextEpisode,
  sharedEpisodeStreamCache,
  prefetchNextEpisodeSkipTimes,
  type EpisodeStreamCacheEntry,
  type NormalizedStreamServer,
} from "@common/services/episodePrefetch.service";
import {
  getVideoHeaders,
  sanitizeHeadersMap,
  DEFAULT_MOBILE_USER_AGENT,
} from "../../../src/mobile/cf-cookies";
import { MobileTracker } from "../../../src/mobile/tracker.native";

function formatEpisodeTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem}`;
}

export type ServerOption = NormalizedStreamServer;

async function fetchAndNormalizeMobileEpisode(
  pkg: string,
  targetEpisodeUrl: string,
): Promise<EpisodeStreamCacheEntry> {
  const allExts = await DataService.db.getExtensions();
  const extList = (allExts as any)?.value || allExts || [];
  const ext = extList.find((e: any) => e.pkg === pkg);
  if (!ext?.code) throw new Error("Extension not found");

  const result = await DataService.executeExtension({
    pkg,
    code: ext.code,
    contextArgs: { type: "fetchPages", chapterUrl: targetEpisodeUrl },
  });

  const rawUrls = extractRawStreamUrls(result);
  if (!rawUrls || rawUrls.length === 0) {
    throw new Error("No stream URLs returned from extension");
  }

  const parsedServers = normalizeStreamServers(rawUrls);
  if (parsedServers.length === 0) {
    throw new Error("No playable video streams found (ad-only feeds filtered)");
  }

  return {
    servers: parsedServers,
    fetchedAt: Date.now(),
  };
}

const INJECTED_POPUP_BLOCKER = `
(function() {
  window.open = function() { return null; };
  window.alert = function() {};
  window.confirm = function() { return false; };
  window.prompt = function() { return null; };

  function sanitizeLinks() {
    var links = document.querySelectorAll('a[target]');
    for (var i = 0; i < links.length; i++) {
      links[i].removeAttribute('target');
    }
  }
  setInterval(sanitizeLinks, 1000);

  function hookVideos() {
    var videos = document.querySelectorAll('video');
    for (var i = 0; i < videos.length; i++) {
      var v = videos[i];
      if (v.__hooked) continue;
      v.__hooked = true;
      v.addEventListener('timeupdate', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'timeupdate',
            currentTime: v.currentTime,
            duration: v.duration
          }));
        }
      });
      v.addEventListener('ended', function() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'ended'
          }));
        }
      });
    }
  }
  setInterval(hookVideos, 1000);
})();
true;
`;

// Direct Native Stream Player (HLS / MP4)
function DirectVideoPlayer({
  server,
  refererUrl,
  initialTime,
  contentFit = "contain",
  onProgress,
  onEnd,
  onRegisterSeek,
  onRegisterPlaybackRate,
  onRegisterFullscreen,
}: {
  server: ServerOption;
  refererUrl?: string;
  initialTime: number;
  contentFit?: VideoContentFit;
  onProgress: (currentTime: number, duration: number) => void;
  onEnd: () => void;
  onRegisterSeek?: (fn: ((seconds: number) => void) | null) => void;
  onRegisterPlaybackRate?: (fn: ((rate: number) => void) | null) => void;
  onRegisterFullscreen?: (fn: (() => void) | null) => void;
}) {
  const videoViewRef = useRef<VideoView | null>(null);
  const headers = useMemo(() => {
    return (
      sanitizeHeadersMap({
        ...getVideoHeaders(server.url, refererUrl),
        ...(server.headers || {}),
      }) || {}
    );
  }, [server.url, server.headers, refererUrl]);

  const videoSource = useMemo(() => {
    return {
      uri: server.url,
      headers,
      contentType:
        server.type === "hls"
          ? ("hls" as const)
          : server.type === "mp4"
            ? ("progressive" as const)
            : undefined,
    };
  }, [server.url, headers, server.type]);

  const hasAppliedInitialSeekRef = useRef(false);

  const player = useVideoPlayer(videoSource, (p) => {
    p.timeUpdateEventInterval = 1;
    p.play();
  });

  const applyInitialSeekIfReady = useCallback(
    (targetSeconds: number) => {
      if (hasAppliedInitialSeekRef.current || targetSeconds <= 10) return;
      if (player.status === "readyToPlay") {
        player.currentTime = targetSeconds;
        hasAppliedInitialSeekRef.current = true;
      }
    },
    [player],
  );

  useEffect(() => {
    hasAppliedInitialSeekRef.current = false;
  }, [server.url]);

  useEffect(() => {
    applyInitialSeekIfReady(initialTime);
  }, [initialTime, applyInitialSeekIfReady]);

  useEventListener(player, "statusChange", ({ status }) => {
    if (status === "readyToPlay") {
      applyInitialSeekIfReady(initialTime);
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    const duration = player.duration || 0;
    onProgress(currentTime, duration);
  });

  useEventListener(player, "playToEnd", () => {
    onEnd();
  });

  useEffect(() => {
    if (!onRegisterSeek) return;
    onRegisterSeek((seconds: number) => {
      player.currentTime = seconds;
    });
    return () => onRegisterSeek(null);
  }, [player, onRegisterSeek]);

  useEffect(() => {
    if (!onRegisterPlaybackRate) return;
    onRegisterPlaybackRate((rate: number) => {
      player.playbackRate = rate;
    });
    return () => onRegisterPlaybackRate(null);
  }, [player, onRegisterPlaybackRate]);

  useEffect(() => {
    if (!onRegisterFullscreen) return;
    onRegisterFullscreen(() => {
      videoViewRef.current?.enterFullscreen().catch(() => {});
    });
    return () => onRegisterFullscreen(null);
  }, [onRegisterFullscreen]);

  return (
    <VideoView
      ref={videoViewRef}
      player={player}
      style={{ width: "100%", height: "100%" }}
      contentFit={contentFit}
      fullscreenOptions={{
        enable: true,
        orientation: "landscape",
        autoExitOnRotate: false,
      }}
      nativeControls={true}
    />
  );
}

// Embedded Web Stream Player (Iframe with Popup Blocking)
function EmbedVideoPlayer({
  server,
  refererUrl,
  onProgress,
  onEnd,
  onRegisterSeek,
  onRegisterPlaybackRate,
}: {
  server: ServerOption;
  refererUrl?: string;
  onProgress: (currentTime: number, duration: number) => void;
  onEnd: () => void;
  onRegisterSeek?: (fn: ((seconds: number) => void) | null) => void;
  onRegisterPlaybackRate?: (fn: ((rate: number) => void) | null) => void;
}) {
  const webViewRef = useRef<any>(null);

  useEffect(() => {
    if (!onRegisterSeek) return;
    onRegisterSeek((seconds: number) => {
      const safeSec = Number.isFinite(seconds) ? seconds : 0;
      webViewRef.current?.injectJavaScript(`
        (function() {
          var videos = document.querySelectorAll('video');
          for (var i = 0; i < videos.length; i++) {
            videos[i].currentTime = ${safeSec};
          }
        })();
        true;
      `);
    });
    return () => onRegisterSeek(null);
  }, [onRegisterSeek]);

  useEffect(() => {
    if (!onRegisterPlaybackRate) return;
    onRegisterPlaybackRate((rate: number) => {
      const safeRate = Number.isFinite(rate) && rate > 0 ? rate : 1;
      webViewRef.current?.injectJavaScript(`
        (function() {
          var videos = document.querySelectorAll('video');
          for (var i = 0; i < videos.length; i++) {
            videos[i].playbackRate = ${safeRate};
          }
        })();
        true;
      `);
    });
    return () => onRegisterPlaybackRate(null);
  }, [onRegisterPlaybackRate]);

  const headers = useMemo(() => {
    return (
      sanitizeHeadersMap({
        ...getVideoHeaders(server.url, refererUrl),
        ...(server.headers || {}),
      }) || {}
    );
  }, [server.url, server.headers, refererUrl]);

  const onShouldStartLoadWithRequest = useCallback((request: any) => {
    const reqUrl = (request.url || "").toLowerCase();
    if (reqUrl === "about:blank" || reqUrl.startsWith("about:")) return true;
    if (
      reqUrl.startsWith("intent:") ||
      reqUrl.startsWith("market:") ||
      reqUrl.startsWith("itms-app:") ||
      reqUrl.startsWith("itms-apps:") ||
      reqUrl.startsWith("vnd.youtube:")
    ) {
      return false;
    }
    if (isAdStreamUrl(reqUrl)) {
      return false;
    }
    return true;
  }, []);

  return (
    <WebView
      ref={webViewRef}
      source={{
        uri: server.url,
        headers,
      }}
      userAgent={DEFAULT_MOBILE_USER_AGENT}
      allowsFullscreenVideo={true}
      allowsInlineMediaPlayback={true}
      mediaPlaybackRequiresUserAction={false}
      javaScriptEnabled={true}
      domStorageEnabled={true}
      setSupportMultipleWindows={false}
      javaScriptCanOpenWindowsAutomatically={false}
      injectedJavaScript={INJECTED_POPUP_BLOCKER}
      onMessage={(event: any) => {
        try {
          const data = JSON.parse(event.nativeEvent.data);
          if (data.type === "timeupdate") {
            onProgress(data.currentTime, data.duration);
          } else if (data.type === "ended") {
            onEnd();
          }
        } catch {}
      }}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      style={{ width: "100%", height: "100%", backgroundColor: "#000000" }}
    />
  );
}

export default function PlayerScreen() {
  const {
    animeId,
    episodeId,
    pkg,
    episodeUrl,
    episodeTitle,
    animeTitle,
    animeCover,
    animeUrl,
  } = useLocalSearchParams<{
    animeId: string;
    episodeId: string;
    pkg?: string;
    episodeUrl?: string;
    episodeTitle?: string;
    animeTitle?: string;
    animeCover?: string;
    animeUrl?: string;
  }>();

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showEpisodesModal, setShowEpisodesModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [aspectFit, setAspectFit] = useState<VideoContentFit>("contain");
  const [initialTime, setInitialTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [skipTimes, setSkipTimes] = useState<EpisodeSkipTimes | null>(null);
  const [outroDismissed, setOutroDismissed] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<1 | 1.5 | 2>(1);
  const [autoNextEnabled, setAutoNextEnabled] = useState(false);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(
    null,
  );

  const playerSeekRef = useRef<((seconds: number) => void) | null>(null);
  const registerPlayerSeek = useCallback(
    (fn: ((seconds: number) => void) | null) => {
      playerSeekRef.current = fn;
    },
    [],
  );
  const playerPlaybackRateRef = useRef<((rate: number) => void) | null>(null);
  const registerPlayerPlaybackRate = useCallback(
    (fn: ((rate: number) => void) | null) => {
      playerPlaybackRateRef.current = fn;
    },
    [],
  );
  const playerFullscreenRef = useRef<(() => void) | null>(null);
  const registerPlayerFullscreen = useCallback(
    (fn: (() => void) | null) => {
      playerFullscreenRef.current = fn;
    },
    [],
  );
  const cycleAspectFit = useCallback(() => {
    setAspectFit((prev) =>
      prev === "contain" ? "cover" : prev === "cover" ? "fill" : "contain",
    );
  }, []);
  const seekBy = useCallback(
    (deltaSeconds: number) => {
      const upper = duration > 0 ? duration : currentTime + 300;
      const target = Math.max(0, Math.min(upper, currentTime + deltaSeconds));
      playerSeekRef.current?.(target);
      setCurrentTime(target);
    },
    [currentTime, duration],
  );
  const cyclePlaybackSpeed = useCallback(() => {
    setPlaybackSpeed((prev) => {
      const next: 1 | 1.5 | 2 = prev === 1 ? 1.5 : prev === 1.5 ? 2 : 1;
      playerPlaybackRateRef.current?.(next);
      return next;
    });
  }, []);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchedTransitionsRef = useRef<Set<string>>(new Set());
  const lastProgressRef = useRef<{ isRead: boolean; lastPage: number } | null>(
    null,
  );

  // 1. Fetch episodes list & watch progress for drawer navigation
  const { data: allEpisodes } = useQuery({
    queryKey: ["anime-episodes", animeId],
    queryFn: async () => {
      const res = await DataService.db.getChapters(animeId);
      return (res as any)?.value || res || [];
    },
    enabled: !!animeId,
  });

  const { data: progressRows = [] } = useQuery({
    queryKey: ["anime-progress", animeId],
    queryFn: async () => {
      const res = await DataService.db.getProgress(animeId);
      return (res as any)?.value || res || [];
    },
    enabled: !!animeId,
  });

  const episodeProgressMap = useMemo(() => {
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
    if (!allEpisodes || !Array.isArray(allEpisodes)) return [];
    return [...allEpisodes].sort(
      (a: any, b: any) => Number(a.number || 0) - Number(b.number || 0),
    );
  }, [allEpisodes]);

  const currentEpIndex = sortedEpisodes.findIndex(
    (e: any) => e.id === episodeId,
  );
  const currentEpisode =
    currentEpIndex >= 0 ? sortedEpisodes[currentEpIndex] : null;
  const prevEpisode =
    currentEpIndex > 0 ? sortedEpisodes[currentEpIndex - 1] : null;
  const nextEpisode =
    currentEpIndex >= 0 && currentEpIndex < sortedEpisodes.length - 1
      ? sortedEpisodes[currentEpIndex + 1]
      : null;

  // Reset Skip Intro / Outro / resume state when episode changes
  useEffect(() => {
    setInitialTime(0);
    setCurrentTime(0);
    setDuration(0);
    setSkipTimes(null);
    setOutroDismissed(false);
    setPlaybackSpeed(1);
    playerPlaybackRateRef.current?.(1);
  }, [episodeId]);

  // Load autoNextAnime setting from SQLite
  useEffect(() => {
    DataService.db
      .getSetting("autoNextAnime")
      .then((val: any) => {
        const raw = typeof val === "object" && val !== null ? val.value : val;
        setAutoNextEnabled(raw === "true" || raw === true);
      })
      .catch(() => {});
  }, []);

  // Fetch AniSkip timestamps (MAL tracker -> AniList tracker -> AniList title search)
  const durationBucket = duration > 60 ? Math.floor(duration) : 0;
  useEffect(() => {
    const episodeNumber = parseEpisodeNumber(
      currentEpisode?.number,
      episodeTitle || currentEpisode?.title,
    );
    if (!episodeNumber || (!animeId && !animeTitle)) return;

    let cancelled = false;
    const loadSkipTimes = async () => {
      try {
        let malId: number | undefined;
        let anilistId: number | undefined;
        if (animeId) {
          const res = await DataService.tracker
            .getByManga(animeId)
            .catch(() => []);
          const trackers = (res as any)?.value ?? res ?? [];
          if (Array.isArray(trackers)) {
            const malTracker = trackers.find((t: any) => t.provider === "mal");
            const aniTracker = trackers.find(
              (t: any) => t.provider === "anilist",
            );
            const rawMal = malTracker
              ? Number(malTracker.remoteId ?? malTracker.remote_id)
              : 0;
            const rawAni = aniTracker
              ? Number(aniTracker.remoteId ?? aniTracker.remote_id)
              : 0;
            if (Number.isFinite(rawMal) && rawMal > 0) malId = rawMal;
            if (Number.isFinite(rawAni) && rawAni > 0) anilistId = rawAni;
          }
        }

        const result = await DataService.tracker.getSkipTimes({
          malId,
          anilistId,
          title: animeTitle,
          episodeNumber,
          episodeLength: durationBucket,
        });
        if (!cancelled && result) {
          setSkipTimes(result);
        }
      } catch {
        // Silent failure: fallback UI remains active
      }
    };

    loadSkipTimes();
    return () => {
      cancelled = true;
    };
  }, [
    animeId,
    animeTitle,
    currentEpisode?.number,
    currentEpisode?.title,
    episodeTitle,
    durationBucket,
  ]);

  const skipUIState = useMemo(
    () =>
      evaluateSkipUIState({
        skipTimes,
        currentTime,
        duration,
        hasNextEpisode: Boolean(nextEpisode),
        outroDismissed,
      }),
    [skipTimes, currentTime, duration, nextEpisode, outroDismissed],
  );

  const handleSkipIntro = useCallback(() => {
    if (!skipTimes?.op) return;
    playerSeekRef.current?.(skipTimes.op.endTime);
    setCurrentTime(skipTimes.op.endTime);
  }, [skipTimes]);

  // 2. Fetch saved watching progress to resume playback
  useEffect(() => {
    if (!animeId || !episodeId) return;
    DataService.db
      .getProgress(animeId)
      .then((res: any) => {
        const rows = res?.value || res || [];
        const currentProgress = rows.find(
          (r: any) => r.chapter_id === episodeId,
        );
        if (
          currentProgress &&
          currentProgress.last_page &&
          currentProgress.last_page > 10 &&
          !currentProgress.is_read
        ) {
          setInitialTime(currentProgress.last_page);
        }
      })
      .catch(() => {});
  }, [animeId, episodeId]);

  // 3. Flush progress synchronously
  const syncedEpisodeRef = useRef<Set<string>>(new Set());
  const flushProgress = useCallback(() => {
    if (progressTimerRef.current) {
      clearTimeout(progressTimerRef.current);
      progressTimerRef.current = null;
    }
    if (lastProgressRef.current && animeId && episodeId) {
      const { isRead, lastPage } = lastProgressRef.current;
      DataService.db
        .updateProgress({
          mangaId: animeId,
          chapterId: episodeId,
          isRead,
          lastPage,
        })
        .catch(console.error);

      if (isRead && !syncedEpisodeRef.current.has(episodeId)) {
        syncedEpisodeRef.current.add(episodeId);
        const epNum = parseEpisodeNumber(
          currentEpisode?.number,
          episodeTitle || currentEpisode?.title,
        );
        if (epNum) {
          void MobileTracker.autoSyncProgress(animeId, epNum);
        }
      }

      DataService.db
        .updateHistoryDuration({
          mangaId: animeId,
          chapterId: episodeId,
          durationSeconds: lastPage,
        })
        .catch(console.error);

      lastProgressRef.current = null;
    }
  }, [animeId, episodeId, currentEpisode?.number, currentEpisode?.title, episodeTitle]);

  useEffect(() => {
    return () => {
      flushProgress();
    };
  }, [flushProgress]);

  // 4. Debounced progress schedule + 80% background next-episode prefetch
  const handleProgress = useCallback(
    (ct: number, dur: number) => {
      if (Number.isFinite(ct) && ct >= 0) {
        setCurrentTime(ct);
      }
      if (Number.isFinite(dur) && dur > 0) {
        setDuration(dur);
      }
      if (ct <= 0) return;

      if (pkg && episodeId && nextEpisode?.url) {
        const transitionKey = `${pkg}::${episodeId}->${nextEpisode.id}`;
        if (
          shouldPrefetchNextEpisode({
            currentTime: ct,
            duration: dur,
            pkg,
            nextEpisodeUrl: nextEpisode.url,
            prefetchedKeys: prefetchedTransitionsRef.current,
            transitionKey,
          })
        ) {
          prefetchedTransitionsRef.current.add(transitionKey);
          const nextKey = makeEpisodePrefetchKey(pkg, nextEpisode.url);
          sharedEpisodeStreamCache
            .prefetchInBackground(nextKey, () =>
              fetchAndNormalizeMobileEpisode(pkg, nextEpisode.url),
            )
            .catch(() => {});

          prefetchNextEpisodeSkipTimes({
            animeId,
            animeTitle,
            nextEpisode,
            episodeLength: dur > 60 ? Math.floor(dur) : 0,
            getTrackers: (id) => DataService.tracker.getByManga(id),
            getSkipTimes: (req) => DataService.tracker.getSkipTimes(req),
          }).catch(() => {});
        }
      }

      const isRead = dur > 0 ? ct / dur >= 0.85 : false;
      lastProgressRef.current = { isRead, lastPage: Math.floor(ct) };

      if (progressTimerRef.current) {
        clearTimeout(progressTimerRef.current);
      }

      progressTimerRef.current = setTimeout(() => {
        flushProgress();
      }, 3000);
    },
    [animeId, animeTitle, episodeId, flushProgress, nextEpisode, pkg],
  );

  // 5. Fetch stream from extension (consuming 80% background prefetch cache immediately when available)
  const fetchStream = useCallback(async () => {
    if (!pkg || !episodeUrl) {
      setStatus("error");
      setErrorMsg("Missing extension package or episode URL");
      return;
    }

    const cacheKey = makeEpisodePrefetchKey(pkg, episodeUrl);
    const cachedEntry = sharedEpisodeStreamCache.getCached(cacheKey);
    if (cachedEntry && cachedEntry.servers.length > 0) {
      setErrorMsg("");
      setServers(cachedEntry.servers);
      setActiveServerIdx(selectPreferredServerIndex(cachedEntry.servers));
      setStatus("ready");
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    try {
      const entry = await sharedEpisodeStreamCache.getOrLoad(cacheKey, () =>
        fetchAndNormalizeMobileEpisode(pkg, episodeUrl),
      );
      setServers(entry.servers);
      setActiveServerIdx(selectPreferredServerIndex(entry.servers));
      setStatus("ready");
    } catch (e: any) {
      setStatus("error");
      setErrorMsg(e.message || "Failed to load video stream");
    }
  }, [pkg, episodeUrl]);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  // 6. Navigation between episodes
  const navigateToEpisode = useCallback(
    (targetEp: any) => {
      flushProgress();
      setAutoNextCountdown(null);

      DataService.db
        .addHistory({
          mangaId: animeId,
          mangaTitle: animeTitle,
          mangaCover: animeCover || undefined,
          mangaUrl: animeUrl || undefined,
          chapterId: targetEp.id,
          chapterTitle: targetEp.title || `Episode ${targetEp.number}`,
          startedAt: new Date().toISOString(),
          pkg,
          type: "anime",
        })
        .catch(() => {});

      router.replace({
        pathname: "/player/[animeId]/[episodeId]" as any,
        params: {
          animeId,
          episodeId: targetEp.id,
          pkg,
          episodeUrl: targetEp.url,
          episodeTitle: targetEp.title || `Episode ${targetEp.number}`,
          animeTitle,
          animeCover: animeCover || "",
          animeUrl: animeUrl || "",
        },
      });
    },
    [animeId, animeTitle, animeCover, animeUrl, pkg, flushProgress],
  );

  // 7. Auto-next episode countdown when video finishes (respects Settings -> autoNextAnime)
  const handleEpisodeEnd = useCallback(() => {
    flushProgress();
    if (nextEpisode && autoNextEnabled) {
      setAutoNextCountdown(5);
    }
  }, [flushProgress, nextEpisode, autoNextEnabled]);

  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null);
      if (nextEpisode) {
        navigateToEpisode(nextEpisode);
      }
      return;
    }

    const timer = setTimeout(() => {
      setAutoNextCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(timer);
  }, [autoNextCountdown, nextEpisode, navigateToEpisode]);

  // 8. Auto-hiding top HUD (observes touches via onTouchStart without blocking VideoView controls)
  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4500);
  }, []);

  const revealControls = useCallback(() => {
    setShowControls(true);
    resetControlsTimer();
  }, [resetControlsTimer]);

  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, [resetControlsTimer]);

  const activeServer = servers[activeServerIdx] || null;

  return (
    <View className="flex-1 bg-black">
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar hidden={!showControls} style="light" />

      {/* Main Video Surface */}
      <View className="flex-1 items-center justify-center">
        {status === "loading" ? (
          <View className="items-center justify-center p-8">
            <ActivityIndicator size="large" color="#e11d48" />
            <Typography className="text-white/60 mt-4 text-center font-medium">
              Loading video stream...
            </Typography>
          </View>
        ) : status === "error" ? (
          <View className="items-center justify-center px-8">
            <AlertTriangle size={48} color="#ef4444" />
            <Typography className="text-white text-lg font-semibold mt-4 text-center">
              Failed to load video stream
            </Typography>
            <Typography className="text-white/60 mt-2 text-center text-sm">
              {errorMsg}
            </Typography>
            <View className="flex-row gap-3 mt-6">
              <Button
                title="Retry"
                variant="primary"
                onPress={fetchStream}
                icon={<RefreshCw size={16} color="#fff" />}
              />
              <TouchableOpacity
                className="px-4 py-2 rounded-lg border border-white/25 bg-white/10 justify-center items-center"
                onPress={() => {
                  flushProgress();
                  router.back();
                }}
              >
                <Typography className="text-white font-medium text-sm">
                  Go Back
                </Typography>
              </TouchableOpacity>
            </View>
          </View>
        ) : activeServer ? (
          <View
            className="flex-1 w-full h-full relative"
            onTouchStart={revealControls}
          >
            {activeServer.type === "embed" ? (
              <EmbedVideoPlayer
                key={activeServer.url}
                server={activeServer}
                refererUrl={episodeUrl}
                onProgress={handleProgress}
                onEnd={handleEpisodeEnd}
                onRegisterSeek={registerPlayerSeek}
                onRegisterPlaybackRate={registerPlayerPlaybackRate}
              />
            ) : (
              <DirectVideoPlayer
                key={activeServer.url}
                server={activeServer}
                refererUrl={episodeUrl}
                initialTime={initialTime}
                contentFit={aspectFit}
                onProgress={handleProgress}
                onEnd={handleEpisodeEnd}
                onRegisterSeek={registerPlayerSeek}
                onRegisterPlaybackRate={registerPlayerPlaybackRate}
                onRegisterFullscreen={registerPlayerFullscreen}
              />
            )}
          </View>
        ) : null}
      </View>

      {/* Top Floating HUD (keeps bottom native VideoView controls 100% unobstructed) */}
      {showControls && status === "ready" && !isLocked && (
        <View
          pointerEvents="box-none"
          className="absolute top-0 left-0 right-0 z-30"
        >
          <LinearGradient
            colors={["rgba(0,0,0,0.88)", "rgba(0,0,0,0.45)", "transparent"]}
            className="pt-10 pb-6 px-4"
            pointerEvents="box-none"
          >
            <View className="flex-row items-center justify-between gap-2">
              {/* Back button and Titles */}
              <View className="flex-row items-center flex-1">
                <TouchableOpacity
                  className="p-2 rounded-full bg-white/15 active:bg-white/25 mr-2"
                  onPress={() => {
                    flushProgress();
                    router.back();
                  }}
                >
                  <ArrowLeft size={20} color="#fff" />
                </TouchableOpacity>
                <View className="flex-1 mr-1">
                  <Typography
                    className="text-white text-sm font-bold"
                    numberOfLines={1}
                  >
                    {episodeTitle || "Episode"}
                  </Typography>
                  <Typography
                    className="text-white/65 text-xs"
                    numberOfLines={1}
                  >
                    {animeTitle || ""}
                  </Typography>
                </View>
              </View>

              {/* Episode Prev/Next, Drawer, Speed, Server & Actions */}
              <View className="flex-row items-center gap-1.5">
                {prevEpisode && (
                  <TouchableOpacity
                    className="p-2 rounded-full bg-white/15 active:bg-white/25"
                    onPress={() => navigateToEpisode(prevEpisode)}
                    accessibilityLabel="Previous Episode"
                  >
                    <ChevronLeft size={16} color="#fff" />
                  </TouchableOpacity>
                )}

                {nextEpisode && (
                  <TouchableOpacity
                    className="p-2 rounded-full bg-white/15 active:bg-white/25"
                    onPress={() => navigateToEpisode(nextEpisode)}
                    accessibilityLabel="Next Episode"
                  >
                    <ChevronRight size={16} color="#fff" />
                  </TouchableOpacity>
                )}

                {sortedEpisodes.length > 0 && (
                  <TouchableOpacity
                    className="p-2 rounded-full bg-white/15 active:bg-white/25"
                    onPress={() => setShowEpisodesModal(true)}
                    accessibilityLabel="Episodes List"
                  >
                    <List size={16} color="#fff" />
                  </TouchableOpacity>
                )}

                {activeServer?.type !== "embed" && (
                  <TouchableOpacity
                    className={`px-2.5 py-1.5 rounded-full border ${
                      playbackSpeed > 1
                        ? "bg-primary border-primary"
                        : "bg-white/15 border-white/15"
                    }`}
                    onPress={cyclePlaybackSpeed}
                    accessibilityLabel="Playback Speed"
                  >
                    <Typography className="text-white text-xs font-bold">
                      {playbackSpeed}x
                    </Typography>
                  </TouchableOpacity>
                )}

                {servers.length > 1 && (
                  <TouchableOpacity
                    className="flex-row items-center bg-white/15 px-2.5 py-1.5 rounded-full active:bg-white/25"
                    onPress={() => setShowServerModal(true)}
                  >
                    <Server size={14} color="#60a5fa" />
                    <Typography
                      className="text-white text-xs font-semibold ml-1"
                      numberOfLines={1}
                    >
                      {activeServer?.name || `S${activeServerIdx + 1}`}
                    </Typography>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  className="p-2 rounded-full bg-white/15 active:bg-white/25"
                  onPress={() => setIsLocked(true)}
                  accessibilityLabel="Lock Controls"
                >
                  <Lock size={15} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Quick Seek, Aspect Fit, Fullscreen & External Link Row */}
            <View className="flex-row items-center justify-between mt-3">
              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  className="px-2.5 py-1 rounded-full bg-white/15 active:bg-white/25"
                  onPress={() => seekBy(-10)}
                >
                  <Typography className="text-white text-[11px] font-bold">
                    -10s
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-2.5 py-1 rounded-full bg-white/15 active:bg-white/25"
                  onPress={() => seekBy(10)}
                >
                  <Typography className="text-white text-[11px] font-bold">
                    +10s
                  </Typography>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-2.5 py-1 rounded-full bg-primary/80 active:bg-primary"
                  onPress={() => seekBy(85)}
                >
                  <Typography className="text-white text-[11px] font-bold">
                    +85s OP
                  </Typography>
                </TouchableOpacity>
              </View>

              <View className="flex-row items-center gap-1.5">
                {activeServer?.type !== "embed" && (
                  <>
                    <TouchableOpacity
                      className="px-2.5 py-1 rounded-full bg-white/15 active:bg-white/25"
                      onPress={cycleAspectFit}
                    >
                      <Typography className="text-white text-[11px] font-semibold capitalize">
                        {aspectFit === "contain"
                          ? "Fit"
                          : aspectFit === "cover"
                            ? "Crop"
                            : "Stretch"}
                      </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className="p-1.5 rounded-full bg-white/15 active:bg-white/25"
                      onPress={() => playerFullscreenRef.current?.()}
                      accessibilityLabel="Fullscreen"
                    >
                      <Maximize2 size={14} color="#fff" />
                    </TouchableOpacity>
                  </>
                )}

                {activeServer?.url && (
                  <TouchableOpacity
                    className="p-1.5 rounded-full bg-white/15 active:bg-white/25"
                    onPress={() => {
                      WebBrowser.openBrowserAsync(activeServer.url, {
                        toolbarColor: "#09090b",
                        controlsColor: "#ffffff",
                      }).catch(() => {});
                    }}
                    accessibilityLabel="Open in External Browser"
                  >
                    <ExternalLink size={14} color="#fff" />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </LinearGradient>
        </View>
      )}

      {/* Subtle Show Controls Pill when HUD is hidden */}
      {!showControls && status === "ready" && !isLocked && (
        <TouchableOpacity
          onPress={revealControls}
          activeOpacity={0.8}
          className="absolute top-10 right-4 z-30 bg-black/50 border border-white/15 px-3 py-1 rounded-full"
        >
          <Typography className="text-white/80 text-[11px] font-semibold">
            Menu
          </Typography>
        </TouchableOpacity>
      )}

      {/* Screen Lock Overlay */}
      {isLocked && status === "ready" && (
        <View className="absolute inset-0 z-50" pointerEvents="box-only">
          <TouchableOpacity
            onPress={() => setIsLocked(false)}
            activeOpacity={0.85}
            className="absolute top-12 right-4 flex-row items-center gap-1.5 bg-zinc-900/90 border border-white/25 px-3.5 py-2 rounded-full"
          >
            <Unlock size={14} color="#ffffff" />
            <Typography className="text-white text-xs font-bold">
              Unlock
            </Typography>
          </TouchableOpacity>
        </View>
      )}

      {/* Netflix-style Floating Skip Intro & Next Episode Pills */}
      {status === "ready" &&
        (skipUIState.isInIntro ||
          (skipUIState.showNextEpisode &&
            autoNextCountdown === null &&
            Boolean(nextEpisode))) && (
          <View className="absolute right-4 bottom-24 z-40 items-end gap-2">
            {skipUIState.isInIntro && (
              <TouchableOpacity
                onPress={handleSkipIntro}
                activeOpacity={0.85}
                className="flex-row items-center bg-zinc-900/95 border border-white/25 px-4 py-2.5 rounded-full shadow-2xl"
              >
                <SkipForward size={15} color="#ffffff" fill="#ffffff" />
                <Typography className="text-white text-xs font-bold ml-2">
                  Skip Intro
                </Typography>
              </TouchableOpacity>
            )}

            {skipUIState.showNextEpisode &&
              autoNextCountdown === null &&
              nextEpisode && (
                <View className="flex-row items-center bg-zinc-900/95 border border-primary/50 rounded-full p-1 shadow-2xl">
                  <TouchableOpacity
                    onPress={() => navigateToEpisode(nextEpisode)}
                    activeOpacity={0.85}
                    className="flex-row items-center bg-primary px-3.5 py-2 rounded-full"
                  >
                    <Play size={13} color="#ffffff" fill="#ffffff" />
                    <Typography className="text-white text-xs font-bold ml-1.5">
                      Next Episode • Ep {nextEpisode.number}
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setOutroDismissed(true)}
                    className="p-2"
                    accessibilityLabel="Dismiss Next Episode prompt"
                  >
                    <X size={14} color="#a1a1aa" />
                  </TouchableOpacity>
                </View>
              )}
          </View>
        )}

      {/* Auto-Next Episode Floating Banner */}
      {autoNextCountdown !== null && nextEpisode && (
        <View className="absolute bottom-24 left-4 right-4 z-40 bg-zinc-900/95 border border-primary/40 rounded-2xl p-4 shadow-2xl flex-row items-center justify-between">
          <View className="flex-1 mr-3">
            <Typography className="text-white text-xs font-bold uppercase tracking-wider text-primary">
              Episode Finished
            </Typography>
            <Typography
              className="text-white text-sm font-semibold mt-0.5"
              numberOfLines={1}
            >
              Next: Episode {nextEpisode.number} ({autoNextCountdown}s)
            </Typography>
          </View>
          <View className="flex-row items-center gap-2">
            <Button
              title="Cancel"
              variant="outline"
              size="sm"
              onPress={() => setAutoNextCountdown(null)}
            />
            <Button
              title="Play Now"
              variant="primary"
              size="sm"
              onPress={() => navigateToEpisode(nextEpisode)}
              icon={<Play size={14} color="#fff" />}
            />
          </View>
        </View>
      )}

      {/* Server Selection Modal */}
      <Modal
        visible={showServerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowServerModal(false)}
      >
        <View className="flex-1 bg-black/75 items-center justify-center p-6">
          <View className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm overflow-hidden p-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/10 mb-2">
              <View className="flex-row items-center">
                <Server size={18} color="#60a5fa" />
                <Typography className="text-white font-bold text-base ml-2">
                  Select Video Server
                </Typography>
              </View>
              <TouchableOpacity
                className="p-1 rounded-full bg-white/10"
                onPress={() => setShowServerModal(false)}
              >
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-64 my-2">
              {servers.map((srv, idx) => {
                const isSelected = idx === activeServerIdx;
                return (
                  <TouchableOpacity
                    key={`${srv.url}-${idx}`}
                    className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 ${
                      isSelected
                        ? "bg-primary/20 border border-primary/50"
                        : "bg-white/5 active:bg-white/10"
                    }`}
                    onPress={() => {
                      if (idx !== activeServerIdx && currentTime > 10) {
                        setInitialTime(Math.floor(currentTime));
                      }
                      setActiveServerIdx(idx);
                      setShowServerModal(false);
                    }}
                  >
                    <View className="flex-1 mr-2">
                      <Typography
                        className={`text-sm font-semibold ${
                          isSelected ? "text-primary" : "text-white"
                        }`}
                        numberOfLines={1}
                      >
                        {srv.name}
                      </Typography>
                    </View>
                    <View
                      className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                        srv.type === "hls" || srv.type === "mp4"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      <Typography
                        className={`text-[10px] font-bold uppercase ${
                          srv.type === "hls" || srv.type === "mp4"
                            ? "text-emerald-400"
                            : "text-amber-400"
                        }`}
                      >
                        {srv.type}
                      </Typography>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Episodes Drawer Modal */}
      <Modal
        visible={showEpisodesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEpisodesModal(false)}
      >
        <View className="flex-1 bg-black/75 justify-end">
          <View className="bg-zinc-900 border-t border-white/10 rounded-t-3xl max-h-[75%] p-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-white/10 mb-2">
              <View className="flex-row items-center">
                <List size={18} color="#e11d48" />
                <Typography className="text-white font-bold text-base ml-2">
                  Episodes ({sortedEpisodes.length})
                </Typography>
              </View>
              <TouchableOpacity
                className="p-1.5 rounded-full bg-white/10"
                onPress={() => setShowEpisodesModal(false)}
              >
                <X size={16} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-1">
              {sortedEpisodes.map((ep: any) => {
                const isActive = ep.id === episodeId;
                const prog = episodeProgressMap.get(String(ep.id));
                const isWatched = Boolean(prog?.isRead);
                const resumeSec = prog?.lastPage || 0;
                return (
                  <TouchableOpacity
                    key={ep.id}
                    className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 ${
                      isActive
                        ? "bg-primary/20 border border-primary/50"
                        : "bg-white/5 active:bg-white/10"
                    }`}
                    onPress={() => {
                      setShowEpisodesModal(false);
                      if (!isActive) navigateToEpisode(ep);
                    }}
                  >
                    <View className="flex-row items-center flex-1 mr-2">
                      {isWatched ? (
                        <CheckCircle size={15} color="#10b981" />
                      ) : (
                        <Play
                          size={13}
                          color={isActive ? "#e11d48" : "#94a3b8"}
                          fill={isActive ? "#e11d48" : "none"}
                        />
                      )}
                      <View className="flex-1 ml-2.5">
                        <Typography
                          className={`text-sm font-semibold ${
                            isActive
                              ? "text-primary"
                              : isWatched
                                ? "text-zinc-400"
                                : "text-white"
                          }`}
                          numberOfLines={1}
                        >
                          {ep.title || `Episode ${ep.number}`}
                        </Typography>
                        {!isWatched && resumeSec > 10 && (
                          <Typography className="text-[11px] text-primary">
                            Paused at {formatEpisodeTime(resumeSec)}
                          </Typography>
                        )}
                      </View>
                    </View>
                    {isActive && (
                      <Typography className="text-[10px] font-bold uppercase text-primary">
                        Playing
                      </Typography>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}
