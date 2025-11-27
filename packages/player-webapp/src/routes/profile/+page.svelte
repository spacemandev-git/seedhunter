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
</script>

<svelte:head>
  <title>Profile | Seedhunter</title>
</svelte:head>

<div class="container">
  {#if auth.loading}
    <div class="loading text-center">
      <p>Loading profile...</p>
    </div>
  {:else if !auth.isLoggedIn}
    <div class="not-logged-in text-center">
      <h2>Connect to view your profile</h2>
      <a href="/api/auth/x" class="btn-primary mt-md">Connect with X</a>
    </div>
  {:else}
    <div class="profile-page">
      <h1>Your Profile</h1>
      
      <div class="profile-card">
        <div class="profile-header">
          <div class="avatar">
            <!-- Profile pic or placeholder -->
            <span>👤</span>
          </div>
          <div class="profile-info">
            <h2>@{auth.player?.xHandle}</h2>
            {#if auth.player?.verified}
              <span class="verified-badge">✓ Verified</span>
            {:else}
              <span class="unverified-badge">Not Verified</span>
            {/if}
          </div>
        </div>
        
        <div class="profile-stats">
          <div class="stat">
            <span class="stat-value">{auth.player?.stats.trades ?? 0}</span>
            <span class="stat-label">Total Trades</span>
          </div>
          <div class="stat">
            <span class="stat-value">{auth.player?.stats.points ?? 0}</span>
            <span class="stat-label">Points</span>
          </div>
          <div class="stat">
            <span class="stat-value">#{auth.player?.stats.rank ?? '-'}</span>
            <span class="stat-label">Leaderboard Rank</span>
          </div>
        </div>
      </div>
      
      <div class="verification-section">
        <h3>Get Verified</h3>
        <p class="text-muted mb-md">
          Show this QR code to an admin at the event to verify your account.
          Verified trades earn you points!
        </p>
        
        <div class="qr-container">
          <div class="qr-code">
            <!-- QR code showing X handle -->
            <div class="qr-placeholder">
              <p>@{auth.player?.xHandle}</p>
              <p class="text-muted">QR Code</p>
            </div>
          </div>
          <p class="qr-hint">Find an admin on the <a href="/map">Map</a></p>
        </div>
      </div>
      
      <div class="actions mt-lg">
        <button class="btn-secondary" onclick={() => {
          // TODO: Implement logout
          auth.logout()
          goto('/')
        }}>
          Logout
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .profile-page {
    max-width: 600px;
    margin: 0 auto;
  }
  
  h1 {
    margin-bottom: var(--space-lg);
  }
  
  .profile-card {
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    margin-bottom: var(--space-xl);
  }
  
  .profile-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  
  .avatar {
    width: 80px;
    height: 80px;
    border-radius: var(--radius-full);
    background-color: var(--color-surface);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
  }
  
  .profile-info h2 {
    color: var(--color-primary);
    margin-bottom: var(--space-xs);
  }
  
  .verified-badge {
    background-color: var(--color-success);
    color: white;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-full);
    font-size: 0.85rem;
  }
  
  .unverified-badge {
    background-color: var(--color-text-muted);
    color: white;
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-full);
    font-size: 0.85rem;
  }
  
  .profile-stats {
    display: flex;
    justify-content: space-around;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-surface);
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
    font-size: 0.85rem;
  }
  
  .verification-section {
    background-color: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
    text-align: center;
  }
  
  .verification-section h3 {
    margin-bottom: var(--space-sm);
  }
  
  .qr-container {
    margin-top: var(--space-lg);
  }
  
  .qr-code {
    display: inline-block;
  }
  
  .qr-placeholder {
    width: 200px;
    height: 200px;
    background-color: white;
    border-radius: var(--radius-md);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-bg);
    font-weight: bold;
  }
  
  .qr-hint {
    margin-top: var(--space-md);
    color: var(--color-text-muted);
  }
  
  .actions {
    text-align: center;
  }
</style>
