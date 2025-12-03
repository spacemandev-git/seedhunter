<script lang="ts">
  import { verifications } from '$lib/stores/index.svelte'
  import { verifyPlayer, getPlayerByHandle } from '$lib/api/client'
  import type { PlayerWithStats } from '@seedhunter/shared'
  import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning'
  import { browser } from '$app/environment'

  type VerifyMode = 'idle' | 'scanning' | 'manual' | 'preview' | 'verifying' | 'success' | 'error'

  let mode = $state<VerifyMode>('idle')
  let manualHandle = $state('')
  let previewPlayer = $state<PlayerWithStats | null>(null)
  let loading = $state(false)
  let errorMessage = $state('')
  let lastResult = $state<{ handle: string; tradesVerified: number } | null>(null)

  // Scanner state
  let scannerActive = $state(false)

  function getBarcodeScanner() {
    if (!browser) return null
    try {
      return BarcodeScanner
    } catch {
      return null
    }
  }

  async function startScan() {
    mode = 'scanning'
    errorMessage = ''
    scannerActive = true

    try {
      const scanner = getBarcodeScanner()
      if (!scanner) {
        errorMessage = 'Barcode scanner not available'
        mode = 'error'
        return
      }

      // Check/request permissions
      const { camera } = await scanner.checkPermissions()
      if (camera !== 'granted') {
        const result = await scanner.requestPermissions()
        if (result.camera !== 'granted') {
          errorMessage = 'Camera permission denied'
          mode = 'error'
          return
        }
      }

      // Start scanning
      document.body.classList.add('scanner-active')

      const { barcodes } = await scanner.scan()

      document.body.classList.remove('scanner-active')
      scannerActive = false

      if (barcodes.length > 0) {
        const scannedValue = barcodes[0].rawValue
        // Handle can be with or without @
        const handle = scannedValue.startsWith('@') ? scannedValue.slice(1) : scannedValue
        await lookupPlayer(handle)
      } else {
        mode = 'idle'
      }
    } catch (err) {
      document.body.classList.remove('scanner-active')
      scannerActive = false
      console.error('Scanner error:', err)
      errorMessage = err instanceof Error ? err.message : 'Scanner failed'
      mode = 'error'
    }
  }

  async function stopScan() {
    try {
      const scanner = getBarcodeScanner()
      if (scanner) {
        await scanner.stopScan()
      }
    } catch (err) {
      console.error('Stop scan error:', err)
    }
    document.body.classList.remove('scanner-active')
    scannerActive = false
    mode = 'idle'
  }

  function startManual() {
    mode = 'manual'
    manualHandle = ''
    errorMessage = ''
  }

  async function handleManualSubmit() {
    if (!manualHandle.trim()) {
      errorMessage = 'Please enter a handle'
      return
    }
    const handle = manualHandle.startsWith('@') ? manualHandle.slice(1) : manualHandle
    await lookupPlayer(handle)
  }

  async function lookupPlayer(handle: string) {
    loading = true
    errorMessage = ''

    try {
      const player = await getPlayerByHandle(handle)

      if (!player) {
        errorMessage = 'Player not found'
        mode = 'error'
        return
      }

      previewPlayer = player as PlayerWithStats
      mode = 'preview'
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to find player'
      mode = 'error'
    } finally {
      loading = false
    }
  }

  async function confirmVerify() {
    if (!previewPlayer) return

    loading = true
    mode = 'verifying'
    errorMessage = ''

    try {
      const handle = previewPlayer.xHandle
      const result = await verifyPlayer(handle)

      lastResult = {
        handle,
        tradesVerified: result.tradesVerified
      }

      verifications.addVerification({
        handle,
        timestamp: Date.now(),
        tradesVerified: result.tradesVerified
      })

      mode = 'success'
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Verification failed'
      mode = 'error'
    } finally {
      loading = false
    }
  }

  function reset() {
    mode = 'idle'
    previewPlayer = null
    manualHandle = ''
    errorMessage = ''
    lastResult = null
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleManualSubmit()
    }
  }
</script>

<section class="verify-player card">
  <h2>✓ Verify Player</h2>

  {#if mode === 'idle'}
    <div class="action-buttons">
      <button class="btn-primary btn-large" onclick={startScan}>
        📷 Scan QR Code
      </button>
      <button class="btn-secondary btn-large" onclick={startManual}>
        ⌨️ Enter Handle
      </button>
    </div>

    {#if verifications.recentCount > 0}
      <div class="recent-list mt-lg">
        <h3>Recent Verifications</h3>
        <ul>
          {#each verifications.verifications.slice(0, 5) as v}
            <li>
              <span class="handle">@{v.handle}</span>
              <span class="trades-info">{v.tradesVerified} trades verified</span>
            </li>
          {/each}
        </ul>
      </div>
    {/if}

  {:else if mode === 'scanning'}
    <div class="scanner-view">
      <div class="scanner-frame">
        <div class="scanner-corner tl"></div>
        <div class="scanner-corner tr"></div>
        <div class="scanner-corner bl"></div>
        <div class="scanner-corner br"></div>
        <p class="scanner-hint">Point camera at player's QR code</p>
      </div>
      <button class="btn-secondary mt-lg" onclick={stopScan}>Cancel</button>
    </div>

  {:else if mode === 'manual'}
    <div class="manual-entry">
      <div class="input-group">
        <label for="handle-input">Player Handle</label>
        <input
          id="handle-input"
          type="text"
          bind:value={manualHandle}
          placeholder="@username"
          disabled={loading}
          onkeydown={handleKeydown}
          autocomplete="off"
          autocapitalize="none"
        />
      </div>

      {#if errorMessage}
        <p class="text-error mb-md">{errorMessage}</p>
      {/if}

      <div class="button-row">
        <button class="btn-secondary" onclick={reset}>Cancel</button>
        <button class="btn-primary" onclick={handleManualSubmit} disabled={loading}>
          {loading ? 'Looking up...' : 'Look Up'}
        </button>
      </div>
    </div>

  {:else if mode === 'preview'}
    <div class="player-preview">
      {#if previewPlayer?.xProfilePic}
        <img src={previewPlayer.xProfilePic} alt="Profile" class="preview-avatar-img" />
      {:else}
        <div class="preview-avatar">👤</div>
      {/if}

      <h3>@{previewPlayer?.xHandle}</h3>

      <div class="preview-stats">
        <div class="stat">
          <span class="stat-value">{previewPlayer?.stats?.trades ?? 0}</span>
          <span class="stat-label">Trades</span>
        </div>
        <div class="stat">
          <span class="stat-value">{previewPlayer?.stats?.points ?? 0}</span>
          <span class="stat-label">Points</span>
        </div>
      </div>

      {#if previewPlayer?.verified}
        <div class="already-verified">
          <span class="check-icon">✓</span>
          Already Verified
        </div>
      {/if}

      {#if errorMessage}
        <p class="text-error mt-md">{errorMessage}</p>
      {/if}

      <div class="button-row mt-lg">
        <button class="btn-secondary" onclick={reset}>Cancel</button>
        {#if !previewPlayer?.verified}
          <button class="btn-primary" onclick={confirmVerify} disabled={loading}>
            Verify Player
          </button>
        {/if}
      </div>
    </div>

  {:else if mode === 'verifying'}
    <div class="verifying-state">
      <div class="spinner"></div>
      <p>Verifying player...</p>
    </div>

  {:else if mode === 'success'}
    <div class="success-state">
      <div class="success-icon">✓</div>
      <h3>Verified!</h3>
      <p class="handle">@{lastResult?.handle}</p>
      <p class="trades-result">
        {lastResult?.tradesVerified} trades now count as points
      </p>
      <button class="btn-primary mt-lg" onclick={reset}>
        Verify Another
      </button>
    </div>

  {:else if mode === 'error'}
    <div class="error-state">
      <div class="error-icon">✕</div>
      <h3>Error</h3>
      <p class="error-message">{errorMessage}</p>
      <button class="btn-secondary mt-lg" onclick={reset}>
        Try Again
      </button>
    </div>
  {/if}
</section>

<style>
  .verify-player h2 {
    margin-bottom: var(--space-lg);
    font-size: 1.2rem;
  }

  .action-buttons {
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

  .input-group label {
    display: block;
    margin-bottom: var(--space-xs);
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  /* Scanner view */
  .scanner-view {
    text-align: center;
  }

  .scanner-frame {
    position: relative;
    width: 250px;
    height: 250px;
    margin: 0 auto;
    background-color: var(--color-surface);
    border-radius: var(--radius-md);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .scanner-corner {
    position: absolute;
    width: 30px;
    height: 30px;
    border-color: var(--color-secondary);
    border-style: solid;
  }

  .scanner-corner.tl {
    top: 10px;
    left: 10px;
    border-width: 3px 0 0 3px;
  }

  .scanner-corner.tr {
    top: 10px;
    right: 10px;
    border-width: 3px 3px 0 0;
  }

  .scanner-corner.bl {
    bottom: 10px;
    left: 10px;
    border-width: 0 0 3px 3px;
  }

  .scanner-corner.br {
    bottom: 10px;
    right: 10px;
    border-width: 0 3px 3px 0;
  }

  .scanner-hint {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  /* Manual entry */
  .manual-entry {
    max-width: 300px;
    margin: 0 auto;
  }

  /* Player preview */
  .player-preview {
    text-align: center;
  }

  .preview-avatar {
    font-size: 4rem;
    margin-bottom: var(--space-md);
  }

  .preview-avatar-img {
    width: 100px;
    height: 100px;
    border-radius: var(--radius-full);
    object-fit: cover;
    margin-bottom: var(--space-md);
  }

  .preview-stats {
    display: flex;
    justify-content: center;
    gap: var(--space-xl);
    margin: var(--space-lg) 0;
  }

  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-secondary);
  }

  .stat-label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }

  .already-verified {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    background-color: rgba(35, 134, 54, 0.2);
    color: var(--color-success);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-full);
    font-weight: 500;
  }

  .check-icon {
    font-size: 1.2rem;
  }

  /* States */
  .verifying-state,
  .success-state,
  .error-state {
    text-align: center;
    padding: var(--space-xl) 0;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 4px solid var(--color-surface);
    border-top-color: var(--color-primary);
    border-radius: var(--radius-full);
    margin: 0 auto var(--space-lg);
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
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

  .error-icon {
    width: 80px;
    height: 80px;
    background-color: var(--color-error);
    color: white;
    font-size: 3rem;
    border-radius: var(--radius-full);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto var(--space-md);
  }

  .handle {
    font-weight: 500;
  }

  .trades-info,
  .trades-result {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }

  .error-message {
    color: var(--color-error);
  }

  /* Recent verifications */
  .recent-list h3 {
    font-size: 1rem;
    margin-bottom: var(--space-sm);
    color: var(--color-text-muted);
  }

  .recent-list ul {
    list-style: none;
  }

  .recent-list li {
    display: flex;
    justify-content: space-between;
    padding: var(--space-sm) 0;
    border-bottom: 1px solid var(--color-surface);
  }

  .recent-list li:last-child {
    border-bottom: none;
  }

  /* Global style when scanner is active */
  :global(body.scanner-active) {
    background: transparent !important;
  }

  :global(body.scanner-active .app) {
    display: none;
  }
</style>
