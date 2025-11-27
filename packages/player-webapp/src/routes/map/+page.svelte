<script lang="ts">
  import { onMount } from 'svelte'
  import { adminLocations } from '$lib/stores'
  import { getAdminLocations } from '$lib/api/client'
  
  let mapContainer: HTMLDivElement
  let map: any = null
  let refreshInterval: ReturnType<typeof setInterval>
  
  async function loadLocations() {
    adminLocations.setLoading(true)
    try {
      const locations = await getAdminLocations()
      adminLocations.setLocations(locations)
      updateMarkers()
    } catch (err) {
      console.error('Failed to load admin locations:', err)
    } finally {
      adminLocations.setLoading(false)
    }
  }
  
  function updateMarkers() {
    if (!map) return
    
    // TODO: Update map markers with admin locations
    // This requires Leaflet to be properly loaded
  }
  
  onMount(async () => {
    // Dynamically import Leaflet (client-side only)
    const L = await import('leaflet')
    await import('leaflet/dist/leaflet.css')
    
    // Initialize map centered on a default location (can be updated for venue)
    map = L.map(mapContainer).setView([37.7749, -122.4194], 15)
    
    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map)
    
    // Load initial locations
    await loadLocations()
    
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadLocations, 30000)
    
    return () => {
      if (refreshInterval) clearInterval(refreshInterval)
      if (map) map.remove()
    }
  })
</script>

<svelte:head>
  <title>Admin Map | Seedhunter</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
</svelte:head>

<div class="container">
  <div class="header">
    <h1>📍 Find Admins</h1>
    <button class="btn-secondary" onclick={loadLocations} disabled={adminLocations.loading}>
      {adminLocations.loading ? 'Loading...' : 'Refresh'}
    </button>
  </div>
  
  <p class="text-muted mb-md">
    Find an admin to get verified! Admins can scan your profile QR code to verify your account.
  </p>
  
  <div class="map-container" bind:this={mapContainer}></div>
  
  <div class="admin-list">
    <h3>Active Admins</h3>
    {#if adminLocations.locations.length === 0}
      <p class="text-muted">No admin locations available</p>
    {:else}
      <ul>
        {#each adminLocations.locations as admin}
          <li>
            <span class="admin-name">👤 {admin.username}</span>
            {#if admin.location === '<encrypted>'}
              <span class="location-hidden">📍 Location hidden</span>
            {:else}
              <span class="location-visible">📍 Visible on map</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
    
    {#if adminLocations.lastUpdate}
      <p class="last-update text-muted">
        Last updated: {new Date(adminLocations.lastUpdate).toLocaleTimeString()}
      </p>
    {/if}
  </div>
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }
  
  h1 {
    font-size: 1.5rem;
  }
  
  .map-container {
    height: 400px;
    border-radius: var(--radius-lg);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    background-color: var(--color-bg-secondary);
  }
  
  .admin-list {
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
  }
  
  .admin-list h3 {
    margin-bottom: var(--space-md);
  }
  
  .admin-list ul {
    list-style: none;
  }
  
  .admin-list li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-surface);
  }
  
  .admin-list li:last-child {
    border-bottom: none;
  }
  
  .admin-name {
    font-weight: 500;
  }
  
  .location-visible {
    color: var(--color-success);
  }
  
  .location-hidden {
    color: var(--color-text-muted);
  }
  
  .last-update {
    margin-top: var(--space-md);
    font-size: 0.85rem;
  }
</style>
