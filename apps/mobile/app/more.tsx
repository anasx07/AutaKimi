import React from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Settings, Tv, Info, ChevronRight, Github, Heart, Share2 } from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { Typography, Card, CardContent } from '../../src/native/ui'

interface MoreItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  path?: string
  badge?: string
  badgeColor?: string
  onPress?: () => void
}

export default function MorePage(): React.JSX.Element {
  const items: MoreItem[] = [
    {
      id: 'sources',
      label: 'Content Sources',
      description: 'Manage extension repositories',
      icon: Globe,
      path: '/repositories'
    },
    {
      id: 'sync',
      label: 'Sync with Desktop',
      description: 'Pair your device via local Wi-Fi',
      icon: Share2,
      path: '/sync'
    },
    {
      id: 'anime',
      label: 'Anime',
      description: 'Browse and watch anime from supported sources',
      icon: Tv,
      path: '/anime',
      badge: 'BETA'
    },
    {
      id: 'settings',
      label: 'Settings',
      description: 'Configure reader, downloads, and preferences',
      icon: Settings,
      path: '/settings'
    },
    {
      id: 'about',
      label: 'About',
      description: 'App version, features, and licensing',
      icon: Info,
      path: '/about'
    },
    {
      id: 'github',
      label: 'GitHub',
      description: 'Source code, releases, and issue tracking',
      icon: Github,
      onPress: () => DataService.openExternal('https://github.com/anasx07/AutaKimi-Release')
    },
    {
      id: 'discord',
      label: 'Discord',
      description: 'Join our community server',
      icon: Heart,
      onPress: () => DataService.openExternal('https://discord.gg/qRbpCusgan')
    }
  ]

  const handlePress = (item: MoreItem): void => {
    if (item.onPress) {
      item.onPress()
    } else if (item.path) {
      router.push(item.path as any)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      {/* Header */}
      <View className="px-4 py-4 border-b border-border">
        <Typography variant="h2" className="font-bold text-center">More</Typography>
        <Typography variant="small" className="text-muted-foreground text-center mt-1">
          Explore more features & resources
        </Typography>
      </View>

      <ScrollView className="flex-1 px-4 pt-4" contentContainerStyle={{ paddingBottom: 40 }}>
        {items.map((item) => {
          const Icon = item.icon
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => handlePress(item)}
              className="mb-3"
            >
              <Card>
                <CardContent className="flex-row items-center justify-between py-5">
                  <View className="flex-row items-center gap-4 flex-1">
                    <View className="w-12 h-12 rounded-xl bg-secondary items-center justify-center">
                      <Icon size={24} color="#3b82f6" />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        <Typography className="font-bold text-base">{item.label}</Typography>
                        {item.badge && (
                          <View className="bg-amber-500/20 px-2 py-0.5 rounded-full">
                            <Typography variant="small" className="text-amber-600 font-bold text-[10px]">
                              {item.badge}
                            </Typography>
                          </View>
                        )}
                      </View>
                      <Typography variant="muted" className="text-xs mt-0.5">
                        {item.description}
                      </Typography>
                    </View>
                  </View>
                  <ChevronRight size={18} color="#94a3b8" />
                </CardContent>
              </Card>
            </TouchableOpacity>
          )
        })}

        {/* Footer */}
        <View className="items-center mt-10 pt-6 border-t border-border">
          <View className="flex-row items-center gap-1 mb-2">
            <Heart size={14} color="#ef4444" />
            <Typography variant="small" className="text-muted-foreground font-medium">
              Made with passion by Team AutaKimi
            </Typography>
          </View>
          <Typography variant="small" className="text-muted-foreground opacity-40">
            AutaKimi Mobile v{DataService.version}
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
