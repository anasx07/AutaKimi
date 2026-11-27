import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Image } from "expo-image";
import { WebView } from "react-native-webview";
import { SafeAreaView } from "react-native-safe-area-context";
import { Typography, Button } from "../ui";
import { DataService } from "@renderer/shared/api";
import { ANILIST_OAUTH_URL } from "../../mobile/tracker.native";
import { useAppTheme } from "../../mobile/theme";
import type { AniListMedia, AniListUser, Tracker } from "@common/types";
import {
  X,
  Search,
  LogIn,
  LogOut,
  Key,
  RefreshCw,
  Trash2,
  Plus,
  Minus,
  ExternalLink,
  Check,
} from "lucide-react-native";

interface TrackingModalProps {
  visible: boolean;
  onClose: () => void;
  mediaId: string;
  mediaTitle: string;
  mediaType?: "manga" | "anime";
  suggestedProgress?: number;
  onTrackerChanged?: () => void;
}

const ANILIST_STATUSES: Array<{ value: string; label: string }> = [
  { value: "CURRENT", label: "Current" },
  { value: "PLANNING", label: "Planning" },
  { value: "COMPLETED", label: "Completed" },
  { value: "PAUSED", label: "Paused" },
  { value: "DROPPED", label: "Dropped" },
  { value: "REPEATING", label: "Repeating" },
];

export function TrackingModal({
  visible,
  onClose,
  mediaId,
  mediaTitle,
  mediaType = "manga",
  suggestedProgress = 0,
  onTrackerChanged,
}: TrackingModalProps) {
  const { themeVars, themeClassName } = useAppTheme();
  const [user, setUser] = useState<AniListUser | null>(null);
  const [loadingUser, setLoadingUser] = useState(false);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [tokenInput, setTokenInput] = useState("");
  const [showOAuthWebView, setShowOAuthWebView] = useState(false);

  const [tracker, setTracker] = useState<Tracker | null>(null);
  const [linkedMedia, setLinkedMedia] = useState<AniListMedia | null>(null);
  const [editStatus, setEditStatus] = useState("CURRENT");
  const [editProgress, setEditProgress] = useState(0);
  const [editScore, setEditScore] = useState(0);

  const [searchQuery, setSearchQuery] = useState(mediaTitle || "");
  const [searchResults, setSearchResults] = useState<AniListMedia[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    text: string;
    isError?: boolean;
  } | null>(null);

  const loadState = useCallback(async () => {
    setLoadingUser(true);
    setStatusMessage(null);
    try {
      const [uRes, tRes] = await Promise.all([
        DataService.tracker.getUserAniList(),
        DataService.tracker.getByManga(mediaId),
      ]);
      const resolvedUser = (uRes as any)?.value ?? uRes ?? null;
      setUser(resolvedUser);

      const trackersList = ((tRes as any)?.value ?? tRes ?? []) as Tracker[];
      const aniTracker =
        trackersList.find((t) => t.provider === "anilist") || null;
      setTracker(aniTracker);

      if (aniTracker?.remoteId) {
        const remoteId = Number.parseInt(aniTracker.remoteId, 10);
        if (Number.isFinite(remoteId)) {
          const mRes = await DataService.tracker.getMediaAniList(remoteId);
          const media = ((mRes as any)?.value ??
            mRes ??
            null) as AniListMedia | null;
          setLinkedMedia(media);
          setEditStatus(
            aniTracker.status || media?.mediaListEntry?.status || "CURRENT",
          );
          const baseProg =
            aniTracker.lastSyncedChapter ??
            media?.mediaListEntry?.progress ??
            0;
          setEditProgress(Math.max(baseProg, suggestedProgress));
          setEditScore(
            aniTracker.score ?? media?.mediaListEntry?.score ?? 0,
          );
        }
      } else {
        setLinkedMedia(null);
        if (resolvedUser && mediaTitle) {
          setIsSearching(true);
          try {
            const sRes = await DataService.tracker.searchAniList(
              mediaTitle,
              mediaType === "anime" ? "ANIME" : "MANGA",
            );
            const list = ((sRes as any)?.value ?? sRes ?? []) as AniListMedia[];
            setSearchResults(Array.isArray(list) ? list : []);
          } catch {
            // ignore auto-search errors
          } finally {
            setIsSearching(false);
          }
        }
      }
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Failed to load tracker data",
        isError: true,
      });
    } finally {
      setLoadingUser(false);
    }
  }, [mediaId, mediaTitle, mediaType, suggestedProgress]);

  useEffect(() => {
    if (visible) {
      setSearchQuery(mediaTitle || "");
      loadState();
    }
  }, [visible, mediaTitle, loadState]);

  const handleOAuthUrl = async (url: string) => {
    if (!url) return;
    const match = url.match(/[#?&]access_token=([^&]+)/);
    if (!match?.[1]) return;
    const accessToken = decodeURIComponent(match[1]);
    setShowOAuthWebView(false);
    setLoadingUser(true);
    try {
      const nextUser = await DataService.tracker.setTokenAniList(accessToken);
      setUser(nextUser as AniListUser);
      setStatusMessage({ text: "Connected to AniList!" });
      await loadState();
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Failed to complete AniList login",
        isError: true,
      });
    } finally {
      setLoadingUser(false);
    }
  };

  const handleTokenSubmit = async () => {
    if (!tokenInput.trim()) return;
    setLoadingUser(true);
    setStatusMessage(null);
    try {
      const nextUser = await DataService.tracker.setTokenAniList(
        tokenInput.trim(),
      );
      setUser(nextUser as AniListUser);
      setTokenInput("");
      setShowTokenInput(false);
      setStatusMessage({ text: "Connected to AniList!" });
      await loadState();
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Invalid AniList token",
        isError: true,
      });
    } finally {
      setLoadingUser(false);
    }
  };

  const handleLogout = async () => {
    await DataService.tracker.logoutAniList();
    setUser(null);
    setSearchResults([]);
    setStatusMessage({ text: "Disconnected from AniList." });
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setStatusMessage(null);
    try {
      const res = await DataService.tracker.searchAniList(
        searchQuery.trim(),
        mediaType === "anime" ? "ANIME" : "MANGA",
      );
      const list = ((res as any)?.value ?? res ?? []) as AniListMedia[];
      setSearchResults(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Search failed",
        isError: true,
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleLinkMedia = async (media: AniListMedia) => {
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const initialProgress = Math.max(
        media.mediaListEntry?.progress || 0,
        suggestedProgress,
      );
      const nextTracker: Tracker = {
        mangaId: mediaId,
        provider: "anilist",
        remoteId: String(media.id),
        status: media.mediaListEntry?.status || "CURRENT",
        lastSyncedChapter: initialProgress,
        score: media.mediaListEntry?.score || 0,
        updatedAt: new Date().toISOString(),
      };
      await DataService.tracker.save(nextTracker);
      setTracker(nextTracker);
      setLinkedMedia(media);
      setEditStatus(nextTracker.status || "CURRENT");
      setEditProgress(initialProgress);
      setEditScore(nextTracker.score || 0);
      setStatusMessage({
        text: `Linked to "${media.title.english || media.title.romaji}"`,
      });
      onTrackerChanged?.();
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Failed to link entry",
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnlink = () => {
    Alert.alert(
      "Unlink Tracker",
      "Your local reading/watching progress will be preserved.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Unlink",
          style: "destructive",
          onPress: async () => {
            setIsSaving(true);
            try {
              await DataService.tracker.delete(mediaId, "anilist");
              setTracker(null);
              setLinkedMedia(null);
              setStatusMessage({ text: "Tracker unlinked." });
              onTrackerChanged?.();
            } catch (err: any) {
              setStatusMessage({
                text: err?.message || "Failed to unlink",
                isError: true,
              });
            } finally {
              setIsSaving(false);
            }
          },
        },
      ],
    );
  };

  const handleSyncNow = async () => {
    if (!tracker) return;
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const remoteId = Number.parseInt(tracker.remoteId, 10);
      const updated = await DataService.tracker.updateAniList({
        mediaId: remoteId,
        status: editStatus,
        progress: editProgress,
        score: editScore,
      });
      const finalStatus = (updated as any)?.status || editStatus;
      await DataService.tracker.save({
        mangaId: mediaId,
        provider: "anilist",
        remoteId: tracker.remoteId,
        status: finalStatus,
        lastSyncedChapter: editProgress,
        score: editScore,
        updatedAt: new Date().toISOString(),
      });
      setEditStatus(finalStatus);
      setStatusMessage({ text: "Synced progress to AniList!" });
      onTrackerChanged?.();
    } catch (err: any) {
      setStatusMessage({
        text: err?.message || "Failed to sync with AniList",
        isError: true,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View className={`${themeClassName} flex-1 bg-black/75 justify-end`} style={themeVars}>
        <View className="bg-background rounded-t-3xl border-t border-border max-h-[88%]">
          {/* Header */}
          <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
            <View className="flex-row items-center gap-3 flex-1 mr-2">
              <View className="w-9 h-9 rounded-xl bg-[#02A9FF]/15 items-center justify-center">
                <Typography className="text-[#02A9FF] font-black text-sm">
                  AL
                </Typography>
              </View>
              <View className="flex-1">
                <Typography className="font-bold text-base">
                  AniList Tracking
                </Typography>
                <Typography
                  className="text-xs text-muted-foreground"
                  numberOfLines={1}
                >
                  {mediaTitle}
                </Typography>
              </View>
            </View>
            <TouchableOpacity
              onPress={onClose}
              className="p-2 rounded-full bg-secondary"
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView className="px-5 py-4" keyboardShouldPersistTaps="handled">
            {/* Feedback Banner */}
            {statusMessage && (
              <View
                className={`p-3 rounded-xl mb-4 flex-row items-center justify-between border ${
                  statusMessage.isError
                    ? "bg-destructive/10 border-destructive/30"
                    : "bg-primary/10 border-primary/30"
                }`}
              >
                <Typography
                  className={`text-xs font-medium flex-1 mr-2 ${
                    statusMessage.isError ? "text-destructive" : "text-primary"
                  }`}
                >
                  {statusMessage.text}
                </Typography>
                <TouchableOpacity onPress={() => setStatusMessage(null)}>
                  <X size={14} color="#94a3b8" />
                </TouchableOpacity>
              </View>
            )}

            {/* Account Card */}
            <View className="p-4 rounded-2xl bg-card border border-border mb-4">
              {loadingUser ? (
                <View className="flex-row items-center gap-2">
                  <ActivityIndicator size="small" color="#02A9FF" />
                  <Typography className="text-xs text-muted-foreground">
                    Checking AniList account...
                  </Typography>
                </View>
              ) : user ? (
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1 mr-2">
                    {user.avatar?.medium ? (
                      <Image
                        source={{ uri: user.avatar.medium }}
                        style={{ width: 36, height: 36, borderRadius: 18 }}
                      />
                    ) : (
                      <View className="w-9 h-9 rounded-full bg-[#02A9FF]/20 items-center justify-center">
                        <Typography className="text-[#02A9FF] font-bold text-xs">
                          {user.name.slice(0, 2).toUpperCase()}
                        </Typography>
                      </View>
                    )}
                    <View className="flex-1">
                      <Typography className="font-bold text-sm" numberOfLines={1}>
                        {user.name}
                      </Typography>
                      <Typography className="text-[11px] text-emerald-500 font-semibold">
                        AniList Connected
                      </Typography>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={handleLogout}
                    className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-secondary"
                  >
                    <LogOut size={14} color="#ef4444" />
                    <Typography className="text-xs text-destructive font-semibold">
                      Disconnect
                    </Typography>
                  </TouchableOpacity>
                </View>
              ) : (
                <View>
                  <Typography className="font-bold text-sm">
                    Connect AniList
                  </Typography>
                  <Typography className="text-xs text-muted-foreground mt-0.5 mb-3">
                    Sync read chapters and watched episodes automatically.
                  </Typography>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => setShowOAuthWebView(true)}
                      className="flex-1 flex-row items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#02A9FF]"
                    >
                      <LogIn size={16} color="#fff" />
                      <Typography className="text-white text-xs font-bold">
                        Log in with AniList
                      </Typography>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => setShowTokenInput((p) => !p)}
                      className="p-2.5 rounded-xl bg-secondary border border-border"
                    >
                      <Key size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>

                  {showTokenInput && (
                    <View className="mt-3 pt-3 border-t border-border/60 gap-2">
                      <Typography className="text-xs text-muted-foreground">
                        Paste your AniList personal access token:
                      </Typography>
                      <View className="flex-row gap-2">
                        <TextInput
                          value={tokenInput}
                          onChangeText={setTokenInput}
                          placeholder="Paste token..."
                          placeholderTextColor="#71717a"
                          secureTextEntry
                          className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-foreground text-xs"
                        />
                        <Button
                          title="Save"
                          size="sm"
                          onPress={handleTokenSubmit}
                        />
                      </View>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Main Tracker Section */}
            {tracker && linkedMedia ? (
              <View className="p-4 rounded-2xl bg-card border border-border mb-6 gap-4">
                <View className="flex-row gap-3 items-start">
                  {linkedMedia.coverImage?.medium && (
                    <Image
                      source={{ uri: linkedMedia.coverImage.medium }}
                      style={{ width: 56, height: 80, borderRadius: 10 }}
                    />
                  )}
                  <View className="flex-1">
                    <Typography className="font-bold text-sm" numberOfLines={2}>
                      {linkedMedia.title.english || linkedMedia.title.romaji}
                    </Typography>
                    <Typography className="text-xs text-muted-foreground mt-1">
                      {mediaType === "anime"
                        ? `${linkedMedia.episodes || "?"} episodes`
                        : `${linkedMedia.chapters || "?"} chapters`}
                    </Typography>
                    <TouchableOpacity
                      onPress={() =>
                        DataService.openExternal(
                          `https://anilist.co/${mediaType === "anime" ? "anime" : "manga"}/${linkedMedia.id}`,
                        )
                      }
                      className="flex-row items-center gap-1 mt-1.5"
                    >
                      <Typography className="text-primary text-xs font-semibold">
                        Open on AniList
                      </Typography>
                      <ExternalLink size={12} color="#e11d48" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Status Picker */}
                <View>
                  <Typography className="text-xs font-semibold text-muted-foreground mb-2">
                    Status
                  </Typography>
                  <View className="flex-row flex-wrap gap-1.5">
                    {ANILIST_STATUSES.map((st) => {
                      const active = editStatus === st.value;
                      return (
                        <TouchableOpacity
                          key={st.value}
                          onPress={() => setEditStatus(st.value)}
                          className={`px-3 py-1.5 rounded-full border ${
                            active
                              ? "bg-primary/20 border-primary"
                              : "bg-secondary border-border"
                          }`}
                        >
                          <Typography
                            className={`text-xs font-medium ${
                              active ? "text-primary" : "text-muted-foreground"
                            }`}
                          >
                            {st.label}
                          </Typography>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Progress Stepper */}
                <View>
                  <Typography className="text-xs font-semibold text-muted-foreground mb-2">
                    {mediaType === "anime"
                      ? "Episodes Watched"
                      : "Chapters Read"}
                  </Typography>
                  <View className="flex-row items-center gap-2">
                    <TouchableOpacity
                      onPress={() => setEditProgress((p) => Math.max(0, p - 1))}
                      className="w-10 h-10 rounded-xl bg-secondary border border-border items-center justify-center"
                    >
                      <Minus size={16} color="#94a3b8" />
                    </TouchableOpacity>
                    <TextInput
                      keyboardType="numeric"
                      value={String(editProgress)}
                      onChangeText={(t) =>
                        setEditProgress(Math.max(0, Number.parseInt(t, 10) || 0))
                      }
                      className="flex-1 h-10 bg-background border border-border rounded-xl text-center text-foreground font-bold text-sm"
                    />
                    <TouchableOpacity
                      onPress={() => setEditProgress((p) => p + 1)}
                      className="w-10 h-10 rounded-xl bg-secondary border border-border items-center justify-center"
                    >
                      <Plus size={16} color="#94a3b8" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Score */}
                <View>
                  <Typography className="text-xs font-semibold text-muted-foreground mb-2">
                    Score (0 - 100)
                  </Typography>
                  <TextInput
                    keyboardType="numeric"
                    value={String(editScore)}
                    onChangeText={(t) =>
                      setEditScore(
                        Math.max(
                          0,
                          Math.min(100, Number.parseInt(t, 10) || 0),
                        ),
                      )
                    }
                    className="h-10 bg-background border border-border rounded-xl px-3 text-foreground font-semibold text-sm"
                  />
                </View>

                {/* Footer Actions */}
                <View className="flex-row items-center justify-between pt-2 border-t border-border/60">
                  <TouchableOpacity
                    onPress={handleUnlink}
                    disabled={isSaving}
                    className="flex-row items-center gap-1.5 px-3 py-2 rounded-xl bg-destructive/10"
                  >
                    <Trash2 size={14} color="#ef4444" />
                    <Typography className="text-xs text-destructive font-semibold">
                      Unlink
                    </Typography>
                  </TouchableOpacity>

                  <Button
                    title={isSaving ? "Syncing..." : "Sync to AniList"}
                    size="sm"
                    disabled={isSaving || !user}
                    onPress={handleSyncNow}
                    icon={<RefreshCw size={14} color="#fff" />}
                  />
                </View>
              </View>
            ) : (
              <View className="mb-8">
                <Typography className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Search &amp; Link on AniList
                </Typography>
                <View className="flex-row gap-2 mb-3">
                  <View className="flex-1 flex-row items-center bg-card border border-border rounded-xl px-3">
                    <Search size={15} color="#71717a" />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      onSubmitEditing={handleSearch}
                      placeholder="Search title..."
                      placeholderTextColor="#71717a"
                      returnKeyType="search"
                      className="flex-1 py-2.5 ml-2 text-foreground text-sm"
                    />
                  </View>
                  <Button
                    title="Search"
                    size="sm"
                    disabled={isSearching || !searchQuery.trim()}
                    onPress={handleSearch}
                  />
                </View>

                {isSearching ? (
                  <View className="py-8 items-center">
                    <ActivityIndicator size="small" color="#e11d48" />
                  </View>
                ) : searchResults.length === 0 ? (
                  <View className="py-8 items-center bg-card rounded-2xl border border-border">
                    <Typography className="text-xs text-muted-foreground">
                      Search AniList to link this title.
                    </Typography>
                  </View>
                ) : (
                  <View className="gap-2">
                    {searchResults.map((item) => (
                      <TouchableOpacity
                        key={item.id}
                        disabled={isSaving}
                        onPress={() => handleLinkMedia(item)}
                        className="flex-row items-center p-3 rounded-2xl bg-card border border-border gap-3"
                      >
                        {item.coverImage?.medium && (
                          <Image
                            source={{ uri: item.coverImage.medium }}
                            style={{ width: 44, height: 64, borderRadius: 8 }}
                          />
                        )}
                        <View className="flex-1">
                          <Typography
                            className="font-semibold text-sm"
                            numberOfLines={2}
                          >
                            {item.title.english || item.title.romaji}
                          </Typography>
                          <Typography className="text-xs text-muted-foreground mt-0.5">
                            {[
                              item.format,
                              mediaType === "anime"
                                ? `${item.episodes || "?"} eps`
                                : `${item.chapters || "?"} chs`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Typography>
                        </View>
                        <View className="px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30 flex-row items-center gap-1">
                          <Check size={13} color="#e11d48" />
                          <Typography className="text-primary text-xs font-bold">
                            Link
                          </Typography>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>

      {/* In-App AniList OAuth WebView Modal */}
      <Modal
        visible={showOAuthWebView}
        animationType="slide"
        onRequestClose={() => setShowOAuthWebView(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <Typography className="font-bold text-base">
              Sign in to AniList
            </Typography>
            <TouchableOpacity
              onPress={() => setShowOAuthWebView(false)}
              className="p-2 rounded-full bg-secondary"
            >
              <X size={18} color="#94a3b8" />
            </TouchableOpacity>
          </View>
          <WebView
            source={{ uri: ANILIST_OAUTH_URL }}
            onNavigationStateChange={(navState) => {
              void handleOAuthUrl(navState.url);
            }}
            onShouldStartLoadWithRequest={(req) => {
              if (req.url && req.url.includes("access_token=")) {
                void handleOAuthUrl(req.url);
                return false;
              }
              return true;
            }}
          />
        </SafeAreaView>
      </Modal>
    </Modal>
  );
}
