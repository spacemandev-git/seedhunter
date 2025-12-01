<script lang="ts">
  import type { Card } from '@seedhunter/shared'
  import { CATEGORY_COLORS, CATEGORY_LABELS } from '@seedhunter/shared'
  
  interface Props {
    card: Card | null
    ownerHandle?: string
    isOwn?: boolean
    tradeCount?: number
    points?: number
    size?: 'small' | 'medium' | 'large'
    flippable?: boolean
  }
  
  let { 
    card, 
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
  
  function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.other
  }
  
  function getCategoryLabel(category: string): string {
    return CATEGORY_LABELS[category] || 'Other'
  }
  
  const API_BASE = import.meta.env.VITE_API_URL || 'https://seedhunterapi.seedplex.io'
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
      {#if card}
        <!-- Card image -->
        <div class="card-image">
          <img 
            src="{API_BASE}/static/cards/{card.id}.png" 
            alt="{card.founderName}"
            onerror={(e) => {
              const target = e.currentTarget as HTMLImageElement
              target.style.display = 'none'
              target.nextElementSibling?.classList.remove('hidden')
            }}
          />
          <div class="placeholder hidden">
            <span class="placeholder-icon">🎴</span>
          </div>
        </div>
        
        <!-- Card info -->
        <div class="card-info">
          <h3 class="founder-name">{card.founderName}</h3>
          <p class="company">{card.company}</p>
          {#if card.xHandle}
            <p class="x-handle">@{card.xHandle}</p>
          {/if}
        </div>
        
        <!-- Card footer -->
        <div class="card-footer">
          <span 
            class="category-badge" 
            style="background-color: {getCategoryColor(card.category)}"
          >
            {getCategoryLabel(card.category)}
          </span>
          <span class="card-id">#{card.id.slice(0, 6)}</span>
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
        
        {#if card}
          <div class="card-details">
            <p><strong>Founder:</strong> {card.founderName}</p>
            <p><strong>Company:</strong> {card.company}</p>
            {#if card.role}
              <p><strong>Role:</strong> {card.role}</p>
            {/if}
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
  
  .card-image {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, var(--color-teal-pale), #EEF9F8);
    overflow: hidden;
    position: relative;
  }
  
  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
  }
  
  .placeholder.hidden {
    display: none;
  }
  
  .placeholder-icon {
    font-size: 4rem;
    opacity: 0.5;
  }
  
  .card-info {
    padding: var(--space-md);
    text-align: center;
    background: white;
  }
  
  .founder-name {
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 2px;
    line-height: 1.2;
  }
  
  .company {
    font-size: 0.9rem;
    color: var(--color-primary);
    font-weight: 600;
    margin-bottom: 2px;
  }
  
  .x-handle {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  
  .card-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: var(--color-bg-secondary);
    border-top: 1px solid var(--color-border-light);
  }
  
  .category-badge {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    color: white;
    padding: 3px 8px;
    border-radius: var(--radius-full);
    letter-spacing: 0.03em;
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
  
  .size-large .founder-name {
    font-size: 1.3rem;
  }
  
  .size-large .company {
    font-size: 1rem;
  }
</style>
