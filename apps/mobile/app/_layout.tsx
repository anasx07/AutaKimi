import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MobileApi } from '../src/mobile/api.native';
import { View, ActivityIndicator } from 'react-native';
import { cssInterop } from 'nativewind';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { DataService } from '@renderer/shared/api';
import { syncClient } from '../src/mobile/sync-client.native';
import { useAppTheme } from '../src/mobile/theme';
import '../global.css';

cssInterop(Image, { className: 'style' });
cssInterop(LinearGradient, { className: 'style' });

const queryClient = new QueryClient();

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);
  const { isDark, setColorScheme, themeVars, themeClassName, palette } = useAppTheme();

  useEffect(() => {
    // Register MobileApi as the platform bridge so shared DataService
    // (used by hooks like useInfiniteLibraryItems) works via window.api
    ;(window as any).api = MobileApi

    // Initialize Database and Services
    MobileApi.init().then(async () => {
      try {
        const settings = await DataService.db.getSettings();
        const theme = settings?.theme;
        if (theme === 'light' || theme === 'dark' || theme === 'system') {
          setColorScheme(theme);
        } else {
          setColorScheme('system');
        }
      } catch (e) {
        console.error('Failed to initialize theme setting:', e);
      }
      setInitialized(true);
      
      // Trigger silent background sync on launch
      syncClient.autoSyncBackground();
    });
  }, [setColorScheme]);

  if (!initialized) {
    return (
      <View
        className={`${themeClassName} flex-1 items-center justify-center bg-background`}
        style={[{ flex: 1, backgroundColor: palette.background }, themeVars]}
      >
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <ActivityIndicator size="large" color="#e11d48" />
      </View>
    );
  }

  return (
    <View
      className={`${themeClassName} flex-1 bg-background`}
      style={[{ flex: 1, backgroundColor: palette.background }, themeVars]}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <QueryClientProvider client={queryClient}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: palette.background },
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </QueryClientProvider>
    </View>
  );
}
