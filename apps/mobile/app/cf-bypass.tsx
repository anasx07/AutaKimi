import { useEffect, useState, useRef } from 'react'
import { View, TouchableOpacity, ActivityIndicator, Alert } from 'react-native'
import { Stack, router } from 'expo-router'
import { WebView } from 'react-native-webview'
import { CfBypassFlow } from '../src/mobile/cf-cookies'
import { Typography, Button } from '@mobile/native/ui';
import { ArrowLeft, Shield, ShieldCheck, AlertTriangle } from 'lucide-react-native'

const CF_CHECK_JS = `
  (function() {
    try {
      var cookies = document.cookie.split(';').map(c => c.trim());
      var cfCookie = cookies.find(c => c.startsWith('cf_clearance='));
      if (cfCookie) {
        var value = cfCookie.substring('cf_clearance='.length);
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'cf_cookie', value: value }));
      }
    } catch(e) {}
    setTimeout(function() {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ping' }));
    }, 2000);
  })();
`

export default function CfBypassScreen() {
  const webViewRef = useRef<WebView>(null)
  const [status, setStatus] = useState<'loading' | 'waiting' | 'solved' | 'error'>('loading')
  const [url, setUrl] = useState('')

  useEffect(() => {
    if (CfBypassFlow.pendingUrl) {
      setUrl(CfBypassFlow.pendingUrl)
      setStatus('loading')
    } else {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    if (!url || status !== 'loading') return
    const timer = setTimeout(() => setStatus('waiting'), 3000)
    return () => clearTimeout(timer)
  }, [url, status])

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'cf_cookie' && data.value) {
        setStatus('solved')
        CfBypassFlow.complete(data.value)
        setTimeout(() => {
          if (router.canGoBack()) router.back()
        }, 1500)
      }
    } catch {}
  }

  const injectCheck = () => {
    webViewRef.current?.injectJavaScript(CF_CHECK_JS)
  }

  const handleCancel = () => {
    CfBypassFlow.cancel()
    if (router.canGoBack()) router.back()
  }

  const handleOpenBrowser = () => {
    Alert.alert(
      'Open in Browser',
      'Would you like to open this page in your device browser instead?',
      [
        { text: 'Stay Here', style: 'cancel' },
        {
          text: 'Open Browser',
          onPress: () => {
            CfBypassFlow.cancel()
            if (router.canGoBack()) router.back()
          }
        }
      ]
    )
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View className="pt-12 pb-2 px-4 border-b border-border bg-background">
        <View className="flex-row items-center justify-between">
          <TouchableOpacity onPress={handleCancel} className="p-2 -ml-2">
            <ArrowLeft size={22} color="#fff" />
          </TouchableOpacity>
          <View className="flex-1 ml-3">
            <Typography className="font-semibold text-base">Cloudflare Bypass</Typography>
            <Typography className="text-xs text-muted-foreground" numberOfLines={1}>
              {url ? new URL(url).hostname : ''}
            </Typography>
          </View>
        </View>
      </View>

      {/* Status Banner */}
      <View className={`px-4 py-3 flex-row items-center ${status === 'solved' ? 'bg-green-900/30' : status === 'error' ? 'bg-red-900/30' : 'bg-primary/10'}`}>
        {status === 'solved' ? (
          <ShieldCheck size={18} color="#22c55e" />
        ) : status === 'error' ? (
          <AlertTriangle size={18} color="#ef4444" />
        ) : (
          <Shield size={18} color="#3b82f6" />
        )}
        <Typography className={`ml-2 text-sm flex-1 ${status === 'solved' ? 'text-green-400' : status === 'error' ? 'text-red-400' : ''}`}>
          {status === 'loading' ? 'Loading challenge...' :
           status === 'waiting' ? 'Solve the challenge below to continue' :
           status === 'solved' ? 'Challenge solved! Redirecting...' :
           'Something went wrong'}
        </Typography>
      </View>

      {/* WebView */}
      <View className="flex-1">
        {url ? (
          <WebView
            ref={webViewRef}
            source={{ uri: url }}
            className="flex-1"
            javaScriptEnabled={true}
            domStorageEnabled={true}
            onMessage={handleMessage}
            onLoad={() => injectCheck()}
            onLoadEnd={() => injectCheck()}
            onError={() => setStatus('error')}
            sharedCookiesEnabled={true}
            thirdPartyCookiesEnabled={true}
            userAgent="Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
          />
        ) : (
          <View className="flex-1 items-center justify-center px-8">
            <AlertTriangle size={48} color="#ef4444" />
            <Typography className="text-lg font-semibold mt-4 text-center text-destructive">
              No URL provided
            </Typography>
            <Button title="Go Back" variant="outline" className="mt-4" onPress={handleCancel} />
          </View>
        )}
      </View>

      {/* Bottom info */}
      <View className="px-4 py-4 bg-background border-t border-border">
        <Typography className="text-xs text-muted-foreground text-center">
          Complete the security check above. Once verified, you'll be redirected automatically.
        </Typography>
      </View>
    </View>
  )
}
