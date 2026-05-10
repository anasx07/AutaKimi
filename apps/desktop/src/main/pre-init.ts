import { app } from 'electron'
import path from 'path'

// Set app name before any db imports to ensure correct userData path
app.name = 'AutaKimi'

// Force userData path to be exactly what was requested (AppData/Roaming/AutaKimi on Windows)
try {
  const appData = app.getPath('appData')
  const targetPath = path.join(appData, 'AutaKimi')
  app.setPath('userData', targetPath)
} catch (e) {
  console.error('Failed to set userData path:', e)
}
