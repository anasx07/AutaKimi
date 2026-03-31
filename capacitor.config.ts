import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.codixy.autakimi',
  appName: 'AutaKimi',
  webDir: 'dist-mobile',
  android: {
    allowMixedContent: true,
    webContentsDebuggingEnabled: true
  },
  plugins: {
    CapacitorSQLite: {
      iosDatabaseLocation: 'Library/CapacitorDatabase'
    },
    CapacitorHttp: {
      enabled: true
    }
  }
}

export default config
