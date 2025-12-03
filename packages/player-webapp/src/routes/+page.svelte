<script lang="ts">
  import { onMount } from 'svelte'
  import { leaderboard, auth } from '$lib/stores'
  import GameRulesCard from '$lib/components/GameRulesCard.svelte'
  
  let isRefreshing = $state(false)
  
  onMount(() => {
    leaderboard.fetch()
  })
  
  async function refresh() {
    isRefreshing = true
    await leaderboard.fetch()
    isRefreshing = false
  }
</script>

<svelte:head>
  <title>Leaderboard | Seedhunter</title>
</svelte:head>

<div class="page">
  <div class="container">
    <!-- Header -->
    <div class="page-header">
      <div class="header-content">
        <h1>Leaderboard</h1>
        <p class="subtitle">Top traders at the event</p>
      </div>
      <button 
        class="btn-refresh" 
        onclick={refresh} 
        disabled={leaderboard.loading || isRefreshing}
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
    
    <!-- Game Rules & Prize Pool -->
    <GameRulesCard />
    
    {#if leaderboard.error}
      <div class="error-card animate-fade-in">
        <div class="error-icon">⚠️</div>
        <p>{leaderboard.error}</p>
        <button class="btn-secondary mt-md" onclick={refresh}>Try Again</button>
      </div>
    {:else if leaderboard.loading && leaderboard.entries.length === 0}
      <!-- Skeleton loading -->
      <div class="leaderboard-card">
        {#each [1, 2, 3, 4, 5] as _}
          <div class="entry-row skeleton">
            <div class="rank-badge skeleton-badge"></div>
            <div class="player-info">
              <div class="skeleton-line w-32"></div>
              <div class="skeleton-line w-16 small"></div>
            </div>
            <div class="stats">
              <div class="skeleton-line w-12"></div>
            </div>
          </div>
        {/each}
      </div>
    {:else if leaderboard.entries.length === 0}
      <div class="empty-state animate-fade-in">
        <div class="empty-icon">🏆</div>
        <h3>No Rankings Yet</h3>
        <p>Be the first to get verified and climb the leaderboard!</p>
        {#if !auth.isLoggedIn}
          <a href="/auth/login" class="btn-primary mt-lg">Join the Hunt</a>
        {/if}
      </div>
    {:else}
      <div class="leaderboard-card animate-fade-in">
        {#each leaderboard.entries as entry, index}
          <a 
            href="/players/{entry.xHandle}" 
            class="entry-row"
            class:highlight={auth.player?.xHandle === entry.xHandle}
            class:is-you={auth.player?.xHandle === entry.xHandle}
            style="animation-delay: {index * 30}ms"
          >
            <!-- Rank -->
            <div class="rank-badge" class:gold={entry.rank === 1} class:silver={entry.rank === 2} class:bronze={entry.rank === 3}>
              {#if entry.rank === 1}
                <span class="medal">🥇</span>
              {:else if entry.rank === 2}
                <span class="medal">🥈</span>
              {:else if entry.rank === 3}
                <span class="medal">🥉</span>
              {:else}
                <span class="rank-number">{entry.rank}</span>
              {/if}
            </div>
            
            <!-- Player info -->
            <div class="player-info">
              <div class="handle-row">
                <span class="handle">@{entry.xHandle}</span>
                {#if entry.verified}
                  <span class="verified-badge" title="Verified">✓</span>
                {/if}
                {#if auth.player?.xHandle === entry.xHandle}
                  <span class="you-badge">You</span>
                {/if}
              </div>
              <div class="trade-count">
                {Math.floor(entry.trades / 2)} trade{Math.floor(entry.trades / 2) !== 1 ? 's' : ''}
              </div>
            </div>
            
            <!-- Points -->
            <div class="points-badge">
              <span class="points-value">{entry.points}</span>
              <span class="points-label">pts</span>
            </div>
          </a>
        {/each}
      </div>
      
      <div class="footer-info">
        <p>Showing {leaderboard.entries.length} of {leaderboard.total} players</p>
      </div>
    {/if}
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
    margin-bottom: var(--space-lg);
  }
  
  .header-content h1 {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 2px;
  }
  
  .subtitle {
    font-size: 0.9rem;
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
  
  .btn-refresh:disabled {
    opacity: 0.5;
  }
  
  .refresh-icon {
    width: 20px;
    height: 20px;
  }
  
  .refresh-icon.spinning {
    animation: spin 0.8s linear infinite;
  }
  
  /* Leaderboard card */
  .leaderboard-card {
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    overflow: hidden;
  }
  
  .entry-row {
    display: flex;
    align-items: center;
    padding: var(--space-md);
    gap: var(--space-md);
    text-decoration: none;
    color: inherit;
    transition: background-color var(--transition-fast);
    animation: slideUp var(--transition-normal) ease-out both;
  }
  
  .entry-row:not(:last-child) {
    border-bottom: 1px solid var(--color-border-light);
  }
  
  .entry-row:hover {
    background-color: var(--color-bg-secondary);
  }
  
  .entry-row.highlight {
    background-color: var(--color-primary-light);
  }
  
  .entry-row.highlight:hover {
    background-color: var(--color-teal-pale);
  }
  
  /* Rank badge */
  .rank-badge {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-md);
    background: var(--color-bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .rank-badge.gold {
    background: linear-gradient(135deg, #FFD700, #FFA500);
  }
  
  .rank-badge.silver {
    background: linear-gradient(135deg, #E8E8E8, #B8B8B8);
  }
  
  .rank-badge.bronze {
    background: linear-gradient(135deg, #CD7F32, #8B4513);
  }
  
  .medal {
    font-size: 1.25rem;
  }
  
  .rank-number {
    font-weight: 700;
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  
  /* Player info */
  .player-info {
    flex: 1;
    min-width: 0;
  }
  
  .handle-row {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    flex-wrap: wrap;
  }
  
  .handle {
    font-weight: 600;
    color: var(--color-text);
    font-size: 0.95rem;
  }
  
  .verified-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 16px;
    height: 16px;
    background: var(--color-success);
    color: white;
    border-radius: 50%;
    font-size: 0.6rem;
    font-weight: bold;
  }
  
  .you-badge {
    background: var(--color-primary-light);
    color: var(--color-primary);
    font-size: 0.7rem;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: var(--radius-full);
  }
  
  .trade-count {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
  
  /* Points */
  .points-badge {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    flex-shrink: 0;
  }
  
  .points-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }
  
  .points-label {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
  }
  
  /* Skeleton loading */
  .skeleton {
    pointer-events: none;
  }
  
  .skeleton-badge {
    width: 40px;
    height: 40px;
    background: linear-gradient(90deg, var(--color-border-light) 25%, var(--color-bg-secondary) 50%, var(--color-border-light) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-md);
  }
  
  .skeleton-line {
    height: 16px;
    background: linear-gradient(90deg, var(--color-border-light) 25%, var(--color-bg-secondary) 50%, var(--color-border-light) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: var(--radius-sm);
  }
  
  .skeleton-line.small {
    height: 12px;
    margin-top: 4px;
  }
  
  .w-32 { width: 128px; }
  .w-16 { width: 64px; }
  .w-12 { width: 48px; }
  
  @keyframes shimmer {
    0% { background-position: -200% 0; }
    100% { background-position: 200% 0; }
  }
  
  /* Empty state */
  .empty-state {
    text-align: center;
    padding: var(--space-2xl) var(--space-lg);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
  }
  
  .empty-icon {
    font-size: 4rem;
    margin-bottom: var(--space-md);
  }
  
  .empty-state h3 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--space-sm);
  }
  
  .empty-state p {
    color: var(--color-text-muted);
  }
  
  /* Error state */
  .error-card {
    text-align: center;
    padding: var(--space-xl);
    background: var(--color-surface);
    border-radius: var(--radius-lg);
    border: 2px solid var(--color-error);
  }
  
  .error-icon {
    font-size: 2.5rem;
    margin-bottom: var(--space-md);
  }
  
  .error-card p {
    color: var(--color-error);
  }
  
  /* Footer */
  .footer-info {
    text-align: center;
    padding: var(--space-md);
  }
  
  .footer-info p {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
