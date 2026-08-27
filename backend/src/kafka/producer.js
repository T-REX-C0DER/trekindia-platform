import { kafka, TOPICS } from './config.js';

/**
 * TrekIndia — Reusable Singleton Kafka Producer Service
 * Handles event serialization, partition key routing, and resilient delivery.
 * Features: exponential backoff reconnect, DISCONNECT auto-recovery, graceful degradation.
 */
class MessageProducerService {
  constructor() {
    this.producer = null;
    this.isConnected = false;
    this.connectingPromise = null;

    // Reconnect backoff state
    this._reconnectAttempts = 0;
    this._reconnectTimer = null;
    this._maxReconnectDelay = 5 * 60 * 1000; // 5 minutes cap
    this._baseDelay = 3000; // 3 seconds initial
  }

  /**
   * Compute next backoff delay with jitter: delay = min(base * 2^attempt, max) + jitter
   */
  _nextDelay() {
    const exponential = this._baseDelay * Math.pow(2, this._reconnectAttempts);
    const capped = Math.min(exponential, this._maxReconnectDelay);
    const jitter = Math.floor(Math.random() * 1000);
    return capped + jitter;
  }

  /**
   * Schedule a reconnect with exponential backoff.
   * Skips if already connected, connecting, or timer is already pending.
   */
  _scheduleReconnect() {
    if (this.isConnected || this.connectingPromise || this._reconnectTimer) return;

    const delay = this._nextDelay();
    console.log(`[Kafka Producer] Scheduling reconnect attempt #${this._reconnectAttempts + 1} in ${Math.round(delay / 1000)}s...`);

    this._reconnectTimer = setTimeout(async () => {
      this._reconnectTimer = null;
      if (!this.isConnected) {
        this._reconnectAttempts++;
        await this.connect().catch(() => {});
      }
    }, delay);
  }

  /**
   * Connect to Kafka cluster
   */
  async connect() {
    if (this.isConnected && this.producer) return this.producer;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = (async () => {
      try {
        console.log('[Kafka Producer] Connecting to KRaft broker...');

        // Disconnect existing broken producer if any
        if (this.producer) {
          try { await this.producer.disconnect(); } catch (_) {}
          this.producer = null;
        }

        this.producer = kafka.producer({
          allowAutoTopicCreation: true,
          transactionTimeout: 30000,
          idempotent: true
        });

        this.producer.on(this.producer.events.CONNECT, () => {
          this.isConnected = true;
          this._reconnectAttempts = 0; // reset backoff on successful connect
          if (this._reconnectTimer) {
            clearTimeout(this._reconnectTimer);
            this._reconnectTimer = null;
          }
          console.log('✅ [Kafka Producer] Connected to Kafka KRaft broker.');
        });

        this.producer.on(this.producer.events.DISCONNECT, () => {
          this.isConnected = false;
          console.warn('⚠️ [Kafka Producer] Disconnected from Kafka broker. Auto-reconnect scheduled.');
          this._scheduleReconnect();
        });

        this.producer.on(this.producer.events.REQUEST_TIMEOUT, () => {
          console.warn('⚠️ [Kafka Producer] Request timed out.');
        });

        await this.producer.connect();
        this.isConnected = true;
        this._reconnectAttempts = 0;
        return this.producer;
      } catch (err) {
        console.error('❌ [Kafka Producer] Connection error:', err.message);
        this.isConnected = false;
        this._scheduleReconnect();
        // Don't throw — allow graceful degradation when Kafka is unavailable
        return null;
      } finally {
        this.connectingPromise = null;
      }
    })();

    return this.connectingPromise;
  }

  /**
   * Publish a message event to Kafka topic trekindia.messages
   * KEY: conversation_id (Guarantees in-order delivery within conversation partition)
   */
  async publishMessageEvent(event) {
    const conversationId = event.payload?.conversation_id;
    if (!conversationId) {
      console.warn('[Kafka Producer] Cannot publish message without conversation_id key.');
      return false;
    }

    return this.sendEvent({
      topic: TOPICS.MESSAGES,
      key: String(conversationId),
      event
    });
  }

  /**
   * Publish a user presence event to Kafka topic trekindia.user-events
   * KEY: user_id
   */
  async publishUserEvent(event) {
    const userId = event.payload?.user_id;
    return this.sendEvent({
      topic: TOPICS.USER_EVENTS,
      key: userId ? String(userId) : 'user-presence',
      event
    });
  }

  /**
   * Publish a notification event to Kafka topic trekindia.notifications
   * KEY: user_id
   */
  async publishNotificationEvent(event) {
    const userId = event.payload?.user_id;
    return this.sendEvent({
      topic: TOPICS.NOTIFICATIONS,
      key: userId ? String(userId) : 'notification',
      event
    });
  }

  /**
   * Publish a failed message event to Dead Letter Queue (trekindia.messages.dlq)
   */
  async publishToDLQ(originalEvent, errorDetails) {
    const dlqPayload = {
      dlq_timestamp: new Date().toISOString(),
      error: {
        message: errorDetails.message,
        stack: errorDetails.stack,
        attempts: errorDetails.attempts || 1
      },
      original_event: originalEvent
    };

    return this.sendEvent({
      topic: TOPICS.DLQ,
      key: originalEvent?.payload?.conversation_id || 'dlq',
      event: dlqPayload
    });
  }

  /**
   * Generic event sender with auto-reconnect and resilient logging.
   * If Kafka is offline, logs a warning and returns false (no crash).
   */
  async sendEvent({ topic, key, event }) {
    try {
      if (!this.isConnected || !this.producer) {
        await this.connect();
      }

      if (!this.producer || !this.isConnected) {
        console.warn(`⚠️ [Kafka Producer] Broker offline — event safely persisted in DB: ${event.event_type || 'event'}`);
        return false;
      }

      const serializedValue = JSON.stringify(event);

      const recordMetadata = await this.producer.send({
        topic,
        messages: [
          {
            key: String(key),
            value: serializedValue,
            headers: {
              'event_type': event.event_type || 'unknown',
              'client_id': 'trekindia-backend',
              'timestamp': String(Date.now())
            }
          }
        ]
      });

      console.log(`[Kafka Producer] Published [${event.event_type}] to topic '${topic}' (Partition ${recordMetadata[0]?.partition}, Key: ${key})`);
      return true;
    } catch (err) {
      console.error(`❌ [Kafka Producer] Delivery failed for topic '${topic}':`, err.message);
      // If the producer threw a connection error, mark as disconnected and schedule reconnect
      if (err.type === 'LEADER_NOT_AVAILABLE' || err.message?.includes('ECONNREFUSED') || err.message?.includes('disconnected')) {
        this.isConnected = false;
        this._scheduleReconnect();
      }
      return false;
    }
  }

  /**
   * Graceful shutdown of producer — clears reconnect timer too
   */
  async disconnect() {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer);
      this._reconnectTimer = null;
    }
    if (this.producer && this.isConnected) {
      try {
        console.log('[Kafka Producer] Disconnecting producer gracefully...');
        await this.producer.disconnect();
        this.isConnected = false;
        console.log('✅ [Kafka Producer] Disconnected.');
      } catch (err) {
        console.error('[Kafka Producer] Error during disconnect:', err.message);
      }
    }
  }
}

export const messageProducer = new MessageProducerService();
export default messageProducer;
