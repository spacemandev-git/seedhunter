import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [sveltekit()],
  server: {
    port: 5174 // Different port from player webapp
  },
  // Exclude Capacitor native-only packages from SSR bundling only
  // They SHOULD be bundled for the client build
  ssr: {
    noExternal: [],
    external: [
      '@capacitor/core',
      '@capacitor/geolocation',
      '@capacitor/preferences',
      '@capacitor-mlkit/barcode-scanning'
    ]
  }
})
