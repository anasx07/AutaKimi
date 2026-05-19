import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MobileApi } from '../src/mobile/api.native';
import { View, ActivityIndicator } from 'react-native';
import './global.css';

const queryClient = new QueryClient();

export default function RootLayout() {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Register MobileApi as the platform bridge so shared DataService
    // (used by hooks like useInfiniteLibraryItems) works via window.api
    ;(window as any).api = MobileApi

    // Initialize Database and Services
    MobileApi.init().then(() => {
      setInitialized(true);
    });
  }, []);

  if (!initialized) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}
