/**
 * TrekIndia — Full-Screen Messaging System Engine (v2.0)
 * Real-time messaging powered by WebSockets, Kafka streaming backbone,
 * smart message grouping, cohesive integrated composer, trek route sharing, presence, and typing indicators.
 */

(function () {
  'use strict';

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

  // WebSocket references
  let wsClient = null;
  let wsReconnectTimer = null;
  let wsReconnectDelay = 1000;
  let wsPingTimer = null;
  let typingTimeout = null;
  let lastTypingSentAt = 0;

  // ─── 1. INITIALIZATION ──────────────────────────────────────────────────────
  async function init() {
    initTheme();
    initWindowResize();

    // Check Auth
    const user = await checkAuthentication();
    if (!user) {
      window.location.href = 'auth.html?redirect=/messages&message=auth_required';
      return;
    }

    state.currentUser = user;
    updateUserAvatarUI(user);

    // Bind UI Event Listeners
    bindEventListeners();

    // Connect to WebSocket & Kafka bridge
    initWebSocket();

    // Load available treks for route sharing
    loadAvailableTreks();

    // Load conversations and handle URL params (?conv=123 or ?user=102)
    await loadConversations();
    handleUrlParameters();
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
        if (data.success && data.user) {
          return data.user;
        }
      }
    } catch (err) {
      console.warn('[Messaging] Auth verification error:', err);
    }
    return null;
  }

  function updateUserAvatarUI(user) {
    const avatarEl = document.getElementById('msgNavUserAvatar');
    if (avatarEl && user) {
      avatarEl.src = user.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100';
      avatarEl.title = `${user.full_name || user.username} (@${user.username})`;
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
    if (wsClient && (wsClient.readyState === WebSocket.OPEN || wsClient.readyState === WebSocket.CONNECTING)) {
      return;
    }

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

      // Refresh list to catch up on missed messages
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

    // 1. If currently in this chat, append message bubble
    if (isActiveConv) {
      const messagesBody = document.getElementById('chatMessagesBody');

      // Check if temporary optimistic element exists
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
            messagesBody.scrollTop = messagesBody.scrollHeight;
          }
        }
      }

      // Mark incoming message as read immediately since user is actively viewing it
      if (msg.sender_id !== state.currentUser?.user_id) {
        fetch(`/api/community/messages/conversations/${convId}/read`, {
          method: 'POST',
          credentials: 'include'
        }).catch(() => {});
      }
    }

    // 2. Update conversation snippet in conversations list
    let conv = state.conversations.find(c => c.conversation_id === convId);
    let snippet = msg.content || (msg.message_type === 'trek_card' ? `Shared Trek: ${msg.trek_data?.name || 'Trek'}` : '📷 Photo');

    if (conv) {
      conv.last_message = snippet;
      conv.last_message_time = 'Just now';
      if (!isActiveConv && msg.sender_id !== state.currentUser?.user_id) {
        conv.unread_count = (conv.unread_count || 0) + 1;
      }
    } else {
      // New conversation created by someone else: fetch fresh list
      loadConversations(false);
    }

    renderConversationsList();
    updateUnreadBadgeCount();
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

    document.querySelectorAll('.msg-row.self .msg-status').forEach(icon => {
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

    // Update active chat header if this user is active
    if (state.activeConversationData && String(state.activeConversationData.participant?.user_id) === uid) {
      const onlineDot = document.getElementById('chatHeadOnlineDot');
      const statusText = document.getElementById('chatHeadStatus');
      const isOnline = status === 'online';

      if (onlineDot) {
        onlineDot.className = `msg-chat-head-status-dot ${isOnline ? 'online' : ''}`;
      }
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
      if (dot) {
        dot.classList.toggle('visible', Boolean(isOnline));
      }
    });
  }

  function getStatusIconHtml(status) {
    if (status === 'read') {
      // Double checkmark (emerald)
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;
    } else if (status === 'delivered') {
      // Double checkmark (gray)
      return `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L7 17l-5-5"/><path d="M22 10l-7.5 7.5L13 16"/></svg>`;
    } else {
      // Single checkmark (sent)
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

    // Filter by tab
    if (state.activeFilterTab === 'unread') {
      list = list.filter(c => (c.unread_count || 0) > 0);
    }

    // Filter by search query
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

      return `
        <div class="msg-conv-item ${isActive ? 'active' : ''} ${isUnread ? 'unread' : ''}" 
             data-conv-id="${conv.conversation_id}" 
             data-participant-id="${conv.participant?.user_id || ''}">
          <div class="msg-conv-avatar-wrap">
            <img src="${escapeHtml(conv.participant?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" 
                 alt="${escapeHtml(conv.participant?.full_name || 'Trekker')}" 
                 class="msg-conv-avatar" />
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
        </div>
      `;
    }).join('');

    // Attach click handlers
    container.querySelectorAll('.msg-conv-item').forEach(el => {
      el.addEventListener('click', () => {
        const id = parseInt(el.getAttribute('data-conv-id'), 10);
        selectConversation(id);
      });
    });
  }

  function updateUnreadBadgeCount() {
    const totalUnread = (state.conversations || []).reduce((sum, c) => sum + (c.unread_count || 0), 0);
    const badge = document.getElementById('convUnreadBadge');
    if (badge) {
      badge.textContent = totalUnread;
      badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
    }
  }

  // ─── 6. ACTIVE CHAT AREA & SMART GROUPING ──────────────────────────────────
  async function selectConversation(conversationId) {
    const convId = parseInt(conversationId, 10);
    state.activeConversationId = convId;

    // Update URL query parameter cleanly without reloading page
    const url = new URL(window.location.href);
    url.searchParams.set('conv', convId);
    url.searchParams.delete('user');
    window.history.pushState({ convId }, '', url.toString());

    // Highlight in sidebar
    document.querySelectorAll('.msg-conv-item').forEach(el => {
      const id = parseInt(el.getAttribute('data-conv-id'), 10);
      el.classList.toggle('active', id === convId);
    });

    // Mobile slide transition
    const pane = document.getElementById('msgPane');
    if (pane) pane.classList.add('chat-active');

    // Local unread clear
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

    // Set Dynamic Placeholder
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

    if (avatar) avatar.src = conv.participant?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150';
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

    // Populate Messages Body with Smart Grouping
    if (messagesBody) {
      if (!conv.messages || conv.messages.length === 0) {
        messagesBody.innerHTML = `
          <div style="padding: 60px 20px; text-align: center; color: var(--msg-text-muted); margin: auto;">
            <div style="font-size: 2.4rem; margin-bottom: 10px;">🏔️</div>
            <strong style="color: var(--msg-text-primary); font-size: 0.96rem; display: block;">Beginning of Trail Conversation</strong>
            <p style="font-size: 0.82rem; margin-top: 5px; max-width: 320px; margin-inline: auto;">Say hello or share a TrekIndia Himalayan route to coordinate your upcoming hike!</p>
          </div>
        `;
      } else {
        let messagesHtml = '<div class="msg-date-separator"><span>Today</span></div>';
        
        let prevSenderId = null;
        const messages = conv.messages;

        for (let i = 0; i < messages.length; i++) {
          const msg = messages[i];
          const isSelf = msg.is_self || msg.sender_id === state.currentUser?.user_id;
          const nextMsg = messages[i + 1];
          
          const isGroupedWithNext = nextMsg && (nextMsg.is_self === msg.is_self || nextMsg.sender_id === msg.sender_id);
          const isSenderChanged = prevSenderId !== null && prevSenderId !== msg.sender_id;
          
          messagesHtml += renderSingleMessageRow(msg, isSelf, isGroupedWithNext, isSenderChanged);
          prevSenderId = msg.sender_id;
        }

        messagesBody.innerHTML = messagesHtml;
        messagesBody.scrollTop = messagesBody.scrollHeight;
      }
    }
  }

  function renderSingleMessageRow(msg, isSelf, isGrouped = false, isSenderChanged = false) {
    const status = msg.status || 'sent';

    // 1. Trek Card Message
    if (msg.message_type === 'trek_card' && msg.trek_data) {
      const trek = msg.trek_data;
      return `
        <div class="msg-row ${isSelf ? 'self' : 'other'} ${isSenderChanged ? 'sender-changed' : ''}" 
             data-msg-id="${msg.message_id || ''}" 
             data-client-msg-id="${msg.client_message_id || ''}">
          ${!isSelf ? `<img src="${escapeHtml(msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" class="msg-row-avatar ${isGrouped ? 'spacer' : ''}" alt="" />` : ''}
          <div class="msg-content-wrap">
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
            <div class="msg-footer">
              <span class="msg-time">${escapeHtml(msg.created_at || 'Just now')}</span>
              ${isSelf ? `<span class="msg-status ${status}">${getStatusIconHtml(status)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // 2. Photo Message
    if (msg.message_type === 'image' && msg.attachment_url) {
      return `
        <div class="msg-row ${isSelf ? 'self' : 'other'} ${isSenderChanged ? 'sender-changed' : ''}" 
             data-msg-id="${msg.message_id || ''}" 
             data-client-msg-id="${msg.client_message_id || ''}">
          ${!isSelf ? `<img src="${escapeHtml(msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" class="msg-row-avatar ${isGrouped ? 'spacer' : ''}" alt="" />` : ''}
          <div class="msg-content-wrap">
            <div class="msg-photo-bubble">
              <img src="${escapeHtml(msg.attachment_url)}" alt="Trail attachment" onclick="window.open(this.src, '_blank')" />
            </div>
            <div class="msg-footer">
              <span class="msg-time">${escapeHtml(msg.created_at || 'Just now')}</span>
              ${isSelf ? `<span class="msg-status ${status}">${getStatusIconHtml(status)}</span>` : ''}
            </div>
          </div>
        </div>
      `;
    }

    // 3. Regular Text Message
    return `
      <div class="msg-row ${isSelf ? 'self' : 'other'} ${isGrouped ? 'is-grouped' : ''} ${isSenderChanged ? 'sender-changed' : ''}" 
           data-msg-id="${msg.message_id || ''}" 
           data-client-msg-id="${msg.client_message_id || ''}">
        ${!isSelf ? `<img src="${escapeHtml(msg.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" class="msg-row-avatar ${isGrouped ? 'spacer' : ''}" alt="" />` : ''}
        <div class="msg-content-wrap">
          <div class="msg-bubble">
            ${escapeHtml(msg.content || '')}
          </div>
          <div class="msg-footer">
            <span class="msg-time">${escapeHtml(msg.created_at || 'Just now')}</span>
            ${isSelf ? `<span class="msg-status ${status}">${getStatusIconHtml(status)}</span>` : ''}
          </div>
        </div>
      </div>
    `;
  }

  // ─── 7. SENDING MESSAGES & AUTO-GROWING COMPOSER ───────────────────────────
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

    // Optimistic UI Append
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

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = renderSingleMessageRow(optimisticMsg, true, false, true);
      if (tempDiv.firstElementChild) {
        messagesBody.appendChild(tempDiv.firstElementChild);
        messagesBody.scrollTop = messagesBody.scrollHeight;
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
        }
      }
    } catch (err) {
      console.error('[Messaging] Send failed:', err);
      showToast('Unable to deliver message. Check connection.');
    } finally {
      updateSendButtonState();
    }
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

  // ─── 8. NEW DIRECT CONVERSATION MODAL ──────────────────────────────────────
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

    list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--msg-text-muted);">Finding trekkers...</div>';

    try {
      const res = await fetch('/api/community/trekkers');
      const data = await res.json();
      if (data.success && data.trekkers) {
        const filteredSelf = data.trekkers.filter(t => t.user_id !== state.currentUser?.user_id);
        renderNewChatTrekkers(filteredSelf);

        if (searchInput) {
          searchInput.oninput = () => {
            const q = searchInput.value.trim().toLowerCase();
            const filtered = filteredSelf.filter(t =>
              (t.full_name || '').toLowerCase().includes(q) ||
              (t.username || '').toLowerCase().includes(q) ||
              (t.location || '').toLowerCase().includes(q)
            );
            renderNewChatTrekkers(filtered);
          };
        }
      }
    } catch (err) {
      list.innerHTML = '<div style="padding: 24px; text-align: center; color: #ef4444;">Failed to load trekkers.</div>';
    }
  }

  function renderNewChatTrekkers(trekkers) {
    const list = document.getElementById('newChatTrekkersList');
    if (!list) return;

    if (!trekkers || trekkers.length === 0) {
      list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--msg-text-muted);">No trekkers match your search.</div>';
      return;
    }

    list.innerHTML = trekkers.map(t => `
      <div class="msg-modal-trekker-row" data-user-id="${t.user_id}">
        <img src="${escapeHtml(t.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150')}" 
             class="msg-modal-trekker-avatar" alt="${escapeHtml(t.full_name)}" />
        <div class="msg-modal-trekker-info">
          <strong>${escapeHtml(t.full_name)}</strong>
          <span>@${escapeHtml(t.username)} • 📍 ${escapeHtml(t.location || 'India')}</span>
        </div>
        <button type="button" class="msg-modal-msg-btn">Chat</button>
      </div>
    `).join('');

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

  // ─── 9. SHARE HIMALAYAN TREK ROUTE MODAL ───────────────────────────────────
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
    if (searchInput) {
      searchInput.value = '';
      searchInput.focus();
    }

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
      list.innerHTML = '<div style="padding: 24px; text-align: center; color: var(--msg-text-muted);">No treks found.</div>';
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

  // ─── 10. URL PARAMETERS ROUTING ────────────────────────────────────────────
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

  // ─── 11. GLOBAL EVENT LISTENERS ────────────────────────────────────────────
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

    // Search Box
    document.getElementById('convSearchInput')?.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim();
      renderConversationsList();
    });

    // Filter Tabs
    document.getElementById('tabAllChats')?.addEventListener('click', (e) => {
      document.querySelectorAll('.msg-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-selected', 'true');
      state.activeFilterTab = 'all';
      renderConversationsList();
    });

    document.getElementById('tabUnreadChats')?.addEventListener('click', (e) => {
      document.querySelectorAll('.msg-filter-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      e.currentTarget.classList.add('active');
      e.currentTarget.setAttribute('aria-selected', 'true');
      state.activeFilterTab = 'unread';
      renderConversationsList();
    });

    // Chat Composer Textarea Auto-grow & Send Button state
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

    // Attach Action Buttons
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
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
