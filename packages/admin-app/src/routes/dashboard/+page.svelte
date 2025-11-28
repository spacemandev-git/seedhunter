<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/index.svelte'
  import { logout } from '$lib/api/client'
  import { stopLocationBroadcast } from '$lib/services/locationService'
  import { LocationToggle, VerifyPlayer, ChatMod } from '$lib/components'

  // Tab state for bottom navigation
  let activeTab = $state<'location' | 'verify' | 'chat'>('verify')

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
</script>

<svelte:head>
  <title>Dashboard | Seedhunter Admin</title>
</svelte:head>

<div class="dashboard">
  <header>
    <h1>🌱 Admin</h1>
    <button class="btn-secondary btn-small" onclick={handleLogout}>Logout</button>
  </header>

  <main>
    {#if activeTab === 'location'}
      <LocationToggle />
    {:else if activeTab === 'verify'}
      <VerifyPlayer />
    {:else if activeTab === 'chat'}
      <ChatMod />
    {/if}
  </main>

  <nav class="bottom-nav">
    <button
      class="nav-item"
      class:active={activeTab === 'location'}
      onclick={() => (activeTab = 'location')}
    >
      <span class="nav-icon">📍</span>
      <span class="nav-label">Location</span>
    </button>
    <button
      class="nav-item"
      class:active={activeTab === 'verify'}
      onclick={() => (activeTab = 'verify')}
    >
      <span class="nav-icon">✓</span>
      <span class="nav-label">Verify</span>
    </button>
    <button
      class="nav-item"
      class:active={activeTab === 'chat'}
      onclick={() => (activeTab = 'chat')}
    >
      <span class="nav-icon">💬</span>
      <span class="nav-label">Chat</span>
    </button>
  </nav>
</div>

<style>
  .dashboard {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    padding-top: calc(var(--safe-top) + var(--space-md));
    padding-bottom: calc(var(--safe-bottom) + 70px);
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 var(--space-md);
    margin-bottom: var(--space-md);
  }

  header h1 {
    font-size: 1.5rem;
    color: var(--color-secondary);
  }

  :global(.btn-small) {
    padding: var(--space-sm) var(--space-md);
    font-size: 0.9rem;
  }

  main {
    flex: 1;
    padding: 0 var(--space-md);
    overflow-y: auto;
  }

  /* Bottom Navigation */
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    background-color: var(--color-bg-secondary);
    border-top: 1px solid var(--color-surface);
    padding-bottom: var(--safe-bottom);
  }

  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-md) var(--space-sm);
    background: none;
    border: none;
    border-radius: 0;
    color: var(--color-text-muted);
    transition: color 150ms;
  }

  .nav-item:active {
    transform: none;
  }

  .nav-item.active {
    color: var(--color-secondary);
  }

  .nav-icon {
    font-size: 1.5rem;
    margin-bottom: var(--space-xs);
  }

  .nav-label {
    font-size: 0.75rem;
    font-weight: 500;
  }
</style>
