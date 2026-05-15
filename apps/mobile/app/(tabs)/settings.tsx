import { useState, useEffect, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, Switch, Alert } from 'react-native';
import { Typography, Button, Card } from '@mobile/native/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DataService } from '@renderer/shared/api';
import { router } from 'expo-router';
import {
  Smartphone, BookOpen, Eye, Download, Database,
  Info, Trash2, Sun, Moon, Monitor,
  ChevronRight, Check, Menu
} from 'lucide-react-native';

type SettingsMap = Record<string, string>

export default function SettingsTab() {
  const [settings, setSettings] = useState<SettingsMap>({})
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  useEffect(() => {
    DataService.db.getSettings()
      .then((s: SettingsMap) => {
        setSettings(s || {})
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const set = useCallback((key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    DataService.db.setSetting(key, value).catch(() => {})
  }, [])

  const boolVal = (key: string): boolean => settings[key] === 'true'

  const strVal = (key: string, fallback: string): string => settings[key] || fallback

  const clearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear cached manga metadata and images. Your downloads will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear', style: 'destructive',
          onPress: async () => {
            setClearing(true)
            try {
              await DataService.clearCache()
              Alert.alert('Done', 'Cache cleared successfully.')
            } catch (e: any) {
              Alert.alert('Error', e.message || 'Failed to clear cache')
            } finally {
              setClearing(false)
            }
          }
        }
      ]
    )
  }

  type Option<T = string> = { label: string; value: T; icon?: React.ReactNode }    

  const OptionPicker = ({ label, options, currentValue, onSelect }: {
    label: string
    options: Option[]
    currentValue: string
    onSelect: (v: string) => void
  }) => {
    const [showOptions, setShowOptions] = useState(false)
    if (!showOptions) {
      const cur = options.find(o => o.value === currentValue)
      return (
        <TouchableOpacity
          className="flex-row items-center justify-between px-4 py-4"
          onPress={() => setShowOptions(true)}
        >
          <View className="flex-row items-center">
            {cur?.icon && <View className="mr-2">{cur.icon}</View>}
            <Typography>{cur?.label || currentValue}</Typography>
          </View>
          <ChevronRight size={16} color="#94a3b8" />
        </TouchableOpacity>
      )
    }
    return (
      <View className="px-4 py-2">
        <Typography className="text-xs text-muted-foreground mb-2">{label}</Typography>
        {options.map((opt, i) => (
          <TouchableOpacity
            key={opt.value}
            className={`flex-row items-center px-3 py-3 rounded-lg ${currentValue === opt.value ? 'bg-primary/20' : ''}`}
            onPress={() => { onSelect(opt.value); setShowOptions(false) }}
          >
            {opt.icon && <View className="mr-3">{opt.icon}</View>}
            <Typography className={currentValue === opt.value ? 'text-primary font-medium flex-1' : 'flex-1'}>
              {opt.label}
            </Typography>
            {currentValue === opt.value && <Check size={16} color="#3b82f6" />}    
          </TouchableOpacity>
        ))}
      </View>
    )
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={['top']}>
        <View className="px-4 py-3 border-b border-border">
          <Typography variant="h1">Settings</Typography>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border">
        <Typography variant="h1">Settings</Typography>
        <Typography variant="muted">Manage your preferences</Typography>
      </View>

      <ScrollView className="flex-1">
        {/* Reader */}
        <View className="mt-6 px-4">
          <View className="flex-row items-center mb-2 px-2">
            <BookOpen size={16} color="#94a3b8" />
            <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Reader
            </Typography>
          </View>
          <Card className="overflow-hidden">
            <OptionPicker
              label="Reading Direction"
              currentValue={strVal('reading_mode_v2', 'continuous-vertical')}      
              options={[
                { label: 'Continuous Vertical', value: 'continuous-vertical' },    
                { label: 'Right to Left', value: 'rtl' },
                { label: 'Left to Right', value: 'ltr' },
                { label: 'Vertical Scroll', value: 'vertical' },
                { label: 'Webtoon', value: 'webtoon' },
              ]}
              onSelect={(v) => set('reading_mode_v2', v)}
            />
            <View className="border-t border-border/50" />
            <View className="flex-row items-center justify-between px-4 py-4">     
              <Typography>Auto-mark as Read</Typography>
              <Switch
                value={boolVal('auto_mark_read')}
                onValueChange={(v) => set('auto_mark_read', v ? 'true' : 'false')} 
                trackColor={{ false: '#334155', true: '#3b82f680' }}
                thumbColor={boolVal('auto_mark_read') ? '#3b82f6' : '#64748b'}     
              />
            </View>
            <View className="border-t border-border/50" />
            <OptionPicker
              label="Reader Theme"
              currentValue={strVal('reader_theme', 'dark')}
              options={[
                { label: 'Match App', value: 'match-app', icon: <Smartphone size={16} color="#94a3b8" /> },
                { label: 'Light', value: 'light', icon: <Sun size={16} color="#f59e0b" /> },
                { label: 'Dark', value: 'dark', icon: <Moon size={16} color="#3b82f6" /> },
              ]}
              onSelect={(v) => set('reader_theme', v)}
            />
            <View className="border-t border-border/50" />
            <View className="flex-row items-center justify-between px-4 py-4">     
              <View>
                <Typography>Preload Pages</Typography>
                <Typography className="text-xs text-muted-foreground">
                  {strVal('preload_pages', '3')} pages ahead
                </Typography>
              </View>
              <View className="flex-row items-center gap-2">
                {[1, 3, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    className={`w-8 h-8 rounded-lg items-center justify-center ${strVal('preload_pages', '3') === String(n) ? 'bg-primary' : 'bg-card border border-border'}`}
                    onPress={() => set('preload_pages', String(n))}
                  >
                    <Typography className={strVal('preload_pages', '3') === String(n) ? 'text-white text-xs' : 'text-xs'}>
                      {n}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>
        </View>

        {/* Display */}
        <View className="mt-6 px-4">
          <View className="flex-row items-center mb-2 px-2">
            <Eye size={16} color="#94a3b8" />
            <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Display
            </Typography>
          </View>
          <Card className="overflow-hidden">
            <OptionPicker
              label="Theme"
              currentValue={strVal('theme', 'system')}
              options={[
                { label: 'System', value: 'system', icon: <Monitor size={16} color="#94a3b8" /> },
                { label: 'Light', value: 'light', icon: <Sun size={16} color="#f59e0b" /> },
                { label: 'Dark', value: 'dark', icon: <Moon size={16} color="#3b82f6" /> },
              ]}
              onSelect={(v) => set('theme', v)}
            />
            <View className="border-t border-border/50" />
            <OptionPicker
              label="Default View"
              currentValue={strVal('displayMode', 'grid')}
              options={[
                { label: 'Grid', value: 'grid' },
                { label: 'List', value: 'list' },
              ]}
              onSelect={(v) => set('displayMode', v)}
            />
            <View className="border-t border-border/50" />
            <View className="flex-row items-center justify-between px-4 py-4">     
              <View>
                <Typography>Show NSFW Content</Typography>
                <Typography className="text-xs text-muted-foreground">
                  Display mature content in browse results
                </Typography>
              </View>
              <Switch
                value={boolVal('showNsfw')}
                onValueChange={(v) => set('showNsfw', v ? 'true' : 'false')}       
                trackColor={{ false: '#334155', true: '#3b82f680' }}
                thumbColor={boolVal('showNsfw') ? '#3b82f6' : '#64748b'}
              />
            </View>
          </Card>
        </View>

        {/* Downloads */}
        <View className="mt-6 px-4">
          <View className="flex-row items-center mb-2 px-2">
            <Download size={16} color="#94a3b8" />
            <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Downloads
            </Typography>
          </View>
          <Card className="overflow-hidden">
            <View className="flex-row items-center justify-between px-4 py-4">     
              <View>
                <Typography>Concurrent Downloads</Typography>
                <Typography className="text-xs text-muted-foreground">
                  {strVal('download_concurrency', '3')} at a time
                </Typography>
              </View>
              <View className="flex-row items-center gap-2">
                {[1, 3, 5].map((n) => (
                  <TouchableOpacity
                    key={n}
                    className={`w-8 h-8 rounded-lg items-center justify-center ${strVal('download_concurrency', '3') === String(n) ? 'bg-primary' : 'bg-card border border-border'}`}
                    onPress={() => set('download_concurrency', String(n))}
                  >
                    <Typography className={strVal('download_concurrency', '3') === String(n) ? 'text-white text-xs' : 'text-xs'}>
                      {n}
                    </Typography>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            <View className="border-t border-border/50" />
            <View className="flex-row items-center justify-between px-4 py-4">     
              <View>
                <Typography>Auto-next Episode</Typography>
                <Typography className="text-xs text-muted-foreground">
                  Automatically play next anime episode
                </Typography>
              </View>
              <Switch
                value={boolVal('autoNextAnime')}
                onValueChange={(v) => set('autoNextAnime', v ? 'true' : 'false')}  
                trackColor={{ false: '#334155', true: '#3b82f680' }}
                thumbColor={boolVal('autoNextAnime') ? '#3b82f6' : '#64748b'}      
              />
            </View>
          </Card>
        </View>

        {/* Data */}
        <View className="mt-6 px-4">
          <View className="flex-row items-center mb-2 px-2">
            <Database size={16} color="#94a3b8" />
            <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Data
            </Typography>
          </View>
          <Card className="overflow-hidden">
            <TouchableOpacity
              className="flex-row items-center justify-between px-4 py-4"
              onPress={clearCache}
              disabled={clearing}
            >
              <View className="flex-row items-center">
                <Trash2 size={18} color="#ef4444" />
                <Typography className="ml-3 text-destructive font-medium">
                  {clearing ? 'Clearing...' : 'Clear Cache'}
                </Typography>
              </View>
              <ChevronRight size={16} color="#94a3b8" />
            </TouchableOpacity>
          </Card>
        </View>

        {/* Navigate */}
        <View className="mt-6 px-4">
          <View className="flex-row items-center mb-2 px-2">
            <Menu size={16} color="#94a3b8" />
            <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              Navigate
            </Typography>
          </View>
          <Card className="overflow-hidden mb-3">
            <TouchableOpacity
              onPress={() => router.push('/more')}
              className="flex-row items-center justify-between px-4 py-4 active:bg-secondary"
            >
              <Typography className="text-base">More</Typography>
              <View className="flex-row items-center gap-2">
                <Typography variant="muted" className="text-xs">Explore features</Typography>
                <ChevronRight size={16} color="#94a3b8" />
              </View>
            </TouchableOpacity>
          </Card>
        </View>

        {/* About */}
        <View className="mt-6 px-4 mb-8">
          <View className="flex-row items-center mb-2 px-2">
            <Info size={16} color="#94a3b8" />
            <Typography className="ml-2 font-bold text-muted-foreground uppercase text-xs tracking-widest">
              About
            </Typography>
          </View>
          <Card className="overflow-hidden">
            <TouchableOpacity
              onPress={() => router.push('/about')}
              className="px-4 py-4 active:bg-secondary"
            >
              <View className="flex-row justify-between mb-2">
                <Typography className="text-muted-foreground">Version</Typography> 
                <Typography>1.5.80</Typography>
              </View>
              <View className="flex-row justify-between mb-2">
                <Typography className="text-muted-foreground">Platform</Typography>
                <Typography>Android (Expo Native)</Typography>
              </View>
              <View className="flex-row justify-between">
                <Typography className="text-muted-foreground">Database</Typography>
                <Typography>SQLite (expo-sqlite)</Typography>
              </View>
            </TouchableOpacity>
          </Card>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
