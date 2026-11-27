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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  ChevronDown,
  Server,
  Play,
  X,
  SkipForward,
  List,
  Lock,
  Unlock,
  Maximize2,
  CheckCircle,
  ShieldCheck,
  Zap,
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
  type ServerProbeResult,
} from "@common/services/episodePrefetch.service";
import {
  getVideoHeaders,
  sanitizeHeadersMap,
  DEFAULT_MOBILE_USER_AGENT,
} from "../../../src/mobile/cf-cookies";
import { useAppTheme } from "../../../src/mobile/theme";
import { MobileTracker } from "../../../src/mobile/tracker.native";

function normalizeEpisodeMatchKey(value?: string | null): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).replace(/\/+$/, "").toLowerCase();
  } catch {
    return raw.replace(/\/+$/, "").toLowerCase();
  }
}

function formatEpisodeTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? "0" : ""}${rem}`;
}

export type ServerOption = NormalizedStreamServer & {
  status?: "alive" | "dead" | "checking" | "untested";
  pingMs?: number;
  error?: string;
};

function mapEntryToServerOptions(entry: EpisodeStreamCacheEntry): ServerOption[] {
  return entry.servers.map((srv, idx) => {
    const probe = entry.probeResults?.find((p) => p.index === idx);
    return {
      ...srv,
      status: probe ? probe.status : "checking",
      pingMs: probe?.pingMs,
      error: probe?.error,
    };
  });
}

function resolveEffectiveServerIndex(
  items: ServerOption[],
  preferredIndex: number,
): number {
  const candidate = items[preferredIndex];
  if (candidate && candidate.status === "dead") {
    const aliveDirectIdx = items.findIndex(
      (srv) =>
        srv.status === "alive" && (srv.type === "hls" || srv.type === "mp4"),
    );
    if (aliveDirectIdx !== -1) return aliveDirectIdx;
    const aliveIdx = items.findIndex((srv) => srv.status === "alive");
    if (aliveIdx !== -1) return aliveIdx;
  }
  return preferredIndex;
}

async function probeMobileServers(
  cacheKey: string,
  entry: EpisodeStreamCacheEntry,
): Promise<ServerProbeResult[]> {
  const results = await Promise.all(
    entry.servers.map(async (srv, i): Promise<ServerProbeResult> => {
      try {
        const probeRes = await DataService.probeStream(
          srv.url,
          srv.headers,
          3000,
        );
        return {
          index: i,
          status: probeRes.alive ? "alive" : "dead",
          pingMs: probeRes.pingMs,
          error: probeRes.error,
        };
      } catch {
        return {
          index: i,
          status: "dead",
          error: "Probe error",
        };
      }
    }),
  );
  sharedEpisodeStreamCache.updateProbeResults(cacheKey, results);
  return results;
}

async function fetchAndNormalizeMobileEpisode(
  pkg: string,
  targetEpisodeUrl: string,
): Promise<EpisodeStreamCacheEntry> {
  const allExts = await DataService.db.getExtensions();
  const extList = (allExts as any)?.value || allExts || [];
  const ext = extList.find((e: any) => e.pkg === pkg);
  if (!ext?.code) throw new Error("Extension not found");

  const result: any = await DataService.executeExtension({
    pkg,
    code: ext.code,
    contextArgs: { type: "fetchPages", chapterUrl: targetEpisodeUrl },
  });

  if (result && typeof result === "object" && result.ok === false) {
    throw new Error(result.error || "Extension failed to resolve episode streams");
  }

  const rawUrls = extractRawStreamUrls(result);
  if (!rawUrls || rawUrls.length === 0) {
    const debugInfo = result?.pages?.debug || result?.debug;
    if (debugInfo?.isBlocked) {
      throw new Error(
        "Cloudflare challenge blocked this episode page. Tap Resolve CF to continue.",
      );
    }
    throw new Error("No streaming servers found for this episode");
  }

  const parsedServers = normalizeStreamServers(rawUrls);
  if (parsedServers.length === 0) {
    throw new Error(
      "No playable video streams found (ad-only feeds filtered)",
    );
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

// Direct Native Stream Player (HLS / MP4) with error & stall failover
function DirectVideoPlayer({
  server,
  refererUrl,
  initialTime,
  contentFit = "contain",
  onProgress,
  onEnd,
  onError,
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
  onError: (reason: string) => void;
  onRegisterSeek?: (fn: ((seconds: number) => void) | null) => void;
  onRegisterPlaybackRate?: (fn: ((rate: number) => void) | null) => void;
  onRegisterFullscreen?: (fn: (() => void) | null) => void;
}) {
  const videoViewRef = useRef<VideoView | null>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const hasReadyRef = useRef(false);
  const hasReportedErrorRef = useRef(false);

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
    hasReadyRef.current = false;
    hasReportedErrorRef.current = false;

    // 12s watchdog if direct stream hangs in loading state
    const watchdog = setTimeout(() => {
      if (!hasReadyRef.current && !hasReportedErrorRef.current) {
        hasReportedErrorRef.current = true;
        onErrorRef.current("Stream timed out waiting to buffer");
      }
    }, 12000);

    return () => clearTimeout(watchdog);
  }, [server.url]);

  useEffect(() => {
    applyInitialSeekIfReady(initialTime);
  }, [initialTime, applyInitialSeekIfReady]);

  useEventListener(player, "statusChange", (event: any) => {
    const nextStatus = event?.status;
    if (nextStatus === "readyToPlay") {
      hasReadyRef.current = true;
      applyInitialSeekIfReady(initialTime);
    } else if (nextStatus === "error" && !hasReportedErrorRef.current) {
      hasReportedErrorRef.current = true;
      const errMessage =
        event?.error?.message || "Direct stream playback error";
      onErrorRef.current(errMessage);
    }
  });

  useEventListener(player, "timeUpdate", ({ currentTime }) => {
    hasReadyRef.current = true;
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

// Embedded Web Stream Player (Iframe with Popup Blocking & HTTP error failover)
function EmbedVideoPlayer({
  server,
  refererUrl,
  onProgress,
  onEnd,
  onError,
  onRegisterSeek,
  onRegisterPlaybackRate,
}: {
  server: ServerOption;
  refererUrl?: string;
  onProgress: (currentTime: number, duration: number) => void;
  onEnd: () => void;
  onError: (reason: string) => void;
  onRegisterSeek?: (fn: ((seconds: number) => void) | null) => void;
  onRegisterPlaybackRate?: (fn: ((rate: number) => void) | null) => void;
}) {
  const webViewRef = useRef<any>(null);
  const [webLoading, setWebLoading] = useState(true);
  const hasFailedRef = useRef(false);

  useEffect(() => {
    hasFailedRef.current = false;
    setWebLoading(true);
  }, [server.url]);

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
    <View className="flex-1 w-full h-full relative bg-black">
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
        onLoadStart={() => setWebLoading(true)}
        onLoadEnd={() => setWebLoading(false)}
        onError={(syntheticEvent: any) => {
          setWebLoading(false);
          if (hasFailedRef.current) return;
          hasFailedRef.current = true;
          const desc =
            syntheticEvent?.nativeEvent?.description ||
            "Embed page failed to load";
          onError(desc);
        }}
        onHttpError={(syntheticEvent: any) => {
          const code = syntheticEvent?.nativeEvent?.statusCode;
          const failedUrl = syntheticEvent?.nativeEvent?.url || "";
          if (code >= 400 && !hasFailedRef.current) {
            const isMainUrl =
              !failedUrl ||
              failedUrl === server.url ||
              failedUrl.startsWith(server.url.split("?")[0]);
            if (isMainUrl) {
              hasFailedRef.current = true;
              setWebLoading(false);
              onError(`Embed server returned HTTP ${code}`);
            }
          }
        }}
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
      {webLoading && (
        <View
          pointerEvents="none"
          className="absolute inset-0 items-center justify-center bg-black/50"
        >
          <ActivityIndicator size="large" color="#e11d48" />
          <Typography className="text-white/75 text-xs font-medium mt-2">
            Connecting to {server.name}...
          </Typography>
        </View>
      )}
    </View>
  );
}

function getServerStatusDot(srv: ServerOption): string {
  if (srv.status === "alive") return srv.type === "embed" ? "🟢" : "🟢⚡";
  if (srv.status === "dead") return "🔴";
  if (srv.status === "checking") return "⏳";
  return srv.type === "embed" ? "🌐" : "⚡";
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

  const { width: winWidth, height: winHeight } = useWindowDimensions();
  const isLandscape = winWidth > winHeight;
  const { isDark, themeVars, themeClassName, palette } = useAppTheme();

  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [servers, setServers] = useState<ServerOption[]>([]);
  const [activeServerIdx, setActiveServerIdx] = useState(0);
  const [isSwitchingServer, setIsSwitchingServer] = useState(false);
  const [switchingNotice, setSwitchingNotice] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const [showServerModal, setShowServerModal] = useState(false);
  const [showEpisodesModal, setShowEpisodesModal] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isBypassingCf, setIsBypassingCf] = useState(false);
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

  const loadGenRef = useRef(0);
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

  // 1. Fetch episodes list & watch progress for drawer / inline list
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

  const isCurrentEpisodeMatch = useCallback(
    (ep: any): boolean => {
      if (!ep) return false;
      if (ep.id === episodeId) return true;
      if (episodeUrl && ep.url === episodeUrl) return true;
      const targetIdNorm = normalizeEpisodeMatchKey(episodeId);
      const targetUrlNorm = normalizeEpisodeMatchKey(episodeUrl);
      const epIdNorm = normalizeEpisodeMatchKey(ep.id);
      const epUrlNorm = normalizeEpisodeMatchKey(ep.url);
      if (targetIdNorm && (epIdNorm === targetIdNorm || epUrlNorm === targetIdNorm)) {
        return true;
      }
      if (targetUrlNorm && (epUrlNorm === targetUrlNorm || epIdNorm === targetUrlNorm)) {
        return true;
      }
      return false;
    },
    [episodeId, episodeUrl],
  );

  const currentEpIndex = sortedEpisodes.findIndex(isCurrentEpisodeMatch);
  const currentEpisode =
    currentEpIndex >= 0 ? sortedEpisodes[currentEpIndex] : null;
  const displayEpisodeNumber =
    currentEpisode?.number ??
    parseEpisodeNumber(undefined, episodeTitle) ??
    "?";
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
    setIsSwitchingServer(false);
    setSwitchingNotice(null);
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

  const toggleAutoNext = useCallback(() => {
    setAutoNextEnabled((prev) => {
      const next = !prev;
      DataService.db
        .setSetting("autoNextAnime", next ? "true" : "false")
        .catch(() => {});
      return next;
    });
  }, []);

  // Fetch AniSkip timestamps
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
        // Silent failure
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
  }, [
    animeId,
    episodeId,
    currentEpisode?.number,
    currentEpisode?.title,
    episodeTitle,
  ]);

  useEffect(() => {
    return () => {
      flushProgress();
    };
  }, [flushProgress]);

  // 4. Debounced progress + 80% next-episode prefetch
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

  // 5. Server selection, live probing, and automatic failover across servers
  const applyEntryServers = useCallback(
    (
      entry: EpisodeStreamCacheEntry,
      cacheKey: string,
      currentGen: number,
    ) => {
      const initialServers = mapEntryToServerOptions(entry);
      const preferredIdx = selectPreferredServerIndex(entry.servers);
      const effectiveIdx = resolveEffectiveServerIndex(
        initialServers,
        preferredIdx,
      );

      setServers(initialServers);
      setActiveServerIdx(effectiveIdx);
      setErrorMsg("");
      setStatus("ready");

      if (!entry.probeResults) {
        probeMobileServers(cacheKey, entry).then((results) => {
          if (currentGen !== loadGenRef.current) return;
          let nextAliveIdx = -1;

          setServers((prev) => {
            const updated = prev.map((srv, i) => {
              const r = results.find((res) => res.index === i);
              if (!r) return srv;
              return {
                ...srv,
                status: r.status,
                pingMs: r.pingMs,
                error: r.error,
              };
            });
            nextAliveIdx = resolveEffectiveServerIndex(updated, effectiveIdx);
            return updated;
          });

          if (nextAliveIdx !== -1 && nextAliveIdx !== effectiveIdx) {
            setActiveServerIdx(nextAliveIdx);
          }
        });
      }
    },
    [],
  );

  const failoverToNextServer = useCallback(
    (reason: string) => {
      console.warn(
        `[MobilePlayer] Server failover triggered (idx=${activeServerIdx}): ${reason}`,
      );

      setServers((prev) => {
        if (!prev || prev.length === 0) {
          setStatus("error");
          setErrorMsg(reason || "Failed to load video stream");
          return prev;
        }

        const updated = [...prev];
        if (updated[activeServerIdx]) {
          updated[activeServerIdx] = {
            ...updated[activeServerIdx],
            status: "dead",
            error: reason,
          };
        }

        // Priority 1: alive direct stream
        let nextIdx = -1;
        for (let step = 1; step < updated.length; step++) {
          const idx = (activeServerIdx + step) % updated.length;
          const srv = updated[idx];
          if (
            srv?.status === "alive" &&
            (srv.type === "hls" || srv.type === "mp4")
          ) {
            nextIdx = idx;
            break;
          }
        }
        // Priority 2: any alive server
        if (nextIdx === -1) {
          for (let step = 1; step < updated.length; step++) {
            const idx = (activeServerIdx + step) % updated.length;
            if (updated[idx]?.status === "alive") {
              nextIdx = idx;
              break;
            }
          }
        }
        // Priority 3: any non-dead server
        if (nextIdx === -1) {
          for (let step = 1; step < updated.length; step++) {
            const idx = (activeServerIdx + step) % updated.length;
            if (updated[idx]?.status !== "dead") {
              nextIdx = idx;
              break;
            }
          }
        }

        if (nextIdx !== -1) {
          const target = updated[nextIdx];
          setIsSwitchingServer(true);
          setSwitchingNotice(
            `Switching to ${target.name} (${nextIdx + 1}/${updated.length})`,
          );
          setTimeout(() => {
            setActiveServerIdx(nextIdx);
            setIsSwitchingServer(false);
            setErrorMsg("");
            setStatus("ready");
          }, 350);
        } else {
          setIsSwitchingServer(false);
          setStatus("error");
          setErrorMsg(
            updated.length > 1
              ? `All ${updated.length} servers failed to load (${reason}).`
              : reason || "Server failed to load video stream.",
          );
        }

        return updated;
      });
    },
    [activeServerIdx],
  );

  const handleManualNextServer = useCallback(() => {
    if (servers.length <= 1) return;
    let nextIdx = (activeServerIdx + 1) % servers.length;
    for (let step = 1; step < servers.length; step++) {
      const checkIdx = (activeServerIdx + step) % servers.length;
      if (servers[checkIdx]?.status !== "dead") {
        nextIdx = checkIdx;
        break;
      }
    }
    if (currentTime > 10) setInitialTime(Math.floor(currentTime));
    setActiveServerIdx(nextIdx);
    setErrorMsg("");
    setStatus("ready");
  }, [servers, activeServerIdx, currentTime]);

  const fetchStream = useCallback(async () => {
    if (!pkg || !episodeUrl) {
      setStatus("error");
      setErrorMsg("Missing extension package or episode URL");
      return;
    }

    const gen = ++loadGenRef.current;
    const cacheKey = makeEpisodePrefetchKey(pkg, episodeUrl);
    const cachedEntry = sharedEpisodeStreamCache.getCached(cacheKey);
    if (cachedEntry && cachedEntry.servers.length > 0) {
      applyEntryServers(cachedEntry, cacheKey, gen);
      return;
    }

    setStatus("loading");
    setErrorMsg("");
    setIsSwitchingServer(false);
    try {
      const entry = await sharedEpisodeStreamCache.getOrLoad(cacheKey, () =>
        fetchAndNormalizeMobileEpisode(pkg, episodeUrl),
      );
      if (gen !== loadGenRef.current) return;
      applyEntryServers(entry, cacheKey, gen);
    } catch (e: any) {
      if (gen !== loadGenRef.current) return;
      setStatus("error");
      setErrorMsg(e.message || "Failed to load video stream");
    }
  }, [pkg, episodeUrl, applyEntryServers]);

  useEffect(() => {
    fetchStream();
  }, [fetchStream]);

  const handleResolveCloudflare = useCallback(async () => {
    if (!episodeUrl) return;
    setIsBypassingCf(true);
    try {
      await DataService.cfBypass(episodeUrl);
      if (pkg && episodeUrl) {
        sharedEpisodeStreamCache.clear();
      }
      await fetchStream();
    } finally {
      setIsBypassingCf(false);
    }
  }, [episodeUrl, pkg, fetchStream]);

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

  // 7. Auto-next episode countdown when video finishes
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

  // 8. Auto-hiding HUD timer (used in landscape fullscreen playback)
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
  const stageHeight = isLandscape ? winHeight : Math.round((winWidth * 9) / 16);

  const renderServerSelectorPill = (inOverlay: boolean) =>
    servers.length > 0 ? (
      <View className="flex-row items-center gap-1">
        <TouchableOpacity
          onPress={() => setShowServerModal(true)}
          activeOpacity={0.8}
          className={
            inOverlay
              ? "flex-row items-center bg-zinc-900/95 border border-white/15 px-3 py-1.5 rounded-full gap-1.5"
              : "flex-row items-center bg-secondary border border-border px-3 py-1.5 rounded-full gap-1.5"
          }
        >
          <Typography className="text-xs">
            {activeServer ? getServerStatusDot(activeServer) : "🌐"}
          </Typography>
          <Typography
            className={
              inOverlay
                ? "text-white text-xs font-bold max-w-[110px]"
                : "text-foreground text-xs font-bold max-w-[110px]"
            }
            numberOfLines={1}
          >
            {activeServer?.name || `Server ${activeServerIdx + 1}`}
          </Typography>
          {activeServer?.pingMs ? (
            <Typography
              className={
                inOverlay
                  ? "text-white/50 text-[10px]"
                  : "text-muted-foreground text-[10px]"
              }
            >
              {activeServer.pingMs}ms
            </Typography>
          ) : null}
          <ChevronDown
            size={13}
            color={inOverlay ? "#a1a1aa" : palette.mutedForeground}
          />
        </TouchableOpacity>

        {servers.length > 1 && (
          <TouchableOpacity
            onPress={handleManualNextServer}
            activeOpacity={0.8}
            className={
              inOverlay
                ? "p-1.5 rounded-full bg-zinc-900/95 border border-white/15"
                : "p-1.5 rounded-full bg-secondary border border-border"
            }
            accessibilityLabel="Switch to Next Working Server"
          >
            <RefreshCw size={13} color={isDark || inOverlay ? "#60a5fa" : "#2563eb"} />
          </TouchableOpacity>
        )}
      </View>
    ) : null;

  const videoStage = (
    <View
      style={
        isLandscape
          ? { flex: 1, width: "100%", height: "100%" }
          : { width: winWidth, height: stageHeight }
      }
      className="bg-black items-center justify-center relative"
    >
      {status === "loading" ? (
        <View className="items-center justify-center p-6">
          <ActivityIndicator size="large" color="#e11d48" />
          <Typography className="text-white/75 mt-3 text-center text-sm font-medium">
            Loading servers...
          </Typography>
        </View>
      ) : status === "error" ? (
        <View className="items-center justify-center px-6 py-4">
          <AlertTriangle size={40} color="#ef4444" />
          <Typography className="text-white text-base font-bold mt-3 text-center">
            Failed to load video stream
          </Typography>
          <Typography
            className="text-white/65 mt-1.5 text-center text-xs max-w-sm"
            numberOfLines={3}
          >
            {errorMsg}
          </Typography>
          <View className="flex-row flex-wrap items-center justify-center gap-2 mt-4">
            <Button
              title="Retry"
              variant="primary"
              size="sm"
              onPress={fetchStream}
              icon={<RefreshCw size={14} color="#fff" />}
            />
            {servers.length > 1 && (
              <TouchableOpacity
                className="px-3.5 py-2 rounded-lg bg-primary/20 border border-primary/50"
                onPress={handleManualNextServer}
              >
                <Typography className="text-primary font-semibold text-xs">
                  Try Next Server
                </Typography>
              </TouchableOpacity>
            )}
            {episodeUrl && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-500/40 bg-amber-500/15"
                onPress={handleResolveCloudflare}
                disabled={isBypassingCf}
              >
                <ShieldCheck size={14} color="#fbbf24" />
                <Typography
                  className="font-semibold text-xs"
                  style={{ color: "#fcd34d" }}
                >
                  {isBypassingCf ? "Solving..." : "Resolve CF"}
                </Typography>
              </TouchableOpacity>
            )}
            {(activeServer?.url || episodeUrl) && (
              <TouchableOpacity
                className="flex-row items-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/25 bg-white/10"
                onPress={() => {
                  const target = activeServer?.url || episodeUrl || "";
                  if (target) {
                    WebBrowser.openBrowserAsync(target, {
                      toolbarColor: "#09090b",
                      controlsColor: "#ffffff",
                    }).catch(() => {});
                  }
                }}
              >
                <ExternalLink size={13} color="#fff" />
                <Typography className="text-white font-medium text-xs">
                  Open in Browser
                </Typography>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : activeServer ? (
        <View
          className="flex-1 w-full h-full relative"
          onTouchStart={revealControls}
        >
          {activeServer.type === "embed" ? (
            <EmbedVideoPlayer
              key={`${activeServer.url}-${activeServerIdx}`}
              server={activeServer}
              refererUrl={episodeUrl}
              onProgress={handleProgress}
              onEnd={handleEpisodeEnd}
              onError={failoverToNextServer}
              onRegisterSeek={registerPlayerSeek}
              onRegisterPlaybackRate={registerPlayerPlaybackRate}
            />
          ) : (
            <DirectVideoPlayer
              key={`${activeServer.url}-${activeServerIdx}`}
              server={activeServer}
              refererUrl={episodeUrl}
              initialTime={initialTime}
              contentFit={aspectFit}
              onProgress={handleProgress}
              onEnd={handleEpisodeEnd}
              onError={failoverToNextServer}
              onRegisterSeek={registerPlayerSeek}
              onRegisterPlaybackRate={registerPlayerPlaybackRate}
              onRegisterFullscreen={registerPlayerFullscreen}
            />
          )}
        </View>
      ) : null}

      {/* Switching Server Failover Overlay */}
      {isSwitchingServer && (
        <View className="absolute inset-0 z-40 bg-black/85 items-center justify-center px-6">
          <ActivityIndicator size="large" color="#e11d48" />
          <Typography className="text-white font-bold text-base mt-3 uppercase">
            Switching Server
          </Typography>
          {switchingNotice && (
            <Typography className="text-white/70 text-xs mt-1 text-center">
              {switchingNotice}
            </Typography>
          )}
        </View>
      )}

      {/* Floating Skip Intro & Next Episode Pills */}
      {status === "ready" &&
        !isLocked &&
        (skipUIState.isInIntro ||
          (skipUIState.showNextEpisode &&
            autoNextCountdown === null &&
            Boolean(nextEpisode))) && (
          <View className="absolute right-3 bottom-14 z-30 items-end gap-2">
            {skipUIState.isInIntro && (
              <TouchableOpacity
                onPress={handleSkipIntro}
                activeOpacity={0.85}
                className="flex-row items-center bg-zinc-900/95 border border-white/25 px-3.5 py-2 rounded-full"
              >
                <SkipForward size={14} color="#ffffff" fill="#ffffff" />
                <Typography className="text-white text-xs font-bold ml-1.5">
                  Skip Intro
                </Typography>
              </TouchableOpacity>
            )}

            {skipUIState.showNextEpisode &&
              autoNextCountdown === null &&
              nextEpisode && (
                <View className="flex-row items-center bg-zinc-900/95 border border-primary/50 rounded-full p-1">
                  <TouchableOpacity
                    onPress={() => navigateToEpisode(nextEpisode)}
                    activeOpacity={0.85}
                    className="flex-row items-center bg-primary px-3 py-1.5 rounded-full"
                  >
                    <Play size={12} color="#ffffff" fill="#ffffff" />
                    <Typography className="text-white text-xs font-bold ml-1.5">
                      Next Episode · Ep {nextEpisode.number}
                    </Typography>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setOutroDismissed(true)}
                    className="p-1.5"
                    accessibilityLabel="Dismiss Next Episode prompt"
                  >
                    <X size={13} color="#a1a1aa" />
                  </TouchableOpacity>
                </View>
              )}
          </View>
        )}

      {/* Auto-Next Countdown Banner */}
      {autoNextCountdown !== null && nextEpisode && (
        <View className="absolute bottom-4 left-3 right-3 z-40 bg-zinc-900/95 border border-primary/40 rounded-2xl p-3 flex-row items-center justify-between">
          <View className="flex-1 mr-2">
            <Typography className="text-primary text-[11px] font-bold uppercase">
              Episode Finished
            </Typography>
            <Typography
              className="text-white text-xs font-semibold mt-0.5"
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
              icon={<Play size={13} color="#fff" />}
            />
          </View>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView
      className={isLandscape ? "flex-1 bg-black" : "flex-1 bg-background"}
      edges={isLandscape ? [] : ["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar
        hidden={isLandscape && !showControls}
        style={isLandscape ? "light" : isDark ? "light" : "dark"}
      />

      {!isLandscape ? (
        /* PORTRAIT WATCH MODE (Desktop-parity Watch Layout: Header -> 16:9 Player -> Provider/Control Bar -> Episodes List) */
        <View className="flex-1 bg-background">
          {/* Always-visible Top Header */}
          <View className="flex-row items-center justify-between px-3 py-2.5 border-b border-border bg-card">
            <View className="flex-row items-center flex-1 mr-2">
              <TouchableOpacity
                className="p-2 rounded-full bg-secondary mr-2.5"
                onPress={() => {
                  flushProgress();
                  router.back();
                }}
              >
                <ArrowLeft size={18} color={palette.foreground} />
              </TouchableOpacity>
              <View className="flex-1">
                <Typography
                  className="text-foreground text-sm font-bold"
                  numberOfLines={1}
                >
                  {animeTitle || "Watch"}
                </Typography>
                <Typography
                  className="text-muted-foreground text-xs"
                  numberOfLines={1}
                >
                  {episodeTitle ||
                    `Episode ${currentEpisode?.number || ""}`.trim()}
                </Typography>
              </View>
            </View>

            <View className="flex-row items-center gap-1.5">
              <TouchableOpacity
                onPress={fetchStream}
                className="p-2 rounded-full bg-secondary"
                accessibilityLabel="Reload Stream"
              >
                <RefreshCw size={16} color={palette.foreground} />
              </TouchableOpacity>
              {activeServer?.url && (
                <TouchableOpacity
                  onPress={() => {
                    WebBrowser.openBrowserAsync(activeServer.url, {
                      toolbarColor: palette.background,
                      controlsColor: palette.foreground,
                    }).catch(() => {});
                  }}
                  className="p-2 rounded-full bg-secondary"
                  accessibilityLabel="Open in External Browser"
                >
                  <ExternalLink size={16} color={palette.foreground} />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* 16:9 Video Player Surface */}
          {videoStage}

          {/* Control Strip Below Video (Desktop Parity) */}
          <View className="px-3 py-2.5 bg-card border-b border-border gap-2">
            {/* Row 1: Prev/Next Episode & Video Providers Dropdown */}
            <View className="flex-row items-center justify-between gap-2">
              <View className="flex-row items-center bg-secondary rounded-full border border-border p-0.5">
                <TouchableOpacity
                  disabled={!prevEpisode}
                  onPress={() => prevEpisode && navigateToEpisode(prevEpisode)}
                  className="p-1.5 rounded-full"
                  style={{ opacity: prevEpisode ? 1 : 0.35 }}
                >
                  <ChevronLeft size={16} color={palette.foreground} />
                </TouchableOpacity>
                <Typography className="text-foreground text-xs font-bold px-2">
                  EP {displayEpisodeNumber}
                </Typography>
                <TouchableOpacity
                  disabled={!nextEpisode}
                  onPress={() => nextEpisode && navigateToEpisode(nextEpisode)}
                  className="p-1.5 rounded-full"
                  style={{ opacity: nextEpisode ? 1 : 0.35 }}
                >
                  <ChevronRight size={16} color={palette.foreground} />
                </TouchableOpacity>
              </View>

              {renderServerSelectorPill(false) || (
                <Typography className="text-muted-foreground text-xs">
                  {status === "loading" ? "Resolving providers..." : "No providers"}
                </Typography>
              )}
            </View>

            {/* Row 2: Quick Seek, Speed, Aspect Fit, Auto-Next & Fullscreen */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, alignItems: "center" }}
            >
              <TouchableOpacity
                onPress={toggleAutoNext}
                className={`flex-row items-center gap-1 px-2.5 py-1 rounded-full border ${
                  autoNextEnabled
                    ? "bg-primary/15 border-primary/50"
                    : "bg-secondary border-border"
                }`}
              >
                <Zap
                  size={12}
                  color={autoNextEnabled ? "#e11d48" : palette.mutedForeground}
                />
                <Typography
                  className={`text-[11px] font-bold ${
                    autoNextEnabled ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  Auto-Next
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekBy(-10)}
                className="px-2.5 py-1 rounded-full bg-secondary border border-border"
              >
                <Typography className="text-foreground text-[11px] font-bold">
                  -10s
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekBy(10)}
                className="px-2.5 py-1 rounded-full bg-secondary border border-border"
              >
                <Typography className="text-foreground text-[11px] font-bold">
                  +10s
                </Typography>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => seekBy(85)}
                className="px-2.5 py-1 rounded-full bg-primary/15 border border-primary/40"
              >
                <Typography className="text-primary text-[11px] font-bold">
                  +85s OP
                </Typography>
              </TouchableOpacity>

              {activeServer?.type !== "embed" && (
                <>
                  <TouchableOpacity
                    onPress={cyclePlaybackSpeed}
                    className={`px-2.5 py-1 rounded-full border ${
                      playbackSpeed > 1
                        ? "bg-primary border-primary"
                        : "bg-secondary border-border"
                    }`}
                  >
                    <Typography
                      className={`text-[11px] font-bold ${
                        playbackSpeed > 1 ? "text-white" : "text-foreground"
                      }`}
                    >
                      {playbackSpeed}x
                    </Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={cycleAspectFit}
                    className="px-2.5 py-1 rounded-full bg-secondary border border-border"
                  >
                    <Typography className="text-foreground text-[11px] font-semibold">
                      {aspectFit === "contain"
                        ? "Fit"
                        : aspectFit === "cover"
                          ? "Crop"
                          : "Stretch"}
                    </Typography>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => playerFullscreenRef.current?.()}
                    className="flex-row items-center gap-1 px-2.5 py-1 rounded-full bg-secondary border border-border"
                  >
                    <Maximize2 size={12} color={palette.foreground} />
                    <Typography className="text-foreground text-[11px] font-semibold">
                      Fullscreen
                    </Typography>
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>

          {/* Inline Episodes Panel (Desktop Watch Page Parity) */}
          <ScrollView className="flex-1 bg-background px-3 pt-3" contentContainerStyle={{ paddingBottom: 32 }}>
            <View className="flex-row items-center justify-between mb-2.5 px-1">
              <Typography className="text-muted-foreground text-xs font-bold uppercase tracking-wider">
                Episodes ({sortedEpisodes.length})
              </Typography>
              {servers.length > 0 && (
                <TouchableOpacity onPress={() => setShowServerModal(true)}>
                  <Typography className="text-primary text-xs font-semibold">
                    {servers.length} Server{servers.length !== 1 ? "s" : ""} Available
                  </Typography>
                </TouchableOpacity>
              )}
            </View>

            {sortedEpisodes.map((ep: any) => {
              const isActive = isCurrentEpisodeMatch(ep);
              const prog = episodeProgressMap.get(String(ep.id));
              const isWatched = Boolean(prog?.isRead);
              const resumeSec = prog?.lastPage || 0;
              return (
                <TouchableOpacity
                  key={ep.id}
                  onPress={() => {
                    if (!isActive) navigateToEpisode(ep);
                  }}
                  className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 border ${
                    isActive
                      ? "bg-primary/15 border-primary/50"
                      : "bg-card border-border active:bg-secondary"
                  }`}
                >
                  <View className="flex-row items-center flex-1 mr-2">
                    {isWatched ? (
                      <CheckCircle size={15} color="#10b981" />
                    ) : (
                      <Play
                        size={13}
                        color={isActive ? "#e11d48" : palette.mutedForeground}
                        fill={isActive ? "#e11d48" : "none"}
                      />
                    )}
                    <View className="flex-1 ml-2.5">
                      <Typography
                        className={`text-sm font-semibold ${
                          isActive
                            ? "text-primary"
                            : isWatched
                              ? "text-muted-foreground"
                              : "text-foreground"
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
      ) : (
        /* LANDSCAPE / FULLSCREEN CINEMA MODE */
        <View className="flex-1 bg-black relative">
          {videoStage}

          {/* Floating Top HUD (always shown on loading/error, auto-hides during ready playback) */}
          {(showControls || status !== "ready") && !isLocked && (
            <View
              pointerEvents="box-none"
              className="absolute top-0 left-0 right-0 z-30"
            >
              <LinearGradient
                colors={["rgba(0,0,0,0.88)", "rgba(0,0,0,0.45)", "transparent"]}
                className="pt-4 pb-6 px-4"
                pointerEvents="box-none"
              >
                <View className="flex-row items-center justify-between gap-2">
                  <View className="flex-row items-center flex-1">
                    <TouchableOpacity
                      className="p-2 rounded-full bg-white/15 mr-2"
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

                  <View className="flex-row items-center gap-1.5">
                    {prevEpisode && (
                      <TouchableOpacity
                        className="p-2 rounded-full bg-white/15"
                        onPress={() => navigateToEpisode(prevEpisode)}
                      >
                        <ChevronLeft size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {nextEpisode && (
                      <TouchableOpacity
                        className="p-2 rounded-full bg-white/15"
                        onPress={() => navigateToEpisode(nextEpisode)}
                      >
                        <ChevronRight size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {sortedEpisodes.length > 0 && (
                      <TouchableOpacity
                        className="p-2 rounded-full bg-white/15"
                        onPress={() => setShowEpisodesModal(true)}
                      >
                        <List size={16} color="#fff" />
                      </TouchableOpacity>
                    )}
                    {renderServerSelectorPill(true)}
                    <TouchableOpacity
                      className="p-2 rounded-full bg-white/15"
                      onPress={() => setIsLocked(true)}
                    >
                      <Lock size={15} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>

                {status === "ready" && (
                  <View className="flex-row items-center justify-between mt-2.5">
                    <View className="flex-row items-center gap-1.5">
                      <TouchableOpacity
                        className="px-2.5 py-1 rounded-full bg-white/15"
                        onPress={() => seekBy(-10)}
                      >
                        <Typography className="text-white text-[11px] font-bold">
                          -10s
                        </Typography>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-2.5 py-1 rounded-full bg-white/15"
                        onPress={() => seekBy(10)}
                      >
                        <Typography className="text-white text-[11px] font-bold">
                          +10s
                        </Typography>
                      </TouchableOpacity>
                      <TouchableOpacity
                        className="px-2.5 py-1 rounded-full bg-primary/80"
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
                            className="px-2.5 py-1 rounded-full bg-white/15"
                            onPress={cyclePlaybackSpeed}
                          >
                            <Typography className="text-white text-[11px] font-bold">
                              {playbackSpeed}x
                            </Typography>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="px-2.5 py-1 rounded-full bg-white/15"
                            onPress={cycleAspectFit}
                          >
                            <Typography className="text-white text-[11px] font-semibold">
                              {aspectFit === "contain"
                                ? "Fit"
                                : aspectFit === "cover"
                                  ? "Crop"
                                  : "Stretch"}
                            </Typography>
                          </TouchableOpacity>
                          <TouchableOpacity
                            className="p-1.5 rounded-full bg-white/15"
                            onPress={() => playerFullscreenRef.current?.()}
                          >
                            <Maximize2 size={14} color="#fff" />
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </LinearGradient>
            </View>
          )}

          {!showControls && status === "ready" && !isLocked && (
            <TouchableOpacity
              onPress={revealControls}
              activeOpacity={0.8}
              className="absolute top-4 right-4 z-30 bg-black/55 border border-white/15 px-3 py-1 rounded-full"
            >
              <Typography className="text-white/80 text-[11px] font-semibold">
                Menu
              </Typography>
            </TouchableOpacity>
          )}

          {isLocked && status === "ready" && (
            <View className="absolute inset-0 z-50" pointerEvents="box-only">
              <TouchableOpacity
                onPress={() => setIsLocked(false)}
                activeOpacity={0.85}
                className="absolute top-6 right-4 flex-row items-center gap-1.5 bg-zinc-900/90 border border-white/25 px-3.5 py-2 rounded-full"
              >
                <Unlock size={14} color="#ffffff" />
                <Typography className="text-white text-xs font-bold">
                  Unlock
                </Typography>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Server Selection Modal */}
      <Modal
        visible={showServerModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowServerModal(false)}
      >
        <View
          className={`${themeClassName} flex-1 bg-black/75 items-center justify-center p-6`}
          style={themeVars}
        >
          <View className="bg-card border border-border rounded-2xl w-full max-w-sm overflow-hidden p-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-2">
              <View className="flex-row items-center">
                <Server size={18} color={isDark ? "#60a5fa" : "#2563eb"} />
                <Typography className="text-foreground font-bold text-base ml-2">
                  Select Video Provider ({servers.length})
                </Typography>
              </View>
              <TouchableOpacity
                className="p-1.5 rounded-full bg-secondary"
                onPress={() => setShowServerModal(false)}
              >
                <X size={16} color={palette.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView className="max-h-72 my-2">
              {servers.map((srv, idx) => {
                const isSelected = idx === activeServerIdx;
                const isDead = srv.status === "dead";
                return (
                  <TouchableOpacity
                    key={`${srv.url}-${idx}`}
                    className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 border ${
                      isSelected
                        ? "bg-primary/15 border-primary/50"
                        : isDead
                          ? "bg-red-500/10 border-red-500/20"
                          : "bg-secondary/70 border-border/50 active:bg-secondary"
                    }`}
                    onPress={() => {
                      if (idx !== activeServerIdx && currentTime > 10) {
                        setInitialTime(Math.floor(currentTime));
                      }
                      setActiveServerIdx(idx);
                      setErrorMsg("");
                      setStatus("ready");
                      setShowServerModal(false);
                    }}
                  >
                    <View className="flex-row items-center flex-1 mr-2 gap-2">
                      <Typography className="text-xs">
                        {getServerStatusDot(srv)}
                      </Typography>
                      <View className="flex-1">
                        <Typography
                          className={`text-sm font-semibold ${
                            isSelected
                              ? "text-primary"
                              : isDead
                                ? "text-muted-foreground line-through"
                                : "text-foreground"
                          }`}
                          numberOfLines={1}
                        >
                          {srv.name}
                        </Typography>
                        {srv.error ? (
                          <Typography
                            className="text-[10px] text-red-500"
                            numberOfLines={1}
                          >
                            {srv.error}
                          </Typography>
                        ) : srv.pingMs ? (
                          <Typography className="text-[10px] text-emerald-500">
                            {srv.pingMs}ms
                          </Typography>
                        ) : null}
                      </View>
                    </View>
                    <View
                      className={`px-2 py-0.5 rounded ${
                        srv.type === "hls" || srv.type === "mp4"
                          ? "bg-emerald-500/20"
                          : "bg-amber-500/20"
                      }`}
                    >
                      <Typography
                        className={`text-[10px] font-bold uppercase ${
                          srv.type === "hls" || srv.type === "mp4"
                            ? "text-emerald-500"
                            : "text-amber-500"
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

      {/* Episodes Drawer Modal (for Landscape mode) */}
      <Modal
        visible={showEpisodesModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowEpisodesModal(false)}
      >
        <View
          className={`${themeClassName} flex-1 bg-black/75 justify-end`}
          style={themeVars}
        >
          <View className="bg-card border-t border-border rounded-t-3xl max-h-[75%] p-4">
            <View className="flex-row items-center justify-between pb-3 border-b border-border mb-2">
              <View className="flex-row items-center">
                <List size={18} color="#e11d48" />
                <Typography className="text-foreground font-bold text-base ml-2">
                  Episodes ({sortedEpisodes.length})
                </Typography>
              </View>
              <TouchableOpacity
                className="p-1.5 rounded-full bg-secondary"
                onPress={() => setShowEpisodesModal(false)}
              >
                <X size={16} color={palette.foreground} />
              </TouchableOpacity>
            </View>

            <ScrollView className="my-1">
              {sortedEpisodes.map((ep: any) => {
                const isActive = isCurrentEpisodeMatch(ep);
                const prog = episodeProgressMap.get(String(ep.id));
                const isWatched = Boolean(prog?.isRead);
                const resumeSec = prog?.lastPage || 0;
                return (
                  <TouchableOpacity
                    key={ep.id}
                    className={`flex-row items-center justify-between p-3 rounded-xl mb-1.5 border ${
                      isActive
                        ? "bg-primary/15 border-primary/50"
                        : "bg-secondary/70 border-border/50 active:bg-secondary"
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
                          color={isActive ? "#e11d48" : palette.mutedForeground}
                          fill={isActive ? "#e11d48" : "none"}
                        />
                      )}
                      <View className="flex-1 ml-2.5">
                        <Typography
                          className={`text-sm font-semibold ${
                            isActive
                              ? "text-primary"
                              : isWatched
                                ? "text-muted-foreground"
                                : "text-foreground"
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
    </SafeAreaView>
  );
}
