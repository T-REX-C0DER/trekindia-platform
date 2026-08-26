import { WebSocketServer, WebSocket } from 'ws';
import cookie from 'cookie';
import { verifyToken, COOKIE_NAME } from '../utils/cookies.js';
import { query } from '../config/database.js';
import { createUserPresenceEvent, createNotificationEvent } from '../kafka/schemas.js';
import messageProducer from '../kafka/producer.js';

/**
 * TrekIndia — WebSocket Manager & Real-Time Delivery Server
 * Bridges Kafka Consumer events directly to active client browser connections.
 */
class WebSocketManager {
  constructor() {
    this.wss = null;
    this.userSockets = new Map(); // Map<userId (string), Set<WebSocket>>
    this.pingInterval = null;
  }

  /**
   * Attach WebSocket server to existing HTTP server
   */
  init(server) {
    this.wss = new WebSocketServer({
      server,
      path: '/ws/messages',
      clientTracking: true
    });

    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    // Periodic heartbeat ping to detect terminated/dead connections
    this.pingInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
          return ws.terminate();
        }
        ws.isAlive = false;
        try {
          ws.ping();
        } catch (_) {}
      });
    }, 30000);

    this.wss.on('close', () => {
      if (this.pingInterval) clearInterval(this.pingInterval);
    });

    console.log('✅ [WebSocket Server] Mounted on /ws/messages');
  }

  /**
   * Handle incoming WebSocket client connection with authentication
   */
  async handleConnection(ws, req) {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    // Authenticate user via cookie or authorization header / query param
    let user = null;

    try {
      const parsedCookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
      const token = parsedCookies[COOKIE_NAME];

      if (token) {
        user = verifyToken(token);
      }

      // Fallback: Check query string ?token=...
      if (!user && req.url) {
        const urlParams = new URL(req.url, 'http://localhost').searchParams;
        const queryToken = urlParams.get('token');
        if (queryToken) {
          user = verifyToken(queryToken);
        }
      }
    } catch (err) {
      console.warn('[WebSocket] Token verification failed on handshake:', err.message);
    }

    if (!user || !user.user_id) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'UNAUTHORIZED',
        message: 'Authentication required for WebSocket connection.'
      }));
      ws.close(4001, 'Unauthorized');
      return;
    }

    const userId = String(user.user_id);
    ws.userId = userId;
    ws.userEmail = user.email;

    // Add socket to user's active connection set
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId).add(ws);

    console.log(`[WebSocket] User connected: ${userId} (${user.email}). Active sockets: ${this.userSockets.get(userId).size}`);

    // Update DB presence & publish Kafka presence event if first connection
    if (this.userSockets.get(userId).size === 1) {
      await this.setUserOnlineStatus(userId, 'online');
    }

    // Send welcome confirmation with list of currently online user IDs
    ws.send(JSON.stringify({
      type: 'connection.established',
      user_id: userId,
      online_users: this.getOnlineUserIds(),
      timestamp: new Date().toISOString()
    }));

    // Handle incoming client messages (e.g. typing indicators, read notifications)
    ws.on('message', (data) => this.handleClientMessage(ws, data));

    // Handle disconnection
    ws.on('close', () => this.handleDisconnection(ws, userId));
    ws.on('error', (err) => {
      console.warn(`[WebSocket] Error on user ${userId} socket:`, err.message);
    });
  }

  /**
   * Handle incoming messages sent from the client over WebSocket
   */
  async handleClientMessage(ws, rawData) {
    try {
      const data = JSON.parse(rawData.toString());

      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;

        case 'user.typing':
          // Relay typing event to conversation participants
          if (data.conversation_id) {
            this.broadcastToConversationParticipants(
              data.conversation_id,
              {
                type: 'user.typing',
                conversation_id: data.conversation_id,
                user_id: ws.userId,
                is_typing: data.is_typing !== false
              },
              ws.userId // exclude sender
            );
          }
          break;

        case 'message.read':
          // Handled via REST API for DB permanence, but can also trigger WS sync
          break;

        default:
          break;
      }
    } catch (err) {
      console.warn('[WebSocket] Error processing client message:', err.message);
    }
  }

  /**
   * Handle socket disconnection
   */
  async handleDisconnection(ws, userId) {
    if (this.userSockets.has(userId)) {
      const set = this.userSockets.get(userId);
      set.delete(ws);
      if (set.size === 0) {
        this.userSockets.delete(userId);
        console.log(`[WebSocket] User went offline: ${userId}`);
        await this.setUserOnlineStatus(userId, 'offline');
      }
    }
  }

  /**
   * Update database and broadcast presence changes
   */
  async setUserOnlineStatus(userId, status) {
    try {
      // 1. Update PostgreSQL
      await query(
        `UPDATE users SET online_status = $1, last_seen_at = CURRENT_TIMESTAMP WHERE user_id = $2`,
        [status, userId]
      ).catch(() => {});

      // 2. Publish to Kafka topic trekindia.user-events
      const event = createUserPresenceEvent({ user_id: userId, status });
      await messageProducer.publishUserEvent(event);

      // 3. Broadcast presence to all connected WebSocket clients
      this.broadcast({
        type: 'user.presence',
        user_id: userId,
        status,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[WebSocket] Error setting online status:', err.message);
    }
  }

  /**
   * Send JSON message to a specific user across all their open devices/tabs
   */
  sendToUser(userId, payload) {
    const uId = String(userId);
    const sockets = this.userSockets.get(uId);
    if (!sockets || sockets.size === 0) {
      return false; // User is offline
    }

    const messageString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    let deliveredCount = 0;

    sockets.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(messageString);
        deliveredCount++;
      }
    });

    return deliveredCount > 0;
  }

  /**
   * Broadcast payload to all active participants of a conversation
   */
  async broadcastToConversationParticipants(conversationId, payload, excludeUserId = null) {
    try {
      const res = await query(
        `SELECT user_id FROM conversation_participants WHERE conversation_id = $1`,
        [conversationId]
      );

      const participants = res.rows.map(r => String(r.user_id));
      for (const participantId of participants) {
        if (excludeUserId && String(participantId) === String(excludeUserId)) {
          continue;
        }
        this.sendToUser(participantId, payload);
      }
    } catch (err) {
      console.warn('[WebSocket] Error fetching conversation participants for broadcast:', err.message);
    }
  }

  /**
   * Broadcast message to ALL currently connected clients
   */
  broadcast(payload) {
    const messageString = typeof payload === 'string' ? payload : JSON.stringify(payload);
    this.wss?.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageString);
      }
    });
  }

  /**
   * Check if a given user is currently online
   */
  isUserOnline(userId) {
    const sockets = this.userSockets.get(String(userId));
    return Boolean(sockets && sockets.size > 0);
  }

  /**
   * Return array of all currently online user IDs
   */
  getOnlineUserIds() {
    return Array.from(this.userSockets.keys());
  }
}

export const wsManager = new WebSocketManager();
export default wsManager;
