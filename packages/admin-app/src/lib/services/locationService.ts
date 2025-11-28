import { location } from '$lib/stores/index.svelte'
import { updateLocation, setVisibility } from '$lib/api/client'
import { LOCATION_UPDATE_INTERVAL_MS } from '@seedhunter/shared'
import { browser } from '$app/environment'
import { Geolocation } from '@capacitor/geolocation'
import { registerPlugin } from '@capacitor/core'

// Types for BackgroundGeolocation (from @capacitor-community/background-geolocation)
interface WatcherOptions {
  backgroundMessage?: string
  backgroundTitle?: string
  requestPermissions?: boolean
  stale?: boolean
  distanceFilter?: number
}

interface BGLocation {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
  simulated: boolean
  bearing: number | null
  speed: number | null
  time: number | null
}

interface CallbackError extends Error {
  code?: string
}

interface BackgroundGeolocationPlugin {
  addWatcher(
    options: WatcherOptions,
    callback: (position?: BGLocation, error?: CallbackError) => void
  ): Promise<string>
  removeWatcher(options: { id: string }): Promise<void>
  openSettings(): Promise<void>
}

// Register the background geolocation plugin (native-only, no JS module)
const BackgroundGeolocation = registerPlugin<BackgroundGeolocationPlugin>('BackgroundGeolocation')

// State
let foregroundWatchId: string | null = null
let updateInterval: ReturnType<typeof setInterval> | null = null
let backgroundWatcherId: string | null = null
let useBackgroundMode = false

// ============================================
// Permission Management
// ============================================

export async function requestPermissions(): Promise<boolean> {
  if (!browser) return false
  
  try {
    console.log('[Location] Requesting permissions...')
    
    // Request foreground permissions first
    const status = await Geolocation.requestPermissions()
    console.log('[Location] Permission status:', JSON.stringify(status))
    
    if (status.location !== 'granted') {
      console.warn('[Location] Permission not granted, status:', status.location)
      return false
    }

    // Check if background geolocation is available
    try {
      // Test if the plugin is registered by checking if it exists
      if (BackgroundGeolocation) {
        useBackgroundMode = true
        console.log('[Location] Background geolocation available')
      }
    } catch {
      console.warn('[Location] Background geolocation not available, using foreground only')
      useBackgroundMode = false
    }

    return true
  } catch (err) {
    console.error('[Location] Failed to request permissions:', err)
    return false
  }
}

export async function checkPermissions(): Promise<boolean> {
  if (!browser) return false
  
  try {
    const status = await Geolocation.checkPermissions()
    console.log('[Location] Check permissions status:', JSON.stringify(status))
    return status.location === 'granted'
  } catch (err) {
    console.error('[Location] Check permissions error:', err)
    return false
  }
}

// ============================================
// Location Broadcasting
// ============================================

export async function startLocationBroadcast(): Promise<boolean> {
  if (!browser) return false
  
  console.log('[Location] Starting location broadcast...')
  const hasPermission = await checkPermissions()
  console.log('[Location] Has permission:', hasPermission)

  if (!hasPermission) {
    console.log('[Location] No permission, requesting...')
    const granted = await requestPermissions()
    console.log('[Location] Permission granted:', granted)
    if (!granted) {
      location.setError('Location permission denied')
      return false
    }
  }

  try {
    // Try background geolocation first (Android)
    if (useBackgroundMode) {
      const started = await startBackgroundLocation()
      if (started) {
        location.setBroadcasting(true)
        return true
      }
    }

    // Fallback to foreground-only mode
    await startForegroundLocation()
    location.setBroadcasting(true)
    return true
  } catch (err) {
    location.setError(err instanceof Error ? err.message : 'Failed to start location')
    return false
  }
}

async function startBackgroundLocation(): Promise<boolean> {
  try {
    if (!BackgroundGeolocation) return false

    // Add watcher for background updates
    backgroundWatcherId = await BackgroundGeolocation.addWatcher(
      {
        backgroundMessage: 'Seedhunter is sharing your location with players',
        backgroundTitle: 'Location Active',
        requestPermissions: true,
        stale: false,
        distanceFilter: 10 // meters
      },
      async (position, error) => {
        if (error) {
          if (error.code === 'NOT_AUTHORIZED') {
            location.setError('Background location not authorized. Please enable in settings.')
          } else {
            console.error('Background location error:', error)
          }
          return
        }

        if (position) {
          location.updatePosition(position.latitude, position.longitude)

          // Send to server
          try {
            await updateLocation(position.latitude, position.longitude)
          } catch (err) {
            console.error('Failed to update location on server:', err)
          }
        }
      }
    )

    // Get initial position
    const initial = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    })
    location.updatePosition(initial.coords.latitude, initial.coords.longitude)
    await updateLocation(initial.coords.latitude, initial.coords.longitude)

    console.log('Background location started')
    return true
  } catch (err) {
    console.error('Failed to start background location:', err)
    return false
  }
}

async function startForegroundLocation(): Promise<void> {
  // Start watching position (foreground only)
  foregroundWatchId = await Geolocation.watchPosition(
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    },
    (position, err) => {
      if (err) {
        location.setError(err.message)
        return
      }

      if (position) {
        location.updatePosition(position.coords.latitude, position.coords.longitude)
      }
    }
  )

  // Start periodic updates to server
  updateInterval = setInterval(async () => {
    if (location.lastLat !== null && location.lastLng !== null) {
      try {
        await updateLocation(location.lastLat, location.lastLng)
      } catch (err) {
        console.error('Failed to update location on server:', err)
      }
    }
  }, LOCATION_UPDATE_INTERVAL_MS)

  // Get initial position
  const initial = await Geolocation.getCurrentPosition({
    enableHighAccuracy: true,
    timeout: 10000
  })
  location.updatePosition(initial.coords.latitude, initial.coords.longitude)
  await updateLocation(initial.coords.latitude, initial.coords.longitude)

  console.log('Foreground location started')
}

export async function stopLocationBroadcast(): Promise<void> {
  // Stop background watcher if active
  if (backgroundWatcherId !== null) {
    try {
      if (BackgroundGeolocation) {
        await BackgroundGeolocation.removeWatcher({ id: backgroundWatcherId })
      }
      backgroundWatcherId = null
      console.log('Background location stopped')
    } catch (err) {
      console.error('Failed to stop background location:', err)
    }
  }

  // Stop foreground watcher
  if (foregroundWatchId) {
    await Geolocation.clearWatch({ id: foregroundWatchId })
    foregroundWatchId = null
  }

  // Stop server update interval
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }

  location.setBroadcasting(false)
}

// ============================================
// Utility Functions
// ============================================

export function isRunning(): boolean {
  return foregroundWatchId !== null || backgroundWatcherId !== null
}

export async function toggleVisibility(visible: boolean): Promise<void> {
  try {
    await setVisibility(visible)
    location.setVisible(visible)
  } catch (err) {
    location.setError(err instanceof Error ? err.message : 'Failed to update visibility')
  }
}

export function getLastPosition(): { lat: number; lng: number } | null {
  if (location.lastLat !== null && location.lastLng !== null) {
    return { lat: location.lastLat, lng: location.lastLng }
  }
  return null
}

// ============================================
// Open App Settings (for permission recovery)
// ============================================

export async function openLocationSettings(): Promise<void> {
  try {
    if (BackgroundGeolocation) {
      await BackgroundGeolocation.openSettings()
    }
  } catch (err) {
    console.error('Failed to open settings:', err)
  }
}
