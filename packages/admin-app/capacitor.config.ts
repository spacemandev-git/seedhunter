import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'io.seedplex.seedhunter.admin',
  appName: 'Seedhunter Admin',
  webDir: 'build',
  server: {
    androidScheme: 'https'
  },
  plugins: {
    Geolocation: {
      // Use high accuracy for admin location tracking
    },
    BackgroundGeolocation: {
      // These are set in code, not config
    },
    CapacitorMLKitBarcodeScanning: {
      // Camera permission is handled via manifest
    },
    Preferences: {
      // No special config needed
    }
  },
  android: {
    allowMixedContent: true,
    // For background location, battery optimization exception recommended
    backgroundColor: '#0d1117', // Match app background
    webContentsDebuggingEnabled: true // Enable Chrome DevTools debugging
  }
}

export default config
