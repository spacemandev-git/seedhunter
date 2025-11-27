<script lang="ts">
  import { onMount } from 'svelte'
  import { auth } from '$lib/stores'
  import '../app.css'
  
  let { children } = $props()
  
  onMount(() => {
    auth.init()
  })
</script>

<div class="app">
  <header>
    <nav class="container">
      <a href="/" class="logo">🌱 Seedhunter</a>
      
      <div class="nav-links">
        <a href="/">Leaderboard</a>
        <a href="/map">Map</a>
        {#if auth.isLoggedIn}
          <a href="/card">My Card</a>
          <a href="/profile">Profile</a>
        {/if}
      </div>
      
      <div class="auth-area">
        {#if auth.loading}
          <span class="text-muted">Loading...</span>
        {:else if auth.isLoggedIn}
          <span class="handle">@{auth.player?.xHandle}</span>
        {:else}
          <a href="/api/auth/x" class="btn-primary">Connect with X</a>
        {/if}
      </div>
    </nav>
  </header>
  
  <main>
    {@render children()}
  </main>
  
  <footer>
    <div class="container">
      <p class="text-muted text-center">
        Seedhunter by Seedplex • Breakpoint Conference
      </p>
    </div>
  </footer>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  
  header {
    background-color: var(--color-bg-secondary);
    border-bottom: 1px solid var(--color-surface);
    padding: var(--space-md) 0;
  }
  
  header nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-md);
  }
  
  .logo {
    font-size: 1.5rem;
    font-weight: bold;
    color: var(--color-secondary);
  }
  
  .logo:hover {
    text-decoration: none;
  }
  
  .nav-links {
    display: flex;
    gap: var(--space-md);
  }
  
  .nav-links a {
    color: var(--color-text);
    padding: var(--space-xs) var(--space-sm);
    border-radius: var(--radius-sm);
  }
  
  .nav-links a:hover {
    background-color: var(--color-surface);
    text-decoration: none;
  }
  
  .auth-area {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
  }
  
  .handle {
    color: var(--color-primary);
    font-weight: 500;
  }
  
  main {
    flex: 1;
    padding: var(--space-lg) 0;
  }
  
  footer {
    padding: var(--space-lg) 0;
    border-top: 1px solid var(--color-surface);
  }
  
  @media (max-width: 768px) {
    header nav {
      flex-wrap: wrap;
    }
    
    .nav-links {
      order: 3;
      width: 100%;
      justify-content: center;
      margin-top: var(--space-sm);
    }
  }
</style>
