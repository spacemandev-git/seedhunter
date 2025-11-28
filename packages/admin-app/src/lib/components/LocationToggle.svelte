<script lang="ts">
  import { location } from '$lib/stores/index.svelte'
  import {
    startLocationBroadcast,
    stopLocationBroadcast,
    toggleVisibility
  } from '$lib/services/locationService'

  interface Props {
    onStatusChange?: (broadcasting: boolean) => void
  }

  let { onStatusChange }: Props = $props()

  let loading = $state(false)

  async function handleToggleBroadcast() {
    loading = true
    try {
      if (location.broadcasting) {
        await stopLocationBroadcast()
      } else {
        await startLocationBroadcast()
      }
      onStatusChange?.(location.broadcasting)
    } finally {
      loading = false
    }
  }

  async function handleVisibilityToggle() {
    await toggleVisibility(!location.visible)
  }

  function formatTime(timestamp: number | null): string {
    if (!timestamp) return 'Never'
    return new Date(timestamp).toLocaleTimeString()
  }

  function formatCoords(lat: number | null, lng: number | null): string {
    if (lat === null || lng === null) return 'Unknown'
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`
  }
</script>

<section class="location-toggle card">
  <h2>📍 Location Broadcasting</h2>

  <div class="toggle-row">
    <div class="toggle-info">
      <span class="toggle-label">Broadcast Location</span>
      <span class="toggle-status">
        <span
          class="status-dot"
          class:active={location.broadcasting}
          class:inactive={!location.broadcasting}
        ></span>
        {location.broadcasting ? 'Active' : 'Off'}
      </span>
    </div>
    <button
      class="toggle"
      class:active={location.broadcasting}
      onclick={handleToggleBroadcast}
      disabled={loading}
      aria-label={location.broadcasting ? 'Stop broadcasting' : 'Start broadcasting'}
    ></button>
  </div>

  {#if location.broadcasting}
    <div class="toggle-row mt-md">
      <div class="toggle-info">
        <span class="toggle-label">Visible to Players</span>
        <span class="toggle-status text-muted">
          {location.visible ? 'Shown on map' : 'Hidden (<encrypted>)'}
        </span>
      </div>
      <button
        class="toggle"
        class:active={location.visible}
        onclick={handleVisibilityToggle}
        aria-label={location.visible ? 'Hide location' : 'Show location'}
      ></button>
    </div>

    <div class="location-details mt-md">
      <div class="detail-row">
        <span class="detail-label">Last Update:</span>
        <span class="detail-value">{formatTime(location.lastUpdate)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Coordinates:</span>
        <span class="detail-value">{formatCoords(location.lastLat, location.lastLng)}</span>
      </div>
    </div>
  {/if}

  {#if location.error}
    <div class="error-banner mt-md">
      <span class="error-icon">⚠️</span>
      <span>{location.error}</span>
    </div>
  {/if}
</section>

<style>
  .location-toggle h2 {
    margin-bottom: var(--space-lg);
    font-size: 1.2rem;
  }

  .toggle-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .toggle-info {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }

  .toggle-label {
    font-weight: 500;
  }

  .toggle-status {
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .location-details {
    background-color: var(--color-surface);
    border-radius: var(--radius-md);
    padding: var(--space-md);
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-xs) 0;
  }

  .detail-row:not(:last-child) {
    border-bottom: 1px solid var(--color-bg);
  }

  .detail-label {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .detail-value {
    font-family: monospace;
    font-size: 0.85rem;
  }

  .error-banner {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    background-color: rgba(248, 81, 73, 0.1);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
    padding: var(--space-md);
    color: var(--color-error);
  }

  .error-icon {
    font-size: 1.2rem;
  }
</style>
