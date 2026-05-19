import React, { useState, useEffect } from 'react'
import { View, ScrollView, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { ArrowLeft, Library, Plus, Trash2, Globe, RefreshCw, AlertCircle } from 'lucide-react-native'
import { Typography, Button, Card, CardContent } from '../src/native/ui'
import { MobileDB } from '../src/mobile/db.native'
import { templateService } from '@common'

export default function RepositoriesPage() {
  const [repos, setRepos] = useState<string[]>([])
  const [newRepoUrl, setNewRepoUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  const fetchRepos = async () => {
    const res = await MobileDB.getSetting('source_repositories')
    if (res.ok && res.value) {
      try {
        setRepos(JSON.parse(res.value))
      } catch (e) {
        setRepos([])
      }
    }
  }

  useEffect(() => {
    fetchRepos()
  }, [])

  const handleAddRepo = async () => {
    if (!newRepoUrl.trim()) return
    setIsLoading(true)
    try {
      const res = await templateService.fetchTemplates(newRepoUrl.trim())
      if (res.success) {
        const updated = [...repos, newRepoUrl.trim()]
        await MobileDB.setSetting('source_repositories', JSON.stringify(updated))
        setRepos(updated)
        setNewRepoUrl('')
        Alert.alert('Success', `Added repository with ${res.count} templates.`)
      } else {
        Alert.alert('Error', res.error || 'Failed to fetch repository')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveRepo = (url: string) => {
    Alert.alert(
      'Remove Repository',
      'Are you sure you want to remove this source?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            const updated = repos.filter(r => r !== url)
            await MobileDB.setSetting('source_repositories', JSON.stringify(updated))
            setRepos(updated)
          }
        }
      ]
    )
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await templateService.loadAllRepositories(repos)
    setRefreshing(false)
    Alert.alert('Success', 'All templates refreshed.')
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ title: 'Content Sources', headerShown: false }} />
      
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border/50">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={22} color="#3b82f6" />
        </TouchableOpacity>
        <Typography variant="h3" className="font-bold text-lg">Content Sources</Typography>
        <TouchableOpacity onPress={handleRefresh} disabled={refreshing}>
          <RefreshCw size={20} color="#3b82f6" className={refreshing ? 'animate-spin' : ''} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 p-4" contentContainerStyle={{ pb: 40 }}>
        <View className="mb-6">
          <Typography variant="h1" className="mb-1">Extensions</Typography>
          <Typography variant="muted">Manage community scraper repositories</Typography>
        </View>

        {/* Add Repo Input */}
        <Card className="mb-6 border-primary/20">
          <CardContent className="p-4 gap-4">
            <View className="bg-secondary/30 rounded-xl px-4 py-2 border border-border/50">
              <TextInput
                placeholder="Repository JSON URL"
                placeholderTextColor="#94a3b8"
                className="text-foreground h-10"
                value={newRepoUrl}
                onChangeText={setNewRepoUrl}
                autoCapitalize="none"
              />
            </View>
            <Button 
              title="Add Repository" 
              onPress={handleAddRepo}
              disabled={isLoading || !newRepoUrl}
              icon={isLoading ? <ActivityIndicator size="small" color="#fff" /> : <Plus size={18} color="#fff" />}
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
            repos.map((url) => (
              <Card key={url} className="border-border/50 bg-secondary/10">
                <CardContent className="p-4 flex-row items-center justify-between">
                  <View className="flex-1 flex-row items-center gap-3">
                    <View className="w-10 h-10 rounded-xl bg-primary/10 items-center justify-center">
                      <Globe size={20} color="#3b82f6" />
                    </View>
                    <View className="flex-1">
                      <Typography className="font-bold text-sm" numberOfLines={1}>{url}</Typography>
                      <Typography className="text-[10px] text-green-500 uppercase font-bold">Active Provider</Typography>
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
            ))
          )}
        </View>

        {/* Information Cards */}
        <View className="mt-10 gap-4">
          <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex-row items-center gap-4">
               <Library size={24} color="#3b82f6" />
               <View className="flex-1">
                  <Typography className="font-bold text-sm">Universal Framework</Typography>
                  <Typography className="text-xs opacity-60">AutaKimi does not host content. It is a tool for viewing data from sources you choose.</Typography>
               </View>
            </CardContent>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
