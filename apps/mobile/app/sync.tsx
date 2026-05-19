import React, { useState, useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity, Alert } from 'react-native'
import { BarCodeScanner } from 'expo-barcode-scanner'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { ArrowLeft, Smartphone, ShieldCheck, RefreshCw } from 'lucide-react-native'
import { Typography, Button, Card, CardContent } from '../src/native/ui'
import { syncClient } from '../src/mobile/sync-client.native'

export default function SyncPage() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [scanned, setScanned] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)

  useEffect(() => {
    const getBarCodeScannerPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync()
      setHasPermission(status === 'granted')
    }
    getBarCodeScannerPermissions()
  }, [])

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isConnecting) return
    setScanned(true)

    if (data.startsWith('autakimi-pair://')) {
      setIsConnecting(true)
      try {
        const url = new URL(data.replace('autakimi-pair://', 'http://'))
        const ip = url.hostname
        const port = parseInt(url.port)
        const secret = url.searchParams.get('secret')
        const deviceId = url.searchParams.get('id')

        if (ip && port && secret && deviceId) {
          const success = await syncClient.connect({ ip, port, secret, deviceId })
          if (success) {
            Alert.alert('Success', 'Devices paired successfully!', [
              { text: 'OK', onPress: () => router.back() }
            ])
          } else {
            Alert.alert('Error', 'Failed to connect to desktop. Make sure both devices are on the same Wi-Fi.')
            setScanned(false)
          }
        }
      } catch (err) {
        Alert.alert('Error', 'Invalid QR code format.')
        setScanned(false)
      } finally {
        setIsConnecting(false)
      }
    } else {
      Alert.alert('Error', 'This QR code is not for AutaKimi Sync.')
      setScanned(false)
    }
  }

  if (hasPermission === null) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Typography>Requesting camera permission...</Typography>
      </View>
    )
  }

  if (hasPermission === false) {
    return (
      <View className="flex-1 items-center justify-center bg-background p-6">
        <Typography className="text-center mb-4">No access to camera. Please enable it in settings to use sync.</Typography>
        <Button title="Go Back" onPress={() => router.back()} />
      </View>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-black" edges={['top']}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-white/10 bg-background">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
          <ArrowLeft size={22} color="#3b82f6" />
        </TouchableOpacity>
        <Typography variant="h3" className="font-bold text-lg">Sync with Desktop</Typography>
        <View className="w-10" />
      </View>

      <View className="flex-1 relative">
        <BarCodeScanner
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          style={StyleSheet.absoluteFillObject}
        />
        
        {/* Overlay */}
        <View className="absolute inset-0 items-center justify-center">
          <View className="w-64 h-64 border-2 border-primary rounded-3xl items-center justify-center bg-black/20">
             {isConnecting && <RefreshCw size={48} color="#3b82f6" className="animate-spin" />}
          </View>
          <Typography className="text-white font-bold mt-10 bg-black/60 px-6 py-2 rounded-full uppercase tracking-widest text-xs">
            Scan Pairing QR Code
          </Typography>
        </View>

        {/* Instructions */}
        <View className="absolute bottom-10 left-6 right-6">
           <Card className="bg-background/90 border-primary/20">
             <CardContent className="flex-row items-center gap-4">
                <View className="w-12 h-12 rounded-full bg-primary/10 items-center justify-center">
                  <Smartphone size={24} color="#3b82f6" />
                </View>
                <View className="flex-1">
                  <Typography className="font-bold text-sm">Open Desktop Settings</Typography>
                  <Typography variant="muted" className="text-xs">Navigate to Sync tab and scan the QR code displayed there.</Typography>
                </View>
             </CardContent>
           </Card>
        </View>
      </View>
    </SafeAreaView>
  )
}
