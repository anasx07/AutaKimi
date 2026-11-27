import React from 'react'
import { View, TouchableOpacity, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import {
  ArrowLeft,
  Info,
  ChevronRight,
  Heart,
  Share2,
  Globe,
  GitBranch,
  Package,
  BarChart3
} from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { Typography, Card, CardContent } from '../src/native/ui'
import { useAppTheme } from '../src/mobile/theme'

interface MoreItem {
  id: string
  label: string
  description: string
  icon: React.ComponentType<{ size?: number; color?: string }>
  path?: string
  onPress?: () => void
}

export default function MorePage(): React.JSX.Element {
  const { palette } = useAppTheme()
  const items: MoreItem[] = [
    {
      id: 'extensions',
      label: 'Extensions',
      description: 'Install, pin, and update anime & manga scrapers',
      icon: Package,
      path: '/extensions'
    },
    {
      id: 'sources',
      label: 'Content Repositories',
      description: 'Manage manifest.json & Keiyoushi repositories',
      icon: Globe,
      path: '/repositories'
    },
    {
      id: 'stats',
      label: 'Local Wrapped & Stats',
      description: 'Reading/watching streak, top genres & hours',
      icon: BarChart3,
      path: '/stats'
    },
    {
      id: 'sync',
      label: 'Sync with Desktop',
      description: 'Pair your device via QR code or local Wi-Fi',
      icon: Share2,
      path: '/sync'
    },
    {
      id: 'about',
      label: 'About',
      description: 'App version, features, updates, and licensing',
      icon: Info,
      path: '/about'
    },
    {
      id: 'github',
      label: 'GitHub',
      description: 'Source code, releases, and issue tracking',
      icon: GitBranch,
      onPress: () => DataService.openExternal('https://github.com/anasx07/AutaKimi')
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
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border bg-background">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 rounded-xl" activeOpacity={0.7}>
          <ArrowLeft size={22} color={palette.foreground} />
        </TouchableOpacity>
        <Typography variant="h2" className="font-bold text-lg">More</Typography>
        <View className="w-9" />
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
                    <View className="w-11 h-11 rounded-xl bg-secondary border border-border items-center justify-center">
                      <Icon size={20} color="#e11d48" />
                    </View>
                    <View className="flex-1">
                      <Typography className="font-bold text-base">{item.label}</Typography>
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
