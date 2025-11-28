<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { chat } from '$lib/stores/index.svelte'
  import { getChatMessages, deleteMessage } from '$lib/api/client'
  import type { ChatMessage } from '@seedhunter/shared'

  let loading = $state(false)
  let error = $state('')
  let filterHandle = $state('')
  let deletingId = $state<string | null>(null)
  let refreshInterval: ReturnType<typeof setInterval> | null = null

  // Filtered messages
  let filteredMessages = $derived(
    filterHandle.trim()
      ? chat.messages.filter((m) =>
          m.senderHandle.toLowerCase().includes(filterHandle.toLowerCase())
        )
      : chat.messages
  )

  onMount(async () => {
    await loadMessages()
    // Auto-refresh every 30 seconds
    refreshInterval = setInterval(loadMessages, 30000)
  })

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval)
    }
  })

  async function loadMessages() {
    loading = true
    error = ''

    try {
      const messages = await getChatMessages(100)
      chat.setMessages(messages)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load messages'
    } finally {
      loading = false
    }
  }

  async function handleDelete(msgId: string) {
    if (deletingId) return

    deletingId = msgId
    try {
      await deleteMessage(msgId)
      chat.removeMessage(msgId)
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to delete message'
    } finally {
      deletingId = null
    }
  }

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  function clearFilter() {
    filterHandle = ''
  }
</script>

<section class="chat-mod card">
  <div class="header">
    <h2>💬 Chat Moderation</h2>
    <button
      class="refresh-btn"
      onclick={loadMessages}
      disabled={loading}
      aria-label="Refresh messages"
    >
      🔄
    </button>
  </div>

  <div class="filter-bar">
    <input
      type="text"
      bind:value={filterHandle}
      placeholder="Filter by @handle..."
      class="filter-input"
    />
    {#if filterHandle}
      <button class="clear-filter" onclick={clearFilter}>✕</button>
    {/if}
  </div>

  {#if error}
    <div class="error-banner mb-md">
      <span>{error}</span>
      <button class="dismiss-btn" onclick={() => (error = '')}>✕</button>
    </div>
  {/if}

  <div class="messages-container">
    {#if loading && chat.messages.length === 0}
      <div class="loading-state">
        <div class="spinner-small"></div>
        <span>Loading messages...</span>
      </div>
    {:else if filteredMessages.length === 0}
      <div class="empty-state">
        {#if filterHandle}
          <p>No messages from "{filterHandle}"</p>
        {:else}
          <p>No messages yet</p>
        {/if}
      </div>
    {:else}
      <ul class="message-list">
        {#each filteredMessages as msg (msg.id)}
          <li class="message-item" class:admin-message={msg.isAdmin}>
            <div class="message-header">
              <span class="sender" class:is-admin={msg.isAdmin}>
                @{msg.senderHandle}
                {#if msg.isAdmin}
                  <span class="admin-badge">ADMIN</span>
                {/if}
              </span>
              <span class="timestamp">{formatTime(msg.createdAt)}</span>
            </div>
            <div class="message-content">
              <p>{msg.content}</p>
              <button
                class="delete-btn"
                onclick={() => handleDelete(msg.id)}
                disabled={deletingId === msg.id}
                aria-label="Delete message"
              >
                {deletingId === msg.id ? '...' : '🗑️'}
              </button>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <div class="footer">
    <span class="message-count">
      {filteredMessages.length} message{filteredMessages.length !== 1 ? 's' : ''}
      {#if filterHandle}
        (filtered)
      {/if}
    </span>
  </div>
</section>

<style>
  .chat-mod {
    display: flex;
    flex-direction: column;
    max-height: 500px;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-md);
  }

  .header h2 {
    font-size: 1.2rem;
    margin: 0;
  }

  .refresh-btn {
    background: none;
    border: none;
    font-size: 1.2rem;
    padding: var(--space-sm);
    opacity: 0.7;
    transition: opacity 150ms;
  }

  .refresh-btn:hover:not(:disabled) {
    opacity: 1;
  }

  .refresh-btn:disabled {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .filter-bar {
    position: relative;
    margin-bottom: var(--space-md);
  }

  .filter-input {
    padding-right: 40px;
  }

  .clear-filter {
    position: absolute;
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: var(--color-text-muted);
    padding: var(--space-xs);
    font-size: 1rem;
  }

  .error-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background-color: rgba(248, 81, 73, 0.1);
    border: 1px solid var(--color-error);
    border-radius: var(--radius-md);
    padding: var(--space-sm) var(--space-md);
    color: var(--color-error);
    font-size: 0.9rem;
  }

  .dismiss-btn {
    background: none;
    border: none;
    color: var(--color-error);
    padding: var(--space-xs);
  }

  .messages-container {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 150px;
    color: var(--color-text-muted);
    gap: var(--space-sm);
  }

  .spinner-small {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-surface);
    border-top-color: var(--color-primary);
    border-radius: var(--radius-full);
    animation: spin 1s linear infinite;
  }

  .message-list {
    list-style: none;
  }

  .message-item {
    padding: var(--space-md);
    border-bottom: 1px solid var(--color-surface);
  }

  .message-item:last-child {
    border-bottom: none;
  }

  .message-item.admin-message {
    background-color: rgba(255, 215, 0, 0.05);
  }

  .message-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-xs);
  }

  .sender {
    font-weight: 500;
    font-size: 0.9rem;
    display: flex;
    align-items: center;
    gap: var(--space-xs);
  }

  .sender.is-admin {
    color: var(--color-secondary);
  }

  .admin-badge {
    font-size: 0.7rem;
    background-color: var(--color-secondary);
    color: var(--color-bg);
    padding: 2px 6px;
    border-radius: var(--radius-sm);
    font-weight: 600;
  }

  .timestamp {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }

  .message-content {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-md);
  }

  .message-content p {
    flex: 1;
    word-break: break-word;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  .delete-btn {
    background: none;
    border: none;
    padding: var(--space-xs);
    opacity: 0.5;
    transition: opacity 150ms;
    flex-shrink: 0;
  }

  .delete-btn:hover:not(:disabled) {
    opacity: 1;
  }

  .delete-btn:disabled {
    opacity: 0.3;
  }

  .footer {
    padding-top: var(--space-md);
    border-top: 1px solid var(--color-surface);
    margin-top: var(--space-md);
  }

  .message-count {
    font-size: 0.85rem;
    color: var(--color-text-muted);
  }
</style>
