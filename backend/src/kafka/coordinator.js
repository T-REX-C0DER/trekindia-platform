import { isKafkaBrokerReachable } from './config.js';
import { initializeKafkaTopics } from './admin.js';
import messageProducer from './producer.js';
import messageConsumer from './consumer.js';

class KafkaCoordinator {
  constructor() {
    this.isKafkaAvailable = false;
    this.isInitializing = false;
    this.pollInterval = null;
  }

  /**
   * Start Kafka services with non-blocking graceful fallback
   */
  async start() {
    await this._tryConnect();

    // Start background auto-discovery polling every 8s
    if (!this.pollInterval) {
      this.pollInterval = setInterval(async () => {
        const isReachable = await isKafkaBrokerReachable();

        if (isReachable && !this.isKafkaAvailable && !this.isInitializing) {
          console.log('\n🔄 [Kafka Coordinator] Kafka broker detected on localhost:9092! Connecting...');
          await this._tryConnect();
        } else if (!isReachable && this.isKafkaAvailable) {
          console.warn('\n⚠️ [Kafka Coordinator] Kafka broker became unreachable. Switched to Graceful WebSocket Fallback.');
          this.isKafkaAvailable = false;
          try { await messageConsumer.disconnect(); } catch (_) {}
          try { await messageProducer.disconnect(); } catch (_) {}
        }
      }, 8000);
    }
  }

  async _tryConnect() {
    if (this.isInitializing) return;
    this.isInitializing = true;

    try {
      const isReachable = await isKafkaBrokerReachable();

      if (!isReachable) {
        this.isKafkaAvailable = false;
        console.log('ℹ️  [Kafka KRaft] Broker is offline at localhost:9092.');
        console.log('💡 [Kafka KRaft] Running in Graceful Fallback Mode (Direct WebSocket messaging active).');
        console.log('💡 [Kafka KRaft] To enable Kafka streaming: Start Docker Desktop & run "npm run kafka:start".\n');
        return false;
      }

      console.log('[Kafka Coordinator] Broker is reachable. Initializing KRaft topics...');
      await initializeKafkaTopics();

      const prod = await messageProducer.connect();
      const cons = await messageConsumer.start();

      if (prod && cons) {
        this.isKafkaAvailable = true;
        console.log('🚀 [Kafka KRaft] Full pipeline active: Producer & Consumer connected to localhost:9092.\n');
        return true;
      } else {
        this.isKafkaAvailable = false;
        return false;
      }
    } catch (err) {
      this.isKafkaAvailable = false;
      return false;
    } finally {
      this.isInitializing = false;
    }
  }

  /**
   * Return status object for health checks
   */
  getStatus() {
    return {
      available: this.isKafkaAvailable,
      mode: this.isKafkaAvailable ? 'kafka_kraft_stream' : 'graceful_direct_websocket_fallback',
      producer_connected: Boolean(messageProducer.isConnected),
      consumer_running: Boolean(messageConsumer.isRunning)
    };
  }

  /**
   * Graceful shutdown
   */
  async stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    try {
      await messageConsumer.disconnect();
      await messageProducer.disconnect();
      this.isKafkaAvailable = false;
    } catch (_) {}
  }
}

export const kafkaCoordinator = new KafkaCoordinator();
export default kafkaCoordinator;
