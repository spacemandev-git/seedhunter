<script lang="ts">
  import { auth } from '$lib/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  
  // Redirect if not logged in
  onMount(() => {
    if (!auth.loading && !auth.isLoggedIn) {
      goto('/')
    }
  })
  
  let showTradeModal = $state(false)
</script>

<svelte:head>
  <title>My Card | Seedhunter</title>
</svelte:head>

<div class="container">
  {#if auth.loading}
    <div class="loading">
      <p>Loading your card...</p>
    </div>
  {:else if !auth.isLoggedIn}
    <div class="not-logged-in">
      <h2>Connect to view your card</h2>
      <a href="/api/auth/x" class="btn-primary">Connect with X</a>
    </div>
  {:else}
    <div class="card-page">
      <div class="card-container">
        <!-- Card will be rendered here -->
        <div class="founder-card">
          <div class="card-inner">
            <div class="card-image">
              <!-- Placeholder for card image -->
              <div class="placeholder">
                <span>🎴</span>
              </div>
            </div>
            <div class="card-info">
              <h2 class="founder-name">Founder Name</h2>
              <p class="company">Company</p>
              <p class="owner">Owned by @{auth.player?.xHandle}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div class="card-actions">
        <button class="btn-primary trade-btn" onclick={() => showTradeModal = true}>
          🔄 Trade Card
        </button>
        
        <div class="stats">
          <div class="stat">
            <span class="stat-value">{auth.player?.stats.trades ?? 0}</span>
            <span class="stat-label">Trades</span>
          </div>
          <div class="stat">
            <span class="stat-value">{auth.player?.stats.points ?? 0}</span>
            <span class="stat-label">Points</span>
          </div>
          <div class="stat">
            <span class="stat-value">#{auth.player?.stats.rank ?? '-'}</span>
            <span class="stat-label">Rank</span>
          </div>
        </div>
      </div>
    </div>
    
    {#if showTradeModal}
      <div class="modal-overlay" onclick={() => showTradeModal = false}>
        <div class="modal" onclick={(e) => e.stopPropagation()}>
          <h3>Trade Your Card</h3>
          <p class="text-muted">Show this QR code to another player to trade cards.</p>
          
          <div class="qr-container">
            <!-- QR code will be generated here -->
            <div class="qr-placeholder">
              <p>QR Code</p>
              <p class="text-muted">Implementation pending</p>
            </div>
          </div>
          
          <div class="modal-actions">
            <button class="btn-secondary" onclick={() => showTradeModal = false}>
              Close
            </button>
            <button class="btn-primary">
              📷 Scan QR Instead
            </button>
          </div>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .card-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-xl);
  }
  
  .founder-card {
    width: 300px;
    height: 420px;
    perspective: 1000px;
  }
  
  .card-inner {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, var(--color-surface), var(--color-bg-secondary));
    border-radius: var(--radius-lg);
    border: 3px solid var(--color-secondary);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }
  
  .card-image {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--color-bg);
  }
  
  .placeholder {
    font-size: 6rem;
  }
  
  .card-info {
    padding: var(--space-md);
    text-align: center;
    background-color: var(--color-bg-secondary);
  }
  
  .founder-name {
    font-size: 1.2rem;
    margin-bottom: var(--space-xs);
  }
  
  .company {
    color: var(--color-secondary);
    margin-bottom: var(--space-xs);
  }
  
  .owner {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  
  .card-actions {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-lg);
  }
  
  .trade-btn {
    font-size: 1.2rem;
    padding: var(--space-md) var(--space-xl);
  }
  
  .stats {
    display: flex;
    gap: var(--space-xl);
  }
  
  .stat {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-secondary);
  }
  
  .stat-label {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  
  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }
  
  .modal {
    background-color: var(--color-bg-secondary);
    padding: var(--space-xl);
    border-radius: var(--radius-lg);
    max-width: 400px;
    width: 90%;
    text-align: center;
  }
  
  .modal h3 {
    margin-bottom: var(--space-sm);
  }
  
  .qr-container {
    margin: var(--space-lg) 0;
  }
  
  .qr-placeholder {
    width: 200px;
    height: 200px;
    margin: 0 auto;
    background-color: white;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-bg);
  }
  
  .modal-actions {
    display: flex;
    gap: var(--space-md);
    justify-content: center;
  }
  
  .loading, .not-logged-in {
    text-align: center;
    padding: var(--space-xl);
  }
</style>
