import { kafka, TOPICS, isKafkaBrokerReachable } from './config.js';

/**
 * Initialize and verify required Kafka KRaft topics with appropriate partitions
 */
export async function initializeKafkaTopics() {
  const isReachable = await isKafkaBrokerReachable();
  if (!isReachable) {
    return false;
  }

  const admin = kafka.admin();

  try {
    console.log('[Kafka Admin] Connecting to Kafka broker to verify topics...');
    await admin.connect();
    console.log('✅ [Kafka Admin] Connected to Kafka KRaft broker.');

    const existingTopics = await admin.listTopics();
    console.log(`[Kafka Admin] Existing topics:`, existingTopics);

    const requiredTopics = [
      {
        topic: TOPICS.MESSAGES,
        numPartitions: 3,
        replicationFactor: 1, // Single-broker local KRaft cluster
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' } // 7 days retention
        ]
      },
      {
        topic: TOPICS.NOTIFICATIONS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '604800000' }
        ]
      },
      {
        topic: TOPICS.USER_EVENTS,
        numPartitions: 3,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '86400000' } // 1 day retention
        ]
      },
      {
        topic: TOPICS.DLQ,
        numPartitions: 1,
        replicationFactor: 1,
        configEntries: [
          { name: 'cleanup.policy', value: 'delete' },
          { name: 'retention.ms', value: '1209600000' } // 14 days retention
        ]
      }
    ];

    const topicsToCreate = requiredTopics.filter(t => !existingTopics.includes(t.topic));

    if (topicsToCreate.length > 0) {
      console.log(`[Kafka Admin] Creating missing topics:`, topicsToCreate.map(t => t.topic));
      await admin.createTopics({
        validateOnly: false,
        waitForLeaders: true,
        topics: topicsToCreate
      });
      console.log('✅ [Kafka Admin] Topics created successfully.');
    } else {
      console.log('✅ [Kafka Admin] All required topics exist.');
    }

    return true;
  } catch (err) {
    console.warn('⚠️ [Kafka Admin] Topic verification notice:', err.message);
    return false;
  } finally {
    try {
      await admin.disconnect();
    } catch (_) {}
  }
}

// Allow direct execution: node backend/src/kafka/admin.js
if (process.argv[1] && process.argv[1].endsWith('admin.js')) {
  initializeKafkaTopics().then(() => process.exit(0)).catch(() => process.exit(1));
}
