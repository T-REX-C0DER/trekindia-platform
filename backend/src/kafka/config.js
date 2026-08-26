import { Kafka, logLevel } from 'kafkajs';
import dotenv from 'dotenv';

dotenv.config();

export const KAFKA_CONFIG = {
  clientId: process.env.KAFKA_CLIENT_ID || 'trekindia-platform',
  brokers: process.env.KAFKA_BOOTSTRAP_SERVERS 
    ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(',').map(b => b.trim()) 
    : ['127.0.0.1:9092'],
  logLevel: process.env.NODE_ENV === 'development' ? logLevel.INFO : logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 8,
    maxRetryTime: 30000,
    factor: 2
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
  retry: KAFKA_CONFIG.retry
});

export default kafka;
