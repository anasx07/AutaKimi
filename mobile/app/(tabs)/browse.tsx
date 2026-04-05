import React from 'react';
import { View } from 'react-native';
import { Typography } from '../../src/native/ui/Typography';
import { Button } from '../../src/native/ui/Button';
import { Search } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function BrowseTab() {
  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="px-4 py-3 border-b border-border">
        <Typography variant="h1">Browse</Typography>
        <Typography variant="muted">Discover new content</Typography>
      </View>
      <View className="flex-1 items-center justify-center p-8">
        <View className="bg-primary/10 p-6 rounded-full mb-4">
          <Search size={48} color="#3b82f6" />
        </View>
        <Typography variant="h2">Browse Sources</Typography>
        <Typography variant="muted" className="text-center mt-2 px-8">
          Explore manga and anime from various extensions.
        </Typography>
        <Button
          title="Explore Extensions"
          className="mt-6 w-full"
          onPress={() => {}}
        />
      </View>
    </SafeAreaView>
  );
}
