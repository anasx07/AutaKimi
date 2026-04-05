import React from 'react';
import { View, ScrollView, TouchableOpacity } from 'react-native';
import { Typography } from '../../src/native/ui/Typography';
import { Settings as SettingsIcon, Info, Sliders, Database, Smartphone } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SettingsTab() {
  const settingsGroups = [
    {
      title: 'General',
      icon: <Smartphone size={20} color="#666" />,
      items: ['Appearance', 'Library', 'Reader', 'Downloads'],
    },
    {
      title: 'Advanced',
      icon: <Database size={20} color="#666" />,
      items: ['Clear Cache', 'Database Migration', 'Security'],
    },
    {
      title: 'About',
      icon: <Info size={20} color="#666" />,
      items: ['Check for Updates', 'Help & FAQ', 'Licenses'],
    },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border">
        <Typography variant="h1">Settings</Typography>
        <Typography variant="muted">Manage your preferences</Typography>
      </View>
      <ScrollView className="flex-1">
        {settingsGroups.map((group, gIdx) => (
          <View key={gIdx} className="mt-6 px-4">
            <View className="flex-row items-center mb-2 px-2">
              {group.icon}
              <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
                {group.title}
              </Typography>
            </View>
            <View className="bg-card rounded-2xl border border-border overflow-hidden">
              {group.items.map((item, iIdx) => (
                <TouchableOpacity
                  key={iIdx}
                  className={`px-6 py-4 flex-row items-center justify-between ${iIdx !== group.items.length - 1 ? 'border-b border-border/50' : ''}`}
                >
                  <Typography>{item}</Typography>
                  <Sliders size={16} color="#94a3b8" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
        <View className="py-12 items-center">
          <Typography variant="muted" className="text-center">
            AutaKimi v1.5.67 (Expo Native)
          </Typography>
          <Typography variant="muted" className="text-center mt-1">
            Build 2026.03.31
          </Typography>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
