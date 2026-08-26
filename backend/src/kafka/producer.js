import { kafka, TOPICS } from './config.js';

/**
 * TrekIndia — Reusable Singleton Kafka Producer Service
 * Handles event serialization, partition key routing, and resilient delivery.
 */
class MessageProducerService {
  constructor() {
    this.producer = null;
    this.isConnected = false;
    this.connectingPromise = null;
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
        this.producer = kafka.producer({
          allowAutoTopicCreation: true,
          transactionTimeout: 30000,
          idempotent: true
        });

        this.producer.on(this.producer.events.CONNECT, () => {
          this.isConnected = true;
          console.log('✅ [Kafka Producer] Connected to Kafka KRaft broker.');
        });

        this.producer.on(this.producer.events.DISCONNECT, () => {
          this.isConnected = false;
          console.warn('⚠️ [Kafka Producer] Disconnected from Kafka broker.');
        });

        await this.producer.connect();
        this.isConnected = true;
        return this.producer;
      } catch (err) {
        console.error('❌ [Kafka Producer] Connection error:', err.message);
        this.isConnected = false;
        // Don't throw fatal error - allow graceful degradation
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
   * Generic event sender with auto-reconnect and resilient logging
   */
  async sendEvent({ topic, key, event }) {
    try {
      if (!this.isConnected || !this.producer) {
        await this.connect();
      }

      if (!this.producer || !this.isConnected) {
        console.warn(`⚠️ [Kafka Producer] Broker offline. Event queued/persisted in DB: ${event.event_type || 'event'}`);
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
      return false;
    }
  }

  /**
   * Graceful shutdown of producer
   */
  async disconnect() {
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
