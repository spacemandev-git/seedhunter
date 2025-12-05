<script lang="ts">
  import { onMount } from 'svelte'
  import { getTradeHistory } from '$lib/api/client'
  import type { Trade } from '@seedhunter/shared'
  import { auth } from '$lib/stores'
  
  let trades = $state<Trade[]>([])
  let loading = $state(true)
  let error = $state<string | null>(null)
  
  // Fetch founder data client-side
  let foundersData = $state<Record<string, any>>({})
  
  onMount(async () => {
    try {
      // Load founders data
      const response = await fetch('/founders.json')
      foundersData = await response.json()
      
      // Load trade history
      const history = await getTradeHistory()
      trades = history
    } catch (err) {
      console.error('Failed to load trade history:', err)
      error = err instanceof Error ? err.message : 'Failed to load trade history'
    } finally {
      loading = false
    }
  })
  
  function getFounderName(gridIndex: number): string {
    const founder = foundersData[String(gridIndex)]
    return founder ? founder.name : `Founder #${gridIndex}`
  }
  
  function getFounderCompany(gridIndex: number): string {
    const founder = foundersData[String(gridIndex)]
    return founder ? founder.company : 'Unknown'
  }
  
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000)
      return minutes === 0 ? 'Just now' : `${minutes}m ago`
    }
    
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000)
      return `${hours}h ago`
    }
    
    // Less than 7 days
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000)
      return `${days}d ago`
    }
    
    // Format as date
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }
  
  function getTradeDirection(trade: Trade): 'gave' | 'received' {
    const currentHandle = auth.player?.xHandle
    // If you're playerA, you gave gridIndexA and received gridIndexB
    return trade.playerA === currentHandle ? 'gave' : 'received'
  }
  
  function getOtherPlayer(trade: Trade): string {
    const currentHandle = auth.player?.xHandle
    return trade.playerA === currentHandle ? trade.playerB : trade.playerA
  }
  
  function getGaveCard(trade: Trade): { name: string; company: string } {
    const currentHandle = auth.player?.xHandle
    const gridIndex = trade.playerA === currentHandle ? trade.gridIndexA : trade.gridIndexB
    return {
      name: getFounderName(gridIndex),
      company: getFounderCompany(gridIndex)
    }
  }
  
  function getReceivedCard(trade: Trade): { name: string; company: string } {
    const currentHandle = auth.player?.xHandle
    const gridIndex = trade.playerA === currentHandle ? trade.gridIndexB : trade.gridIndexA
    return {
      name: getFounderName(gridIndex),
      company: getFounderCompany(gridIndex)
    }
  }
</script>

<div class="trade-history">
  <div class="section-header">
    <h2>Trade History</h2>
    <span class="trade-count">{trades.length} {trades.length === 1 ? 'trade' : 'trades'}</span>
  </div>
  
  {#if loading}
    <div class="loading-state">
      <div class="spinner"></div>
      <p>Loading trade history...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <div class="error-icon">⚠️</div>
      <p>{error}</p>
    </div>
  {:else if trades.length === 0}
    <div class="empty-state">
      <div class="empty-icon">🔄</div>
      <h3>No trades yet</h3>
      <p>Your trade history will appear here once you complete your first trade</p>
    </div>
  {:else}
    <div class="trades-list">
      {#each trades as trade (trade.id)}
        {@const gave = getGaveCard(trade)}
        {@const received = getReceivedCard(trade)}
        {@const otherPlayer = getOtherPlayer(trade)}
        
        <div class="trade-item">
          <div class="trade-header">
            <span class="other-player">@{otherPlayer}</span>
            <span class="trade-time">{formatDate(trade.timestamp)}</span>
          </div>
          
          <div class="trade-details">
            <div class="trade-card gave">
              <span class="card-label">Gave</span>
              <span class="card-name">{gave.name}</span>
              <span class="card-company">{gave.company}</span>
            </div>
            
            <div class="trade-arrow">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M7 16V4M7 4L3 8M7 4l4 4" />
                <path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            </div>
            
            <div class="trade-card received">
              <span class="card-label">Received</span>
              <span class="card-name">{received.name}</span>
              <span class="card-company">{received.company}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .trade-history {
    width: 100%;
    max-width: 600px;
    margin: 0 auto;
  }
  
  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) 0;
    border-bottom: 2px solid var(--color-border);
    margin-bottom: var(--space-md);
  }
  
  .section-header h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }
  
  .trade-count {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    background: var(--color-bg-secondary);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-md);
  }
  
  /* States */
  .loading-state,
  .error-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    text-align: center;
  }
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--space-md);
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  
  .loading-state p,
  .error-state p {
    color: var(--color-text-muted);
    margin: 0;
  }
  
  .error-icon {
    font-size: 3rem;
    margin-bottom: var(--space-sm);
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--space-md);
  }
  
  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 var(--space-xs) 0;
  }
  
  .empty-state p {
    color: var(--color-text-muted);
    max-width: 300px;
    line-height: 1.5;
  }
  
  /* Trades list */
  .trades-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .trade-item {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-md);
    box-shadow: var(--shadow-card);
    transition: transform var(--transition-fast), box-shadow var(--transition-fast);
  }
  
  .trade-item:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-card-hover);
  }
  
  .trade-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--space-sm);
    padding-bottom: var(--space-xs);
    border-bottom: 1px solid var(--color-border);
  }
  
  .other-player {
    font-weight: 600;
    color: var(--color-primary);
    font-size: 0.9rem;
  }
  
  .trade-time {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  
  /* Trade details */
  .trade-details {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: var(--space-md);
  }
  
  .trade-card {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  
  .card-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-muted);
    font-weight: 600;
  }
  
  .card-name {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
  }
  
  .card-company {
    font-size: 0.75rem;
    color: var(--color-text-secondary);
  }
  
  .trade-card.gave {
    text-align: left;
  }
  
  .trade-card.received {
    text-align: right;
  }
  
  .trade-arrow {
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-primary);
    opacity: 0.6;
  }
  
  .trade-arrow svg {
    width: 24px;
    height: 24px;
  }
  
  /* Responsive */
  @media (max-width: 480px) {
    .trade-details {
      grid-template-columns: 1fr;
      gap: var(--space-sm);
    }
    
    .trade-card.gave,
    .trade-card.received {
      text-align: left;
    }
    
    .trade-arrow {
      transform: rotate(90deg);
      margin: var(--space-xs) 0;
    }
    
    .trade-card {
      padding: var(--space-sm);
      background: var(--color-bg-secondary);
      border-radius: var(--radius-md);
    }
  }
</style>
