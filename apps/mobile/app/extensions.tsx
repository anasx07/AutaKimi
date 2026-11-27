import { useState, useCallback, useMemo, useRef } from "react";
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from "react-native";
import { Image } from "expo-image";
import { router, Stack, useFocusEffect } from "expo-router";
import { DataService } from "@renderer/shared/api";
import {
  computeAvailableUpdates,
  findInstalledMatch,
  resolveInstallPayload,
} from "@renderer/entities/extension/lib/updates";
import {
  extractBasePkg,
  getRepoMeta,
  normalizeRepoKey,
} from "@common/services/repoIdentity";
import { isAnimeExtension } from "@common/utils/mediaType";
import { Typography, Button, Card, CardContent } from "@mobile/native/ui";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  Package,
  Trash2,
  X,
  Search,
  ArrowLeft,
  Check,
  RefreshCw,
  Pin,
  ChevronRight,
} from "lucide-react-native";
import { useColorScheme } from "nativewind";

const LANG_FLAGS: Record<string, string> = {
  all: "🌐",
  en: "🇬🇧",
  ar: "🇸🇦",
  es: "🇪🇸",
  fr: "🇫🇷",
  id: "🇮🇩",
  ja: "🇯🇵",
  ko: "🇰🇷",
  pt: "🇵🇹",
  ru: "🇷🇺",
  th: "🇹🇭",
  tr: "🇹🇷",
  vi: "Viet",
  zh: "🇨🇳",
  hi: "🇮🇳",
  de: "🇩🇪",
  it: "🇮🇹",
  pl: "🇵🇱",
  nl: "🇳🇱",
  cs: "🇨🇿",
  bg: "🇧🇬",
  ca: "🇦🇩",
  uk: "🇺🇦",
};

const LANG_NAMES: Record<string, string> = {
  all: "All",
  en: "English",
  ar: "Arabic",
  es: "Spanish",
  fr: "French",
  id: "Indonesian",
  ja: "Japanese",
  ko: "Korean",
  pt: "Portuguese",
  ru: "Russian",
  th: "Thai",
  tr: "Turkish",
  vi: "Vietnamese",
  zh: "Chinese",
  hi: "Hindi",
  de: "German",
  it: "Italian",
  pl: "Polish",
  nl: "Dutch",
  cs: "Czech",
  bg: "Bulgarian",
  ca: "Catalan",
  uk: "Ukrainian",
};

const LANGS = [
  "en",
  "ar",
  "es",
  "fr",
  "id",
  "ja",
  "ko",
  "pt",
  "ru",
  "th",
  "tr",
  "vi",
  "zh",
  "de",
  "it",
  "pl",
];

export default function ExtensionsScreen() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [catalog, setCatalog] = useState<any[]>([]);
  const [installed, setInstalled] = useState<any[]>([]);
  const [pinnedPkgs, setPinnedPkgs] = useState<string[]>([]);
  const [showNsfw, setShowNsfw] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchingLangCatalog, setFetchingLangCatalog] = useState(false);
  const [installingPkgs, setInstallingPkgs] = useState<Set<string>>(new Set());
  const [updatingAll, setUpdatingAll] = useState(false);
  const [activeTab, setActiveTab] = useState<"installed" | "available">(
    "available",
  );
  const [mediaFilter, setMediaFilter] = useState<"all" | "manga" | "anime">(
    "all",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [langFilter, setLangFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasInitializedTabRef = useRef(false);

  const loadData = useCallback(
    async (isRefresh = false, explicitLang?: string | null) => {
      if (isRefresh) setRefreshing(true);
      else if (!hasInitializedTabRef.current) setLoading(true);
      setError(null);
      try {
        const targetLang =
          explicitLang !== undefined ? explicitLang : langFilter;
        const [installedExts, catalogRes, pinnedRaw, nsfwRaw] = await Promise.all([
          DataService.db.getExtensions(),
          DataService.getExtensionsCatalog(targetLang || "all"),
          DataService.db.getSetting("pinned_extensions").catch(() => null),
          DataService.db.getSetting("showNsfw").catch(() => null),
        ]);
        const validInstalled = (installedExts || []).filter(
          (e: any) => e.pkg && !/^\d+$/.test(e.pkg),
        );
        setInstalled(validInstalled);
        const cat = Array.isArray(catalogRes) ? catalogRes : [];
        setCatalog(cat);

        const rawPinned =
          typeof pinnedRaw === "string" ? pinnedRaw : (pinnedRaw as any)?.value;
        if (typeof rawPinned === "string" && rawPinned) {
          try {
            const parsed = JSON.parse(rawPinned);
            if (Array.isArray(parsed)) setPinnedPkgs(parsed);
          } catch {}
        }

        const rawNsfw =
          typeof nsfwRaw === "string" ? nsfwRaw : (nsfwRaw as any)?.value;
        setShowNsfw(rawNsfw === "true" || rawNsfw === true);

        // Auto-switch to installed once on initial load when extensions are already installed
        if (!hasInitializedTabRef.current) {
          hasInitializedTabRef.current = true;
          if (validInstalled.length > 0) {
            setActiveTab("installed");
          }
        }
      } catch (e: any) {
        setError(e.message || "Failed to load extensions");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [langFilter],
  );

  useFocusEffect(
    useCallback(() => {
      loadData(false);
    }, [loadData]),
  );

  const onRefresh = () => loadData(true);

  const handleSelectLang = async (nextLang: string | null) => {
    setLangFilter(nextLang);
    setFetchingLangCatalog(true);
    try {
      const cat = await DataService.getExtensionsCatalog(nextLang || "all");
      if (Array.isArray(cat)) setCatalog(cat);
    } catch {
      // keep existing cached catalog on failure
    } finally {
      setFetchingLangCatalog(false);
    }
  };

  const togglePinExt = async (pkg: string) => {
    const next = pinnedPkgs.includes(pkg)
      ? pinnedPkgs.filter((p) => p !== pkg)
      : [...pinnedPkgs, pkg];
    setPinnedPkgs(next);
    const json = JSON.stringify(next);
    await Promise.all([
      DataService.db.setSetting("pinned_extensions", json),
      DataService.db.setSetting("pinned_anime_sources", json),
    ]).catch(() => {});
  };

  const validInstalled = useMemo(() => {
    return installed.filter((e) => e.pkg && !/^\d+$/.test(e.pkg));
  }, [installed]);

  const updatesList = useMemo(() => {
    return computeAvailableUpdates(validInstalled, catalog);
  }, [validInstalled, catalog]);

  const updatesByPkg = useMemo(() => {
    return new Map(updatesList.map((u) => [u.pkg, u]));
  }, [updatesList]);

  const filteredInstalled = useMemo(() => {
    let list = validInstalled;
    if (mediaFilter === "anime") {
      list = list.filter((ext) => isAnimeExtension(ext));
    } else if (mediaFilter === "manga") {
      list = list.filter((ext) => !isAnimeExtension(ext));
    }
    if (langFilter) {
      list = list.filter((ext) => ext.lang === langFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (ext) =>
          (ext.name || "").toLowerCase().includes(q) ||
          (ext.pkg || "").toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const aPin = pinnedPkgs.includes(a.pkg) ? 1 : 0;
      const bPin = pinnedPkgs.includes(b.pkg) ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      return (a.name || a.pkg).localeCompare(b.name || b.pkg);
    });
  }, [validInstalled, mediaFilter, langFilter, searchQuery, pinnedPkgs]);

  const filteredCatalog = useMemo(() => {
    let list = catalog;
    if (!showNsfw) {
      list = list.filter((ext) => !ext.nsfw);
    }
    if (mediaFilter === "anime") {
      list = list.filter((ext) => isAnimeExtension(ext));
    } else if (mediaFilter === "manga") {
      list = list.filter((ext) => !isAnimeExtension(ext));
    }
    if (langFilter) {
      list = list.filter((ext) => ext.lang === langFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (ext) =>
          (ext.name || "").toLowerCase().includes(q) ||
          (ext.pkg || "").toLowerCase().includes(q),
      );
    }
    return list;
  }, [catalog, showNsfw, mediaFilter, langFilter, searchQuery]);

  const installExt = async (ext: any) => {
    const payload = resolveInstallPayload(ext, validInstalled);
    setInstallingPkgs((prev) => new Set(prev).add(payload.pkg));
    try {
      await DataService.installExtension(payload, payload.repoUrl || "local");
      await loadData(true);
    } catch (e: any) {
      console.error("[Extensions] Install failed:", e);
    } finally {
      setInstallingPkgs((prev) => {
        const next = new Set(prev);
        next.delete(payload.pkg);
        return next;
      });
    }
  };

  const updateAllExt = async () => {
    if (updatesList.length === 0 || updatingAll) return;
    setUpdatingAll(true);
    const pkgs = updatesList.map((u) => u.pkg);
    setInstallingPkgs((prev) => {
      const next = new Set(prev);
      pkgs.forEach((p) => next.add(p));
      return next;
    });
    try {
      await Promise.all(
        updatesList.map((ext) =>
          DataService.installExtension(ext, ext.repoUrl || "local"),
        ),
      );
      await loadData(true);
    } catch (e: any) {
      console.error("[Extensions] Bulk update failed:", e);
    } finally {
      setInstallingPkgs((prev) => {
        const next = new Set(prev);
        pkgs.forEach((p) => next.delete(p));
        return next;
      });
      setUpdatingAll(false);
    }
  };

  const uninstallExt = async (pkg: string) => {
    try {
      await DataService.db.removeExtension(pkg);
      await loadData(true);
    } catch (e) {
      console.error("[Extensions] Uninstall failed:", e);
    }
  };

  const renderExtItem = ({ item }: { item: any }) => {
    const installedMatch =
      activeTab === "installed"
        ? item
        : findInstalledMatch(item, installed) ||
          installed.find(
            (e) =>
              !normalizeRepoKey(e.repoUrl) &&
              (e.pkg === item.pkg ||
                e.pkg.endsWith(item.pkg) ||
                item.pkg.endsWith(e.pkg)),
          );
    const installed_ = !!installedMatch;
    const updateTarget = installedMatch
      ? updatesByPkg.get(installedMatch.pkg)
      : updatesByPkg.get(item.pkg);
    const plannedInstall = resolveInstallPayload(item, validInstalled);
    const installing =
      installingPkgs.has(item.pkg) ||
      installingPkgs.has(plannedInstall.pkg) ||
      (installedMatch ? installingPkgs.has(installedMatch.pkg) : false) ||
      (updateTarget ? installingPkgs.has(updateTarget.pkg) : false);
    const flag = LANG_FLAGS[item.lang] || "🌐";
    const langName = LANG_NAMES[item.lang] || item.lang;
    const hasRepo =
      !!item.repoUrl && item.repoUrl !== "remote" && item.repoUrl !== "local";
    const repoMeta = hasRepo ? getRepoMeta(item.repoUrl, item.repoName) : null;
    const repoColor = item.repoColor || repoMeta?.repoColor;
    const repoName = item.repoName || repoMeta?.repoName;
    const isPinned = installedMatch ? pinnedPkgs.includes(installedMatch.pkg) : false;
    const itemIsAnime = isAnimeExtension(item);

    return (
      <Card
        className="mb-3"
        style={
          repoColor
            ? { borderLeftWidth: 4, borderLeftColor: repoColor }
            : undefined
        }
      >
        <CardContent>
          <View className="flex-row items-center">
            <TouchableOpacity
              className="flex-row items-center flex-1 mr-2"
              activeOpacity={installed_ ? 0.75 : 1}
              disabled={!installed_}
              onPress={() => {
                const targetPkg = installedMatch?.pkg || item.pkg;
                router.push({
                  pathname: "/(tabs)/browse" as any,
                  params: { pkg: targetPkg },
                });
              }}
            >
              {item.icon ? (
                <Image
                  source={{ uri: item.icon }}
                  style={{ width: 48, height: 48, borderRadius: 12 }}
                  contentFit="contain"
                  transition={150}
                />
              ) : (
                <View className="w-12 h-12 bg-primary/10 rounded-xl items-center justify-center">
                  <Package size={24} color="#e11d48" />
                </View>
              )}
              <View className="flex-1 ml-3">
                <View className="flex-row items-center gap-1.5">
                  <Typography className="font-semibold flex-shrink" numberOfLines={1}>
                    {item.name || extractBasePkg(item.pkg)}
                  </Typography>
                  <View className="px-1.5 py-0.5 rounded bg-secondary border border-border/50">
                    <Typography className="text-[9px] font-bold uppercase text-muted-foreground">
                      {itemIsAnime ? "Anime" : "Manga"}
                    </Typography>
                  </View>
                </View>
                <View className="flex-row items-center flex-wrap gap-1.5 mt-0.5">
                  <Typography className="text-xs text-muted-foreground">
                    {flag} {langName} ·{" "}
                    {updateTarget
                      ? `v${installedMatch?.version || item.version || "1.0.0"} → v${updateTarget.version}`
                      : `v${item.version || "1.0.0"}`}
                  </Typography>
                  {repoName && repoColor && (
                    <View
                      style={{
                        backgroundColor: `${repoColor}1f`,
                        borderColor: `${repoColor}45`,
                        borderWidth: 1,
                      }}
                      className="px-1.5 py-0.5 rounded-md"
                    >
                      <Typography
                        style={{ color: repoColor }}
                        className="text-[10px] font-bold"
                      >
                        {repoName}
                      </Typography>
                    </View>
                  )}
                  {!!item.nsfw && (
                    <View className="px-1.5 py-0.5 rounded bg-destructive/15 border border-destructive/30">
                      <Typography className="text-[9px] font-bold text-destructive">
                        18+
                      </Typography>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>

            {activeTab === "installed" ? (
              <View className="flex-row items-center gap-1.5">
                <TouchableOpacity
                  className="p-2 rounded-xl bg-secondary/60"
                  onPress={() => togglePinExt(item.pkg)}
                  activeOpacity={0.7}
                  accessibilityLabel={isPinned ? "Unpin extension" : "Pin extension"}
                >
                  <Pin
                    size={16}
                    color={isPinned ? "#e11d48" : "#71717a"}
                    fill={isPinned ? "#e11d48" : "none"}
                  />
                </TouchableOpacity>
                {updateTarget && (
                  <Button
                    title={installing ? "" : "Update"}
                    variant="primary"
                    size="sm"
                    loading={installing}
                    disabled={installing}
                    onPress={() => installExt(updateTarget)}
                  />
                )}
                <TouchableOpacity
                  className="p-2 bg-destructive/10 rounded-xl"
                  onPress={() => uninstallExt(item.pkg)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-1.5"
                  onPress={() =>
                    router.push({
                      pathname: "/(tabs)/browse" as any,
                      params: { pkg: item.pkg },
                    })
                  }
                >
                  <ChevronRight size={16} color="#71717a" />
                </TouchableOpacity>
              </View>
            ) : installed_ ? (
              <View className="flex-row items-center gap-2">
                {updateTarget ? (
                  <Button
                    title={installing ? "" : "Update"}
                    variant="primary"
                    size="sm"
                    loading={installing}
                    disabled={installing}
                    onPress={() => installExt(updateTarget)}
                  />
                ) : (
                  <View className="px-3 py-1.5 bg-secondary rounded-xl flex-row items-center">
                    <Check size={14} color="#10b981" />
                    <Typography className="text-xs font-semibold text-emerald-500 ml-1">
                      Installed
                    </Typography>
                  </View>
                )}
                <TouchableOpacity
                  className="p-2 bg-destructive/10 rounded-xl"
                  onPress={() => uninstallExt(installedMatch?.pkg || item.pkg)}
                  activeOpacity={0.7}
                >
                  <Trash2 size={16} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ) : (
              <Button
                title={installing ? "" : "Install"}
                variant="primary"
                size="sm"
                loading={installing}
                disabled={installing}
                onPress={() => installExt(item)}
              />
            )}
          </View>
        </CardContent>
      </Card>
    );
  };

  const currentList =
    activeTab === "installed" ? filteredInstalled : filteredCatalog;

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/40 bg-background">
          <View className="flex-row items-center">
            <TouchableOpacity
              className="p-2 -ml-2 rounded-xl"
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={24} color={isDark ? "#f4f4f5" : "#09090b"} />
            </TouchableOpacity>
            <Typography
              variant="h1"
              className="ml-2 text-2xl font-black text-foreground"
            >
              Extensions
            </Typography>
          </View>
          <TouchableOpacity
            className="px-3 py-1.5 bg-secondary/50 rounded-xl border border-border/50"
            onPress={() => router.push("/repositories" as any)}
            activeOpacity={0.7}
          >
            <Typography className="text-xs font-semibold text-primary">
              Repositories
            </Typography>
          </TouchableOpacity>
        </View>

        {/* Main Segmented Tabs: Installed / Available */}
        <View className="flex-row mx-4 mt-3 p-1 bg-secondary/30 rounded-2xl border border-border/40">
          <TouchableOpacity
            onPress={() => setActiveTab("installed")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row ${
              activeTab === "installed" ? "bg-primary" : ""
            }`}
            activeOpacity={0.8}
          >
            <Typography
              className={`font-bold text-sm ${
                activeTab === "installed" ? "text-white" : "text-foreground"
              }`}
            >
              Installed
            </Typography>
            <View
              className={`ml-2 px-2 py-0.5 rounded-full ${
                activeTab === "installed" ? "bg-white/20" : "bg-muted"
              }`}
            >
              <Typography
                className={`text-xs font-bold ${
                  activeTab === "installed"
                    ? "text-white"
                    : "text-muted-foreground"
                }`}
              >
                {validInstalled.length}
              </Typography>
            </View>
            {updatesList.length > 0 && (
              <View className="ml-1.5 px-1.5 py-0.5 rounded-full bg-amber-500">
                <Typography className="text-[10px] font-black text-black">
                  {updatesList.length}
                </Typography>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setActiveTab("available")}
            className={`flex-1 py-2 rounded-xl items-center justify-center flex-row ${
              activeTab === "available" ? "bg-primary" : ""
            }`}
            activeOpacity={0.8}
          >
            <Typography
              className={`font-bold text-sm ${
                activeTab === "available" ? "text-white" : "text-foreground"
              }`}
            >
              Available
            </Typography>
            <View
              className={`ml-2 px-2 py-0.5 rounded-full ${
                activeTab === "available" ? "bg-white/20" : "bg-muted"
              }`}
            >
              <Typography
                className={`text-xs font-bold ${
                  activeTab === "available"
                    ? "text-white"
                    : "text-muted-foreground"
                }`}
              >
                {catalog.length}
              </Typography>
            </View>
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View className="px-4 py-2 bg-card mx-4 mt-2.5 rounded-xl border border-border flex-row items-center">
          <Search size={16} color="#94a3b8" />
          <TextInput
            className="flex-1 ml-2 text-foreground py-1 text-sm"
            placeholder={
              activeTab === "installed"
                ? "Search installed extensions..."
                : "Search available extensions..."
            }
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity
              onPress={() => setSearchQuery("")}
              className="p-1"
            >
              <X size={16} color="#94a3b8" />
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Media Filter: All / Manga / Anime */}
        <View className="flex-row mx-4 mt-2.5 gap-2">
          {(
            [
              { key: "all", label: "All" },
              { key: "manga", label: "Manga" },
              { key: "anime", label: "Anime" },
            ] as const
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              onPress={() => setMediaFilter(opt.key)}
              className={`px-3.5 py-1.5 rounded-lg border ${
                mediaFilter === opt.key
                  ? "bg-primary border-primary"
                  : "bg-card border-border"
              }`}
            >
              <Typography
                className={
                  mediaFilter === opt.key
                    ? "text-white font-semibold text-xs"
                    : "text-muted-foreground font-medium text-xs"
                }
              >
                {opt.label}
              </Typography>
            </TouchableOpacity>
          ))}
          {fetchingLangCatalog && (
            <View className="ml-auto justify-center pr-1">
              <ActivityIndicator size="small" color="#e11d48" />
            </View>
          )}
        </View>

        {/* Lang Filter */}
        <View className="py-2">
          <FlatList
            horizontal
            data={["all", ...LANGS]}
            keyExtractor={(l) => l}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item: lang }) => (
              <TouchableOpacity
                className={`px-3 py-1.5 rounded-full mr-2 ${
                  langFilter === lang || (!langFilter && lang === "all")
                    ? "bg-primary"
                    : "bg-card border border-border"
                }`}
                onPress={() =>
                  handleSelectLang(lang === "all" ? null : lang)
                }
              >
                <Typography
                  className={`text-xs font-medium ${
                    langFilter === lang || (!langFilter && lang === "all")
                      ? "text-white"
                      : "text-foreground"
                  }`}
                >
                  {LANG_FLAGS[lang] || "🌐"} {LANG_NAMES[lang] || lang}
                </Typography>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Update All Banner */}
        {activeTab === "installed" && updatesList.length > 0 && (
          <View className="mx-4 mt-1 mb-1 px-3.5 py-2.5 bg-primary/10 border border-primary/30 rounded-xl flex-row items-center justify-between">
            <View className="flex-row items-center flex-1 mr-2">
              <RefreshCw size={15} color="#e11d48" />
              <Typography className="text-xs font-semibold text-foreground ml-2">
                {updatesList.length}{" "}
                {updatesList.length === 1
                  ? "extension update"
                  : "extension updates"}{" "}
                available
              </Typography>
            </View>
            <Button
              title={updatingAll ? "" : "Update All"}
              variant="primary"
              size="sm"
              loading={updatingAll}
              disabled={updatingAll}
              onPress={updateAllExt}
            />
          </View>
        )}

        {/* Content */}
        {loading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#e11d48" />
          </View>
        ) : error ? (
          <View className="flex-1 items-center justify-center px-8">
            <Typography className="text-destructive text-lg font-semibold text-center">
              Failed to load
            </Typography>
            <Typography className="text-muted-foreground mt-2 text-center">
              {error}
            </Typography>
            <Button
              title="Retry"
              variant="outline"
              className="mt-4"
              onPress={onRefresh}
            />
          </View>
        ) : (
          <FlatList
            data={currentList}
            keyExtractor={(item) =>
              item.catalogKey || `${item.repoUrl || "default"}::${item.pkg}`
            }
            renderItem={renderExtItem}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor="#e11d48"
              />
            }
            ListEmptyComponent={
              <View className="py-12 items-center px-6">
                <Package size={48} color="#94a3b8" />
                <Typography className="text-muted-foreground mt-4 text-center font-medium">
                  {searchQuery
                    ? "No extensions match your search"
                    : activeTab === "installed"
                      ? "No extensions installed yet"
                      : "No available extensions found"}
                </Typography>
                {activeTab === "installed" && !searchQuery && (
                  <Button
                    title="Browse Available Extensions"
                    variant="outline"
                    className="mt-4"
                    onPress={() => setActiveTab("available")}
                  />
                )}
              </View>
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}
