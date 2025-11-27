<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte'
  import { auth, chat } from '$lib/stores'
  import { goto } from '$app/navigation'
  import { 
    getChatMessages, 
    sendChatMessage, 
    connectWebSocket, 
    removeWSHandler,
    sendWSMessage,
    type WSMessageHandler
  } from '$lib/api/client'
  import type { ChatMessage, WSServerMessage } from '@seedhunter/shared'
  
  let messageInput = $state('')
  let sending = $state(false)
  let loadingHistory = $state(true)
  let error = $state<string | null>(null)
  let messagesContainer: HTMLDivElement
  let shouldAutoScroll = $state(true)
  
  // WebSocket message handler
  const wsHandler: WSMessageHandler = (message: WSServerMessage) => {
    switch (message.type) {
      case 'chat':
        chat.addMessage(message.message)
        if (shouldAutoScroll) {
          scrollToBottom()
        }
        break
      case 'chat_deleted':
        chat.removeMessage(message.msgId)
        break
    }
  }
  
  onMount(async () => {
    // Check auth
    if (!auth.loading && !auth.isLoggedIn) {
      goto('/auth/login')
      return
    }
    
    // Wait for auth
    if (auth.loading) {
      const checkAuth = setInterval(() => {
        if (!auth.loading) {
          clearInterval(checkAuth)
          if (!auth.isLoggedIn) {
            goto('/auth/login')
          } else {
            initChat()
          }
        }
      }, 100)
    } else {
      initChat()
    }
  })
  
  async function initChat() {
    // Load message history
    try {
      const messages = await getChatMessages(100)
      chat.setMessages(messages)
      await tick()
      scrollToBottom()
    } catch (err) {
      console.error('Failed to load messages:', err)
      error = 'Failed to load messages'
    } finally {
      loadingHistory = false
    }
    
    // Connect WebSocket for realtime updates
    connectWebSocket(wsHandler)
    chat.setConnected(true)
  }
  
  onDestroy(() => {
    removeWSHandler(wsHandler)
  })
  
  function scrollToBottom() {
    if (messagesContainer) {
      // Use requestAnimationFrame to ensure DOM is updated
      requestAnimationFrame(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight
      })
    }
  }
  
  function handleScroll() {
    if (!messagesContainer) return
    
    const { scrollTop, scrollHeight, clientHeight } = messagesContainer
    // If user is near bottom (within 100px), auto-scroll on new messages
    shouldAutoScroll = scrollHeight - scrollTop - clientHeight < 100
  }
  
  async function handleSend() {
    const content = messageInput.trim()
    if (!content || sending) return
    
    sending = true
    error = null
    
    try {
      // Try WebSocket first for immediate delivery
      const sent = sendWSMessage({ type: 'chat', content })
      
      if (!sent) {
        // Fallback to REST API
        await sendChatMessage(content)
      }
      
      messageInput = ''
      shouldAutoScroll = true
      scrollToBottom()
    } catch (err) {
      console.error('Failed to send message:', err)
      error = err instanceof Error ? err.message : 'Failed to send message'
    } finally {
      sending = false
    }
  }
  
  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }
  
  function formatTime(timestamp: number): string {
    const date = new Date(timestamp)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  
  function isOwnMessage(message: ChatMessage): boolean {
    return message.senderHandle === auth.player?.xHandle
  }
</script>

<svelte:head>
  <title>Chat | Seedhunter</title>
</svelte:head>

<div class="page">
  <div class="chat-container">
    <!-- Header -->
    <div class="chat-header">
      <div class="header-info">
        <h1>Chat</h1>
        <div class="connection-status" class:connected={chat.connected}>
          <span class="status-dot"></span>
          <span>{chat.connected ? 'Connected' : 'Connecting...'}</span>
        </div>
      </div>
      <span class="online-count">{chat.messages.length} messages</span>
    </div>
    
    <!-- Messages -->
    <div 
      class="messages-container" 
      bind:this={messagesContainer}
      onscroll={handleScroll}
    >
      {#if loadingHistory}
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Loading messages...</p>
        </div>
      {:else if chat.messages.length === 0}
        <div class="empty-state">
          <span class="empty-icon">💬</span>
          <p>No messages yet</p>
          <small>Be the first to say hello!</small>
        </div>
      {:else}
        <div class="messages-list">
          {#each chat.messages as message (message.id)}
            <div 
              class="message" 
              class:own={isOwnMessage(message)}
              class:admin={message.isAdmin}
            >
              {#if !isOwnMessage(message)}
                <div class="message-avatar">
                  {#if message.isAdmin}
                    <span class="admin-badge">⭐</span>
                  {:else}
                    <span>👤</span>
                  {/if}
                </div>
              {/if}
              
              <div class="message-content">
                {#if !isOwnMessage(message)}
                  <div class="message-header">
                    <span class="sender-handle">@{message.senderHandle}</span>
                    {#if message.isAdmin}
                      <span class="admin-label">Admin</span>
                    {/if}
                  </div>
                {/if}
                <div class="message-bubble">
                  <p>{message.content}</p>
                </div>
                <span class="message-time">{formatTime(message.createdAt)}</span>
              </div>
            </div>
          {/each}
        </div>
      {/if}
      
      {#if !shouldAutoScroll && chat.messages.length > 0}
        <button class="scroll-to-bottom" onclick={() => { shouldAutoScroll = true; scrollToBottom() }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 5v14m0 0l-7-7m7 7l7-7" />
          </svg>
          New messages
        </button>
      {/if}
    </div>
    
    <!-- Error message -->
    {#if error}
      <div class="error-banner">
        <span>{error}</span>
        <button onclick={() => error = null}>✕</button>
      </div>
    {/if}
    
    <!-- Input -->
    {#if auth.isLoggedIn}
      <div class="input-container">
        <div class="input-wrapper">
          <input
            type="text"
            placeholder="Type a message..."
            bind:value={messageInput}
            onkeydown={handleKeydown}
            disabled={sending}
            maxlength="500"
          />
          <button 
            class="send-btn" 
            onclick={handleSend}
            disabled={!messageInput.trim() || sending}
          >
            {#if sending}
              <div class="spinner small"></div>
            {:else}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            {/if}
          </button>
        </div>
        <span class="char-count" class:warning={messageInput.length > 450}>
          {messageInput.length}/500
        </span>
      </div>
    {:else}
      <div class="login-prompt">
        <p>Sign in to join the chat</p>
        <a href="/auth/login" class="btn-primary">Connect with X</a>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
  
  .chat-container {
    flex: 1;
    display: flex;
    flex-direction: column;
    max-width: 600px;
    margin: 0 auto;
    width: 100%;
    background: var(--color-surface);
    overflow: hidden;
  }
  
  /* Header */
  .chat-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-md);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  
  .header-info h1 {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--color-text);
    margin-bottom: 2px;
  }
  
  .connection-status {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--color-text-muted);
  }
  
  .connection-status.connected .status-dot {
    background: var(--color-success);
  }
  
  .online-count {
    font-size: 0.8rem;
    color: var(--color-text-muted);
  }
  
  /* Messages */
  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: var(--space-md);
    background: var(--color-bg-secondary);
    position: relative;
  }
  
  .messages-list {
    display: flex;
    flex-direction: column;
    gap: var(--space-md);
  }
  
  .message {
    display: flex;
    gap: var(--space-sm);
    max-width: 85%;
  }
  
  .message.own {
    margin-left: auto;
    flex-direction: row-reverse;
  }
  
  .message-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--color-primary-light);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.9rem;
    flex-shrink: 0;
  }
  
  .message.admin .message-avatar {
    background: linear-gradient(135deg, var(--color-gold), #F5A623);
  }
  
  .admin-badge {
    font-size: 0.8rem;
  }
  
  .message-content {
    display: flex;
    flex-direction: column;
  }
  
  .message.own .message-content {
    align-items: flex-end;
  }
  
  .message-header {
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    margin-bottom: 2px;
  }
  
  .sender-handle {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text-secondary);
  }
  
  .admin-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    background: var(--color-gold);
    color: white;
    padding: 1px 4px;
    border-radius: 4px;
  }
  
  .message-bubble {
    background: var(--color-surface);
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-lg);
    border-top-left-radius: var(--radius-sm);
    box-shadow: var(--shadow-sm);
  }
  
  .message.own .message-bubble {
    background: var(--color-primary);
    color: white;
    border-top-left-radius: var(--radius-lg);
    border-top-right-radius: var(--radius-sm);
  }
  
  .message.admin .message-bubble {
    border: 2px solid var(--color-gold);
  }
  
  .message-bubble p {
    word-wrap: break-word;
    white-space: pre-wrap;
    line-height: 1.4;
  }
  
  .message-time {
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: 2px;
  }
  
  /* Scroll to bottom button */
  .scroll-to-bottom {
    position: absolute;
    bottom: var(--space-md);
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: var(--space-xs);
    padding: var(--space-xs) var(--space-md);
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-full);
    font-size: 0.8rem;
    font-weight: 600;
    box-shadow: var(--shadow-lg);
    animation: bounce 2s ease-in-out infinite;
  }
  
  .scroll-to-bottom svg {
    width: 16px;
    height: 16px;
  }
  
  @keyframes bounce {
    0%, 100% { transform: translateX(-50%) translateY(0); }
    50% { transform: translateX(-50%) translateY(-4px); }
  }
  
  /* Empty/Loading states */
  .loading-state, .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    min-height: 200px;
    color: var(--color-text-muted);
  }
  
  .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--space-md);
  }
  
  .empty-state p {
    font-weight: 600;
    color: var(--color-text-secondary);
  }
  
  .empty-state small {
    font-size: 0.85rem;
  }
  
  /* Error banner */
  .error-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    background: rgba(231, 76, 60, 0.1);
    color: var(--color-error);
    font-size: 0.85rem;
  }
  
  .error-banner button {
    background: none;
    padding: var(--space-xs);
    color: var(--color-error);
  }
  
  /* Input */
  .input-container {
    padding: var(--space-md);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    flex-shrink: 0;
  }
  
  .input-wrapper {
    display: flex;
    gap: var(--space-sm);
  }
  
  .input-wrapper input {
    flex: 1;
    padding: var(--space-md);
    border-radius: var(--radius-full);
    font-size: 0.95rem;
  }
  
  .send-btn {
    width: 48px;
    height: 48px;
    padding: 0;
    border-radius: 50%;
    background: var(--color-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  
  .send-btn:disabled {
    background: var(--color-border);
    color: var(--color-text-muted);
  }
  
  .send-btn svg {
    width: 20px;
    height: 20px;
  }
  
  .char-count {
    display: block;
    text-align: right;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    margin-top: var(--space-xs);
  }
  
  .char-count.warning {
    color: var(--color-warning);
  }
  
  /* Spinner */
  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  
  .spinner.small {
    width: 18px;
    height: 18px;
    border-width: 2px;
    border-color: rgba(255, 255, 255, 0.3);
    border-top-color: white;
  }
  
  /* Login prompt */
  .login-prompt {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--space-sm);
    padding: var(--space-lg);
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
  }
  
  .login-prompt p {
    color: var(--color-text-muted);
    font-size: 0.9rem;
  }
</style>
