<script lang="ts">
  import { onMount } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { auth } from "$lib/stores";
  import "../app.css";

  let { children } = $props();
  let loggingOut = $state(false);

  async function handleLogout() {
    if (loggingOut) return;
    loggingOut = true;
    try {
      await auth.logout();
      goto('/');
    } finally {
      loggingOut = false;
    }
  }

  // Tab configuration
  const tabs = [
    { href: "/", icon: "trophy", label: "Leaderboard", authRequired: false },
    { href: "/card", icon: "card", label: "Card", authRequired: true },
    { href: "/chat", icon: "chat", label: "Chat", authRequired: false },
    { href: "/map", icon: "map", label: "Map", authRequired: false },
  ];

  // Social links for header
  const socialLinks = [
    { href: "https://t.me/+VvlOcxlAbH1lNzcx", icon: "telegram", label: "Telegram" },
    { href: "https://x.com/seedplex_io", icon: "x", label: "X" },
  ];

  onMount(() => {
    auth.init();
  });

  function isActive(href: string, currentPath: string): boolean {
    if (href === "/") return currentPath === "/";
    return currentPath.startsWith(href);
  }
</script>

<div class="app">
  <!-- Header - minimal on mobile -->
  <header>
    <div class="header-content">
      <a href="/" class="logo">
        <img src="/Seedplex Logo.png" alt="Seedplex" class="logo-img" />
        <span class="logo-text">Seedhunter</span>
      </a>

      {#if auth.loading}
        <div class="auth-status">
          <div class="spinner"></div>
        </div>
      {:else if auth.isLoggedIn}
        <div class="auth-status logged-in">
          <a href="/profile" class="profile-link" title="View Profile">
            {#if auth.player?.xProfilePic}
              <img 
                src={auth.player.xProfilePic} 
                alt="@{auth.player.xHandle}" 
                class="user-avatar"
              />
            {:else}
              <div class="user-avatar-placeholder">
                {auth.player?.xHandle?.charAt(0).toUpperCase() || '?'}
              </div>
            {/if}
            <span class="user-handle">@{auth.player?.xHandle}</span>
            {#if auth.player?.verified}
              <span class="verified-icon" title="Verified">✓</span>
            {/if}
          </a>
          <div class="social-links">
            {#each socialLinks as link}
              <a
                href={link.href}
                class="social-link"
                target="_blank"
                rel="noopener noreferrer"
                title={link.label}
              >
                {#if link.icon === "telegram"}
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 5L2 12.5l7 1M21 5l-3 15-8-6.5M21 5L9 13.5m0 0V19l3.25-3.25" />
                  </svg>
                {:else if link.icon === "x"}
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                {/if}
              </a>
            {/each}
          </div>
          <button 
            class="btn-logout" 
            onclick={handleLogout}
            disabled={loggingOut}
            title="Logout"
          >
            {#if loggingOut}
              <div class="spinner-small"></div>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            {/if}
          </button>
        </div>
      {:else}
        <a href="/auth/login" class="btn-primary btn-connect"> Connect </a>
      {/if}
    </div>
  </header>

  <!-- Main content area -->
  <main class="scrollable-hidden">
    {@render children()}
  </main>

  <!-- Bottom Tab Bar -->
  <nav class="tab-bar">
    {#each tabs as tab}
      {#if !tab.authRequired || auth.isLoggedIn}
        <a
          href={tab.href}
          class="tab-item"
          class:active={!tab.external && isActive(tab.href, $page.url.pathname)}
          target={tab.external ? "_blank" : undefined}
          rel={tab.external ? "noopener noreferrer" : undefined}
        >
          <span class="tab-icon">
            {#if tab.icon === "trophy"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                <path d="M4 22h16" />
                <path d="M10 22V8a6 6 0 0 1 4 0v14" />
                <path d="M6 4v5a6 6 0 0 0 12 0V4" />
              </svg>
            {:else if tab.icon === "card"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="M3 10h18" />
                <path d="M7 15h4" />
              </svg>
            {:else if tab.icon === "chat"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"
                />
              </svg>
            {:else if tab.icon === "map"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="10" r="3" />
                <path
                  d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"
                />
              </svg>
            {:else if tab.icon === "telegram"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M21 5L2 12.5l7 1M21 5l-3 15-8-6.5M21 5L9 13.5m0 0V19l3.25-3.25" />
              </svg>
            {:else if tab.icon === "x"}
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            {:else if tab.icon === "user"}
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </svg>
            {/if}
          </span>
          <span class="tab-label">{tab.label}</span>
        </a>
      {/if}
    {/each}
  </nav>
</div>

<style>
  .app {
    height: 100vh;
    height: 100dvh; /* Dynamic viewport height for mobile */
    display: flex;
    flex-direction: column;
    background-color: var(--color-bg-secondary);
  }

  /* Header */
  header {
    background-color: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    padding: var(--space-sm) var(--space-md);
    flex-shrink: 0;
    z-index: 50;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    max-width: 600px;
    margin: 0 auto;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    text-decoration: none;
  }

  .logo-img {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .logo-text {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    letter-spacing: -0.02em;
  }

  .auth-status {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .profile-link {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    text-decoration: none;
    padding: 4px 8px 4px 4px;
    border-radius: var(--radius-md);
    transition: background-color var(--transition-fast);
  }

  .profile-link:hover {
    background-color: var(--color-bg-secondary);
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid var(--color-border);
  }

  .user-avatar-placeholder {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 0.9rem;
  }

  .user-handle {
    font-weight: 600;
    color: var(--color-primary);
    font-size: 0.9rem;
  }

  .verified-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    background-color: var(--color-success);
    color: white;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: bold;
  }

  .social-links {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .social-link {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    text-decoration: none;
    transition: all var(--transition-fast);
  }

  .social-link:hover {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
  }

  .social-link svg {
    width: 16px;
    height: 16px;
  }

  .btn-logout {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--transition-fast);
  }

  .btn-logout:hover:not(:disabled) {
    background: var(--color-error);
    border-color: var(--color-error);
    color: white;
  }

  .btn-logout:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-logout svg {
    width: 18px;
    height: 18px;
  }

  .spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .btn-connect {
    padding: var(--space-xs) var(--space-md);
    font-size: 0.9rem;
  }

  /* Main content */
  main {
    flex: 1;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

  /* Bottom Tab Bar */
  .tab-bar {
    display: flex;
    justify-content: space-evenly;
    align-items: center;
    background-color: var(--color-surface);
    border-top: 1px solid var(--color-border);
    padding: var(--space-xs) var(--space-xs);
    padding-bottom: calc(var(--space-xs) + var(--safe-area-bottom));
    flex-shrink: 0;
    z-index: 50;
    overflow: hidden;
  }

  .tab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-xs) var(--space-xs);
    text-decoration: none;
    color: var(--color-text-muted);
    transition: color var(--transition-fast);
    min-width: 0;
    flex: 1;
    gap: 2px;
  }

  .tab-item:hover {
    color: var(--color-text-secondary);
  }

  .tab-item.active {
    color: var(--color-primary);
  }

  .tab-icon {
    width: 24px;
    height: 24px;
  }

  .tab-icon svg {
    width: 100%;
    height: 100%;
  }

  .tab-label {
    font-size: 0.7rem;
    font-weight: 500;
    letter-spacing: 0.01em;
  }

  .tab-item.active .tab-label {
    font-weight: 600;
  }

  /* Desktop adjustments */
  @media (min-width: 768px) {
    header {
      padding: var(--space-md);
    }

    .logo-img {
      width: 40px;
      height: 40px;
    }

    .logo-text {
      font-size: 1.5rem;
    }

    .tab-bar {
      max-width: 400px;
      margin: 0 auto;
      border-radius: var(--radius-lg) var(--radius-lg) 0 0;
      border-left: 1px solid var(--color-border);
      border-right: 1px solid var(--color-border);
    }

    .tab-item {
      padding: var(--space-sm) var(--space-md);
      flex: 0 0 auto;
    }

    .tab-icon {
      width: 28px;
      height: 28px;
    }

    .tab-label {
      font-size: 0.75rem;
    }
  }
</style>
