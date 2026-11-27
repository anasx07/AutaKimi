import React, { useState, useCallback } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useFocusEffect } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Globe,
  RefreshCw,
  AlertCircle,
} from "lucide-react-native";
import { Typography, Button, Card, CardContent } from "../src/native/ui";
import { DataService } from "@renderer/shared/api";
import { keiyoushiService } from "@common";
import { useColorScheme } from "nativewind";
import { getRepoMeta } from "@common/services/repoIdentity";

function getGithubRawSuggestion(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "github.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      if (parts.length >= 2) {
        const user = parts[0];
        const repo = parts[1];
        if (parts[2] === "blob" && parts.length >= 4) {
          const branchAndPath = parts.slice(3).join("/");
          return `https://raw.githubusercontent.com/${user}/${repo}/${branchAndPath}`;
        }
        if (parts.length === 2 || (parts.length >= 3 && parts[2] === "tree")) {
          const branch =
            parts.length >= 4 && parts[2] === "tree" ? parts[3] : "main";
          return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/manifest.json`;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

export default function RepositoriesPage() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const queryClient = useQueryClient();
  const [repos, setRepos] = useState<string[]>([]);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<string | null>(null);

  const fetchRepos = useCallback(async () => {
    try {
      const list = await DataService.sources.getRepos();
      setRepos(Array.isArray(list) ? list : []);
    } catch {
      setRepos([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchRepos();
    }, [fetchRepos]),
  );

  const submitRepo = async (rawInput: string) => {
    let url = rawInput.trim();
    if (!url) return;
    if (keiyoushiService.isKeiyoushiUrl(url)) {
      url = keiyoushiService.normalizeKeiyoushiUrl(url);
    }

    setIsLoading(true);
    setRepoError(null);
    setSuggestion(null);
    try {
      const res = await DataService.sources.addRepo(url);
      if (res && (res as any).success) {
        setNewRepoUrl("");
        await fetchRepos();
        await DataService.sources.refreshAll();
        await queryClient.invalidateQueries({ queryKey: ["extensions"] });
        const count = (res as any).count || 0;
        Alert.alert(
          "Success",
          count > 0
            ? `Added repository (${count} entries synced).`
            : "Repository added successfully.",
        );
      } else {
        setRepoError((res as any)?.error || "Failed to resolve repository manifest");
      }
    } catch (e: any) {
      setRepoError(e?.message || "Failed to add repository");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddRepo = async () => {
    const trimmed = newRepoUrl.trim();
    if (!trimmed) return;
    const rawSuggestion = getGithubRawSuggestion(trimmed);
    if (rawSuggestion) {
      setSuggestion(rawSuggestion);
      setRepoError(null);
      return;
    }
    await submitRepo(trimmed);
  };

  const handleRemoveRepo = (url: string) => {
    Alert.alert(
      "Remove Repository",
      "Are you sure you want to remove this repository?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await DataService.sources.removeRepo(url);
              await queryClient.invalidateQueries({ queryKey: ["extensions"] });
              await fetchRepos();
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Failed to remove repository");
            }
          },
        },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await DataService.sources.refreshAll();
      await queryClient.invalidateQueries({ queryKey: ["extensions"] });
      Alert.alert("Success", "All repositories refreshed.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to refresh repositories");
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen
        options={{ title: "Content Sources", headerShown: false }}
      />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/40 bg-background">
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2 rounded-xl"
          activeOpacity={0.7}
        >
          <ArrowLeft size={22} color={isDark ? "#f4f4f5" : "#09090b"} />
        </TouchableOpacity>
        <Typography variant="h3" className="font-bold text-lg">
          Repositories
        </Typography>
        <TouchableOpacity
          onPress={handleRefresh}
          disabled={refreshing || repos.length === 0}
          className="p-2 -mr-2 rounded-xl"
        >
          <RefreshCw
            size={20}
            color={repos.length === 0 ? "#71717a" : "#e11d48"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="mb-5">
          <Typography variant="h1" className="mb-1">
            Content Sources
          </Typography>
          <Typography variant="muted">
            Add community repository URLs (manifest.json, templates.json, or Keiyoushi index.min.json)
          </Typography>
        </View>

        {/* Add Repo Input */}
        <Card className="mb-4 border-primary/20">
          <CardContent className="p-4 gap-3">
            <View className="bg-secondary/30 rounded-xl px-4 py-2 border border-border/50">
              <TextInput
                placeholder="https://example.com/manifest.json or index.min.json"
                placeholderTextColor="#94a3b8"
                className="text-foreground h-10 text-xs"
                value={newRepoUrl}
                onChangeText={(text) => {
                  setNewRepoUrl(text);
                  if (suggestion) setSuggestion(null);
                  if (repoError) setRepoError(null);
                }}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleAddRepo}
              />
            </View>
            <Button
              title={isLoading ? "Adding..." : "Add Repository"}
              onPress={handleAddRepo}
              disabled={isLoading || !newRepoUrl.trim()}
              icon={
                isLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Plus size={18} color="#fff" />
                )
              }
            />
          </CardContent>
        </Card>

        {/* Error Box */}
        {!!repoError && (
          <View className="mb-4 p-3.5 rounded-xl bg-destructive/10 border border-destructive/30 flex-row items-center gap-2.5">
            <AlertCircle size={18} color="#ef4444" />
            <Typography className="text-xs text-destructive flex-1">
              {repoError}
            </Typography>
          </View>
        )}

        {/* GitHub URL Auto-Fix Suggestion */}
        {!!suggestion && (
          <Card className="mb-4 border-primary/40 bg-primary/5">
            <CardContent className="p-4 gap-2.5">
              <View className="flex-row items-start gap-2.5">
                <AlertCircle size={18} color="#e11d48" />
                <View className="flex-1">
                  <Typography className="text-xs font-bold text-primary">
                    GitHub Web URL Detected
                  </Typography>
                  <Typography className="text-xs text-muted-foreground mt-0.5">
                    Use the raw JSON link instead?
                  </Typography>
                  <Typography className="text-[11px] font-mono text-foreground mt-1.5 bg-background/60 p-2 rounded-lg">
                    {suggestion}
                  </Typography>
                </View>
              </View>
              <View className="flex-row gap-2 mt-1">
                <Button
                  title="Apply Fix & Add"
                  size="sm"
                  className="flex-1"
                  onPress={() => {
                    setNewRepoUrl(suggestion);
                    submitRepo(suggestion);
                  }}
                />
                <Button
                  title="Add Original"
                  variant="outline"
                  size="sm"
                  onPress={() => submitRepo(newRepoUrl.trim())}
                />
              </View>
            </CardContent>
          </Card>
        )}

        {/* Repo List */}
        <View className="gap-3">
          {repos.length === 0 ? (
            <View className="items-center py-10 opacity-40">
              <Globe size={48} color="#94a3b8" />
              <Typography className="mt-2 font-medium">
                No repositories added yet
              </Typography>
            </View>
          ) : (
            repos.map((url) => {
              const repoMeta = getRepoMeta(url);
              const isKeiyoushi = repoMeta.isKeiyoushi;
              return (
                <Card
                  key={url}
                  style={{
                    borderLeftWidth: 4,
                    borderLeftColor: repoMeta.repoColor,
                  }}
                  className="border-border/50 bg-secondary/10"
                >
                  <CardContent className="p-4 flex-row items-center justify-between">
                    <View className="flex-1 flex-row items-center gap-3">
                      <View
                        style={{ backgroundColor: `${repoMeta.repoColor}20` }}
                        className="w-10 h-10 rounded-xl items-center justify-center"
                      >
                        <Globe size={20} color={repoMeta.repoColor} />
                      </View>
                      <View className="flex-1">
                        <Typography
                          className="font-bold text-sm"
                          numberOfLines={1}
                        >
                          {url}
                        </Typography>
                        <Typography
                          style={{ color: repoMeta.repoColor }}
                          className="text-[10px] uppercase font-bold mt-0.5"
                        >
                          {isKeiyoushi
                            ? "Keiyoushi Extension Ecosystem"
                            : repoMeta.repoName}
                        </Typography>
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemoveRepo(url)}
                      className="p-2"
                    >
                      <Trash2 size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </CardContent>
                </Card>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
