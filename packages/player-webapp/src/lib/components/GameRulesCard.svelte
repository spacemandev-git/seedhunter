<script lang="ts">
  let isExpanded = $state(false)
</script>

<div class="rules-card">
  <button class="rules-header" onclick={() => isExpanded = !isExpanded}>
    <div class="header-left">
      <span class="trophy-icon">🏆</span>
      <div class="header-text">
        <h2>Win up to $1,000!</h2>
        <p class="tagline">Trade cards, earn points, claim prizes</p>
      </div>
    </div>
    <svg 
      class="chevron" 
      class:rotated={isExpanded}
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2.5"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  </button>
  
  {#if isExpanded}
    <div class="rules-content">
      <!-- Prize Pool Section -->
      <div class="section prizes-section">
        <h3>🎁 Prize Pool</h3>
        <div class="prize-list">
          <div class="prize-item gold">
            <span class="place">🥇 1st Place</span>
            <span class="amount">$1,000</span>
            <span class="desc">to invest in any launch on Seedplex</span>
          </div>
          <div class="prize-item silver">
            <span class="place">🥈🥉 2nd - 5th Place</span>
            <span class="amount">$500 each</span>
            <span class="desc">to invest in any launch on Seedplex</span>
          </div>
        </div>
      </div>
      
      <!-- How to Play Section -->
      <div class="section rules-section">
        <h3>📖 How to Play</h3>
        <ol class="rules-list">
          <li>
            <strong>Get Your Card</strong>
            <span>Connect with X to receive your Solana Breakpoint Project Card</span>
          </li>
          <li>
            <strong>Trade with Others</strong>
            <span>Tap "Trade" on your card, show the QR code, and let someone scan it to swap cards. Each unique trade is worth 1 point.</span>
          </li>
          <li>
            <strong>Get Verified</strong>
            <span>Find an admin on the map (somewhere in Abu Dhabi) and have them scan your profile to verify your account. Only verified accounts count for prizes. Verification after trading also counts, so trade away and whenever someone verifies they were at Breakpoint with an admin, all your point totals will get updated</span>
          </li>
        </ol>
      </div>
      
      <!-- Pro Tips -->
      <div class="section tips-section">
        <h3>💡 Pro Tips</h3>
        <ul class="tips-list">
          <li>Get verified early to maximize your points</li>
          <li>Trade with as many different verified players as possible</li>
          <li>Check the map for admin locations</li>
          <li>Past trades count when you or others become verified</li>
        </ul>
      </div>
    </div>
  {/if}
</div>

<style>
  .rules-card {
    background: linear-gradient(135deg, var(--color-surface) 0%, var(--color-bg-secondary) 100%);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-card);
    overflow: hidden;
    margin-bottom: var(--space-lg);
    border: 1px solid var(--color-border);
  }
  
  .rules-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-md) var(--space-lg);
    background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark, #0d9488) 100%);
    color: white;
    border: none;
    cursor: pointer;
    text-align: left;
    transition: opacity var(--transition-fast);
  }
  
  .rules-header:hover {
    opacity: 0.95;
  }
  
  .header-left {
    display: flex;
    align-items: center;
    gap: var(--space-md);
  }
  
  .trophy-icon {
    font-size: 2rem;
  }
  
  .header-text h2 {
    font-size: 1.25rem;
    font-weight: 700;
    margin: 0;
    line-height: 1.2;
  }
  
  .tagline {
    font-size: 0.85rem;
    opacity: 0.9;
    margin: 2px 0 0 0;
  }
  
  .chevron {
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    transition: transform var(--transition-normal);
  }
  
  .chevron.rotated {
    transform: rotate(180deg);
  }
  
  .rules-content {
    padding: var(--space-lg);
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
    animation: slideDown 0.3s ease-out;
  }
  
  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  .section h3 {
    font-size: 1rem;
    font-weight: 700;
    color: var(--color-text);
    margin: 0 0 var(--space-sm) 0;
  }
  
  /* Prize Section */
  .prize-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
  }
  
  .prize-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--space-xs) var(--space-sm);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-bg);
  }
  
  .prize-item.gold {
    background: linear-gradient(135deg, rgba(255, 215, 0, 0.15) 0%, rgba(255, 165, 0, 0.1) 100%);
    border: 1px solid rgba(255, 215, 0, 0.3);
  }
  
  .prize-item.silver {
    background: linear-gradient(135deg, rgba(192, 192, 192, 0.15) 0%, rgba(169, 169, 169, 0.1) 100%);
    border: 1px solid rgba(192, 192, 192, 0.3);
  }
  
  .prize-item .place {
    font-weight: 600;
    color: var(--color-text);
    min-width: 140px;
  }
  
  .prize-item .amount {
    font-weight: 700;
    color: var(--color-primary);
    font-size: 1.1rem;
  }
  
  .prize-item .desc {
    font-size: 0.85rem;
    color: var(--color-text-muted);
    flex-basis: 100%;
  }
  
  /* Rules Section */
  .rules-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
    counter-reset: rules;
  }
  
  .rules-list li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: var(--space-sm) var(--space-md);
    padding-left: calc(var(--space-md) + 28px);
    background: var(--color-bg);
    border-radius: var(--radius-md);
    position: relative;
    counter-increment: rules;
  }
  
  .rules-list li::before {
    content: counter(rules);
    position: absolute;
    left: var(--space-md);
    top: var(--space-sm);
    width: 20px;
    height: 20px;
    background: var(--color-primary);
    color: white;
    border-radius: 50%;
    font-size: 0.75rem;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .rules-list li strong {
    color: var(--color-text);
    font-weight: 600;
  }
  
  .rules-list li span {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
  
  /* Tips Section */
  .tips-list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
  }
  
  .tips-list li {
    display: flex;
    align-items: flex-start;
    gap: var(--space-sm);
    font-size: 0.9rem;
    color: var(--color-text-secondary);
    padding: var(--space-xs) 0;
  }
  
  .tips-list li::before {
    content: "✓";
    color: var(--color-success);
    font-weight: bold;
    flex-shrink: 0;
  }
</style>
