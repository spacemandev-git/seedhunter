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
      // Geolocation plugin config
    },
    BackgroundGeolocation: {
      // Background geolocation config
    },
    BarcodeScanning: {
      // Barcode scanning config
    },
    Preferences: {
      // Secure storage
    }
  },
  android: {
    allowMixedContent: true
  }
}

export default config
