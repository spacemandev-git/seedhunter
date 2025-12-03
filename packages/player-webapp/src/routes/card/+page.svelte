<script lang="ts">
  import { auth, tradeStore } from '$lib/stores'
  import { getPlayerProject } from '$lib/api/client'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import type { GridProject, Trade } from '@seedhunter/shared'
  import FounderCard from '$lib/components/FounderCard.svelte'
  import TradeModal from '$lib/components/TradeModal.svelte'
  
  let project = $state<GridProject | null>(null)
  let loading = $state(true)
  let showTradeModal = $state(false)
  
  onMount(async () => {
    // Redirect if not logged in
    if (!auth.loading && !auth.isLoggedIn) {
      goto('/auth/login')
      return
    }
    
    // Wait for auth to load
    if (auth.loading) {
      const checkAuth = setInterval(() => {
        if (!auth.loading) {
          clearInterval(checkAuth)
          if (!auth.isLoggedIn) {
            goto('/auth/login')
          } else {
            loadProject()
          }
        }
      }, 100)
    } else {
      loadProject()
    }
  })
  
  async function loadProject() {
    if (!auth.player?.xHandle) return
    
    try {
      project = await getPlayerProject(auth.player.xHandle)
    } catch (err) {
      console.error('Failed to load project:', err)
    } finally {
      loading = false
    }
  }
  
  function handleTradeComplete(result: { trade: Trade; newProject: GridProject }) {
    // Reload the project after trade completes
    loadProject()
    tradeStore.addTrade(result.trade)
    showTradeModal = false
    
    // Refresh player stats
    auth.init()
  }
</script>

<svelte:head>
  <title>My Card | Seedhunter</title>
</svelte:head>

<div class="page">
  <div class="container">
    {#if auth.loading || loading}
      <div class="loading-state">
        <div class="spinner-large"></div>
        <p>Loading your card...</p>
      </div>
    {:else if !auth.isLoggedIn}
      <div class="auth-prompt">
        <div class="prompt-icon">🎴</div>
        <h2>Connect to Get Your Card</h2>
        <p>Sign in with X to receive your random founder trading card and start trading!</p>
        <a href="/auth/login" class="btn-primary btn-large mt-lg">Connect with X</a>
      </div>
    {:else}
      <div class="card-page">
        <!-- Page header -->
        <div class="page-header">
          <h1>My Card</h1>
          <p class="subtitle">Tap card to see stats</p>
        </div>
        
        <!-- Card display -->
        <div class="card-container">
          <FounderCard 
            {project}
            ownerHandle={auth.player?.xHandle}
            isOwn={true}
            tradeCount={Math.floor((auth.player?.stats.trades ?? 0) / 2)}
            points={auth.player?.stats.points ?? 0}
            size="large"
            flippable={true}
          />
        </div>
        
        <!-- Trade button -->
        <button 
          class="btn-primary btn-large trade-btn" 
          onclick={() => showTradeModal = true}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="trade-icon">
            <path d="M7 16V4M7 4L3 8M7 4l4 4" />
            <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          Trade Card
        </button>
        
        <!-- Stats cards -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-icon">🔄</span>
            <div class="stat-content">
              <span class="stat-value">{Math.floor((auth.player?.stats.trades ?? 0) / 2)}</span>
              <span class="stat-label">Total Trades</span>
            </div>
          </div>
          
          <div class="stat-card">
            <span class="stat-icon">⭐</span>
            <div class="stat-content">
              <span class="stat-value">{auth.player?.stats.points ?? 0}</span>
              <span class="stat-label">Points</span>
            </div>
          </div>
          
          <div class="stat-card">
            <span class="stat-icon">🏆</span>
            <div class="stat-content">
              <span class="stat-value">#{auth.player?.stats.rank ?? '-'}</span>
              <span class="stat-label">Rank</span>
            </div>
          </div>
        </div>
        
        <!-- Verification status -->
        {#if !auth.player?.verified}
          <div class="verification-prompt">
            <div class="prompt-content">
              <span class="prompt-icon-small">✅</span>
              <div class="prompt-text">
                <strong>Get Verified to Earn Points</strong>
                <span>Find an admin and show them your profile QR</span>
              </div>
            </div>
            <a href="/profile" class="btn-secondary">Show QR</a>
          </div>
        {:else}
          <div class="verified-status">
            <span class="verified-icon">✓</span>
            <span>You're verified! Your trades count toward points.</span>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<TradeModal 
  open={showTradeModal}
  onClose={() => showTradeModal = false}
  onTradeComplete={handleTradeComplete}
/>

<style>
  .page {
    padding: var(--space-md) 0 var(--space-xl);
  }
  
  .card-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
  }
  
  .page-header {
    text-align: center;
    margin-bottom: var(--space-sm);
  }
  
  .page-header h1 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 2px;
  }
  
  .subtitle {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  
  /* Card container */
  .card-container {
    margin: var(--space-sm) 0;
  }
  
  /* Trade button */
  .trade-btn {
    width: 100%;
    max-width: 320px;
    padding: var(--space-md) var(--space-xl);
    font-size: 1.1rem;
  }
  
  .trade-icon {
    width: 24px;
    height: 24px;
  }
  
  /* Stats row */
  .stats-row {
    display: flex;
    gap: var(--space-md);
    width: 100%;
    max-width: 400px;
  }
  
  .stat-card {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--space-md);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
  }
  
  .stat-icon {
    font-size: 1.5rem;
    margin-bottom: var(--space-xs);
  }
  
  .stat-content {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }
  
  .stat-label {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    margin-top: 2px;
  }
  
  /* Verification prompt */
  .verification-prompt {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
    width: 100%;
    max-width: 400px;
    padding: var(--space-md);
    background: var(--color-surface);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
  }
  
  .prompt-content {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .prompt-icon-small {
    font-size: 1.5rem;
  }
  
  .prompt-text {
    display: flex;
    flex-direction: column;
  }
  
  .prompt-text strong {
    font-size: 0.9rem;
    color: var(--color-text);
  }
  
  .prompt-text span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .verified-status {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-md);
    background: rgba(46, 204, 113, 0.1);
    border-radius: var(--radius-lg);
    color: var(--color-success);
    font-size: 0.9rem;
    width: 100%;
    max-width: 400px;
  }
  
  .verified-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background: var(--color-success);
    color: white;
    border-radius: 50%;
    font-size: 0.8rem;
    font-weight: bold;
  }
  
  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    color: var(--color-text-muted);
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
  
  /* Auth prompt */
  .auth-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-2xl) var(--space-lg);
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }
  
  .prompt-icon {
    font-size: 4rem;
    margin-bottom: var(--space-md);
  }
  
  .auth-prompt h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--space-sm);
  }
  
  .auth-prompt p {
    color: var(--color-text-muted);
    max-width: 280px;
    line-height: 1.6;
  }
  
  /* Responsive */
  @media (max-width: 360px) {
    .stats-row {
      flex-direction: column;
    }
    
    .stat-card {
      flex-direction: row;
      justify-content: flex-start;
      gap: var(--space-md);
    }
    
    .stat-content {
      align-items: flex-start;
    }
  }
</style>
