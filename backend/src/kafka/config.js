import net from 'net';
import { Kafka, logLevel } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Fast TCP probe to check if the Kafka broker port is reachable
 */
export async function isKafkaBrokerReachable(brokerAddress = null, timeoutMs = 800) {
  const target = brokerAddress || (process.env.KAFKA_BOOTSTRAP_SERVERS ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(',')[0].trim() : '127.0.0.1:9092');
  let [host, portStr] = target.split(':');
  if (host === 'localhost') host = '127.0.0.1';
  const port = parseInt(portStr || '9092', 10);

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const cleanup = () => {
      if (!settled) {
        settled = true;
        socket.removeAllListeners();
        socket.destroy();
      }
    };

    socket.setTimeout(timeoutMs);

    socket.once('connect', () => {
      cleanup();
      resolve(true);
    });

    socket.once('timeout', () => {
      cleanup();
      resolve(false);
    });

    socket.once('error', () => {
      cleanup();
      resolve(false);
    });

    try {
      socket.connect(port, host);
    } catch (_) {
      cleanup();
      resolve(false);
    }
  });
}

/**
 * Custom KafkaJS Logger that suppresses noisy ECONNREFUSED JSON error spam
 */
const customLogCreator = () => {
  return ({ level, log }) => {
    const { message, error } = log;
    const msg = String(message || '');
    const errMsg = String(error?.message || error || '');

    // Filter out expected connection failures when Kafka broker is offline
    if (
      msg.includes('Connection error') ||
      msg.includes('Failed to connect to seed broker') ||
      msg.includes('ECONNREFUSED') ||
      errMsg.includes('ECONNREFUSED') ||
      msg.includes('The client is closed')
    ) {
      return; // Quietly handled by coordinator
    }

    if (level === logLevel.ERROR) {
      console.error(`[Kafka Error] ${msg}`, errMsg ? `(${errMsg})` : '');
    } else if (level === logLevel.WARN && !msg.includes('Limiting retries')) {
      console.warn(`[Kafka Warn] ${msg}`);
    }
  };
};

export const KAFKA_CONFIG = {
  clientId: process.env.KAFKA_CLIENT_ID || 'trekindia-platform',
  brokers: process.env.KAFKA_BOOTSTRAP_SERVERS 
    ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(',').map(b => b.trim()) 
    : ['127.0.0.1:9092'],
  logLevel: logLevel.ERROR,
  logCreator: customLogCreator,
  retry: {
    initialRetryTime: 200,
    retries: 3,
    maxRetryTime: 3000,
    factor: 1.5
  }
};

export const TOPICS = {
  MESSAGES: process.env.KAFKA_MESSAGES_TOPIC || 'trekindia.messages',
  NOTIFICATIONS: process.env.KAFKA_NOTIFICATIONS_TOPIC || 'trekindia.notifications',
  USER_EVENTS: process.env.KAFKA_USER_EVENTS_TOPIC || 'trekindia.user-events',
  DLQ: process.env.KAFKA_DLQ_TOPIC || 'trekindia.messages.dlq'
};

export const CONSUMER_GROUPS = {
  MESSAGE_DELIVERY: process.env.KAFKA_MESSAGE_CONSUMER_GROUP || 'trekindia-message-delivery',
  NOTIFICATIONS: process.env.KAFKA_NOTIFICATION_CONSUMER_GROUP || 'trekindia-notifications-service'
};

export const kafka = new Kafka({
  clientId: KAFKA_CONFIG.clientId,
  brokers: KAFKA_CONFIG.brokers,
  logLevel: KAFKA_CONFIG.logLevel,
  logCreator: KAFKA_CONFIG.logCreator,
  retry: KAFKA_CONFIG.retry
});

export default kafka;

