import React, { useState, useEffect } from "react";
import {
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router } from "expo-router";
import {
  ArrowLeft,
  Library,
  Plus,
  Trash2,
  Globe,
  RefreshCw,
  AlertCircle,
} from "lucide-react-native";
import { Typography, Button, Card, CardContent } from "../src/native/ui";
import { MobileDB } from "../src/mobile/db.native";
import {
  templateService,
  sourceService,
  extensionRegistryOrchestrator,
  keiyoushiService,
} from "@common";
import { useColorScheme } from "nativewind";
import { getRepoMeta } from "@common/services/repoIdentity";

export default function RepositoriesPage() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === "dark";
  const [repos, setRepos] = useState<string[]>([]);
  const [newRepoUrl, setNewRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRepos = async () => {
    const res = await MobileDB.getSetting("source_repositories");
    if (res.ok && res.value) {
      try {
        let list: string[] = JSON.parse(res.value);
        let changed = false;
        list = list.map((u) => {
          if (keiyoushiService.isKeiyoushiUrl(u)) {
            const norm = keiyoushiService.normalizeKeiyoushiUrl(u);
            if (norm !== u) {
              changed = true;
              return norm;
            }
          }
          return u;
        });
        if (changed) {
          await MobileDB.setSetting(
            "source_repositories",
            JSON.stringify(list),
          );
        }
        setRepos(list);
      } catch (e) {
        setRepos([]);
      }
    }
  };

  useEffect(() => {
    fetchRepos();
  }, []);

  const handleAddRepo = async () => {
    if (!newRepoUrl.trim()) return;
    let url = newRepoUrl.trim();
    if (keiyoushiService.isKeiyoushiUrl(url)) {
      url = keiyoushiService.normalizeKeiyoushiUrl(url);
    }
    setIsLoading(true);
    try {
      const res = await templateService.fetchTemplates(url);
      if (res.success) {
        const syncRes = await extensionRegistryOrchestrator.syncRepositories([
          url,
        ]);
        const updated = [...repos.filter((r) => r !== url), url];
        await MobileDB.setSetting(
          "source_repositories",
          JSON.stringify(updated),
        );
        setRepos(updated);
        setNewRepoUrl("");
        const total = syncRes?.sourcesCount || res.count || 0;
        Alert.alert("Success", `Added repository with ${total} extensions.`);
      } else {
        Alert.alert("Error", res.error || "Failed to fetch repository");
      }
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveRepo = (url: string) => {
    Alert.alert(
      "Remove Repository",
      "Are you sure you want to remove this source?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const updated = repos.filter((r) => r !== url);
            await MobileDB.setSetting(
              "source_repositories",
              JSON.stringify(updated),
            );
            setRepos(updated);
          },
        },
      ],
    );
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await extensionRegistryOrchestrator.syncRepositories(repos);
    setRefreshing(false);
    Alert.alert("Success", "All repositories refreshed.");
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
          Content Sources
        </Typography>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <RefreshCw
            size={20}
            color="#e11d48"
            className={refreshing ? "animate-spin" : ""}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        className="flex-1 p-4"
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View className="mb-6">
          <Typography variant="h1" className="mb-1">
            Extensions
          </Typography>
          <Typography variant="muted">
            Manage community scraper repositories
          </Typography>
        </View>

        {/* Add Repo Input */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-4 gap-4">
            <View className="bg-secondary/30 rounded-xl px-4 py-2 border border-border/50">
              <TextInput
                placeholder="AutaKimi (manifest.json) or Keiyoushi (index.min.json) URL"
                placeholderTextColor="#94a3b8"
                className="text-foreground h-10 text-xs"
                value={newRepoUrl}
                onChangeText={setNewRepoUrl}
                autoCapitalize="none"
              />
            </View>
            <Button
              title="Add Repository"
              onPress={handleAddRepo}
              disabled={isLoading || !newRepoUrl}
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

        {/* Repo List */}
        <View className="gap-3">
          {repos.length === 0 ? (
            <View className="items-center py-10 opacity-30">
              <Globe size={48} color="#94a3b8" />
              <Typography className="mt-2">No repositories added</Typography>
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
                          className="text-[10px] uppercase font-bold"
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

        {/* Information Cards */}
        <View className="mt-8 gap-4">
          <Card className="bg-card border-border">
            <CardContent className="p-4 flex-row items-center gap-4">
              <Library size={22} color="#e11d48" />
              <View className="flex-1">
                <Typography className="font-bold text-sm">
                  Universal Framework
                </Typography>
                <Typography className="text-xs opacity-60">
                  AutaKimi does not host content. It is a tool for viewing data
                  from sources you choose.
                </Typography>
              </View>
            </CardContent>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
