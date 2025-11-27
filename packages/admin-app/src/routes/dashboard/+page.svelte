<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth, location, verifications } from '$lib/stores'
  import { logout, verifyPlayer, getPlayerByHandle } from '$lib/api/client'
  import { 
    startLocationBroadcast, 
    stopLocationBroadcast, 
    toggleVisibility 
  } from '$lib/services/locationService'
  
  // Verification state
  let verifyMode = $state<'idle' | 'scanning' | 'manual' | 'preview' | 'success'>('idle')
  let manualHandle = $state('')
  let previewPlayer = $state<any>(null)
  let verifyLoading = $state(false)
  let verifyError = $state('')
  let lastVerifyResult = $state<{ handle: string; tradesVerified: number } | null>(null)
  
  // Redirect if not logged in
  onMount(() => {
    if (!auth.loading && !auth.isLoggedIn) {
      goto('/')
    }
  })
  
  $effect(() => {
    if (!auth.loading && !auth.isLoggedIn) {
      goto('/')
    }
  })
  
  async function handleLogout() {
    await stopLocationBroadcast()
    await logout()
    auth.logout()
    goto('/')
  }
  
  async function toggleBroadcast() {
    if (location.broadcasting) {
      await stopLocationBroadcast()
    } else {
      await startLocationBroadcast()
    }
  }
  
  async function handleVisibilityToggle() {
    await toggleVisibility(!location.visible)
  }
  
  function startScan() {
    verifyMode = 'scanning'
    verifyError = ''
    // TODO: Initialize barcode scanner
  }
  
  function startManual() {
    verifyMode = 'manual'
    manualHandle = ''
    verifyError = ''
  }
  
  async function lookupPlayer() {
    if (!manualHandle.trim()) {
      verifyError = 'Please enter a handle'
      return
    }
    
    verifyLoading = true
    verifyError = ''
    
    try {
      const handle = manualHandle.startsWith('@') ? manualHandle.slice(1) : manualHandle
      const player = await getPlayerByHandle(handle)
      
      if (!player) {
        verifyError = 'Player not found'
        return
      }
      
      previewPlayer = player
      verifyMode = 'preview'
    } catch (err) {
      verifyError = err instanceof Error ? err.message : 'Failed to find player'
    } finally {
      verifyLoading = false
    }
  }
  
  async function confirmVerify() {
    if (!previewPlayer) return
    
    verifyLoading = true
    verifyError = ''
    
    try {
      const result = await verifyPlayer(previewPlayer.xHandle || previewPlayer.handle)
      
      lastVerifyResult = {
        handle: previewPlayer.xHandle || previewPlayer.handle,
        tradesVerified: result.tradesVerified
      }
      
      verifications.addVerification({
        handle: lastVerifyResult.handle,
        timestamp: Date.now(),
        tradesVerified: result.tradesVerified
      })
      
      verifyMode = 'success'
    } catch (err) {
      verifyError = err instanceof Error ? err.message : 'Verification failed'
    } finally {
      verifyLoading = false
    }
  }
  
  function resetVerify() {
    verifyMode = 'idle'
    previewPlayer = null
    manualHandle = ''
    verifyError = ''
    lastVerifyResult = null
  }
</script>

<svelte:head>
  <title>Dashboard | Seedhunter Admin</title>
</svelte:head>

<div class="dashboard">
  <header>
    <h1>🌱 Admin</h1>
    <button class="btn-secondary" onclick={handleLogout}>Logout</button>
  </header>
  
  <main>
    <!-- Location Section -->
    <section class="card">
      <h2>📍 Location Broadcasting</h2>
      
      <div class="toggle-row">
        <div class="toggle-info">
          <span class="toggle-label">Broadcast Location</span>
          <span class="toggle-status">
            <span class="status-dot" class:active={location.broadcasting} class:inactive={!location.broadcasting}></span>
            {location.broadcasting ? 'Active' : 'Off'}
          </span>
        </div>
        <button 
          class="toggle" 
          class:active={location.broadcasting}
          onclick={toggleBroadcast}
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
          ></button>
        </div>
        
        {#if location.lastUpdate}
          <p class="location-info mt-md text-muted">
            Last update: {new Date(location.lastUpdate).toLocaleTimeString()}
            {#if location.lastLat && location.lastLng}
              <br>Coords: {location.lastLat.toFixed(4)}, {location.lastLng.toFixed(4)}
            {/if}
          </p>
        {/if}
      {/if}
      
      {#if location.error}
        <p class="text-error mt-md">{location.error}</p>
      {/if}
    </section>
    
    <!-- Verify Section -->
    <section class="card">
      <h2>✓ Verify Player</h2>
      
      {#if verifyMode === 'idle'}
        <div class="verify-buttons">
          <button class="btn-primary btn-large" onclick={startScan}>
            📷 Scan QR Code
          </button>
          <button class="btn-secondary btn-large" onclick={startManual}>
            ⌨️ Enter Handle
          </button>
        </div>
        
        {#if verifications.recentCount > 0}
          <div class="recent-verifications mt-lg">
            <h3>Recent Verifications</h3>
            <ul>
              {#each verifications.verifications.slice(0, 5) as v}
                <li>
                  <span>@{v.handle}</span>
                  <span class="text-muted">{v.tradesVerified} trades verified</span>
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        
      {:else if verifyMode === 'scanning'}
        <div class="scanner-container">
          <div class="scanner-placeholder">
            <p>Camera Scanner</p>
            <p class="text-muted">Implementation pending</p>
          </div>
          <button class="btn-secondary mt-md" onclick={resetVerify}>Cancel</button>
        </div>
        
      {:else if verifyMode === 'manual'}
        <div class="manual-entry">
          <div class="input-group">
            <input
              type="text"
              bind:value={manualHandle}
              placeholder="@handle"
              disabled={verifyLoading}
            />
          </div>
          
          {#if verifyError}
            <p class="text-error mb-md">{verifyError}</p>
          {/if}
          
          <div class="button-row">
            <button class="btn-secondary" onclick={resetVerify}>Cancel</button>
            <button class="btn-primary" onclick={lookupPlayer} disabled={verifyLoading}>
              {verifyLoading ? 'Looking up...' : 'Look Up'}
            </button>
          </div>
        </div>
        
      {:else if verifyMode === 'preview'}
        <div class="player-preview">
          <div class="preview-avatar">👤</div>
          <h3>@{previewPlayer?.xHandle || previewPlayer?.handle}</h3>
          <p class="text-muted">
            Trades: {previewPlayer?.stats?.trades ?? 0}
          </p>
          {#if previewPlayer?.verified}
            <p class="text-success">Already verified ✓</p>
          {/if}
          
          {#if verifyError}
            <p class="text-error mt-md">{verifyError}</p>
          {/if}
          
          <div class="button-row mt-lg">
            <button class="btn-secondary" onclick={resetVerify}>Cancel</button>
            {#if !previewPlayer?.verified}
              <button class="btn-primary" onclick={confirmVerify} disabled={verifyLoading}>
                {verifyLoading ? 'Verifying...' : 'Verify Player'}
              </button>
            {/if}
          </div>
        </div>
        
      {:else if verifyMode === 'success'}
        <div class="verify-success">
          <div class="success-icon">✓</div>
          <h3>Verified!</h3>
          <p>@{lastVerifyResult?.handle}</p>
          <p class="text-muted">
            {lastVerifyResult?.tradesVerified} trades now count as points
          </p>
          <button class="btn-primary mt-lg" onclick={resetVerify}>
            Verify Another
          </button>
        </div>
      {/if}
    </section>
  </main>
</div>

<style>
  .dashboard {
    min-height: 100vh;
    padding: var(--space-md);
    padding-top: calc(var(--safe-top) + var(--space-md));
  }
  
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }
  
  header h1 {
    font-size: 1.5rem;
    color: var(--color-secondary);
  }
  
  main {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  .card h2 {
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
  
  .location-info {
    font-size: 0.85rem;
  }
  
  .verify-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .button-row {
    display: flex;
    gap: var(--space-md);
    justify-content: flex-end;
  }
  
  .input-group {
    margin-bottom: var(--space-md);
  }
  
  .scanner-container,
  .manual-entry,
  .player-preview,
  .verify-success {
    text-align: center;
  }
  
  .scanner-placeholder {
    height: 200px;
    background-color: var(--color-surface);
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  
  .preview-avatar {
    font-size: 4rem;
    margin-bottom: var(--space-md);
  }
  
  .success-icon {
    width: 80px;
    height: 80px;
    background-color: var(--color-success);
    color: white;
    font-size: 3rem;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--space-md);
  }
  
  .recent-verifications h3 {
    font-size: 1rem;
    margin-bottom: var(--space-sm);
  }
  
  .recent-verifications ul {
    list-style: none;
  }
  
  .recent-verifications li {
    display: flex;
    justify-content: space-between;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-surface);
  }
  
  .recent-verifications li:last-child {
    border-bottom: none;
  }
</style>
