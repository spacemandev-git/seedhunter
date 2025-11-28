<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { adminLocations } from "$lib/stores";
  import { getAdminLocations } from "$lib/api/client";
  import type { AdminLocation } from "@seedhunter/shared";

  let mapContainer: HTMLDivElement;
  let map: any = null;
  let L: any = null;
  let markers: any[] = [];
  let refreshInterval: ReturnType<typeof setInterval> | null = null;
  let isRefreshing = $state(false);

  async function loadLocations() {
    isRefreshing = true;
    adminLocations.setLoading(true);

    try {
      const locations = await getAdminLocations();
      adminLocations.setLocations(locations);
      updateMarkers(locations);
    } catch (err) {
      console.error("Failed to load admin locations:", err);
    } finally {
      adminLocations.setLoading(false);
      isRefreshing = false;
    }
  }

  function updateMarkers(locations: AdminLocation[]) {
    if (!map || !L) return;

    // Clear existing markers
    markers.forEach((m) => m.remove());
    markers = [];

    // Add new markers
    locations.forEach((admin) => {
      if (
        admin.location !== "<encrypted>" &&
        typeof admin.location === "object"
      ) {
        const { lat, lng } = admin.location;

        // Create custom icon
        const adminIcon = L.divIcon({
          className: "admin-marker",
          html: `<div class="marker-pin"><span>👤</span></div><div class="marker-label">${admin.username}</div>`,
          iconSize: [40, 50],
          iconAnchor: [20, 50],
        });

        const marker = L.marker([lat, lng], { icon: adminIcon }).addTo(map)
          .bindPopup(`
            <div style="text-align: center; padding: 8px;">
              <strong>${admin.username}</strong><br/>
              <small style="color: #2ECC71;">📍 Available for verification</small>
            </div>
          `);

        markers.push(marker);
      }
    });

    // Fit bounds if we have markers
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.2));
    }
  }

  onMount(async () => {
    // Dynamically import Leaflet (client-side only)
    L = await import("leaflet");

    // Initialize map centered on a default location (Breakpoint venue area)
    map = L.map(mapContainer, {
      zoomControl: false, // We'll add custom controls
    }).setView([37.7749, -122.4194], 16);

    // Add zoom control to bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Add tile layer with light theme
    L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
      {
        attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
        maxZoom: 19,
      },
    ).addTo(map);

    // Load initial locations
    await loadLocations();

    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadLocations, 30000);
  });

  onDestroy(() => {
    if (refreshInterval) clearInterval(refreshInterval);
    if (map) map.remove();
  });

  function formatTime(timestamp: number | null): string {
    if (!timestamp) return "Unknown";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
</script>

<svelte:head>
  <title>Find Admins | Seedhunter</title>
  <link
    rel="stylesheet"
    href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
  />
</svelte:head>

<div class="page">
  <div class="container">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1>Find Admins</h1>
        <p class="subtitle">Get verified to earn points</p>
      </div>
      <button
        class="btn-refresh"
        onclick={loadLocations}
        disabled={adminLocations.loading || isRefreshing}
        aria-label="Refresh"
      >
        <svg
          class="refresh-icon"
          class:spinning={isRefreshing}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
          <path d="M21 3v5h-5" />
        </svg>
      </button>
    </div>

    <!-- Map -->
    <div class="map-card">
      <div class="map-container" bind:this={mapContainer}></div>
    </div>

    <!-- Admin list -->
    <div class="admin-card">
      <div class="card-header">
        <h3>Active Admins</h3>
        {#if adminLocations.lastUpdate}
          <span class="last-update"
            >Updated {formatTime(adminLocations.lastUpdate)}</span
          >
        {/if}
      </div>

      {#if adminLocations.loading && adminLocations.locations.length === 0}
        <!-- Skeleton loading -->
        <div class="admin-list">
          {#each [1, 2, 3] as _}
            <div class="admin-item skeleton">
              <div class="skeleton-circle"></div>
              <div class="skeleton-lines">
                <div class="skeleton-line w-24"></div>
                <div class="skeleton-line w-16 small"></div>
              </div>
            </div>
          {/each}
        </div>
      {:else if adminLocations.locations.length === 0}
        <div class="empty-state">
          <span class="empty-icon">🔍</span>
          <p>No admins broadcasting right now</p>
          <small>Check back soon!</small>
        </div>
      {:else}
        <div class="admin-list">
          {#each adminLocations.locations as admin}
            <div class="admin-item">
              <div class="admin-avatar">👤</div>
              <div class="admin-info">
                <span class="admin-name">{admin.username}</span>
                {#if admin.location === "<encrypted>"}
                  <span class="location-status hidden">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path d="M17 11V7a5 5 0 0 0-10 0v4" />
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    </svg>
                    Location &lt;encrypted&gt;
                  </span>
                {:else}
                  <span class="location-status visible">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <circle cx="12" cy="10" r="3" />
                      <path
                        d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"
                      />
                    </svg>
                    On map
                  </span>
                {/if}
              </div>
              {#if admin.location !== "<encrypted>"}
                <div class="admin-badge">✓</div>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Info tip -->
    <div class="info-tip">
      <span class="tip-icon">💡</span>
      <p>
        Show your <a href="/profile">profile QR</a> to an admin to get verified!
      </p>
    </div>
  </div>
</div>

<style>
  .page {
    padding: var(--space-md) 0 var(--space-lg);
  }

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--space-md);
  }

  .header-content h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 2px;
  }

  .subtitle {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .btn-refresh {
    width: 44px;
    height: 44px;
    padding: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--transition-fast);
  }

  .btn-refresh:hover:not(:disabled) {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .refresh-icon {
    width: 20px;
    height: 20px;
  }

  .refresh-icon.spinning {
    animation: spin 0.8s linear infinite;
  }

  /* Map card */
  .map-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: var(--shadow-card);
    margin-bottom: var(--space-lg);
  }

  .map-container {
    height: 300px;
    width: 100%;
  }

  /* Custom map markers */
  :global(.admin-marker) {
    background: transparent;
  }

  :global(.marker-pin) {
    width: 40px;
    height: 40px;
    background: linear-gradient(
      135deg,
      var(--color-teal),
      var(--color-teal-dark)
    );
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    box-shadow: 0 4px 12px rgba(46, 186, 181, 0.4);
    border: 3px solid white;
  }

  :global(.marker-label) {
    position: absolute;
    bottom: -24px;
    left: 50%;
    transform: translateX(-50%);
    background: white;
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--color-text);
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* Admin list card */
  .admin-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    margin-bottom: var(--space-lg);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-border-light);
  }

  .card-header h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
  }

  .last-update {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .admin-list {
    padding: var(--space-sm);
  }

  .admin-item {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    transition: background var(--transition-fast);
  }

  .admin-item:hover {
    background: var(--color-bg-secondary);
  }

  .admin-avatar {
    width: 40px;
    height: 40px;
    background: var(--color-primary-light);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .admin-info {
    flex: 1;
    min-width: 0;
  }

  .admin-name {
    display: block;
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.95rem;
  }

  .location-status {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.8rem;
    margin-top: 2px;
  }

  .location-status svg {
    width: 14px;
    height: 14px;
  }

  .location-status.visible {
    color: var(--color-success);
  }

  .location-status.hidden {
    color: var(--color-text-muted);
  }

  .admin-badge {
    width: 24px;
    height: 24px;
    background: var(--color-success);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: bold;
    flex-shrink: 0;
  }

  /* Empty state */
  .empty-state {
    text-align: center;
    padding: var(--space-xl);
    color: var(--color-text-muted);
  }

  .empty-icon {
    font-size: 2.5rem;
    display: block;
    margin-bottom: var(--space-sm);
  }

  .empty-state p {
    font-weight: 500;
    color: var(--color-text-secondary);
  }

  .empty-state small {
    font-size: 0.85rem;
  }

  /* Skeleton loading */
  .admin-item.skeleton {
    pointer-events: none;
  }

  .skeleton-circle {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    background: linear-gradient(
      90deg,
      var(--color-border-light) 25%,
      var(--color-bg-secondary) 50%,
      var(--color-border-light) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

  .skeleton-lines {
    flex: 1;
  }

  .skeleton-line {
    height: 14px;
    background: linear-gradient(
      90deg,
      var(--color-border-light) 25%,
      var(--color-bg-secondary) 50%,
      var(--color-border-light) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
  }

  .skeleton-line.small {
    height: 10px;
    margin-top: 6px;
  }

  .w-24 {
    width: 96px;
  }
  .w-16 {
    width: 64px;
  }

  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }

  /* Info tip */
  .info-tip {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: var(--color-primary-light);
    border-radius: var(--radius-lg);
  }

  .tip-icon {
    font-size: 1.25rem;
  }

  .info-tip p {
    font-size: 0.9rem;
    color: var(--color-text-secondary);
  }

  .info-tip a {
    color: var(--color-primary);
    font-weight: 600;
  }

  @media (min-width: 480px) {
    .map-container {
      height: 350px;
    }
  }
</style>
