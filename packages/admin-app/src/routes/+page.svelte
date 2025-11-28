<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { auth } from '$lib/stores/index.svelte'
  import { login } from '$lib/api/client'
  
  let username = $state('')
  let password = $state('')
  let loading = $state(false)
  let error = $state('')
  
  // Redirect if already logged in
  onMount(() => {
    if (!auth.loading && auth.isLoggedIn) {
      goto('/dashboard')
    }
  })
  
  // Watch for auth changes
  $effect(() => {
    if (!auth.loading && auth.isLoggedIn) {
      goto('/dashboard')
    }
  })
  
  async function handleLogin() {
    if (!username.trim() || !password.trim()) {
      error = 'Please enter username and password'
      return
    }
    
    loading = true
    error = ''
    
    try {
      console.log('[Login] Starting login attempt...')
      console.log('[Login] API URL from env:', import.meta.env.VITE_API_URL)
      const session = await login(username, password)
      console.log('[Login] Success:', session)
      auth.setAdmin(session.admin as any, session.token)
      goto('/dashboard')
    } catch (err) {
      console.error('[Login] Error caught:', err)
      console.error('[Login] Error type:', err?.constructor?.name)
      console.error('[Login] Error message:', err instanceof Error ? err.message : String(err))
      if (err instanceof TypeError) {
        console.error('[Login] TypeError - likely network/CORS issue')
      }
      error = err instanceof Error ? err.message : 'Login failed'
    } finally {
      loading = false
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      handleLogin()
    }
  }
</script>

<svelte:head>
  <title>Login | Seedhunter Admin</title>
</svelte:head>

<div class="login-page">
  <div class="login-container">
    <div class="logo">
      <span class="emoji">🌱</span>
      <h1>Seedhunter</h1>
      <p class="subtitle">Admin Portal</p>
    </div>
    
    <form class="login-form" onsubmit={(e) => { e.preventDefault(); handleLogin() }}>
      {#if error}
        <div class="error-message">
          {error}
        </div>
      {/if}
      
      <div class="input-group">
        <label for="username">Username</label>
        <input
          id="username"
          type="text"
          bind:value={username}
          placeholder="Enter username"
          disabled={loading}
          autocomplete="username"
          onkeydown={handleKeydown}
        />
      </div>
      
      <div class="input-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          bind:value={password}
          placeholder="Enter password"
          disabled={loading}
          autocomplete="current-password"
          onkeydown={handleKeydown}
        />
      </div>
      
      <button type="submit" class="btn-primary btn-large" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>
    </form>
    
    <p class="footer-text text-muted">
      Admin access only • Breakpoint Conference
    </p>
  </div>
</div>

<style>
  .login-page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
  }
  
  .login-container {
    width: 100%;
    max-width: 360px;
  }
  
  .logo {
    text-align: center;
    margin-bottom: var(--space-xl);
  }
  
  .emoji {
    font-size: 4rem;
    display: block;
    margin-bottom: var(--space-sm);
  }
  
  .logo h1 {
    font-size: 2rem;
    color: var(--color-secondary);
    margin-bottom: var(--space-xs);
  }
  
  .subtitle {
    color: var(--color-text-muted);
  }
  
  .login-form {
    background-color: var(--color-bg-secondary);
    border: 1px solid var(--color-surface);
    border-radius: var(--radius-lg);
    padding: var(--space-xl);
  }
  
  .error-message {
    background-color: rgba(248, 81, 73, 0.1);
    border: 1px solid var(--color-error);
    color: var(--color-error);
    padding: var(--space-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-lg);
    text-align: center;
  }
  
  .input-group {
    margin-bottom: var(--space-lg);
  }
  
  .input-group label {
    display: block;
    margin-bottom: var(--space-xs);
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
  
  button[type="submit"] {
    width: 100%;
    margin-top: var(--space-md);
  }
  
  .footer-text {
    text-align: center;
    margin-top: var(--space-lg);
    font-size: 0.85rem;
  }
</style>
