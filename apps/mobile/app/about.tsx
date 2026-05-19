import React from 'react'
import { View, ScrollView, TouchableOpacity } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { ArrowLeft, Github, ExternalLink, Shield, Code, Heart, Info } from 'lucide-react-native'
import { DataService } from '@renderer/shared/api'
import { Typography, Card, CardContent, Button } from '../../src/native/ui'

export default function AboutPage(): React.JSX.Element {
  const version = DataService.version

  const features = [
    {
      title: 'Extension System',
      description: 'Flexible, sandboxed architecture supporting thousands of manga and anime sources.',
      icon: Code
    },
    {
      title: 'Premium Experience',
      description: 'Optimized image loading, smart infinite scroll, and immersive horizontal/paged modes.',
      icon: Heart
    },
    {
      title: 'Privacy First',
      description: 'No accounts, no tracking, and no telemetry. All your data stays locally on your device.',
      icon: Shield
    }
  ]

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={22} color="#3b82f6" />
        </TouchableOpacity>
        <Typography variant="h3" className="font-bold text-lg">About</Typography>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Hero */}
        <View className="items-center px-6 pt-10 pb-6">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-6">
            <Shield size={48} color="#fff" />
          </View>
          <Typography variant="h1" className="font-black text-4xl text-center mb-2">
            AutaKimi
          </Typography>
          <View className="flex-row gap-3 mb-4">
            <View className="bg-primary/20 px-4 py-1 rounded-full">
              <Typography variant="small" className="text-primary font-bold">v{version}</Typography>
            </View>
            <View className="bg-secondary px-4 py-1 rounded-full border border-border">
              <Typography variant="small" className="text-muted-foreground font-medium">Stable Build</Typography>
            </View>
          </View>
          <Typography variant="muted" className="text-center leading-relaxed max-w-sm">
            The ultimate open-source manga & anime experience for mobile. Built for speed, designed for stability, and powered by you.
          </Typography>

          <View className="flex-row gap-3 mt-6">
            <Button
              title="GitHub"
              variant="primary"
              size="sm"
              icon={<Github size={16} color="#fff" />}
              onPress={() => DataService.openExternal('https://github.com/anasx07/AutaKimi-Release')}
            />
            <Button
              title="Join Discord"
              variant="outline"
              size="sm"
              icon={<ExternalLink size={16} color="#3b82f6" />}
              onPress={() => DataService.openExternal('https://discord.gg/qRbpCusgan')}
            />
          </View>
        </View>

        {/* Features */}
        <View className="px-4 mb-2">
          <View className="flex-row items-center px-2 mb-2">
            <Info size={16} color="#94a3b8" />
            <Typography variant="small" className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Features
            </Typography>
          </View>
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <Card key={idx} className="mb-3">
                <CardContent className="flex-row items-center gap-4">
                  <View className="w-12 h-12 rounded-xl bg-secondary items-center justify-center">
                    <Icon size={24} color="#3b82f6" />
                  </View>
                  <View className="flex-1">
                    <Typography className="font-bold text-base mb-1">{feature.title}</Typography>
                    <Typography variant="muted">{feature.description}</Typography>
                  </View>
                </CardContent>
              </Card>
            )
          })}
        </View>

        {/* Info & License */}
        <View className="px-4 mt-4">
          <View className="flex-row items-center px-2 mb-2">
            <Shield size={16} color="#94a3b8" />
            <Typography variant="small" className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Project
            </Typography>
          </View>
          <Card className="mb-3">
            <CardContent>
              <Typography variant="muted" className="leading-relaxed mb-4">
                AutaKimi is a community-driven project dedicated to creating the most stable and performant platform for digital media consumption. We focus on lightweight architecture and extensible design.
              </Typography>
              <View className="flex-row justify-between items-center pt-3 border-t border-border">
                <Typography variant="small" className="text-muted-foreground">MIT LICENSE</Typography>
                <TouchableOpacity onPress={() => DataService.openExternal('https://github.com/anasx07/AutaKimi-Release/blob/main/LICENSE')}>
                  <Typography variant="small" className="text-primary font-bold">Read Terms</Typography>
                </TouchableOpacity>
              </View>
            </CardContent>
          </Card>
          <Typography variant="small" className="text-center text-muted-foreground mt-6 opacity-50">
            Development Team — Codixy Contributors lead by @anasx07
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}
