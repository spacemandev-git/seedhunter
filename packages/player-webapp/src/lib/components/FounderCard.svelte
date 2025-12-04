<script lang="ts">
  import type { Founder } from '@seedhunter/shared'
  
  interface Props {
    founder: Founder | null
    ownerHandle?: string
    isOwn?: boolean
    tradeCount?: number
    points?: number
    size?: 'small' | 'medium' | 'large'
    flippable?: boolean
  }
  
  let { 
    founder, 
    ownerHandle = '', 
    isOwn = false, 
    tradeCount = 0, 
    points = 0,
    size = 'medium',
    flippable = true
  }: Props = $props()
  
  let isFlipped = $state(false)
  
  function handleFlip() {
    if (flippable) {
      isFlipped = !isFlipped
    }
  }
  
  // Color palette for founder cards based on ID
  const FOUNDER_COLORS = [
    '#FF6B6B', // Red
    '#4ECDC4', // Teal
    '#45B7D1', // Blue
    '#96CEB4', // Green
    '#FFEAA7', // Yellow
    '#DDA0DD', // Plum
    '#98D8C8', // Mint
    '#F7DC6F', // Gold
    '#BB8FCE', // Purple
    '#85C1E9', // Sky
  ]
  
  // Emoji icons for founders based on ID
  const FOUNDER_ICONS = ['🚀', '💡', '🎯', '⭐', '🔥', '💎', '🌟', '🏆', '⚡', '🎨']
  
  function getFounderColor(id: number): string {
    return FOUNDER_COLORS[id % FOUNDER_COLORS.length]
  }
  
  function getFounderIcon(id: number): string {
    return FOUNDER_ICONS[id % FOUNDER_ICONS.length]
  }
  
  function getGradient(id: number): string {
    const color = getFounderColor(id)
    // Create a gradient variant
    return `linear-gradient(135deg, ${color}cc 0%, ${color}88 50%, ${color}55 100%)`
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div 
  class="card-wrapper size-{size}" 
  class:flippable
  onclick={handleFlip}
  onkeydown={(e) => e.key === 'Enter' && handleFlip()}
  role={flippable ? 'button' : 'article'}
  tabindex={flippable ? 0 : -1}
>
  <div class="card-inner" class:flipped={isFlipped}>
    <!-- Front of card -->
    <div class="card-face card-front">
      {#if founder}
        <!-- Card header with gradient background -->
        <div class="card-header" style="background: {getGradient(founder.id)}">
          <div class="founder-icon">
            {getFounderIcon(founder.id)}
          </div>
          <div class="founded-badge">
            Est. {founder.founded}
          </div>
        </div>
        
        <!-- Card info -->
        <div class="card-info">
          <h3 class="founder-name">{founder.name}</h3>
          <p class="company">{founder.company}</p>
          <p class="description">{founder.description}</p>
        </div>
        
        <!-- Card footer -->
        <div class="card-footer">
          <span 
            class="valuation-badge" 
            style="background-color: {getFounderColor(founder.id)}"
          >
            {founder.valuation}
          </span>
          <span class="card-id">#{founder.id}</span>
        </div>
        
        <!-- Owner badge if not own card -->
        {#if ownerHandle && !isOwn}
          <div class="owner-badge">
            Owned by @{ownerHandle}
          </div>
        {/if}
        
        <!-- Flip hint -->
        {#if flippable}
          <div class="flip-hint">Tap to flip</div>
        {/if}
      {:else}
        <div class="card-empty">
          <span class="empty-icon">🎴</span>
          <p>No card assigned</p>
        </div>
      {/if}
    </div>
    
    <!-- Back of card (stats) -->
    <div class="card-face card-back">
      <div class="stats-content">
        <div class="logo-small">🌱</div>
        <h4>Card Stats</h4>
        
        <div class="stats-grid">
          <div class="stat-item">
            <span class="stat-value">{tradeCount}</span>
            <span class="stat-label">Trades</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{points}</span>
            <span class="stat-label">Points</span>
          </div>
        </div>
        
        {#if ownerHandle}
          <div class="owner-info">
            <span class="owner-label">Current Owner</span>
            <span class="owner-handle">@{ownerHandle}</span>
          </div>
        {/if}
        
        {#if founder}
          <div class="card-details">
            <p><strong>Founder:</strong> {founder.name}</p>
            <p><strong>Company:</strong> {founder.company}</p>
            <p><strong>Founded:</strong> {founder.founded}</p>
            <p><strong>Valuation:</strong> {founder.valuation}</p>
            <p class="founder-description">{founder.description}</p>
          </div>
        {/if}
        
        <div class="flip-hint">Tap to flip back</div>
      </div>
    </div>
  </div>
</div>

<style>
  .card-wrapper {
    perspective: 1000px;
    cursor: default;
  }
  
  .card-wrapper.flippable {
    cursor: pointer;
  }
  
  /* Sizes */
  .card-wrapper.size-small {
    width: 200px;
    height: 280px;
  }
  
  .card-wrapper.size-medium {
    width: 280px;
    height: 392px;
  }
  
  .card-wrapper.size-large {
    width: 320px;
    height: 448px;
  }
  
  .card-inner {
    width: 100%;
    height: 100%;
    position: relative;
    transform-style: preserve-3d;
    transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .card-inner.flipped {
    transform: rotateY(180deg);
  }
  
  .card-face {
    position: absolute;
    width: 100%;
    height: 100%;
    backface-visibility: hidden;
    border-radius: var(--radius-xl);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(46, 186, 181, 0.1);
  }
  
  /* Front face */
  .card-front {
    background: linear-gradient(180deg, #FFFFFF 0%, #F8FAFA 100%);
    display: flex;
    flex-direction: column;
  }
  
  .card-header {
    flex: 0 0 auto;
    height: 45%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
  }
  
  .founder-icon {
    font-size: 4rem;
    filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
  }
  
  .founded-badge {
    position: absolute;
    top: var(--space-sm);
    right: var(--space-sm);
    background: rgba(255, 255, 255, 0.95);
    color: var(--color-text);
    padding: 4px 10px;
    border-radius: var(--radius-full);
    font-size: 0.7rem;
    font-weight: 600;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  
  .card-info {
    flex: 1;
    padding: var(--space-md);
    text-align: center;
    background: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  
  .founder-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 4px;
    line-height: 1.2;
  }
  
  .company {
    font-size: 1rem;
    color: var(--color-primary);
    font-weight: 600;
    margin-bottom: 8px;
  }
  
  .description {
    font-size: 0.8rem;
    color: var(--color-text-muted);
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border-light);
  }
  
  .valuation-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    color: white;
    padding: 3px 8px;
    border-radius: var(--radius-full);
    letter-spacing: 0.03em;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  
  .card-id {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--color-text-muted);
    font-family: monospace;
  }
  
  .owner-badge {
    position: absolute;
    bottom: 48px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 0, 0, 0.7);
    color: white;
    padding: 4px 12px;
    border-radius: var(--radius-full);
    font-size: 0.75rem;
    font-weight: 500;
    white-space: nowrap;
  }
  
  .flip-hint {
    position: absolute;
    bottom: 52px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.7rem;
    color: var(--color-text-muted);
    background: rgba(255, 255, 255, 0.9);
    padding: 2px 8px;
    border-radius: var(--radius-full);
    opacity: 0;
    transition: opacity var(--transition-fast);
  }
  
  .card-wrapper.flippable:hover .flip-hint {
    opacity: 1;
  }
  
  /* Back face */
  .card-back {
    background: linear-gradient(135deg, var(--color-teal), var(--color-teal-dark));
    transform: rotateY(180deg);
    color: white;
  }
  
  .stats-content {
    height: 100%;
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }
  
  .logo-small {
    font-size: 2rem;
    margin-bottom: var(--space-sm);
  }
  
  .stats-content h4 {
    font-size: 1.25rem;
    font-weight: 700;
    margin-bottom: var(--space-lg);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  .stats-grid {
    display: flex;
    gap: var(--space-xl);
    margin-bottom: var(--space-lg);
  }
  
  .stat-item {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .stat-value {
    font-size: 2rem;
    font-weight: 700;
    line-height: 1;
  }
  
  .stat-label {
    font-size: 0.75rem;
    text-transform: uppercase;
    opacity: 0.8;
    margin-top: 4px;
  }
  
  .owner-info {
    background: rgba(255, 255, 255, 0.15);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    margin-bottom: var(--space-md);
  }
  
  .owner-label {
    display: block;
    font-size: 0.7rem;
    text-transform: uppercase;
    opacity: 0.8;
  }
  
  .owner-handle {
    font-weight: 600;
    font-size: 1rem;
  }
  
  .card-details {
    text-align: left;
    font-size: 0.8rem;
    opacity: 0.9;
    line-height: 1.6;
  }
  
  .card-details p {
    margin: 2px 0;
  }
  
  .founder-description {
    margin-top: var(--space-sm) !important;
    font-size: 0.75rem;
    opacity: 0.85;
    line-height: 1.4;
    max-height: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  .card-back .flip-hint {
    bottom: var(--space-md);
    background: rgba(0, 0, 0, 0.2);
    color: white;
    opacity: 0.8;
  }
  
  /* Empty state */
  .card-empty {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--color-text-muted);
  }
  
  .empty-icon {
    font-size: 4rem;
    opacity: 0.3;
    margin-bottom: var(--space-md);
  }
  
  /* Size-specific adjustments */
  .size-small .founder-name {
    font-size: 0.9rem;
  }
  
  .size-small .company {
    font-size: 0.8rem;
  }
  
  .size-small .card-info {
    padding: var(--space-sm);
  }
  
  .size-small .founder-icon {
    font-size: 3rem;
  }
  
  .size-large .founder-name {
    font-size: 1.4rem;
  }
  
  .size-large .company {
    font-size: 1.1rem;
  }
  
  .size-large .founder-icon {
    font-size: 5rem;
  }
</style>
