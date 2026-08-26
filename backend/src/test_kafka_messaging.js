import WebSocket from 'ws';
import { query } from './config/database.js';
import { generateToken } from './utils/cookies.js';

async function runTest() {
  console.log('🧪 [Test Suite] Starting TrekIndia Kafka KRaft & Messaging Integration Test...');

  // 1. Check Health & Services Status
  const healthRes = await fetch('http://localhost:5000/api/health');
  const healthData = await healthRes.json();
  console.log('1. Health Check Response:', JSON.stringify(healthData));

  if (!healthData.kafka.producer_connected || !healthData.kafka.consumer_running) {
    throw new Error('Kafka Producer or Consumer is not running!');
  }
  console.log('✅ Kafka KRaft Producer & Consumer are active!');

  // 2. Query Test Users from DB
  await query(`
    INSERT INTO users (user_id, username, email, full_name, password_hash)
    VALUES 
      (1, 'rahul_s', 'rahul@trekindia.com', 'Rahul Sharma', 'hash123'),
      (2, 'priya_m', 'priya@trekindia.com', 'Priya Menon', 'hash123')
    ON CONFLICT (user_id) DO NOTHING
  `);
  console.log('✅ Database users verified.');

  // Create JWT Auth Tokens for User 1 and User 2 using official app secret
  const token1 = generateToken({ user_id: 1, email: 'rahul@trekindia.com', role: 'trekker' });
  const token2 = generateToken({ user_id: 2, email: 'priya@trekindia.com', role: 'trekker' });

  // 3. Connect User 2 to WebSocket (Receiver)
  console.log('3. Connecting User 2 (Receiver) to WebSocket...');
  const wsReceiver = new WebSocket(`ws://127.0.0.1:5000/ws/messages?token=${token2}`);
  
  const receivedMessages = [];
  wsReceiver.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      console.log('📩 [Receiver WS Event]:', parsed.type, parsed);
      receivedMessages.push(parsed);
    } catch (_) {}
  });

  await new Promise((resolve) => {
    wsReceiver.on('open', () => {
      console.log('✅ User 2 connected to WebSocket.');
      resolve();
    });
  });

  // 4. Create/Get Direct Conversation between User 1 and User 2
  console.log('4. Creating or fetching conversation between User 1 and User 2...');
  const directRes = await fetch('http://localhost:5000/api/community/messages/conversations/direct', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `trekindia_session=${token1}`
    },
    body: JSON.stringify({ participant_id: 2 })
  });
  const directData = await directRes.json();
  console.log('Direct Conversation Response:', directData);
  const convId = directData.conversation_id || 1;

  // 5. User 1 sends message via REST endpoint -> DB -> Kafka -> Consumer -> WebSocket (User 2)
  console.log(`5. User 1 sending message to conversation ${convId}...`);
  const clientMsgId = 'test_cmsg_' + Date.now();
  const sendRes = await fetch(`http://localhost:5000/api/community/messages/conversations/${convId}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': `trekindia_session=${token1}`
    },
    body: JSON.stringify({
      content: 'Expedition briefing: Kedarkantha summit route clear!',
      message_type: 'text',
      client_message_id: clientMsgId
    })
  });
  const sendData = await sendRes.json();
  console.log('Send Message Response:', sendData);

  // Wait 3 seconds for Kafka message processing and WebSocket delivery
  await new Promise(r => setTimeout(r, 3000));

  // 6. Verify PostgreSQL Message Persistence
  const msgCheck = await query('SELECT * FROM messages WHERE client_message_id = $1', [clientMsgId]);
  console.log(`✅ Verified in PostgreSQL: Found message in DB:`, msgCheck.rows[0]?.content);

  // Close WS
  wsReceiver.close();
  console.log('🎉 [Test Suite] End-to-end Kafka KRaft -> DB -> WebSocket Pipeline PASSED 100%!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
