import { Geolocation, type Position } from '@capacitor/geolocation'
import { location } from '$lib/stores'
import { updateLocation, setVisibility } from '$lib/api/client'
import { LOCATION_UPDATE_INTERVAL_MS } from '@seedhunter/shared'

let watchId: string | null = null
let updateInterval: ReturnType<typeof setInterval> | null = null

export async function requestPermissions(): Promise<boolean> {
  try {
    const status = await Geolocation.requestPermissions()
    return status.location === 'granted'
  } catch (err) {
    console.error('Failed to request permissions:', err)
    return false
  }
}

export async function checkPermissions(): Promise<boolean> {
  try {
    const status = await Geolocation.checkPermissions()
    return status.location === 'granted'
  } catch (err) {
    return false
  }
}

export async function startLocationBroadcast(): Promise<boolean> {
  const hasPermission = await checkPermissions()
  
  if (!hasPermission) {
    const granted = await requestPermissions()
    if (!granted) {
      location.setError('Location permission denied')
      return false
    }
  }
  
  try {
    // Start watching position
    watchId = await Geolocation.watchPosition(
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
    
    location.setBroadcasting(true)
    
    // Get initial position
    const initial = await Geolocation.getCurrentPosition()
    location.updatePosition(initial.coords.latitude, initial.coords.longitude)
    await updateLocation(initial.coords.latitude, initial.coords.longitude)
    
    return true
  } catch (err) {
    location.setError(err instanceof Error ? err.message : 'Failed to start location')
    return false
  }
}

export async function stopLocationBroadcast(): Promise<void> {
  if (watchId) {
    await Geolocation.clearWatch({ id: watchId })
    watchId = null
  }
  
  if (updateInterval) {
    clearInterval(updateInterval)
    updateInterval = null
  }
  
  location.setBroadcasting(false)
}

export function isRunning(): boolean {
  return watchId !== null
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
