<script lang="ts">
  import { loginWithX } from '$lib/api/client'
  import { auth } from '$lib/stores'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  
  let isLoading = $state(false)
  
  onMount(() => {
    // If already logged in, redirect to home
    if (auth.isLoggedIn) {
      goto('/')
    }
  })
  
  function handleLogin(event: Event) {
    event.preventDefault()
    isLoading = true
    loginWithX()
  }
</script>

<svelte:head>
  <title>Connect | Seedhunter</title>
</svelte:head>

<div class="login-page">
  <div class="login-container">
    <!-- Logo and branding -->
    <div class="branding">
      <img src="/Seedplex Logo.png" alt="Seedplex" class="logo" />
      <h1>Seedhunter</h1>
      <p class="tagline">Trade founder cards. Climb the leaderboard.</p>
    </div>
    
    <!-- Login card -->
    <div class="login-card">
      <div class="card-content">
        <h2>Join the Hunt</h2>
        <p class="description">
          Connect with X to get your founder trading card and start trading with other players at the event.
        </p>
        
        <button 
          type="button"
          class="btn-x" 
          onclick={handleLogin}
          disabled={isLoading}
        >
          {#if isLoading}
            <div class="spinner"></div>
            <span>Connecting...</span>
          {:else}
            <svg class="x-icon" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
            </svg>
            <span>Connect with X</span>
          {/if}
        </button>
        
        <p class="terms">
          By connecting, you agree to participate in the Seedhunter trading game.
        </p>
      </div>
    </div>
    
    <!-- How it works -->
    <div class="how-it-works">
      <h3>How it works</h3>
      <div class="steps">
        <div class="step">
          <div class="step-icon">🎴</div>
          <div class="step-text">
            <strong>Get a Card</strong>
            <span>Receive a random founder card</span>
          </div>
        </div>
        <div class="step">
          <div class="step-icon">🔄</div>
          <div class="step-text">
            <strong>Trade</strong>
            <span>Swap cards with other players</span>
          </div>
        </div>
        <div class="step">
          <div class="step-icon">✅</div>
          <div class="step-text">
            <strong>Get Verified</strong>
            <span>Find an admin to verify you</span>
          </div>
        </div>
        <div class="step">
          <div class="step-icon">🏆</div>
          <div class="step-text">
            <strong>Earn Points</strong>
            <span>Climb the leaderboard</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  .login-page {
    min-height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--space-lg);
    background: linear-gradient(180deg, var(--color-teal-pale) 0%, var(--color-bg) 100%);
  }
  
  .login-container {
    width: 100%;
    max-width: 400px;
  }
  
  .branding {
    text-align: center;
    margin-bottom: var(--space-xl);
  }
  
  .logo {
    width: 80px;
    height: 80px;
    margin-bottom: var(--space-md);
  }
  
  .branding h1 {
    font-size: 2rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--space-xs);
    letter-spacing: -0.02em;
  }
  
  .tagline {
    color: var(--color-text-secondary);
    font-size: 1rem;
  }
  
  .login-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-lg);
    overflow: hidden;
    margin-bottom: var(--space-xl);
  }
  
  .card-content {
    padding: var(--space-xl);
    text-align: center;
  }
  
  .card-content h2 {
    font-size: 1.5rem;
    font-weight: 700;
    margin-bottom: var(--space-sm);
    color: var(--color-text);
  }
  
  .description {
    color: var(--color-text-secondary);
    margin-bottom: var(--space-lg);
    line-height: 1.6;
  }
  
  .btn-x {
    width: 100%;
    padding: var(--space-md) var(--space-lg);
    background-color: #000;
    color: white;
    border-radius: var(--radius-lg);
    font-size: 1rem;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    transition: all var(--transition-fast);
  }
  
  .btn-x:hover:not(:disabled) {
    background-color: #333;
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
  }
  
  .btn-x:disabled {
    opacity: 0.7;
  }
  
  .x-icon {
    width: 20px;
    height: 20px;
  }
  
  .terms {
    margin-top: var(--space-md);
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  
  .how-it-works {
    text-align: center;
  }
  
  .how-it-works h3 {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: var(--space-md);
  }
  
  .steps {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-md);
  }
  
  .step {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    text-align: left;
    padding: var(--space-sm);
    background: var(--color-surface);
    border-radius: var(--radius-md);
  }
  
  .step-icon {
    font-size: 1.5rem;
    line-height: 1;
  }
  
  .step-text {
    display: flex;
    flex-direction: column;
  }
  
  .step-text strong {
    font-size: 0.85rem;
    color: var(--color-text);
  }
  
  .step-text span {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  @media (max-width: 400px) {
    .steps {
      grid-template-columns: 1fr;
    }
  }
</style>
