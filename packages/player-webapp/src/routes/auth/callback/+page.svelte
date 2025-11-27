<script lang="ts">
  import { onMount } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { setAuthToken } from '$lib/api/client'
  import { auth } from '$lib/stores'
  
  let status = $state<'loading' | 'success' | 'error'>('loading')
  let errorMessage = $state('')
  let isNewPlayer = $state(false)
  
  onMount(async () => {
    const token = $page.url.searchParams.get('token')
    const playerData = $page.url.searchParams.get('player')
    const isNew = $page.url.searchParams.get('isNew')
    const error = $page.url.searchParams.get('error')
    const errorDescription = $page.url.searchParams.get('error_description')
    
    // Check for OAuth errors
    if (error) {
      status = 'error'
      errorMessage = errorDescription || `Authentication failed: ${error}`
      return
    }
    
    if (!token || !playerData) {
      status = 'error'
      errorMessage = 'No authentication data received'
      return
    }
    
    try {
      // Parse player data from URL
      const player = JSON.parse(playerData)
      
      // Store the token
      setAuthToken(token)
      
      // Update auth store
      auth.setPlayer({
        ...player,
        stats: { trades: 0, points: 0, rank: 0 } // Will be fetched on next page
      })
      
      isNewPlayer = isNew === 'true'
      status = 'success'
      
      // Redirect after a brief delay to show success
      setTimeout(() => {
        if (isNewPlayer) {
          // New player - go to their card
          goto('/card')
        } else {
          // Returning player - go to home
          goto('/')
        }
      }, 1500)
      
    } catch (err) {
      console.error('OAuth callback error:', err)
      status = 'error'
      errorMessage = err instanceof Error ? err.message : 'Authentication failed'
    }
  })
</script>

<svelte:head>
  <title>Authenticating... | Seedhunter</title>
</svelte:head>

<div class="callback-page">
  <div class="callback-container">
    {#if status === 'loading'}
      <div class="status-card loading">
        <div class="spinner-large"></div>
        <h2>Connecting to X...</h2>
        <p class="text-muted">Please wait while we verify your account</p>
      </div>
    {:else if status === 'success'}
      <div class="status-card success animate-slide-up">
        <div class="success-icon">✓</div>
        <h2>Welcome{isNewPlayer ? '' : ' back'}!</h2>
        <p class="text-muted">
          {isNewPlayer 
            ? 'Your account is ready. Redirecting to your card...' 
            : 'Good to see you again. Redirecting...'}
        </p>
      </div>
    {:else if status === 'error'}
      <div class="status-card error animate-slide-up">
        <div class="error-icon">✕</div>
        <h2>Authentication Failed</h2>
        <p class="error-message">{errorMessage}</p>
        <a href="/auth/login" class="btn-primary mt-lg">
          Try Again
        </a>
      </div>
    {/if}
  </div>
</div>

<style>
  .callback-page {
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    background: linear-gradient(180deg, var(--color-teal-pale) 0%, var(--color-bg) 100%);
  }
  
  .callback-container {
    width: 100%;
    max-width: 400px;
  }
  
  .status-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    padding: var(--space-2xl);
    text-align: center;
  }
  
  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto var(--space-lg);
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
    margin: 0 auto var(--space-lg);
    box-shadow: 0 8px 20px rgba(46, 204, 113, 0.3);
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
    margin: 0 auto var(--space-lg);
    box-shadow: 0 8px 20px rgba(231, 76, 60, 0.3);
  }
  
  .status-card h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: var(--space-sm);
    color: var(--color-text);
  }
  
  .error-message {
    color: var(--color-error);
    background: rgba(231, 76, 60, 0.1);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    margin-top: var(--space-md);
  }
</style>
