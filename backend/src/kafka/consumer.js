import { kafka, TOPICS, CONSUMER_GROUPS } from './config.js';
import { EVENT_TYPES, createNotificationEvent } from './schemas.js';
import wsManager from '../websocket/wsServer.js';
import messageProducer from './producer.js';
import { query } from '../config/database.js';

/**
 * TrekIndia — Resilient Kafka Consumer Service
 * Consumes events from Kafka KRaft broker and delivers in real-time to active WebSocket sessions.
 */
class MessageConsumerService {
  constructor() {
    this.consumer = null;
    this.isRunning = false;
    this.maxRetries = 3;
  }

  /**
   * Start Kafka Consumer and subscribe to topics
   */
  async start() {
    try {
      console.log('[Kafka Consumer] Initializing consumer with group:', CONSUMER_GROUPS.MESSAGE_DELIVERY);

      this.consumer = kafka.consumer({
        groupId: CONSUMER_GROUPS.MESSAGE_DELIVERY,
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        allowAutoTopicCreation: true,
        retry: {
          initialRetryTime: 300,
          retries: 8
        }
      });

      await this.consumer.connect();
      console.log('✅ [Kafka Consumer] Connected to Kafka KRaft broker.');

      // Subscribe to relevant topics
      await this.consumer.subscribe({
        topics: [TOPICS.MESSAGES, TOPICS.NOTIFICATIONS, TOPICS.USER_EVENTS],
        fromBeginning: false
      });

      this.isRunning = true;

      // Start event processing loop
      await this.consumer.run({
        autoCommit: true,
        autoCommitInterval: 2000,
        eachMessage: async ({ topic, partition, message, heartbeat }) => {
          await this.handleMessage({ topic, partition, message, heartbeat });
        }
      });

      console.log(`✅ [Kafka Consumer] Actively listening on topics: ${[TOPICS.MESSAGES, TOPICS.NOTIFICATIONS, TOPICS.USER_EVENTS].join(', ')}`);
    } catch (err) {
      console.error('❌ [Kafka Consumer] Initialization error:', err.message);
      this.isRunning = false;
      // Allow retry after backoff
      setTimeout(() => {
        if (!this.isRunning) this.start().catch(() => {});
      }, 10000);
    }
  }

  /**
   * Process individual incoming Kafka record
   */
  async handleMessage({ topic, partition, message, heartbeat }) {
    const rawValue = message.value?.toString();
    const messageKey = message.key?.toString();

    if (!rawValue) return;

    let event = null;
    try {
      event = JSON.parse(rawValue);
    } catch (err) {
      console.error(`[Kafka Consumer] Malformed JSON received on topic ${topic}:`, rawValue);
      return;
    }

    const eventType = event.event_type || 'unknown';
    console.log(`[Kafka Consumer] Received [${eventType}] from topic '${topic}' (Partition ${partition}, Offset ${message.offset}, Key: ${messageKey})`);

    let attempts = 0;
    while (attempts < this.maxRetries) {
      try {
        switch (topic) {
          case TOPICS.MESSAGES:
            await this.processMessageTopicEvent(event);
            break;

          case TOPICS.NOTIFICATIONS:
            await this.processNotificationTopicEvent(event);
            break;

          case TOPICS.USER_EVENTS:
            await this.processUserTopicEvent(event);
            break;

          default:
            console.log(`[Kafka Consumer] Unhandled topic: ${topic}`);
            break;
        }

        // Processing succeeded
        if (heartbeat) await heartbeat();
        return;
      } catch (err) {
        attempts++;
        console.error(`❌ [Kafka Consumer] Error processing event [${eventType}] (Attempt ${attempts}/${this.maxRetries}):`, err.message);

        if (attempts >= this.maxRetries) {
          console.error(`🚨 [Kafka Consumer] Routing poison event to DLQ '${TOPICS.DLQ}':`, event.event_id);
          await messageProducer.publishToDLQ(event, {
            message: err.message,
            stack: err.stack,
            attempts
          });
          return;
        }

        // Short exponential backoff before retry
        await new Promise(resolve => setTimeout(resolve, 500 * attempts));
      }
    }
  }

  /**
   * Process message events (message.sent, message.delivered, message.read)
   */
  async processMessageTopicEvent(event) {
    const { event_type, payload } = event;

    if (event_type === EVENT_TYPES.MESSAGE_SENT) {
      const {
        message_id,
        conversation_id,
        sender_id,
        receiver_id,
        sender_name,
        sender_avatar,
        content,
        message_type,
        trek_data,
        attachment_url,
        created_at,
        client_message_id
      } = payload;

      // 1. Fetch conversation participants from DB to find recipient(s)
      const res = await query(
        `SELECT cp.user_id, u.full_name, u.profile_image
         FROM conversation_participants cp
         JOIN users u ON cp.user_id = u.user_id
         WHERE cp.conversation_id = $1`,
        [conversation_id]
      );

      const participants = res.rows;
      let deliveredToAnyReceiver = false;

      // 2. Dispatch real-time message via WebSocket to every participant
      for (const participant of participants) {
        const participantId = String(participant.user_id);
        const isSender = participantId === String(sender_id);

        const wsPayload = {
          type: 'message.new',
          message: {
            message_id: parseInt(message_id, 10),
            conversation_id: parseInt(conversation_id, 10),
            sender_id: parseInt(sender_id, 10),
            sender_name,
            sender_avatar,
            content,
            message_type,
            trek_data,
            attachment_url,
            status: isSender ? 'sent' : 'delivered',
            created_at,
            is_self: isSender,
            client_message_id
          }
        };

        const wasDelivered = wsManager.sendToUser(participantId, wsPayload);

        if (!isSender) {
          if (wasDelivered) {
            deliveredToAnyReceiver = true;
          } else {
            // Receiver is offline: create in-app notification in DB & publish notification event
            await this.createOfflineNotification({
              userId: participantId,
              senderId: sender_id,
              senderName: sender_name,
              conversationId: conversation_id,
              content: content || (trek_data ? `Shared Trek: ${trek_data.name}` : 'Sent an attachment')
            });
          }
        }
      }

      // 3. If recipient was online and received message, update DB status to 'delivered'
      if (deliveredToAnyReceiver) {
        await query(
          `UPDATE messages SET status = 'delivered', delivered_at = CURRENT_TIMESTAMP
           WHERE message_id = $1 AND status = 'sent'`,
          [message_id]
        ).catch(() => {});

        // Notify sender over WebSocket that message status is now 'delivered' (double-check)
        wsManager.sendToUser(String(sender_id), {
          type: 'message.status_update',
          conversation_id: parseInt(conversation_id, 10),
          message_id: parseInt(message_id, 10),
          status: 'delivered',
          client_message_id
        });
      }

      console.log(`[WebSocket] Message ${message_id} routed to conversation ${conversation_id} participants.`);
    }

    else if (event_type === EVENT_TYPES.MESSAGE_READ) {
      const { conversation_id, reader_id, message_ids, read_at } = payload;

      // Broadcast read receipt to conversation participants
      await wsManager.broadcastToConversationParticipants(
        conversation_id,
        {
          type: 'message.read_receipt',
          conversation_id: parseInt(conversation_id, 10),
          reader_id: parseInt(reader_id, 10),
          message_ids,
          read_at
        },
        reader_id // exclude reader
      );
    }
  }

  /**
   * Process notification events
   */
  async processNotificationTopicEvent(event) {
    const { payload } = event;
    if (payload?.user_id) {
      wsManager.sendToUser(payload.user_id, {
        type: 'notification.new',
        notification: payload
      });
    }
  }

  /**
   * Process user presence events
   */
  async processUserTopicEvent(event) {
    const { payload } = event;
    if (payload?.user_id) {
      wsManager.broadcast({
        type: 'user.presence',
        user_id: payload.user_id,
        status: payload.status,
        timestamp: payload.timestamp
      });
    }
  }

  /**
   * Helper: create DB notification and publish to Kafka when receiver is offline
   */
  async createOfflineNotification({ userId, senderId, senderName, conversationId, content }) {
    try {
      const title = `New message from ${senderName}`;
      const snippet = content.length > 80 ? content.substring(0, 77) + '...' : content;

      const notifRes = await query(
        `INSERT INTO notifications (user_id, actor_id, type, title, message, reference_id, reference_type)
         VALUES ($1, $2, 'message', $3, $4, $5, 'conversation')
         RETURNING notification_id, created_at`,
        [userId, senderId, title, snippet, conversationId]
      );

      if (notifRes.rows.length > 0) {
        const notif = notifRes.rows[0];
        const notifEvent = createNotificationEvent({
          notification_id: notif.notification_id,
          user_id: userId,
          actor_id: senderId,
          type: 'message',
          title,
          message: snippet,
          reference_id: conversationId,
          reference_type: 'conversation',
          created_at: notif.created_at
        });

        await messageProducer.publishNotificationEvent(notifEvent);
      }
    } catch (err) {
      console.warn('[Kafka Consumer] Could not create offline notification:', err.message);
    }
  }

  /**
   * Graceful shutdown of consumer
   */
  async disconnect() {
    if (this.consumer && this.isRunning) {
      try {
        console.log('[Kafka Consumer] Disconnecting consumer gracefully...');
        await this.consumer.disconnect();
        this.isRunning = false;
        console.log('✅ [Kafka Consumer] Disconnected.');
      } catch (err) {
        console.error('[Kafka Consumer] Error during disconnect:', err.message);
      }
    }
  }
}

export const messageConsumer = new MessageConsumerService();
export default messageConsumer;
