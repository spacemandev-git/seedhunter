<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import QRCode from 'qrcode'
  import { Html5Qrcode } from 'html5-qrcode'
  import { initTrade, confirmTrade, connectWebSocket, removeWSHandler, getPlayerProject } from '$lib/api/client'
  import { auth } from '$lib/stores'
  import type { Trade, Founder, GeoLocation, WSServerMessage } from '@seedhunter/shared'
  import { TRADE_PROXIMITY_METERS } from '@seedhunter/shared'
  
  interface Props {
    open: boolean
    onClose: () => void
    onTradeComplete: (result: { trade: Trade; newProject: Founder }) => void
  }
  
  let { open, onClose, onTradeComplete }: Props = $props()
  
  type TradeState = 'choose' | 'requesting-location' | 'generating' | 'showing' | 'scanning' | 'confirming' | 'success' | 'error'
  
  let tradeState = $state<TradeState>('choose')
  let qrDataUrl = $state<string | null>(null)
  let countdown = $state(60)
  let errorMessage = $state('')
  let tradeResult = $state<{ trade: Trade; newProject: Founder } | null>(null)
  let currentLocation = $state<GeoLocation | null>(null)
  let scanner: Html5Qrcode | null = null
  let countdownInterval: ReturnType<typeof setInterval> | null = null
  let wsHandler: ((msg: WSServerMessage) => void) | null = null
  
  /**
   * Request user's location using the browser's Geolocation API
   */
  async function requestLocation(): Promise<GeoLocation> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported by your browser'))
        return
      }
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          })
        },
        (error) => {
          switch (error.code) {
            case error.PERMISSION_DENIED:
              reject(new Error('Location permission denied. Please enable location access to trade.'))
              break
            case error.POSITION_UNAVAILABLE:
              reject(new Error('Location information is unavailable.'))
              break
            case error.TIMEOUT:
              reject(new Error('Location request timed out. Please try again.'))
              break
            default:
              reject(new Error('An unknown error occurred while getting your location.'))
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0 // Don't use cached location
        }
      )
    })
  }
  
  // Reset state when modal opens/closes
  $effect(() => {
    if (open) {
      tradeState = 'choose'
      qrDataUrl = null
      countdown = 60
      errorMessage = ''
      tradeResult = null
      currentLocation = null
    } else {
      cleanup()
    }
  })
  
  onDestroy(() => {
    cleanup()
  })
  
  function cleanup() {
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
    if (wsHandler) {
      removeWSHandler(wsHandler)
      wsHandler = null
    }
    stopScanner()
  }
  
  async function generateQR() {
    tradeState = 'requesting-location'
    errorMessage = ''
    
    try {
      // First, request location
      currentLocation = await requestLocation()
      
      tradeState = 'generating'
      
      const result = await initTrade(currentLocation)
      
      // Generate QR code from payload
      qrDataUrl = await QRCode.toDataURL(result.payload, {
        width: 256,
        margin: 2,
        color: {
          dark: '#1A2B2A',
          light: '#FFFFFF'
        }
      })
      
      // Start countdown
      const expiresIn = Math.floor((result.expiresAt - Date.now()) / 1000)
      countdown = Math.max(0, expiresIn)
      
      countdownInterval = setInterval(() => {
        countdown--
        if (countdown <= 0) {
          if (countdownInterval) clearInterval(countdownInterval)
          tradeState = 'choose'
          errorMessage = 'QR code expired. Please generate a new one.'
        }
      }, 1000)
      
      // Set up WebSocket listener for trade completion
      // This allows the QR-showing player to see confirmation when the other player scans
      wsHandler = async (msg: WSServerMessage) => {
        if (msg.type === 'trade_complete' && tradeState === 'showing') {
          const trade = msg.trade
          const myHandle = auth.player?.xHandle
          
          // Check if this trade involves us
          if (myHandle && (trade.playerA === myHandle || trade.playerB === myHandle)) {
            // Stop the countdown
            if (countdownInterval) {
              clearInterval(countdownInterval)
              countdownInterval = null
            }
            
            // Fetch our new project to show in success state
            try {
              const newProject = await getPlayerProject(myHandle)
              tradeResult = { trade, newProject }
              tradeState = 'success'
              
              // Notify parent after a delay
              setTimeout(() => {
                onTradeComplete(tradeResult!)
              }, 2000)
            } catch (err) {
              console.error('Failed to fetch new founder:', err)
              // Still show success but without founder details
              tradeResult = { trade, newProject: { id: 0, name: 'Your new card', company: '', description: '', founded: 0, valuation: '' } as Founder }
              tradeState = 'success'
              
              setTimeout(() => {
                onTradeComplete(tradeResult!)
              }, 2000)
            }
          }
        }
      }
      
      connectWebSocket(wsHandler)
      
      tradeState = 'showing'
    } catch (err) {
      console.error('Failed to generate trade QR:', err)
      errorMessage = err instanceof Error ? err.message : 'Failed to generate QR code'
      tradeState = 'error'
    }
  }
  
  async function startScanning() {
    tradeState = 'requesting-location'
    errorMessage = ''
    
    try {
      // First, request location
      currentLocation = await requestLocation()
      
      tradeState = 'scanning'
      
      // Wait for the DOM to update with the #qr-reader element
      await tick()
      
      scanner = new Html5Qrcode('qr-reader')
      
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 }
        },
        onScanSuccess,
        onScanError
      )
    } catch (err) {
      console.error('Failed to start scanner:', err)
      errorMessage = err instanceof Error ? err.message : 'Failed to access camera or location'
      tradeState = 'error'
    }
  }
  
  async function stopScanner() {
    if (scanner) {
      try {
        await scanner.stop()
      } catch (err) {
        // Ignore errors when stopping
      }
      scanner = null
    }
  }
  
  async function onScanSuccess(decodedText: string) {
    await stopScanner()
    tradeState = 'confirming'
    
    try {
      if (!currentLocation) {
        errorMessage = 'Location not available. Please try again.'
        tradeState = 'error'
        return
      }
      
      const result = await confirmTrade(decodedText, currentLocation)
      
      if (result.success && result.trade && result.newProject) {
        tradeResult = { trade: result.trade, newProject: result.newProject }
        tradeState = 'success'
        
        // Notify parent after a delay
        setTimeout(() => {
          onTradeComplete(tradeResult!)
        }, 2000)
      } else {
        errorMessage = result.error || 'Trade failed'
        tradeState = 'error'
      }
    } catch (err) {
      console.error('Trade confirmation failed:', err)
      errorMessage = err instanceof Error ? err.message : 'Trade failed'
      tradeState = 'error'
    }
  }
  
  function onScanError(_: string) {
    // Ignore scan errors - they happen constantly when no QR is in view
  }
  
  function handleClose() {
    cleanup()
    onClose()
  }
  
  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }
</script>

{#if open}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div 
    class="modal-overlay" 
    onclick={handleBackdropClick}
    onkeydown={(e) => e.key === 'Escape' && handleClose()}
    role="dialog"
    aria-modal="true"
    tabindex="0"
  >
    <div class="modal animate-slide-up">
      <!-- Header -->
      <div class="modal-header">
        <h2>
          {#if tradeState === 'choose'}Trade Card
          {:else if tradeState === 'requesting-location'}Getting Location...
          {:else if tradeState === 'generating'}Generating...
          {:else if tradeState === 'showing'}Show This QR
          {:else if tradeState === 'scanning'}Scan QR Code
          {:else if tradeState === 'confirming'}Processing...
          {:else if tradeState === 'success'}Trade Complete!
          {:else if tradeState === 'error'}Trade Failed
          {/if}
        </h2>
        <button class="btn-close" onclick={handleClose} aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      
      <!-- Content -->
      <div class="modal-content">
        {#if tradeState === 'choose'}
          <p class="description">
            Trade your card with another player. Either show your QR code for them to scan, or scan their code.
          </p>
          
          <p class="location-notice">
            📍 Both players must be within {TRADE_PROXIMITY_METERS} meters of each other to trade
          </p>
          
          <div class="action-buttons">
            <button class="action-btn" onclick={generateQR}>
              <span class="action-icon">📱</span>
              <span class="action-text">
                <strong>Show My QR</strong>
                <small>Let them scan your code</small>
              </span>
            </button>
            
            <button class="action-btn" onclick={startScanning}>
              <span class="action-icon">📷</span>
              <span class="action-text">
                <strong>Scan Their QR</strong>
                <small>Scan other player's code</small>
              </span>
            </button>
          </div>
          
        {:else if tradeState === 'requesting-location'}
          <div class="loading-state">
            <div class="location-icon">📍</div>
            <div class="spinner-large"></div>
            <p>Requesting your location...</p>
            <small class="location-hint">Please allow location access when prompted</small>
          </div>
          
        {:else if tradeState === 'generating'}
          <div class="loading-state">
            <div class="spinner-large"></div>
            <p>Generating trade QR code...</p>
          </div>
          
        {:else if tradeState === 'showing'}
          <div class="qr-display">
            {#if qrDataUrl}
              <img src={qrDataUrl} alt="Trade QR Code" class="qr-image" />
            {/if}
            
            <div class="countdown" class:urgent={countdown <= 10}>
              <span class="countdown-value">{countdown}</span>
              <span class="countdown-label">seconds remaining</span>
            </div>
            
            <p class="qr-instructions">
              Ask the other player to scan this code with their Seedhunter app.
            </p>
          </div>
          
          <button class="btn-secondary" onclick={() => tradeState = 'choose'}>
            ← Back
          </button>
          
        {:else if tradeState === 'scanning'}
          <div class="scanner-container">
            <div id="qr-reader" class="qr-reader"></div>
            <p class="scan-instructions">Point your camera at the other player's QR code</p>
          </div>
          
          <button class="btn-secondary" onclick={() => { stopScanner(); tradeState = 'choose' }}>
            ← Back
          </button>
          
        {:else if tradeState === 'confirming'}
          <div class="loading-state">
            <div class="spinner-large"></div>
            <p>Processing trade...</p>
          </div>
          
        {:else if tradeState === 'success'}
          <div class="success-state">
            <div class="success-icon">✓</div>
            <h3>Cards Swapped!</h3>
            {#if tradeResult}
              <p>You received a new card:</p>
              <div class="new-card-preview">
                <strong>{tradeResult.newProject.name}</strong>
                <span>{tradeResult.newProject.company || 'Founder Card'}</span>
              </div>
            {/if}
          </div>
          
        {:else if tradeState === 'error'}
          <div class="error-state">
            <div class="error-icon">✕</div>
            <p>{errorMessage}</p>
            <button class="btn-primary mt-lg" onclick={() => tradeState = 'choose'}>
              Try Again
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 100;
    padding: var(--space-md);
  }
  
  @media (min-width: 480px) {
    .modal-overlay {
      align-items: center;
    }
  }
  
  .modal {
    background: var(--color-surface);
    border-radius: var(--radius-xl) var(--radius-xl) 0 0;
    width: 100%;
    max-width: 400px;
    max-height: 90vh;
    overflow-y: auto;
  }
  
  @media (min-width: 480px) {
    .modal {
      border-radius: var(--radius-xl);
    }
  }
  
  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-lg);
    border-bottom: 1px solid var(--color-border);
  }
  
  .modal-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
  }
  
  .btn-close {
    width: 36px;
    height: 36px;
    padding: 0;
    background: var(--color-bg-secondary);
    border-radius: 50%;
    color: var(--color-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .btn-close svg {
    width: 20px;
    height: 20px;
  }
  
  .btn-close:hover {
    background: var(--color-border);
    color: var(--color-text);
  }
  
  .modal-content {
    padding: var(--space-lg);
  }
  
  .description {
    color: var(--color-text-secondary);
    text-align: center;
    margin-bottom: var(--space-lg);
    line-height: 1.6;
  }
  
  .location-notice {
    background: var(--color-primary-light);
    color: var(--color-primary);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    text-align: center;
    font-size: 0.85rem;
    margin-bottom: var(--space-lg);
  }
  
  .location-icon {
    font-size: 2.5rem;
    margin-bottom: var(--space-sm);
  }
  
  .location-hint {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    margin-top: var(--space-sm);
  }
  
  /* Action buttons */
  .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .action-btn {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    padding: var(--space-lg);
    background: var(--color-bg-secondary);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    text-align: left;
    transition: all var(--transition-fast);
  }
  
  .action-btn:hover {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
  }
  
  .action-icon {
    font-size: 2rem;
  }
  
  .action-text {
    display: flex;
    flex-direction: column;
  }
  
  .action-text strong {
    color: var(--color-text);
    font-size: 1rem;
  }
  
  .action-text small {
    color: var(--color-text-muted);
    font-size: 0.85rem;
    font-weight: normal;
  }
  
  /* QR Display */
  .qr-display {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: var(--space-lg);
  }
  
  .qr-image {
    width: 256px;
    height: 256px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-lg);
  }
  
  .countdown {
    margin-top: var(--space-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .countdown-value {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }
  
  .countdown.urgent .countdown-value {
    color: var(--color-error);
    animation: pulse 1s infinite;
  }
  
  .countdown-label {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  
  .qr-instructions {
    margin-top: var(--space-md);
    color: var(--color-text-secondary);
    text-align: center;
    font-size: 0.9rem;
  }
  
  /* Scanner */
  .scanner-container {
    margin-bottom: var(--space-lg);
  }
  
  .qr-reader {
    width: 100%;
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  :global(#qr-reader video) {
    border-radius: var(--radius-lg);
  }
  
  :global(#qr-reader__scan_region) {
    background: transparent !important;
  }
  
  :global(#qr-reader__dashboard) {
    display: none !important;
  }
  
  .scan-instructions {
    margin-top: var(--space-md);
    color: var(--color-text-secondary);
    text-align: center;
    font-size: 0.9rem;
  }
  
  /* Loading */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-xl);
  }
  
  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--space-lg);
  }
  
  .loading-state p {
    color: var(--color-text-muted);
  }
  
  /* Success */
  .success-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-lg);
  }
  
  .success-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--color-success), #27ae60);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: var(--space-md);
    animation: pop 0.3s ease-out;
  }
  
  @keyframes pop {
    0% { transform: scale(0); }
    50% { transform: scale(1.2); }
    100% { transform: scale(1); }
  }
  
  .success-state h3 {
    font-size: 1.5rem;
    color: var(--color-text);
    margin-bottom: var(--space-sm);
  }
  
  .new-card-preview {
    background: var(--color-primary-light);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    margin-top: var(--space-md);
  }
  
  .new-card-preview strong {
    display: block;
    color: var(--color-text);
  }
  
  .new-card-preview span {
    color: var(--color-primary);
    font-size: 0.9rem;
  }
  
  /* Error */
  .error-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-lg);
  }
  
  .error-icon {
    width: 64px;
    height: 64px;
    background: linear-gradient(135deg, var(--color-error), #c0392b);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    font-weight: bold;
    margin-bottom: var(--space-md);
  }
  
  .error-state p {
    color: var(--color-error);
    background: rgba(231, 76, 60, 0.1);
    padding: var(--space-md);
    border-radius: var(--radius-md);
  }
</style>
