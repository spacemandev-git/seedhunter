<script lang="ts">
  import { auth } from '$lib/stores'
  import { logout } from '$lib/api/client'
  import { goto } from '$app/navigation'
  import { onMount } from 'svelte'
  import QRCode from 'qrcode'
  
  let qrDataUrl = $state<string | null>(null)
  let showBrightness = $state(false)
  
  // Email editing state
  let emailValue = $state('')
  let isEditingEmail = $state(false)
  let emailSaving = $state(false)
  let emailError = $state<string | null>(null)
  let emailSuccess = $state(false)
  
  // Initialize email value when player loads
  $effect(() => {
    if (auth.player?.email !== undefined) {
      emailValue = auth.player.email ?? ''
    }
  })
  
  onMount(async () => {
    // Redirect if not logged in
    if (!auth.loading && !auth.isLoggedIn) {
      goto('/auth/login')
      return
    }
    
    // Wait for auth to load
    if (auth.loading) {
      const checkAuth = setInterval(() => {
        if (!auth.loading) {
          clearInterval(checkAuth)
          if (!auth.isLoggedIn) {
            goto('/auth/login')
          } else {
            generateQR()
          }
        }
      }, 100)
    } else {
      generateQR()
    }
  })
  
  async function generateQR() {
    if (!auth.player?.xHandle) return
    
    try {
      qrDataUrl = await QRCode.toDataURL(auth.player.xHandle, {
        width: 280,
        margin: 2,
        color: {
          dark: '#1A2B2A',
          light: '#FFFFFF'
        }
      })
    } catch (err) {
      console.error('Failed to generate QR:', err)
    }
  }
  
  async function handleLogout() {
    try {
      await logout()
    } catch (err) {
      // Ignore logout errors
    }
    auth.logout()
    goto('/')
  }
  
  function toggleBrightness() {
    showBrightness = !showBrightness
  }
  
  function startEditingEmail() {
    isEditingEmail = true
    emailError = null
    emailSuccess = false
  }
  
  function cancelEditingEmail() {
    isEditingEmail = false
    emailValue = auth.player?.email ?? ''
    emailError = null
  }
  
  async function saveEmail() {
    emailError = null
    emailSuccess = false
    
    // Basic email validation
    if (emailValue && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue)) {
      emailError = 'Please enter a valid email address'
      return
    }
    
    emailSaving = true
    
    try {
      const result = await auth.updateProfile({ email: emailValue || null })
      
      if (result.success) {
        isEditingEmail = false
        emailSuccess = true
        // Clear success message after 3 seconds
        setTimeout(() => emailSuccess = false, 3000)
      } else {
        emailError = result.error || 'Failed to save email'
      }
    } catch (err) {
      emailError = 'Failed to save email. Please try again.'
    } finally {
      emailSaving = false
    }
  }
</script>

<svelte:head>
  <title>Profile | Seedhunter</title>
</svelte:head>

<div class="page">
  <div class="container">
    {#if auth.loading}
      <div class="loading-state">
        <div class="spinner-large"></div>
        <p>Loading profile...</p>
      </div>
    {:else if !auth.isLoggedIn}
      <div class="auth-prompt">
        <div class="prompt-icon">👤</div>
        <h2>Connect to View Profile</h2>
        <p>Sign in with X to manage your Seedhunter profile.</p>
        <a href="/auth/login" class="btn-primary btn-large mt-lg">Connect with X</a>
      </div>
    {:else}
      <div class="profile-page">
        <!-- Profile card -->
        <div class="profile-card">
          <div class="profile-header">
            <div class="avatar">
              {#if auth.player?.xProfilePic}
                <img src={auth.player.xProfilePic} alt="Profile" />
              {:else}
                <span>👤</span>
              {/if}
            </div>
            <div class="profile-info">
              <h2>@{auth.player?.xHandle}</h2>
              {#if auth.player?.verified}
                <span class="badge badge-verified">✓ Verified</span>
              {:else}
                <span class="badge badge-unverified">Not Verified</span>
              {/if}
            </div>
          </div>
          
          <div class="stats-grid">
            <div class="stat-item">
              <span class="stat-value">{Math.floor((auth.player?.stats.trades ?? 0) / 2)}</span>
              <span class="stat-label">Trades</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">{auth.player?.stats.points ?? 0}</span>
              <span class="stat-label">Points</span>
            </div>
            <div class="stat-item">
              <span class="stat-value">#{auth.player?.stats.rank ?? '-'}</span>
              <span class="stat-label">Rank</span>
            </div>
          </div>
        </div>
        
        <!-- Email Section -->
        <div class="email-section">
          <div class="section-header">
            <h3>Email Address</h3>
            {#if emailSuccess}
              <span class="success-badge">✓ Saved</span>
            {/if}
          </div>
          
          {#if isEditingEmail}
            <div class="email-edit">
              <input 
                type="email"
                bind:value={emailValue}
                placeholder="Enter your email address"
                class="email-input"
                disabled={emailSaving}
              />
              {#if emailError}
                <p class="error-message">{emailError}</p>
              {/if}
              <div class="email-actions">
                <button 
                  class="btn-secondary" 
                  onclick={cancelEditingEmail}
                  disabled={emailSaving}
                >
                  Cancel
                </button>
                <button 
                  class="btn-primary" 
                  onclick={saveEmail}
                  disabled={emailSaving}
                >
                  {emailSaving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
          {:else}
            <div class="email-display">
              {#if auth.player?.email}
                <p class="email-value">{auth.player.email}</p>
              {:else}
                <p class="email-placeholder">No email added</p>
              {/if}
              <button class="btn-edit" onclick={startEditingEmail}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                {auth.player?.email ? 'Edit' : 'Add Email'}
              </button>
            </div>
          {/if}
          
          <p class="email-hint">
            Your email is used for important account notifications only.
          </p>
        </div>
        
        <!-- Verification QR section -->
        <div class="qr-section" class:bright={showBrightness}>
          <div class="section-header">
            <h3>
              {#if auth.player?.verified}
                Your Profile QR
              {:else}
                Get Verified
              {/if}
            </h3>
            <button 
              class="btn-ghost brightness-btn" 
              onclick={toggleBrightness}
              title="Toggle brightness for scanning"
            >
              {showBrightness ? '☀️' : '🔆'}
            </button>
          </div>
          
          {#if !auth.player?.verified}
            <p class="qr-description">
              Show this QR code to an admin to get verified. Verified players earn points for trading!
            </p>
          {/if}
          
          <div class="qr-display">
            {#if qrDataUrl}
              <img src={qrDataUrl} alt="Profile QR Code" class="qr-image" />
            {:else}
              <div class="qr-placeholder">
                <div class="spinner"></div>
              </div>
            {/if}
            <p class="handle-label">@{auth.player?.xHandle}</p>
          </div>
          
          {#if !auth.player?.verified}
            <a href="/map" class="find-admin-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="10" r="3" />
                <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z" />
              </svg>
              <span>Find an Admin on the Map</span>
            </a>
          {/if}
        </div>
        
        <!-- How points work -->
        <div class="info-card">
          <h4>How Points Work</h4>
          <ul>
            <li>
              <span class="list-icon">✓</span>
              <span>Trade cards with other players</span>
            </li>
            <li>
              <span class="list-icon">✓</span>
              <span>Both traders must be verified</span>
            </li>
            <li>
              <span class="list-icon">✓</span>
              <span>Each unique verified trade = 1 point</span>
            </li>
            <li>
              <span class="list-icon">🏆</span>
              <span>Most points = top of leaderboard!</span>
            </li>
          </ul>
        </div>
        
        <!-- Logout -->
        <button class="btn-logout" onclick={handleLogout}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          Sign Out
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    padding: var(--space-md) 0 var(--space-xl);
  }
  
  .profile-page {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
  }
  
  /* Profile card */
  .profile-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
  }
  
  .profile-header {
    display: flex;
    align-items: center;
    gap: var(--space-md);
    margin-bottom: var(--space-lg);
  }
  
  .avatar {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--color-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2rem;
    overflow: hidden;
  }
  
  .avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .profile-info h2 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--space-xs);
  }
  
  .stats-grid {
    display: flex;
    justify-content: space-around;
    padding-top: var(--space-lg);
    border-top: 1px solid var(--color-border);
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-primary);
    line-height: 1;
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    margin-top: 4px;
  }
  
  /* Email Section */
  .email-section {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
  }
  
  .email-section .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }
  
  .email-section .section-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0;
  }
  
  .success-badge {
    font-size: 0.85rem;
    color: var(--color-success, #22c55e);
    font-weight: 600;
    animation: fadeIn 0.3s ease;
  }
  
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  
  .email-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-md);
  }
  
  .email-value {
    color: var(--color-text);
    font-size: 1rem;
    margin: 0;
    word-break: break-all;
  }
  
  .email-placeholder {
    color: var(--color-text-muted);
    font-size: 1rem;
    font-style: italic;
    margin: 0;
  }
  
  .btn-edit {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-md);
    background: var(--color-primary-light);
    color: var(--color-primary);
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    white-space: nowrap;
  }
  
  .btn-edit:hover {
    background: var(--color-primary);
    color: white;
  }
  
  .btn-edit svg {
    width: 16px;
    height: 16px;
  }
  
  .email-edit {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .email-input {
    width: 100%;
    padding: var(--space-md);
    font-size: 1rem;
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text);
    transition: border-color var(--transition-fast);
  }
  
  .email-input:focus {
    outline: none;
    border-color: var(--color-primary);
  }
  
  .email-input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .email-actions {
    display: flex;
    gap: var(--space-sm);
    justify-content: flex-end;
  }
  
  .btn-secondary {
    padding: var(--space-sm) var(--space-md);
    background: transparent;
    color: var(--color-text-muted);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .btn-secondary:hover:not(:disabled) {
    border-color: var(--color-text-muted);
  }
  
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .btn-primary {
    padding: var(--space-sm) var(--space-md);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-md);
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
  }
  
  .btn-primary:hover:not(:disabled) {
    background: var(--color-primary-dark, #0d4040);
  }
  
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .error-message {
    color: var(--color-error, #ef4444);
    font-size: 0.875rem;
    margin: 0;
  }
  
  .email-hint {
    color: var(--color-text-muted);
    font-size: 0.8rem;
    margin: var(--space-md) 0 0 0;
    line-height: 1.4;
  }
  
  /* QR Section */
  .qr-section {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
    text-align: center;
    transition: all var(--transition-fast);
  }
  
  .qr-section.bright {
    background: #FFFFFF;
    box-shadow: 0 0 60px rgba(255, 255, 255, 0.5);
  }
  
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }
  
  .section-header h3 {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
  }
  
  .brightness-btn {
    font-size: 1.25rem;
    padding: var(--space-xs);
  }
  
  .qr-description {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin-bottom: var(--space-lg);
    line-height: 1.5;
  }
  
  .qr-display {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .qr-image {
    width: 200px;
    height: 200px;
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-md);
  }
  
  .qr-placeholder {
    width: 200px;
    height: 200px;
    background: var(--color-bg-secondary);
    border-radius: var(--radius-lg);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .handle-label {
    margin-top: var(--space-md);
    font-size: 1rem;
    font-weight: 600;
    color: var(--color-text);
  }
  
  .find-admin-link {
    display: inline-flex;
    align-items: center;
    gap: var(--space-sm);
    margin-top: var(--space-lg);
    padding: var(--space-sm) var(--space-md);
    background: var(--color-primary-light);
    color: var(--color-primary);
    border-radius: var(--radius-full);
    font-weight: 600;
    font-size: 0.9rem;
    transition: all var(--transition-fast);
  }
  
  .find-admin-link:hover {
    background: var(--color-primary);
    color: white;
  }
  
  .find-admin-link svg {
    width: 18px;
    height: 18px;
  }
  
  /* Info card */
  .info-card {
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    padding: var(--space-lg);
    box-shadow: var(--shadow-card);
  }
  
  .info-card h4 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--space-md);
  }
  
  .info-card ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .info-card li {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    color: var(--color-text-secondary);
    font-size: 0.9rem;
  }
  
  .list-icon {
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }
  
  /* Logout button */
  .btn-logout {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-sm);
    width: 100%;
    padding: var(--space-md);
    background: transparent;
    border: 2px solid var(--color-border);
    color: var(--color-text-muted);
    border-radius: var(--radius-lg);
    font-size: 0.95rem;
    transition: all var(--transition-fast);
  }
  
  .btn-logout:hover {
    border-color: var(--color-error);
    color: var(--color-error);
  }
  
  .btn-logout svg {
    width: 20px;
    height: 20px;
  }
  
  /* Loading state */
  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--space-2xl);
    color: var(--color-text-muted);
  }
  
  .spinner-large {
    width: 48px;
    height: 48px;
    border: 4px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin-bottom: var(--space-lg);
  }
  
  /* Auth prompt */
  .auth-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: var(--space-2xl) var(--space-lg);
    background: var(--color-surface);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-card);
  }
  
  .prompt-icon {
    font-size: 4rem;
    margin-bottom: var(--space-md);
  }
  
  .auth-prompt h2 {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: var(--space-sm);
  }
  
  .auth-prompt p {
    color: var(--color-text-muted);
    max-width: 280px;
    line-height: 1.6;
  }
</style>
