import React, { useState, useEffect } from 'react'
import { View, StyleSheet, TouchableOpacity, Alert, Modal, TextInput } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Stack, router } from 'expo-router'
import { ArrowLeft, Smartphone, ShieldCheck, RefreshCw } from 'lucide-react-native'
import { Typography, Button, Card, CardContent } from '../src/native/ui'
import { syncClient } from '../src/mobile/sync-client.native'

export default function SyncPage() {
  const [permission, requestPermission] = useCameraPermissions()
  const [scanned, setScanned] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [showManualModal, setShowManualModal] = useState(false)
  const [manualIp, setManualIp] = useState('')
  const [manualPort, setManualPort] = useState('42069')
  const [manualSecret, setManualSecret] = useState('')

  const handleManualConnect = async () => {
    if (!manualIp || !manualPort || !manualSecret) {
      Alert.alert('Error', 'Please fill in all fields.')
      return
    }

    const portNum = parseInt(manualPort)
    if (isNaN(portNum)) {
      Alert.alert('Error', 'Port must be a valid number.')
      return
    }

    setIsConnecting(true)
    setShowManualModal(false)
    try {
      const success = await syncClient.connect({
        ip: manualIp.trim(),
        port: portNum,
        secret: manualSecret.trim(),
        deviceId: 'manual-pairing'
      })

      if (success) {
        Alert.alert('Success', 'Devices paired successfully!', [
          { text: 'OK', onPress: () => router.back() }
        ])
      } else {
        Alert.alert('Error', 'Failed to connect. Double check IP, Port, Secret and Wi-Fi connection.')
      }
    } catch (err) {
      Alert.alert('Error', 'An error occurred during manual connection.')
    } finally {
      setIsConnecting(false)
    }
  }

  useEffect(() => {
    if (!permission || !permission.granted) {
      requestPermission()
    }
  }, [permission])

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

  if (!permission) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Typography>Requesting camera permission...</Typography>
      </View>
    )
  }

  if (!permission.granted) {
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
        <Typography variant="h3" className="font-bold text-lg text-center flex-1 ml-4">Sync with Desktop</Typography>
        <TouchableOpacity onPress={() => setShowManualModal(true)} className="px-3 py-1.5 bg-primary/10 rounded-full">
          <Typography className="text-primary text-xs font-bold">Manual</Typography>
        </TouchableOpacity>
      </View>

      <View className="flex-1 relative">
        <CameraView
          style={StyleSheet.absoluteFillObject}
          barcodeScannerSettings={{
            barcodeTypes: ['qr'],
          }}
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
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

      <Modal
        visible={showManualModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowManualModal(false)}
      >
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-background border-t border-white/10 rounded-t-3xl p-6 pb-10 space-y-6">
            <View className="flex-row items-center justify-between">
              <Typography variant="h3" className="font-bold text-lg">Manual Pairing</Typography>
              <TouchableOpacity onPress={() => setShowManualModal(false)}>
                <Typography className="text-zinc-500 font-bold text-sm">Cancel</Typography>
              </TouchableOpacity>
            </View>

            <View className="space-y-4">
              <View>
                <Typography className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">IP Address</Typography>
                <TextInput
                  placeholder="e.g. 192.168.1.15"
                  placeholderTextColor="#71717a"
                  value={manualIp}
                  onChangeText={setManualIp}
                  keyboardType="numeric"
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl px-4 py-3 font-mono text-sm"
                />
              </View>

              <View>
                <Typography className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Port</Typography>
                <TextInput
                  placeholder="e.g. 42069"
                  placeholderTextColor="#71717a"
                  value={manualPort}
                  onChangeText={setManualPort}
                  keyboardType="numeric"
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl px-4 py-3 font-mono text-sm"
                />
              </View>

              <View>
                <Typography className="text-zinc-400 text-[10px] font-black uppercase tracking-widest mb-1.5 ml-1">Shared Secret Key</Typography>
                <TextInput
                  placeholder="Paste secret key from Desktop"
                  placeholderTextColor="#71717a"
                  value={manualSecret}
                  onChangeText={setManualSecret}
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl px-4 py-3 font-mono text-sm"
                />
              </View>
            </View>

            <Button
              title="Establish Connection"
              onPress={handleManualConnect}
              className="py-4 rounded-xl font-bold"
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

