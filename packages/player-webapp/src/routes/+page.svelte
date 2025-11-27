<script lang="ts">
  import { onMount } from 'svelte'
  import { leaderboard, auth } from '$lib/stores'
  
  onMount(() => {
    leaderboard.fetch()
  })
  
  function refresh() {
    leaderboard.fetch()
  }
</script>

<svelte:head>
  <title>Leaderboard | Seedhunter</title>
</svelte:head>

<div class="container">
  <div class="header">
    <h1>🏆 Leaderboard</h1>
    <button class="btn-secondary" onclick={refresh} disabled={leaderboard.loading}>
      {leaderboard.loading ? 'Loading...' : 'Refresh'}
    </button>
  </div>
  
  {#if leaderboard.error}
    <div class="error">
      <p>Failed to load leaderboard: {leaderboard.error}</p>
    </div>
  {:else if leaderboard.entries.length === 0 && !leaderboard.loading}
    <div class="empty">
      <p>No verified players yet. Be the first!</p>
    </div>
  {:else}
    <div class="leaderboard">
      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Points</th>
            <th>Trades</th>
          </tr>
        </thead>
        <tbody>
          {#each leaderboard.entries as entry}
            <tr class:highlight={auth.player?.xHandle === entry.xHandle}>
              <td class="rank">
                {#if entry.rank === 1}🥇
                {:else if entry.rank === 2}🥈
                {:else if entry.rank === 3}🥉
                {:else}#{entry.rank}
                {/if}
              </td>
              <td class="handle">
                <a href="/players/{entry.xHandle}">@{entry.xHandle}</a>
                {#if entry.verified}
                  <span class="verified" title="Verified">✓</span>
                {/if}
              </td>
              <td class="points">{entry.points}</td>
              <td class="trades">{entry.trades}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    
    <div class="pagination text-center mt-md">
      <p class="text-muted">
        Showing {leaderboard.entries.length} of {leaderboard.total} verified players
      </p>
    </div>
  {/if}
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-lg);
  }
  
  h1 {
    font-size: 2rem;
  }
  
  .leaderboard {
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  th, td {
    padding: var(--space-md);
    text-align: left;
  }
  
  th {
    background-color: var(--color-surface);
    font-weight: 600;
    text-transform: uppercase;
    font-size: 0.85rem;
    letter-spacing: 0.05em;
  }
  
  tr:not(:last-child) td {
    border-bottom: 1px solid var(--color-surface);
  }
  
  tr.highlight {
    background-color: rgba(233, 69, 96, 0.1);
  }
  
  .rank {
    font-size: 1.2rem;
    width: 80px;
  }
  
  .handle a {
    font-weight: 500;
  }
  
  .verified {
    color: var(--color-success);
    margin-left: var(--space-xs);
  }
  
  .points {
    color: var(--color-secondary);
    font-weight: bold;
  }
  
  .trades {
    color: var(--color-text-muted);
  }
  
  .error {
    background-color: rgba(231, 76, 60, 0.1);
    border: 1px solid var(--color-error);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    color: var(--color-error);
  }
  
  .empty {
    text-align: center;
    padding: var(--space-xl);
    color: var(--color-text-muted);
  }
  
  @media (max-width: 600px) {
    th, td {
      padding: var(--space-sm);
    }
    
    .trades {
      display: none;
    }
  }
</style>
