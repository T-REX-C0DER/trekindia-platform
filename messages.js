/**
 * TrekIndia — Full-Screen Messaging System Engine (v3.0)
 * Real-time messaging powered by WebSockets, Kafka streaming backbone.
 * Completely redesigned message layout, date grouping, delete message/chat,
 * enhanced search, smart grouping, and real-time WS delete events.
 */

(function () {
  'use strict';

  // ─── AVATAR CATALOG (DiceBear + Unsplash fallbacks) ─────────────────────────
  const DEFAULT_AVATAR = 'https://api.dicebear.com/7.x/adventurer/svg?seed=trekindia&backgroundColor=2d6a4f';

  function getAvatarSrc(url) {
    if (!url) return DEFAULT_AVATAR;
    return url;
  }

  function handleAvatarError(imgEl) {
    if (imgEl && !imgEl.dataset.fallbackApplied) {
      imgEl.dataset.fallbackApplied = '1';
      imgEl.src = DEFAULT_AVATAR;
    }
  }

  // ─── STATE STORE ────────────────────────────────────────────────────────────
  const state = {
    currentUser: null,
    conversations: [],
    activeConversationId: null,
    activeConversationData: null,
    onlineUsers: new Set(),
    activeFilterTab: 'all',
    searchQuery: '',
    availableTreks: [],
    isMobileView: window.innerWidth <= 768
  };

  // Confirm dialog state
  let confirmPendingAction = null;

  // WebSocket references
  let wsClient = null;
  let wsReconnectTimer = null;
  let wsReconnectDelay = 1000;
  let wsPingTimer = null;
  let typingTimeout = null;
  let lastTypingSentAt = 0;
  let searchDebounceTimer = null;

  // ─── 1. INITIALIZATION ──────────────────────────────────────────────────────
  async function init() {
    initTheme();
    initWindowResize();

    const user = await checkAuthentication();
    if (!user) {
      window.location.href = 'auth.html?redirect=/messages&message=auth_required';
      return;
    }

    state.currentUser = user;
    updateUserAvatarUI(user);

    bindEventListeners();
    initWebSocket();
    loadAvailableTreks();

    await loadConversations();
    handleUrlParameters();

    window.addEventListener('trekindia:user-updated', (e) => {
      if (e.detail) {
        state.currentUser = { ...(state.currentUser || {}), ...e.detail };
        updateUserAvatarUI(state.currentUser);
      }
    });
  }

  // ─── 2. AUTHENTICATION GUARD ───────────────────────────────────────────────
  async function checkAuthentication() {
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { 'Accept': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) return data.user;
      }
    } catch (err) {
      console.warn('[Messaging] Auth verification error:', err);
    }
    return null;
  }

  function updateUserAvatarUI(user) {
    const avatarEl = document.getElementById('msgNavUserAvatar');
    if (avatarEl && user) {
      avatarEl.src = getAvatarSrc(user.profile_image);
      avatarEl.title = `${user.full_name || user.username} (@${user.username})`;
      avatarEl.onerror = () => handleAvatarError(avatarEl);
    }
  }

  // ─── 3. THEME & BRAND ───────────────────────────────────────────────────────
  function initTheme() {
    const savedTheme = localStorage.getItem('trekindia-theme') || 'dark';
    if (savedTheme === 'dark') {
      document.body.classList.add('dark');
    } else {
      document.body.classList.remove('dark');
    }
    syncBrandLogo();

    const themeToggleBtn = document.getElementById('themeToggleBtn');
    if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', () => {
        document.body.classList.toggle('dark');
        const isDark = document.body.classList.contains('dark');
        localStorage.setItem('trekindia-theme', isDark ? 'dark' : 'light');
        syncBrandLogo();
      });
    }
  }

  function syncBrandLogo() {
    const isDark = document.body.classList.contains('dark');
    const lightIcons = document.querySelectorAll('.brand-icon-img.light-icon');
    const darkIcons = document.querySelectorAll('.brand-icon-img.dark-icon');
    if (isDark) {
      lightIcons.forEach(el => el.style.display = 'none');
      darkIcons.forEach(el => el.style.display = 'block');
    } else {
      lightIcons.forEach(el => el.style.display = 'block');
      darkIcons.forEach(el => el.style.display = 'none');
    }
  }

  function initWindowResize() {
    window.addEventListener('resize', () => {
      state.isMobileView = window.innerWidth <= 768;
    });
  }

  // ─── 4. WEBSOCKET & KAFKA STREAMING BACKBONE ────────────────────────────────
  function initWebSocket() {
    if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/messages`;

    console.log(`[WebSocket] Connecting to ${wsUrl}...`);
    updateWsStatusUI('connecting');

    try {
      wsClient = new WebSocket(wsUrl);
    } catch (err) {
      console.warn('[WebSocket] Creation failed:', err);
      scheduleWsReconnect();
      return;
    }

    wsClient.onopen = () => {
      console.log('✅ [WebSocket] Connected to TrekIndia messaging streaming gateway.');
      updateWsStatusUI('connected');
      wsReconnectDelay = 1000;

      if (wsPingTimer) clearInterval(wsPingTimer);
      wsPingTimer = setInterval(() => {
        if (wsClient && wsClient.readyState === WebSocket.OPEN) {
          wsClient.send(JSON.stringify({ type: 'ping' }));
        }
      }, 25000);

      loadConversations(false);
    };

    wsClient.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleIncomingWsEvent(data);
      } catch (err) {
        console.warn('[WebSocket] Malformed event payload:', err);
      }
    };

    wsClient.onclose = (e) => {
      console.warn(`⚠️ [WebSocket] Disconnected (code: ${e.code}). Reconnecting...`);
      updateWsStatusUI('disconnected');
      if (wsPingTimer) clearInterval(wsPingTimer);
      scheduleWsReconnect();
    };

    wsClient.onerror = (err) => {
      console.warn('[WebSocket] Socket error:', err);
      updateWsStatusUI('disconnected');
      try { wsClient.close(); } catch (_) {}
    };
  }

  function scheduleWsReconnect() {
    if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
    wsReconnectTimer = setTimeout(() => {
      wsReconnectDelay = Math.min(wsReconnectDelay * 1.5, 15000);
      initWebSocket();
    }, wsReconnectDelay);
  }

  function updateWsStatusUI(status) {
    const dot = document.getElementById('wsStatusDot');
    const text = document.getElementById('wsStatusText');
    const banner = document.getElementById('chatReconnectBanner');

    if (status === 'connected') {
      if (dot) dot.className = 'msg-status-dot live';
      if (text) text.textContent = 'Live';
      if (banner) banner.classList.remove('visible');
    } else if (status === 'connecting') {
      if (dot) dot.className = 'msg-status-dot connecting';
      if (text) text.textContent = 'Connecting...';
      if (banner) banner.classList.add('visible');
    } else {
      if (dot) dot.className = 'msg-status-dot';
      if (text) text.textContent = 'Offline';
      if (banner) banner.classList.add('visible');
    }
  }

  function handleIncomingWsEvent(data) {
    switch (data.type) {
      case 'connection.established':
        if (Array.isArray(data.online_users)) {
          state.onlineUsers = new Set(data.online_users.map(String));
          updatePresenceIndicators();
        }
        break;

      case 'message.new':
        handleIncomingMessage(data.message);
        break;

      case 'message.deleted':
        handleMessageDeletedEvent(data);
        break;

      case 'message.status_update':
        handleMessageStatusUpdate(data);
        break;

      case 'message.read_receipt':
        handleReadReceipt(data);
        break;

      case 'user.presence':
        handleUserPresenceUpdate(data);
        break;

      case 'user.typing':
        handleUserTyping(data);
        break;

      default:
        break;
    }
  }

  function handleIncomingMessage(msg) {
    if (!msg) return;
    const convId = parseInt(msg.conversation_id, 10);
    const isActiveConv = state.activeConversationId === convId;

    if (isActiveConv) {
      const messagesBody = document.getElementById('chatMessagesBody');
      const existingEl = document.querySelector(`[data-client-msg-id="${msg.client_message_id}"]`) ||
                         document.querySelector(`[data-msg-id="${msg.message_id}"]`);

      if (existingEl) {
        existingEl.setAttribute('data-msg-id', msg.message_id);
        const timeEl = existingEl.querySelector('.msg-time');
        const statusEl = existingEl.querySelector('.msg-status');
        if (timeEl && msg.created_at) timeEl.textContent = msg.created_at;
        if (statusEl) {
          statusEl.className = `msg-status ${msg.status || 'sent'}`;
          statusEl.innerHTML = getStatusIconHtml(msg.status || 'sent');
        }
      } else {
        if (messagesBody) {
          const isSelf = msg.sender_id === state.currentUser?.user_id;
          const rowEl = document.createElement('div');
          rowEl.innerHTML = renderSingleMessageRow(msg, isSelf, false, true);
          if (rowEl.firstElementChild) {
            messagesBody.appendChild(rowEl.firstElementChild);
            scrollToBottom(messagesBody);
          }
        }
      }

      if (msg.sender_id !== state.currentUser?.user_id) {
        fetch(`/api/community/messages/conversations/${convId}/read`, {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
      }
    }

    let conv = state.conversations.find(c => c.conversation_id === convId);
    const snippet = msg.content || (msg.message_type === 'trek_card' ? `Shared Trek: ${msg.trek_data?.name || 'Trek'}` : '📷 Photo');

    if (conv) {
      conv.last_message = snippet;
      conv.last_message_time = 'Just now';
      if (!isActiveConv && msg.sender_id !== state.currentUser?.user_id) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
    } else {
      loadConversations(false);
    }

    renderConversationsList();
    updateUnreadBadgeCount();
  }

  // ─── HANDLE REAL-TIME MESSAGE DELETE ────────────────────────────────────────
  function handleMessageDeletedEvent(data) {
    const { conversation_id, message_id } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;

    const msgEl = document.querySelector(`[data-msg-id="${message_id}"]`);
    if (msgEl) {
      const bubbleEl = msgEl.querySelector('.msg-bubble');
      if (bubbleEl) {
        bubbleEl.textContent = 'This message was deleted.';
        bubbleEl.classList.add('deleted-msg');
      }
      // Remove action buttons since message is deleted
      const actionsEl = msgEl.querySelector('.msg-actions');
      if (actionsEl) actionsEl.remove();
    }
  }

  function handleMessageStatusUpdate(data) {
    const { conversation_id, message_id, status, client_message_id } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;

    const msgEl = document.querySelector(`[data-msg-id="${message_id}"]`) ||
                  (client_message_id ? document.querySelector(`[data-client-msg-id="${client_message_id}"]`) : null);

    if (msgEl) {
      const statusIconEl = msgEl.querySelector('.msg-status');
      if (statusIconEl) {
        statusIconEl.className = `msg-status ${status}`;
        statusIconEl.innerHTML = getStatusIconHtml(status);
      }
    }
  }

  function handleReadReceipt(data) {
    const { conversation_id } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;

    document.querySelectorAll('.msg-row.outgoing .msg-status').forEach(icon => {
      icon.className = 'msg-status read';
      icon.innerHTML = getStatusIconHtml('read');
    });
  }

  function handleUserPresenceUpdate(data) {
    const { user_id, status } = data;
    const uid = String(user_id);

    if (status === 'online') {
      state.onlineUsers.add(uid);
    } else {
      state.onlineUsers.delete(uid);
    }

    updatePresenceIndicators();

    if (state.activeConversationData && String(state.activeConversationData.participant?.user_id) === uid) {
      const onlineDot = document.getElementById('chatHeadOnlineDot');
      const statusText = document.getElementById('chatHeadStatus');
      const isOnline = status === 'online';

      if (onlineDot) onlineDot.className = `msg-chat-head-status-dot ${isOnline ? 'online' : ''}`;
      if (statusText) {
        statusText.className = `msg-chat-head-sub ${isOnline ? 'online' : ''}`;
        statusText.textContent = isOnline ? '● Active now' : 'Offline';
      }
    }
  }

  function handleUserTyping(data) {
    const { conversation_id, user_id, is_typing } = data;
    if (state.activeConversationId !== parseInt(conversation_id, 10)) return;
    if (String(user_id) === String(state.currentUser?.user_id)) return;

    const typingIndicator = document.getElementById('chatTypingIndicator');
    const typingName = document.getElementById('typingName');
    if (!typingIndicator) return;

    if (is_typing) {
      const activeConv = state.conversations.find(c => c.conversation_id === state.activeConversationId);
      if (typingName) {
        typingName.textContent = activeConv?.participant?.full_name?.split(' ')[0] || 'Trekker';
      }
      typingIndicator.classList.add('visible');
      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        typingIndicator.classList.remove('visible');
      }, 3500);
    } else {
      typingIndicator.classList.remove('visible');
    }
  }

  function updatePresenceIndicators() {
    document.querySelectorAll('.msg-conv-item').forEach(item => {
      const participantId = item.getAttribute('data-participant-id');
      const isOnline = participantId && state.onlineUsers.has(String(participantId));
      const dot = item.querySelector('.msg-online-dot');
      if (dot) dot.classList.toggle('visible', Boolean(isOnline));
    });
  }

  function getStatusIconHtml(status) {
    if (status === 'read') {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;
    } else if (status === 'delivered') {
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;
    } else {
      return `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
  }

  // ─── 5. CONVERSATIONS MANAGEMENT ───────────────────────────────────────────
  async function loadConversations(autoSelect = true) {
    try {
      const res = await fetch('/api/community/messages/conversations', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.conversations) {
        state.conversations = data.conversations;
        renderConversationsList();
        updateUnreadBadgeCount();

        const urlParams = new URLSearchParams(window.location.search);
        const hasUrlConv = urlParams.has('conv') || urlParams.has('user');

        if (autoSelect && !hasUrlConv && !state.activeConversationId && data.conversations.length > 0 && !state.isMobileView) {
          selectConversation(data.conversations[0].conversation_id);
        } else if (data.conversations.length === 0) {
          showEmptyChatView();
        }
      }
    } catch (err) {
      console.error('[Messaging] Failed to load conversations:', err);
    }
  }

  function renderConversationsList() {
    const container = document.getElementById('conversationsList');
    if (!container) return;

    let list = state.conversations || [];

    if (state.activeFilterTab === 'unread') {
      list = list.filter(c => (c.unread_count || 0) > 0);
    }

    if (state.searchQuery) {
      const q = state.searchQuery.toLowerCase();
      list = list.filter(c =>
        (c.participant?.full_name || '').toLowerCase().includes(q) ||
        (c.participant?.username || '').toLowerCase().includes(q) ||
        (c.last_message || '').toLowerCase().includes(q)
      );
    }

    if (list.length === 0) {
      container.innerHTML = `
        <div class="msg-conv-empty">
          <div class="empty-icon">💬</div>
          <strong>No Conversations Found</strong>
          <p>${state.searchQuery ? 'Try adjusting your search query.' : 'Click "New Chat" to connect with fellow trekkers.'}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = list.map(conv => {
      const isOnline = conv.participant?.online_status === 'online' || state.onlineUsers.has(String(conv.participant?.user_id));
      const isActive = conv.conversation_id === state.activeConversationId;
      const isUnread = (conv.unread_count || 0) > 0;
      const avatarSrc = getAvatarSrc(conv.participant?.avatar);

      return `
        <div class="msg-conv-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}"
             data-conv-id="${conv.conversation_id}"
             data-participant-id="${conv.participant?.user_id || ''}">
          <div class="msg-conv-avatar-wrap">
            <img src="${escapeHtml(avatarSrc)}"
                 alt="${escapeHtml(conv.participant?.full_name || 'Trekker')}"
                 class="msg-conv-avatar"
                 onerror="this.src='${DEFAULT_AVATAR}'" />
            <span class="msg-online-dot ${isOnline ? 'visible' : ''}"></span>
          </div>
          <div class="msg-conv-meta">
            <div class="msg-conv-name-row">
              <span class="msg-conv-name">${escapeHtml(conv.participant?.full_name || 'Trekker')}</span>
              <span class="msg-conv-time">${escapeHtml(conv.last_message_time || '')}</span>
            </div>
            <div class="msg-conv-snippet-row">
              <span class="msg-conv-snippet">${escapeHtml(conv.last_message || 'Start conversation...')}</span>
              ${conv.unread_count > 0 ? `<span class="msg-conv-unread-pill">${conv.unread_count}</span>` : ''}
            </div>
          </div>
          <button class="msg-conv-menu-btn" data-conv-id="${conv.conversation_id}" aria-label="Conversation options" title="Options">⋮</button>
          <div class="msg-conv-dropdown" id="convDropdown_${conv.conversation_id}">
            <button class="msg-conv-dropdown-item" data-action="view-profile" data-participant-id="${conv.participant?.user_id || ''}">
              👤 View Profile
            </button>
            <button class="msg-conv-dropdown-item danger" data-action="delete-chat" data-conv-id="${conv.conversation_id}">
              🗑️ Delete Chat
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers
    container.querySelectorAll('.msg-conv-item').forEach(el => {
      el.addEventListener('click', (e) => {
        // Don't trigger if clicked on menu button or dropdown
        if (e.target.closest('.msg-conv-menu-btn') || e.target.closest('.msg-conv-dropdown')) return;
        const id = parseInt(el.getAttribute('data-conv-id'), 10);
        selectConversation(id);
      });
    });

    // Context menu buttons
    container.querySelectorAll('.msg-conv-menu-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const convId = btn.getAttribute('data-conv-id');
        // Close all other dropdowns
        container.querySelectorAll('.msg-conv-dropdown.open').forEach(d => {
          if (d.id !== `convDropdown_${convId}`) d.classList.remove('open');
        });
        const dropdown = document.getElementById(`convDropdown_${convId}`);
        if (dropdown) dropdown.classList.toggle('open');
      });
    });

    // Dropdown action items
    container.querySelectorAll('.msg-conv-dropdown-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = item.getAttribute('data-action');
        // Close dropdown
        item.closest('.msg-conv-dropdown')?.classList.remove('open');

        if (action === 'view-profile') {
          window.location.href = 'community.html#trekkers';
        } else if (action === 'delete-chat') {
          const convId = item.getAttribute('data-conv-id');
          showConfirmDialog({
            icon: '🗑️',
            title: 'Delete this chat?',
            message: 'This will remove the conversation from your chat list. The other person\'s messages won\'t be affected.',
            actionLabel: 'Delete Chat',
            onConfirm: () => deleteConversationForMe(parseInt(convId, 10))
          });
        }
      });
    });

    // Close dropdowns when clicking outside
    document.addEventListener('click', () => {
      container.querySelectorAll('.msg-conv-dropdown.open').forEach(d => d.classList.remove('open'));
    }, { once: false, capture: false });
  }

  function updateUnreadBadgeCount() {
    const totalUnread = (state.conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const badge = document.getElementById('convUnreadBadge');
    if (badge) {
      badge.textContent = totalUnread;
      badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    }
  }

  // ─── 6. DELETE CONVERSATION FOR ME ──────────────────────────────────────────
  async function deleteConversationForMe(convId) {
    try {
      const res = await fetch(`/api/community/messages/conversations/${convId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        state.conversations = state.conversations.filter(c => c.conversation_id !== convId);
        if (state.activeConversationId === convId) {
          showEmptyChatView();
        }
        renderConversationsList();
        updateUnreadBadgeCount();
        showToast('Chat removed from your list.');
      } else {
        showToast('Failed to delete chat. Try again.');
      }
    } catch (err) {
      console.error('[Messaging] Delete conversation error:', err);
      showToast('Failed to delete chat. Check connection.');
    }
  }

  // ─── 7. ACTIVE CHAT AREA & SMART DATE GROUPING ──────────────────────────────
  async function selectConversation(conversationId) {
    const convId = parseInt(conversationId, 10);
    state.activeConversationId = convId;

    const url = new URL(window.location.href);
    url.searchParams.set('conv', convId);
    url.searchParams.delete('user');
    window.history.pushState({ convId }, '', url.toString());

    document.querySelectorAll('.msg-conv-item').forEach(el => {
      const id = parseInt(el.getAttribute('data-conv-id'), 10);
      el.classList.toggle('active', id === convId);
    });

    const pane = document.getElementById('msgPane');
    if (pane) pane.classList.add('chat-active');

    const targetConv = state.conversations.find(c => c.conversation_id === convId);
    if (targetConv) {
      targetConv.unread_count = 0;
      renderConversationsList();
      updateUnreadBadgeCount();
    }

    try {
      const res = await fetch(`/api/community/messages/conversations/${convId}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.conversation) {
        state.activeConversationData = data.conversation;
        renderActiveChat(data.conversation);
      }
    } catch (err) {
      console.error('[Messaging] Failed to load chat conversation:', err);
      showToast('Could not load chat. Check connection.');
    }
  }

  function showEmptyChatView() {
    state.activeConversationId = null;
    state.activeConversationData = null;

    const header = document.getElementById('chatHeader');
    const messagesBody = document.getElementById('chatMessagesBody');
    const composer = document.getElementById('chatComposer');
    const emptyState = document.getElementById('emptyChatState');

    if (header) header.style.display = 'none';
    if (messagesBody) messagesBody.style.display = 'none';
    if (composer) composer.style.display = 'none';
    if (emptyState) emptyState.style.display = 'flex';

    const pane = document.getElementById('msgPane');
    if (pane) pane.classList.remove('chat-active');
  }

  function renderActiveChat(conv) {
    const header = document.getElementById('chatHeader');
    const messagesBody = document.getElementById('chatMessagesBody');
    const composer = document.getElementById('chatComposer');
    const emptyState = document.getElementById('emptyChatState');
    const chatInput = document.getElementById('chatTextInput');

    if (emptyState) emptyState.style.display = 'none';
    if (header) header.style.display = 'flex';
    if (messagesBody) messagesBody.style.display = 'flex';
    if (composer) composer.style.display = 'block';

    const firstName = conv.participant?.full_name?.split(' ')[0] || 'Trekker';
    if (chatInput) {
      chatInput.placeholder = `Message ${firstName}...`;
      chatInput.focus();
    }

    // Populate Header
    const avatar = document.getElementById('chatHeadAvatar');
    const name = document.getElementById('chatHeadName');
    const onlineDot = document.getElementById('chatHeadOnlineDot');
    const statusText = document.getElementById('chatHeadStatus');
    const trekBadge = document.getElementById('chatHeadActiveTrek');
    const trekText = document.getElementById('chatHeadActiveTrekText');

    const isOnline = conv.participant?.online_status === 'online' || state.onlineUsers.has(String(conv.participant?.user_id));

    if (avatar) {
      avatar.src = getAvatarSrc(conv.participant?.avatar);
      avatar.onerror = () => handleAvatarError(avatar);
    }
    if (name) name.textContent = conv.participant?.full_name || 'Trekker';
    if (onlineDot) onlineDot.className = `msg-chat-head-status-dot ${isOnline ? 'online' : ''}`;
    if (statusText) {
      statusText.className = `msg-chat-head-sub ${isOnline ? 'online' : ''}`;
      statusText.textContent = isOnline ? '● Active now' : (conv.participant?.last_active || 'Offline');
    }

    if (trekBadge && trekText) {
      if (conv.participant?.active_trek) {
        trekBadge.classList.add('visible');
        trekText.textContent = `Active Trek · ${conv.participant.active_trek}`;
      } else {
        trekBadge.classList.remove('visible');
      }
    }

    const viewProfileBtn = document.getElementById('chatViewProfileBtn');
    if (viewProfileBtn && conv.participant?.user_id) {
      viewProfileBtn.onclick = () => {
        window.location.href = `community.html#trekkers`;
      };
    }

    // Render Messages with Smart Date Grouping
    if (messagesBody) {
      if (!conv.messages || conv.messages.length === 0) {
        messagesBody.innerHTML = `
          <div style="padding: 60px 20px; text-align: center; color: var(--msg-text-muted); margin: auto; display: flex; flex-direction: column; align-items: center;">
            <div style="font-size: 3rem; margin-bottom: 12px;">🏔️</div>
            <strong style="color: var(--msg-text-primary); font-size: 1rem; display: block; margin-bottom: 6px;">Beginning of Trail Conversation</strong>
            <p style="font-size: 0.82rem; max-width: 300px; line-height: 1.5;">Say hello or share a TrekIndia route to coordinate your upcoming trek!</p>
          </div>
        `;
      } else {
        messagesBody.innerHTML = buildMessagesHtml(conv.messages);
        scrollToBottom(messagesBody);
      }
    }
  }

  // ─── SMART DATE GROUPING & MESSAGE HTML BUILDER ──────────────────────────────
  function buildMessagesHtml(messages) {
    let html = '';
    let lastDateKey = null;
    let prevSenderId = null;

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i];
      const isSelf = Boolean(msg.is_self || String(msg.sender_id) === String(state.currentUser?.user_id));

      // Calculate reliable Date object and date key
      const dateObj = parseMessageDate(msg.raw_created_at || msg.created_at);
      const dateKey = `${dateObj.getFullYear()}-${dateObj.getMonth()}-${dateObj.getDate()}`;

      // Date divider only once per day boundary
      if (dateKey !== lastDateKey) {
        const dateLabel = getMessageDateLabelFromDate(dateObj);
        html += `<div class="msg-date-separator"><span>${escapeHtml(dateLabel)}</span></div>`;
        lastDateKey = dateKey;
        prevSenderId = null; // reset grouping on date change
      }

      // Determine grouping — consecutive messages from same sender
      const nextMsg = messages[i + 1];
      const sameAsPrev = prevSenderId !== null && String(prevSenderId) === String(msg.sender_id);
      const sameAsNext = nextMsg && String(nextMsg.sender_id) === String(msg.sender_id);

      // isGrouped = this message is part of a consecutive group AND NOT the first in the group
      const isGrouped = sameAsPrev;
      // Show avatar only on the last message of a consecutive group
      const showAvatar = !isSelf && !sameAsNext;

      html += renderSingleMessageRow(msg, isSelf, isGrouped, showAvatar);
      prevSenderId = msg.sender_id;
    }

    return html;
  }

  function parseMessageDate(dateVal) {
    if (!dateVal) return new Date();
    if (dateVal instanceof Date) return dateVal;
    
    // If it is a time-only string like "04:50 PM", treat as today
    if (typeof dateVal === 'string' && /^\d{1,2}:\d{2}/.test(dateVal) && !dateVal.includes('-') && !dateVal.includes('T')) {
      return new Date();
    }

    try {
      const d = new Date(dateVal);
      if (!isNaN(d.getTime())) return d;
    } catch (_) {}
    return new Date();
  }

  function getMessageDateLabelFromDate(d) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - msgDay) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'TODAY';
    if (diffDays === 1) return 'YESTERDAY';

    const monthNames = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
    const day = d.getDate();
    const month = monthNames[d.getMonth()];
    const currentYear = now.getFullYear();
    const msgYear = d.getFullYear();

    if (msgYear === currentYear) {
      return `${day} ${month}`;
    }
    return `${day} ${month} ${msgYear}`;
  }

  // ─── RENDER SINGLE MESSAGE ROW ───────────────────────────────────────────────
  function renderSingleMessageRow(msg, isSelf, isGrouped = false, showAvatar = true) {
    const status = msg.status || 'sent';
    const rowClass = `msg-row ${isSelf ? 'outgoing' : 'incoming'} ${isGrouped ? 'is-grouped' : 'sender-changed'}`;
    const msgId = escapeHtml(msg.message_id || '');
    const clientMsgId = escapeHtml(msg.client_message_id || '');

    // Avatar HTML for incoming messages
    const avatarSrc = getAvatarSrc(msg.avatar);
    const avatarHtml = !isSelf
      ? `<img src="${escapeHtml(avatarSrc)}" class="msg-row-avatar ${showAvatar ? '' : 'hidden'}" alt="" onerror="this.src='${DEFAULT_AVATAR}'" />`
      : '';

    // Delete action (only for own messages) + timestamp
    const deleteActionHtml = isSelf
      ? `<div class="msg-actions">
           <button class="msg-action-btn delete-btn" data-msg-id="${msgId}" data-conv-id="${msg.conversation_id || ''}" aria-label="Delete message" title="Delete message">
             <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
           </button>
         </div>`
      : '';

    const timeHtml = `<span class="msg-time">${escapeHtml(msg.created_at || '')}</span>`;
    const statusHtml = isSelf
      ? `<span class="msg-status ${status}">${getStatusIconHtml(status)}</span>`
      : '';

    const footerHtml = `<div class="msg-footer">${timeHtml}${statusHtml}</div>`;

    // 1. Trek Card Message
    if (msg.message_type === 'trek_card' && msg.trek_data) {
      const trek = msg.trek_data;
      return `
        <div class="${rowClass}" data-msg-id="${msgId}" data-client-msg-id="${clientMsgId}">
          ${avatarHtml}
          <div class="msg-content-wrap">
            ${deleteActionHtml}
            <div class="msg-trek-card">
              <div class="msg-trek-card-img">
                <img src="${escapeHtml(trek.image || 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600')}" alt="${escapeHtml(trek.name)}" />
                <span class="msg-trek-diff-badge">${escapeHtml(trek.difficulty || 'MODERATE')}</span>
              </div>
              <div class="msg-trek-card-body">
                <div class="msg-trek-card-name">🏔️ ${escapeHtml(trek.name)}</div>
                <div class="msg-trek-card-stats">
                  <span>⛰️ ${escapeHtml(trek.elevation || trek.altitude || '3,800m')}</span>
                  <span>⏱️ ${escapeHtml(trek.distance || trek.duration || '6 Days')}</span>
                </div>
                <button type="button" class="msg-trek-view-btn" onclick="window.location.href='index.html#treks'">
                  <span>View Route Details</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
            </div>
            ${footerHtml}
          </div>
        </div>
      `;
    }

    // 2. Photo Message
    if (msg.message_type === 'image' && msg.attachment_url) {
      return `
        <div class="${rowClass}" data-msg-id="${msgId}" data-client-msg-id="${clientMsgId}">
          ${avatarHtml}
          <div class="msg-content-wrap">
            ${deleteActionHtml}
            <div class="msg-photo-bubble">
              <img src="${escapeHtml(msg.attachment_url)}" alt="Trail attachment" onclick="window.open(this.src, '_blank')" />
            </div>
            ${footerHtml}
          </div>
        </div>
      `;
    }

    // 3. Regular Text Message
    return `
      <div class="${rowClass}" data-msg-id="${msgId}" data-client-msg-id="${clientMsgId}">
        ${avatarHtml}
        <div class="msg-content-wrap">
          ${deleteActionHtml}
          <div class="msg-bubble">${escapeHtml(msg.content || '')}</div>
          ${footerHtml}
        </div>
      </div>
    `;
  }

  // ─── 8. SENDING MESSAGES ────────────────────────────────────────────────────
  async function sendChatMessage(customPayload = null) {
    if (!state.activeConversationId) return;

    let payload = customPayload;
    const clientMessageId = `cmsg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    if (!payload) {
      const textInput = document.getElementById('chatTextInput');
      if (!textInput || !textInput.value.trim()) return;

      const content = textInput.value.trim();
      payload = {
        message_type: 'text',
        content,
        client_message_id: clientMessageId
      };
      textInput.value = '';
      textInput.style.height = 'auto';
      updateSendButtonState();
    } else {
      payload.client_message_id = clientMessageId;
    }

    const sendBtn = document.getElementById('chatSendBtn');
    if (sendBtn) sendBtn.disabled = true;

    // Optimistic UI
    const messagesBody = document.getElementById('chatMessagesBody');
    if (messagesBody) {
      const optimisticMsg = {
        message_id: 'temp_' + Date.now(),
        client_message_id: clientMessageId,
        sender_id: state.currentUser?.user_id,
        avatar: state.currentUser?.profile_image,
        message_type: payload.message_type,
        content: payload.content,
        trek_data: payload.trek_data,
        attachment_url: payload.attachment_url,
        status: 'sent',
        created_at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        is_self: true
      };

      // Check if we need a date separator for today
      const allSeparators = messagesBody.querySelectorAll('.msg-date-separator span');
      let hasTodaySep = false;
      if (allSeparators.length > 0) {
        const lastSepText = allSeparators[allSeparators.length - 1].textContent.trim().toUpperCase();
        if (lastSepText === 'TODAY') {
          hasTodaySep = true;
        }
      }
      if (!hasTodaySep) {
        const sep = document.createElement('div');
        sep.className = 'msg-date-separator';
        sep.innerHTML = `<span>TODAY</span>`;
        messagesBody.appendChild(sep);
      }

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderSingleMessageRow(optimisticMsg, true, false, false);
      if (tempDiv.firstElementChild) {
        const newMsgEl = tempDiv.firstElementChild;
        messagesBody.appendChild(newMsgEl);
        scrollToBottom(messagesBody);
        // Bind delete for the optimistic message
        bindMessageDeleteButtons(newMsgEl);
      }
    }

    try {
      const res = await fetch(`/api/community/messages/conversations/${state.activeConversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.message) {
        const msgEl = document.querySelector(`[data-client-msg-id="${clientMessageId}"]`);
        if (msgEl) {
          msgEl.setAttribute('data-msg-id', data.message.message_id);
          const timeEl = msgEl.querySelector('.msg-time');
          const statusIcon = msgEl.querySelector('.msg-status');
          if (timeEl && data.message.created_at) timeEl.textContent = data.message.created_at;
          if (statusIcon) {
            statusIcon.className = 'msg-status sent';
            statusIcon.innerHTML = getStatusIconHtml('sent');
          }
          // Update delete button with real message id
          const deleteBtn = msgEl.querySelector('.msg-action-btn.delete-btn');
          if (deleteBtn) deleteBtn.setAttribute('data-msg-id', data.message.message_id);
        }
      }
    } catch (err) {
      console.error('[Messaging] Send failed:', err);
      showToast('Unable to deliver message. Check connection.');
    } finally {
      updateSendButtonState();
    }
  }

  function scrollToBottom(el) {
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }

  function updateSendButtonState() {
    const textInput = document.getElementById('chatTextInput');
    const sendBtn = document.getElementById('chatSendBtn');
    if (textInput && sendBtn) {
      sendBtn.disabled = !textInput.value.trim();
    }
  }

  function emitTypingIndicator() {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN || !state.activeConversationId) return;
    const now = Date.now();
    if (now - lastTypingSentAt > 2000) {
      lastTypingSentAt = now;
      wsClient.send(JSON.stringify({
        type: 'user.typing',
        conversation_id: state.activeConversationId,
        is_typing: true
      }));
    }
  }

  // ─── 9. DELETE MESSAGE ───────────────────────────────────────────────────────
  function bindMessageDeleteButtons(container) {
    const deleteBtns = (container || document).querySelectorAll('.msg-action-btn.delete-btn');
    deleteBtns.forEach(btn => {
      if (btn.dataset.boundDelete) return;
      btn.dataset.boundDelete = '1';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const msgId = btn.getAttribute('data-msg-id');
        const convId = state.activeConversationId;

        if (!msgId || msgId.startsWith('temp_')) {
          showToast('Cannot delete this message yet. Please wait.');
          return;
        }

        showConfirmDialog({
          icon: '🗑️',
          title: 'Delete message?',
          message: 'This action cannot be undone. The message will be removed for all participants.',
          actionLabel: 'Delete',
          onConfirm: async () => {
            try {
              const res = await fetch(`/api/community/messages/conversations/${convId}/messages/${msgId}`, {
                method: 'DELETE',
                credentials: 'include'
              });
              const data = await res.json();
              if (data.success) {
                // Update UI immediately (WS event will propagate to others)
                const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
                if (msgEl) {
                  const bubbleEl = msgEl.querySelector('.msg-bubble');
                  if (bubbleEl) {
                    bubbleEl.textContent = 'You deleted this message.';
                    bubbleEl.classList.add('deleted-msg');
                  }
                  const actionsEl = msgEl.querySelector('.msg-actions');
                  if (actionsEl) actionsEl.remove();
                }
              } else {
                showToast(data.message || 'Failed to delete message.');
              }
            } catch (err) {
              console.error('[Messaging] Delete message error:', err);
              showToast('Failed to delete. Check connection.');
            }
          }
        });
      });
    });
  }

  // ─── 10. CONFIRM DIALOG SYSTEM ──────────────────────────────────────────────
  function showConfirmDialog({ icon, title, message, actionLabel, onConfirm }) {
    const overlay = document.getElementById('msgConfirmDialog');
    const iconEl = document.getElementById('confirmDialogIcon');
    const titleEl = document.getElementById('confirmDialogTitle');
    const msgEl = document.getElementById('confirmDialogMessage');
    const actionBtn = document.getElementById('confirmActionBtn');
    const cancelBtn = document.getElementById('confirmCancelBtn');

    if (!overlay) {
      // Fallback if modal not in HTML
      if (confirm(`${title}\n\n${message}`)) onConfirm();
      return;
    }

    if (iconEl) iconEl.textContent = icon || '🗑️';
    if (titleEl) titleEl.textContent = title || 'Are you sure?';
    if (msgEl) msgEl.textContent = message || '';
    if (actionBtn) actionBtn.textContent = actionLabel || 'Confirm';

    confirmPendingAction = onConfirm;
    overlay.classList.add('open');

    // Focus the cancel button for accessibility
    setTimeout(() => cancelBtn?.focus(), 50);
  }

  function closeConfirmDialog() {
    const overlay = document.getElementById('msgConfirmDialog');
    if (overlay) overlay.classList.remove('open');
    confirmPendingAction = null;
  }

  // ─── 11. NEW DIRECT CONVERSATION MODAL ──────────────────────────────────────
  async function openNewChatModal() {
    const modal = document.getElementById('newChatModal');
    const list = document.getElementById('newChatTrekkersList');
    const searchInput = document.getElementById('newChatSearchInput');

    if (!modal || !list) return;
    modal.classList.add('open');
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }

    list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--msg-text-muted);">Finding trekkers...</div>`;

    // Load initial list from trekkers endpoint
    let allTrekkers = [];
    try {
      const res = await fetch('/api/community/users/search?q=&limit=50', { credentials: 'include' });
      const data = await res.json();
      if (data.success && data.trekkers) {
        allTrekkers = data.trekkers.filter(t => t.user_id !== state.currentUser?.user_id);
      } else {
        // Fallback to trekkers endpoint
        const res2 = await fetch('/api/community/trekkers');
        const data2 = await res2.json();
        if (data2.success && data2.trekkers) {
          allTrekkers = data2.trekkers.filter(t => t.user_id !== state.currentUser?.user_id);
        }
      }
    } catch (err) {
      list.innerHTML = `<div style="padding: 24px; text-align: center; color: #ef4444;">Failed to load trekkers.</div>`;
      return;
    }

    renderNewChatTrekkers(allTrekkers);

    if (searchInput) {
      searchInput.oninput = () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(async () => {
          const q = searchInput.value.trim();
          if (!q) {
            renderNewChatTrekkers(allTrekkers);
            return;
          }
          try {
            const res = await fetch(`/api/community/users/search?q=${encodeURIComponent(q)}&limit=30`, { credentials: 'include' });
            const data = await res.json();
            if (data.success) {
              const filtered = (data.trekkers || []).filter(t => t.user_id !== state.currentUser?.user_id);
              renderNewChatTrekkers(filtered);
            }
          } catch (_) {
            // Fallback: filter locally
            const qLower = q.toLowerCase();
            const filtered = allTrekkers.filter(t =>
              (t.full_name || '').toLowerCase().includes(qLower) ||
              (t.username || '').toLowerCase().includes(qLower)
            );
            renderNewChatTrekkers(filtered);
          }
        }, 300);
      };
    }
  }

  function renderNewChatTrekkers(trekkers) {
    const list = document.getElementById('newChatTrekkersList');
    if (!list) return;

    if (!trekkers || trekkers.length === 0) {
      list.innerHTML = `<div style="padding: 28px 20px; text-align: center; color: var(--msg-text-muted);">
        <div style="font-size: 1.8rem; margin-bottom: 8px;">🔍</div>
        <strong style="color: var(--msg-text-primary); display: block; margin-bottom: 4px;">No trekkers found</strong>
        <p style="font-size: 0.8rem;">Try a different name or username.</p>
      </div>`;
      return;
    }

    list.innerHTML = trekkers.map(t => {
      const avatarSrc = getAvatarSrc(t.avatar || t.profile_image);
      return `
        <div class="msg-modal-trekker-row" data-user-id="${t.user_id}">
          <img src="${escapeHtml(avatarSrc)}"
               class="msg-modal-trekker-avatar" alt="${escapeHtml(t.full_name)}"
               onerror="this.src='${DEFAULT_AVATAR}'" />
          <div class="msg-modal-trekker-info">
            <strong>${escapeHtml(t.full_name)}</strong>
            <span>@${escapeHtml(t.username)}${t.location ? ' · 📍 ' + escapeHtml(t.location) : ''}</span>
          </div>
          <button type="button" class="msg-modal-msg-btn">Chat</button>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.msg-modal-trekker-row').forEach(row => {
      row.addEventListener('click', async () => {
        const targetUserId = row.getAttribute('data-user-id');
        document.getElementById('newChatModal')?.classList.remove('open');
        await startDirectChatWithUser(targetUserId);
      });
    });
  }

  async function startDirectChatWithUser(userId) {
    try {
      const res = await fetch('/api/community/messages/conversations/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ participant_id: userId })
      });
      const data = await res.json();
      if (data.success && data.conversation_id) {
        await loadConversations(false);
        selectConversation(data.conversation_id);
      }
    } catch (err) {
      console.error('[Messaging] Failed to create direct chat:', err);
      showToast('Failed to start chat. Try again.');
    }
  }

  // ─── 12. SHARE TREK ROUTE MODAL ─────────────────────────────────────────────
  async function loadAvailableTreks() {
    try {
      const res = await fetch('/api/treks');
      const data = await res.json();
      state.availableTreks = data.treks || data.data || [];
    } catch (err) {
      state.availableTreks = [
        { id: 1, name: 'Kedarkantha Trek', altitude: '3,810m', difficulty: 'Easy–Moderate', duration: '6 Days', state: 'Uttarakhand', image: 'https://images.unsplash.com/photo-1626015365107-338c45028f39?w=600&q=80' },
        { id: 2, name: 'Hampta Pass', altitude: '4,287m', difficulty: 'Advanced', duration: '5 Days', state: 'Himachal Pradesh', image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600&q=80' },
        { id: 3, name: 'Valley of Flowers', altitude: '3,858m', difficulty: 'Easy', duration: '6 Days', state: 'Uttarakhand', image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?w=600&q=80' },
        { id: 4, name: 'Roopkund Mystery Lake', altitude: '5,029m', difficulty: 'Hard', duration: '8 Days', state: 'Uttarakhand', image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=80' },
        { id: 5, name: 'Rajmachi Fort Trek', altitude: '820m', difficulty: 'Moderate', duration: '2 Days', state: 'Maharashtra', image: 'https://images.unsplash.com/photo-1519681393784-d120267933ba?w=600&q=80' },
        { id: 6, name: 'Harishchandragad', altitude: '1,422m', difficulty: 'Moderate–Hard', duration: '2 Days', state: 'Maharashtra', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80' },
        { id: 8, name: 'Sandakphu Phalut Peak', altitude: '3,636m', difficulty: 'Hard', duration: '6 Days', state: 'West Bengal', image: 'https://images.unsplash.com/photo-1486870591958-9b9d0d1dda99?w=600&q=80' }
      ];
    }
  }

  function openShareTrekModal() {
    const modal = document.getElementById('shareTrekModal');
    const searchInput = document.getElementById('shareTrekSearchInput');
    if (!modal) return;
    modal.classList.add('open');
    if (searchInput) { searchInput.value = ''; searchInput.focus(); }
    renderShareTrekList(state.availableTreks);

    if (searchInput) {
      searchInput.oninput = () => {
        const q = searchInput.value.trim().toLowerCase();
        const filtered = (state.availableTreks || []).filter(t =>
          (t.name || '').toLowerCase().includes(q) ||
          (t.state || '').toLowerCase().includes(q) ||
          (t.difficulty || '').toLowerCase().includes(q)
        );
        renderShareTrekList(filtered);
      };
    }
  }

  function renderShareTrekList(treks) {
    const list = document.getElementById('shareTrekList');
    if (!list) return;
    if (!treks || treks.length === 0) {
      list.innerHTML = `<div style="padding: 24px; text-align: center; color: var(--msg-text-muted);">No treks found.</div>`;
      return;
    }

    list.innerHTML = treks.map(t => `
      <button type="button" class="msg-trek-pick-row" data-trek-id="${t.id || t.trek_id}">
        <img src="${escapeHtml(t.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200')}" class="msg-trek-pick-img" alt="${escapeHtml(t.name)}" />
        <div class="msg-trek-pick-info">
          <strong>${escapeHtml(t.name)}</strong>
          <span>${escapeHtml(t.altitude || t.elevation || 'Himalayas')} • ${escapeHtml(t.difficulty || 'Moderate')} • ${escapeHtml(t.state || 'India')}</span>
        </div>
        <span class="msg-modal-msg-btn">Share</span>
      </button>
    `).join('');

    list.querySelectorAll('.msg-trek-pick-row').forEach(row => {
      row.addEventListener('click', () => {
        const trekId = row.getAttribute('data-trek-id');
        const selectedTrek = (state.availableTreks || []).find(t => String(t.id || t.trek_id) === String(trekId));
        if (selectedTrek) {
          document.getElementById('shareTrekModal')?.classList.remove('open');
          sendChatMessage({
            message_type: 'trek_card',
            trek_data: {
              id: selectedTrek.id || selectedTrek.trek_id,
              name: selectedTrek.name,
              altitude: selectedTrek.altitude || selectedTrek.elevation || '3,800m',
              difficulty: selectedTrek.difficulty || 'Moderate',
              duration: selectedTrek.duration || '5-6 Days',
              image: selectedTrek.image || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=600'
            }
          });
        }
      });
    });
  }

  function handlePhotoAttachment(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image size exceeds 5MB limit.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Url = e.target.result;
      sendChatMessage({
        message_type: 'image',
        attachment_url: base64Url,
        content: 'Trail photograph'
      });
    };
    reader.readAsDataURL(file);
  }

  // ─── 13. URL PARAMETERS ROUTING ─────────────────────────────────────────────
  async function handleUrlParameters() {
    const params = new URLSearchParams(window.location.search);
    const convId = params.get('conv');
    const userId = params.get('user');

    if (convId) {
      selectConversation(parseInt(convId, 10));
    } else if (userId) {
      await startDirectChatWithUser(userId);
    }
  }

  // ─── 14. GLOBAL EVENT LISTENERS ─────────────────────────────────────────────
  function bindEventListeners() {
    // New Chat buttons
    document.getElementById('btnNewChat')?.addEventListener('click', openNewChatModal);
    document.getElementById('btnEmptyNewChat')?.addEventListener('click', openNewChatModal);
    document.getElementById('closeNewChatModalBtn')?.addEventListener('click', () => {
      document.getElementById('newChatModal')?.classList.remove('open');
    });
    document.getElementById('closeShareTrekModalBtn')?.addEventListener('click', () => {
      document.getElementById('shareTrekModal')?.classList.remove('open');
    });

    // Close modals on overlay click
    document.querySelectorAll('.msg-modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) overlay.classList.remove('open');
      });
    });

    // Confirm dialog buttons
    document.getElementById('confirmActionBtn')?.addEventListener('click', () => {
      if (typeof confirmPendingAction === 'function') {
        confirmPendingAction();
      }
      closeConfirmDialog();
    });
    document.getElementById('confirmCancelBtn')?.addEventListener('click', closeConfirmDialog);
    document.getElementById('msgConfirmDialog')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('msgConfirmDialog')) closeConfirmDialog();
    });

    // Mobile back button
    document.getElementById('chatBackBtn')?.addEventListener('click', () => {
      const pane = document.getElementById('msgPane');
      if (pane) pane.classList.remove('chat-active');
      state.activeConversationId = null;
      const url = new URL(window.location.href);
      url.searchParams.delete('conv');
      url.searchParams.delete('user');
      window.history.pushState({}, '', url.pathname);
    });

    // Sidebar Search
    document.getElementById('convSearchInput')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderConversationsList();
    });

    // Filter Tabs
    document.getElementById('tabAllChats')?.addEventListener('click', (e) => {
      document.querySelectorAll('.msg-filter-btn').forEach(b => {
        b.classList.remove('active'); b.setAttribute('aria-selected', 'false');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-selected', 'true');
      state.activeFilterTab = 'all';
      renderConversationsList();
    });

    document.getElementById('tabUnreadChats')?.addEventListener('click', (e) => {
      document.querySelectorAll('.msg-filter-btn').forEach(b => {
        b.classList.remove('active'); b.setAttribute('aria-selected', 'false');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-selected', 'true');
      state.activeFilterTab = 'unread';
      renderConversationsList();
    });

    // Chat Composer
    const chatInput = document.getElementById('chatTextInput');
    if (chatInput) {
      chatInput.addEventListener('input', () => {
        emitTypingIndicator();
        updateSendButtonState();
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
      });

      chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
    }

    document.getElementById('chatSendBtn')?.addEventListener('click', () => sendChatMessage());

    // Message delete delegation — handles dynamically added messages
    const chatMessagesBody = document.getElementById('chatMessagesBody');
    if (chatMessagesBody) {
      chatMessagesBody.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.msg-action-btn.delete-btn');
        if (deleteBtn) {
          e.stopPropagation();
          const msgId = deleteBtn.getAttribute('data-msg-id');
          const convId = state.activeConversationId;

          if (!msgId || msgId.startsWith('temp_')) {
            showToast('Cannot delete this message yet.');
            return;
          }

          showConfirmDialog({
            icon: '🗑️',
            title: 'Delete message?',
            message: 'This action cannot be undone. The message will be removed for all participants.',
            actionLabel: 'Delete',
            onConfirm: async () => {
              try {
                const res = await fetch(`/api/community/messages/conversations/${convId}/messages/${msgId}`, {
                  method: 'DELETE',
                  credentials: 'include'
                });
                const data = await res.json();
                if (data.success) {
                  const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
                  if (msgEl) {
                    const bubbleEl = msgEl.querySelector('.msg-bubble');
                    if (bubbleEl) {
                      bubbleEl.textContent = 'You deleted this message.';
                      bubbleEl.classList.add('deleted-msg');
                    }
                    const actionsEl = msgEl.querySelector('.msg-actions');
                    if (actionsEl) actionsEl.remove();
                  }
                } else {
                  showToast(data.message || 'Failed to delete message.');
                }
              } catch (err) {
                console.error('[Messaging] Delete message error:', err);
                showToast('Failed to delete. Check connection.');
              }
            }
          });
        }
      });
    }

    // Emoji Popover
    const emojiBtn = document.getElementById('chatEmojiTrigger');
    const emojiPopover = document.getElementById('chatEmojiPopover');
    if (emojiBtn && emojiPopover) {
      emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        emojiPopover.classList.toggle('open');
      });

      emojiPopover.querySelectorAll('.emoji-cell').forEach(item => {
        item.addEventListener('click', () => {
          if (chatInput) {
            const start = chatInput.selectionStart || 0;
            const end = chatInput.selectionEnd || 0;
            const text = chatInput.value;
            const emoji = item.textContent;
            chatInput.value = text.substring(0, start) + emoji + text.substring(end);
            chatInput.selectionStart = chatInput.selectionEnd = start + emoji.length;
            chatInput.focus();
            updateSendButtonState();
          }
          emojiPopover.classList.remove('open');
        });
      });

      document.addEventListener('click', (e) => {
        if (!emojiPopover.contains(e.target) && e.target !== emojiBtn) {
          emojiPopover.classList.remove('open');
        }
      });
    }

    // Attachment Menu
    const attachTrigger = document.getElementById('chatAttachTrigger');
    const attachMenu = document.getElementById('chatAttachMenu');
    if (attachTrigger && attachMenu) {
      attachTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        attachMenu.classList.toggle('open');
      });

      document.addEventListener('click', (e) => {
        if (!attachMenu.contains(e.target) && e.target !== attachTrigger) {
          attachMenu.classList.remove('open');
        }
      });
    }

    document.getElementById('attachShareTrekBtn')?.addEventListener('click', () => {
      attachMenu?.classList.remove('open');
      openShareTrekModal();
    });

    const photoInput = document.getElementById('chatPhotoInput');
    document.getElementById('attachSharePhotoBtn')?.addEventListener('click', () => {
      attachMenu?.classList.remove('open');
      photoInput?.click();
    });

    if (photoInput) {
      photoInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          handlePhotoAttachment(e.target.files[0]);
          photoInput.value = '';
        }
      });
    }

    // Escape key closes all overlays
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.msg-modal-overlay.open').forEach(o => o.classList.remove('open'));
        closeConfirmDialog();
        document.querySelectorAll('.msg-conv-dropdown.open').forEach(d => d.classList.remove('open'));
      }
    });
  }

  // ─── UTILITIES ──────────────────────────────────────────────────────────────
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function showToast(msg) {
    const toast = document.getElementById('msgToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
