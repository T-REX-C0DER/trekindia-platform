import http from 'http';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes      from './routes/authRoutes.js';
import profileRoutes   from './routes/profileRoutes.js';
import trekRoutes      from './routes/trekRoutes.js';
import stateRoutes     from './routes/stateRoutes.js';
import districtRoutes  from './routes/districtRoutes.js';
import gearRoutes      from './routes/gearRoutes.js';
import communityRoutes from './routes/communityRoutes.js';
import { errorMiddleware } from './middleware/errorMiddleware.js';
import { runMigrations }  from './config/initDb.js';

// Kafka KRaft & WebSocket Modules
import { initializeKafkaTopics } from './kafka/admin.js';
import messageProducer from './kafka/producer.js';
import messageConsumer from './kafka/consumer.js';
import wsManager from './websocket/wsServer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

const app = express();
const PORT = process.env.PORT || 5000;

// Create standard Node.js HTTP server to support both Express & WebSockets
const server = http.createServer(app);

// Run DB migrations automatically
runMigrations();

// CORS configuration
const clientUrl = process.env.CLIENT_URL;
const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

if (clientUrl && !allowedOrigins.includes(clientUrl)) {
  allowedOrigins.push(clientUrl);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Core Middlewares
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Serve /profile to profile.html
app.get('/profile', (req, res) => {
  res.sendFile(path.join(rootDir, 'profile.html'));
});

// Serve /community to community.html
app.get('/community', (req, res) => {
  res.sendFile(path.join(rootDir, 'community.html'));
});

// Static File Server (serves existing TrekIndia UI)
app.use(express.static(rootDir));

// Health Check API
app.get('/api/health', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'TrekIndia API & Kafka KRaft Services are active.',
    kafka: {
      producer_connected: messageProducer.isConnected,
      consumer_running: messageConsumer.isRunning
    },
    websocket: {
      online_users_count: wsManager.getOnlineUserIds().length
    }
  });
});

// Protected Test Route
import { requireAuth } from './middleware/authMiddleware.js';
app.get('/api/users/me', requireAuth, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

// Authentication V1 Routes
app.use('/api/auth', authRoutes);

// Profile API Routes
app.use('/api/profile', profileRoutes);

// Trek API Routes
app.use('/api/treks', trekRoutes);

// State API Routes
app.use('/api/states', stateRoutes);

// District API Routes
app.use('/api/districts', districtRoutes);

// Gear API Routes
app.use('/api/gear', gearRoutes);

// Community API Routes
app.use('/api/community', communityRoutes);

// Centralized Error Handling Middleware
app.use(errorMiddleware);

// Initialize WebSocket Manager on HTTP Server
wsManager.init(server);

// Initialize Kafka KRaft Services (Topics, Producer, Consumer)
async function startKafkaServices() {
  try {
    console.log('[Server Startup] Initializing Kafka KRaft architecture...');
    await initializeKafkaTopics();
    await messageProducer.connect();
    await messageConsumer.start();
  } catch (err) {
    console.warn('⚠️ [Server Startup] Notice on Kafka initialization:', err.message);
  }
}

startKafkaServices();

// Graceful Shutdown handling
async function gracefulShutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Starting graceful shutdown...`);
  try {
    await messageConsumer.disconnect();
    await messageProducer.disconnect();
    server.close(() => {
      console.log('✅ [Server] HTTP and WebSocket servers closed.');
      process.exit(0);
    });
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 TrekIndia Server running on http://localhost:${PORT}`);
  console.log(`   Community Hub:     http://localhost:${PORT}/community`);
  console.log(`   WebSocket Server:  ws://localhost:${PORT}/ws/messages`);
  console.log(`   Profile Dashboard: http://localhost:${PORT}/profile`);
  console.log(`   Healthcheck:       http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);
});

export default app;
