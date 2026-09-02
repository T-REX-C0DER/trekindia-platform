# TrekIndia Platform — Comprehensive Production Deployment Guide

> **Document Version:** 1.0.0  
> **Target Codebase:** `trekindia-platform`  
> **Architecture Pattern:** Hybrid Monolith (Node.js/Express API + Vanilla Web Component Frontend + PostgreSQL + KRaft Kafka Event Mesh / WebSocket Realtime Delivery)

---

## 1. Current Architecture Analysis

TrekIndia is built as an end-to-end full-stack outdoor exploration, community, and real-time social platform. The architecture is engineered around modern JavaScript (ES Modules), relational data persistence in PostgreSQL, asynchronous event-driven messaging with Apache Kafka (KRaft mode), and low-latency bidirectional communication via WebSockets.

```
+---------------------------------------------------------------------------------------------------+
|                                      CLIENT BROWSER / USER                                        |
|  - Vanilla HTML5 / Modern CSS (Dark & Forest Themes) / Modular ES6 JavaScript                     |
|  - Pages: Home (index.html), Community (community.html), Messages (messages.html),              |
|           Profile (profile.html), Trek Detail (trek-detail.html), Auth (auth.html)                |
+------------------------------------+-------------------------------------+------------------------+
                                     |                                     |
                       HTTP / HTTPS (REST API)                WSS (WebSocket /ws/messages)
                                     |                                     |
+------------------------------------v-------------------------------------v------------------------+
|                                NODE.JS & EXPRESS BACKEND (server.js)                              |
|                                                                                                   |
|  +------------------------+  +------------------------+  +-------------------------------------+  |
|  |   Express Middleware   |  |     REST Controllers   |  |       WebSocket Manager             |  |
|  | - CORS Handling        |  | - Auth (Argon2id/JWT)  |  | - Connection pool & heartbeat       |  |
|  | - Cookie Parser        |  | - Trek & Geo Services  |  | - Session authentication handshake |  |
|  | - Express Rate Limiter |  | - Profile & Badges     |  | - User presence & typing broadcast  |  |
|  | - Static File Server   |  | - Community & Posts    |  | - Direct WebSocket Fallback Engine  |  |
|  +------------------------+  +-----------+------------+  +------------------^------------------+  |
|                                          |                                  |                     |
|                                          v                                  v                     |
|                              +-----------------------+          +-------------------------+       |
|                              |   PostgreSQL Client   |          |    Kafka Coordinator    |       |
|                              | (pg.Pool / Migrations)|          | - Broker TCP probe (8s) |       |
|                              +-----------+-----------+          | - kafkajs Producer      |       |
|                                          |                      | - kafkajs Consumer      |       |
|                                          |                      +------------+------------+       |
+------------------------------------------|-----------------------------------|--------------------+
                                           |                                   |
                                           v                                   v
             +---------------------------------------------+   +------------------------------------+
             |            POSTGRESQL DATABASE              |   |       APACHE KAFKA CLUSTER         |
             | - users, user_profiles, user_settings       |   | (KRaft Mode - Port 9092 / 29092)   |
             | - states, districts, treks, trek_locations  |   | Topics:                            |
             | - trek_companies, trek_gear_products        |   | - trekindia.messages               |
             | - badges, user_badges, user_treks           |   | - trekindia.notifications          |
             | - community_posts, comments, stories        |   | - trekindia.user-events            |
             | - conversations, messages, notifications    |   | - trekindia.messages.dlq           |
             +---------------------------------------------+   +------------------------------------+
```

### Component Breakdown

1. **Frontend**:
   - Built with Vanilla HTML5, semantic markup, responsive CSS variables, and modern ES6 JavaScript modules.
   - No heavyweight frontend build step (Webpack/Vite) is strictly required; scripts are loaded as standard/modular scripts (`main.js`, `auth-client.js`, `community.js`, `messages.js`, `profile.js`, `trek-api.js`, `map.js`).
   - Handles client-side authentication persistence via session cookie check on `/api/auth/me`.
   - Connects to `/ws/messages` for instant real-time chats, typing indicators, read receipts, and presence updates.

2. **Backend**:
   - **Runtime**: Node.js (`type: "module"`) running Express 4.21.
   - **HTTP Server**: Wrapped with standard Node.js `http.createServer(app)` to multiplex Express REST endpoints and the `ws.WebSocketServer` on a single unified port.
   - **Static Delivery**: Express is configured to serve the root directory (`app.use(express.static(rootDir))`), routing `/community`, `/messages`, and `/profile` cleanly to their respective HTML pages.
   - **Error Handling & Resilience**: Centralized error middleware, rate limiting (`express-rate-limit`), input sanitation, and database connection pooling.

3. **Database Layer**:
   - **Engine**: PostgreSQL (`pg` v8.13.0 with connection pooling via `Pool`).
   - **Migrations**: Auto-runs on server bootstrap via `runMigrations()` in `backend/src/config/initDb.js`, executing ordered SQL files from `backend/src/migrations/`.
   - **Query Pattern**: 100% parameterized SQL queries (`$1`, `$2`, etc.) with sort-field whitelists to prevent SQL injection vulnerabilities.

4. **Authentication & Session Security**:
   - **Password Hashing**: State-of-the-art Argon2id hashing (`argon2` v0.40.0) with 64 MB memory cost and 3 time iterations.
   - **Session Tokens**: JSON Web Tokens (`jsonwebtoken` v9.0.2) signed with `SESSION_SECRET` and stored in `HttpOnly`, `SameSite`, and `Secure` cookies (`trekindia_session`).

5. **Real-time & WebSockets**:
   - WebSocket Server mounted on `/ws/messages` using `ws` (v8.21.3).
   - Features connection heartbeats (30s ping/pong), multi-tab user socket tracking (`Map<userId, Set<WebSocket>>`), typing indicators, read receipts, and user presence broadcasts (`online`/`offline`).

6. **Kafka Event Mesh (KRaft Mode)**:
   - Implemented via `kafkajs` (v2.2.4).
   - **Topics**: `trekindia.messages`, `trekindia.notifications`, `trekindia.user-events`, `trekindia.messages.dlq`.
   - **Producer & Consumer**: Run within the same backend process. The producer routes messages partitioned by `conversation_id` or `user_id`. The consumer processes records and dispatches them to active WebSocket clients.
   - **Graceful Fallback**: The custom `KafkaCoordinator` performs non-blocking TCP reachability probes every 8 seconds. If Kafka is offline, the platform automatically routes messages and notifications through direct WebSocket and PostgreSQL storage with **zero service degradation**.

7. **Docker Services**:
   - `docker-compose.yml` configures an Apache Kafka container in KRaft mode (no Zookeeper required) along with `provectuslabs/kafka-ui` on port 8080 for topic management and inspection.

8. **Image & File Storage**:
   - Profile images, post photos, and attachments are accepted as Base64 Data URLs (payload limit configured to `10mb` in Express) or external HTTPS image links (e.g. Unsplash CDN) and stored in PostgreSQL `JSONB` / `TEXT` columns.

---

## 2. Recommended Production Deployment Architecture

To achieve the best balance of **100% free-tier compatibility**, **stability**, **security**, and **effortless setup for a portfolio showcase**, the recommended deployment options are outlined below.

### Primary Recommendation: Unified Full-Stack on Render or Railway + Serverless PostgreSQL (Neon)

```
+-------------------------------------------------------------------------------------+
| FRONTEND & BACKEND (Unified Full-Stack)                                            |
| Platform: Render (Free Web Service) or Railway / Koyeb                              |
| - Serves both API (/api/*), WebSocket (/ws/messages), and UI (Static HTML/CSS/JS)   |
| - Eliminates CORS misconfigurations and cross-domain cookie blocking                |
+------------------------------------------+------------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+---------------------------------------+     +---------------------------------------+
| MANAGED POSTGRESQL (Primary DB)       |     | REAL-TIME STREAMING & EVENT LAYER     |
| Platform: Neon.tech (Free Serverless) |     | Mode A: Graceful Direct WebSocket     |
| - 0.5 GB Storage (Generous Free Tier) |     |         (Built-in, $0/month, 0 Ops)   |
| - Built-in Pooling & SSL Support      |     | Mode B: Upstash Kafka / Confluent     |
| - Full PG 15/16/17 Compatibility      |     |         (Optional Cloud Kafka Free)   |
+---------------------------------------+     +---------------------------------------+
```

### Architecture Comparison Table

| Architecture Option | Frontend Location | Backend Location | Database Provider | Kafka Strategy | Monthly Cost | Complexity | Suitability |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Option 1 (Recommended)** | Render (Unified with Express) | Render Web Service | Neon.tech (PostgreSQL) | Graceful WebSocket Fallback (Built-in) | **$0.00** | Low | **Best for Portfolio & Fast Setup** |
| **Option 2 (Cloud Kafka)** | Render (Unified with Express) | Render Web Service | Neon.tech (PostgreSQL) | Upstash Kafka (Serverless Free Tier) | **$0.00** | Medium | **Best for Full Kafka Demo** |
| **Option 3 (Decoupled)** | Vercel / Netlify | Render API Service | Neon.tech (PostgreSQL) | Upstash Kafka / WS Fallback | **$0.00** | High (CORS/Cookie Tuning) | Advanced |
| **Option 4 (VPS / Docker)** | VPS (Ubuntu) | VPS Docker Compose | PostgreSQL Container | KRaft Kafka Container in Docker | ~$4–$6/mo | Medium-High | Full Infrastructure Control |

---

## 3. Pre-Deployment Code Changes

To make the codebase production-ready for cloud platforms, several small, targeted updates are required.

### 1. PostgreSQL Connection Pooling (`backend/src/config/database.js`)
* **Current Issue**: Only reads individual `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` variables and lacks SSL support. Cloud providers like Neon, Supabase, and Render supply a single `DATABASE_URL` connection string that requires SSL.
* **Required Change**: Add `connectionString: process.env.DATABASE_URL` support with conditional SSL:
```javascript
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const isProduction = process.env.NODE_ENV === 'production';
const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'trekindia',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err.message);
});

export const query = (text, params) => pool.query(text, params);
export const getClient = () => pool.connect();
export default pool;
```

### 2. Cookie Security Settings (`backend/src/utils/cookies.js`)
* **Current Issue**: In production mode, `sameSite` is hardcoded to `'strict'`. If the frontend and backend are hosted on separate domains (e.g. `trekindia.vercel.app` and `trekindia-api.onrender.com`), browsers block the cookie.
* **Required Change**: Support configurable `COOKIE_SAME_SITE` and ensure `secure: true` when running over HTTPS:
```javascript
export function setAuthCookie(res, token) {
  const isProduction = process.env.NODE_ENV === 'production';
  // Use 'none' for cross-domain deployments (requires secure: true), or 'lax' for unified domain
  const sameSiteSetting = process.env.COOKIE_SAME_SITE || (isProduction ? 'lax' : 'lax');
  
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProduction || process.env.COOKIE_SECURE === 'true',
    sameSite: sameSiteSetting,
    maxAge: SEVEN_DAYS_MS,
    path: '/'
  });
}
```

### 3. Reverse Proxy & CORS Trust in Express (`backend/src/server.js`)
* **Current Issue**: Cloud hosts (Render, Railway, Fly.io, Heroku) run behind reverse proxies. Without `trust proxy`, secure cookies and IP-based rate limiting do not function accurately.
* **Required Change**: Add `app.set('trust proxy', 1)` and clean up CORS origin resolution:
```javascript
// Enable reverse proxy trust (vital for Render/Railway/Fly.io)
app.set('trust proxy', 1);

// Flexible CORS resolution
const allowedOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

if (process.env.CLIENT_URL) {
  process.env.CLIENT_URL.split(',').forEach(url => {
    const trimmed = url.trim();
    if (trimmed && !allowedOrigins.includes(trimmed)) {
      allowedOrigins.push(trimmed);
    }
  });
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    return callback(new Error('CORS policy: Not allowed by TrekIndia security.'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

### 4. Cloud Kafka SASL / TLS Support (`backend/src/kafka/config.js`)
* **Current Issue**: `kafkajs` client only connects via plain non-TLS connections (`127.0.0.1:9092`). Managed cloud Kafka services (Upstash, Confluent, Aiven) require SSL/TLS and SASL authentication.
* **Required Change**: Add conditional SASL and SSL flags:
```javascript
const kafkaBrokers = process.env.KAFKA_BOOTSTRAP_SERVERS
  ? process.env.KAFKA_BOOTSTRAP_SERVERS.split(',').map(b => b.trim())
  : ['127.0.0.1:9092'];

const kafkaSsl = process.env.KAFKA_SSL === 'true' ? { rejectUnauthorized: false } : false;

const kafkaSasl = process.env.KAFKA_SASL_USERNAME && process.env.KAFKA_SASL_PASSWORD
  ? {
      mechanism: process.env.KAFKA_SASL_MECHANISM || 'scram-sha-256',
      username: process.env.KAFKA_SASL_USERNAME,
      password: process.env.KAFKA_SASL_PASSWORD,
    }
  : undefined;

export const KAFKA_CONFIG = {
  clientId: process.env.KAFKA_CLIENT_ID || 'trekindia-platform',
  brokers: kafkaBrokers,
  ssl: kafkaSsl,
  sasl: kafkaSasl,
  logLevel: logLevel.ERROR,
  logCreator: customLogCreator,
  retry: {
    initialRetryTime: 300,
    retries: 3,
    maxRetryTime: 4000,
    factor: 1.5
  }
};
```

---

## 4. Environment Variables Reference

Below is the complete production environment variable specification for TrekIndia.

| Variable Name | Component | Required? | Secret? | Description | Example Placeholder |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Backend | **Yes** | No | Runtime environment (`production` or `development`). | `production` |
| `PORT` | Backend | Optional | No | Server port. Cloud hosts automatically set this. | `5000` or `10000` |
| `DATABASE_URL` | Database | **Yes** | **Yes** | Full PostgreSQL URI (Preferred on Neon/Render). | `postgresql://user:pass@ep-xyz.neon.tech/trekindia?sslmode=require` |
| `DB_HOST` | Database | Optional | No | Fallback DB host if `DATABASE_URL` is omitted. | `ep-sample-pooler.neon.tech` |
| `DB_PORT` | Database | Optional | No | PostgreSQL Port. | `5432` |
| `DB_NAME` | Database | Optional | No | Database Name. | `trekindia` |
| `DB_USER` | Database | Optional | No | Database Username. | `trekindia_admin` |
| `DB_PASSWORD` | Database | Optional | **Yes** | Database Password. | `[YOUR_DB_PASSWORD]` |
| `DB_SSL` | Database | Optional | No | Enable SSL (`true`/`false`). Recommended `true` for cloud DBs. | `true` |
| `SESSION_SECRET` | Auth | **Yes** | **Yes** | Cryptographic key for signing JWT tokens. | `e8f49a2b8478d1f2e0... (min 64 chars)` |
| `CLIENT_URL` | CORS | Optional | No | Production URL(s) of frontend (comma-separated if multiple). | `https://trekindia.onrender.com` |
| `COOKIE_SAME_SITE` | Auth | Optional | No | Cookie `SameSite` attribute (`lax`, `strict`, or `none`). | `lax` |
| `KAFKA_BOOTSTRAP_SERVERS`| Kafka | Optional | No | Comma-separated Kafka broker addresses. | `pkc-sample.us-east-1.aws.confluent.cloud:9092` |
| `KAFKA_CLIENT_ID` | Kafka | Optional | No | Unique Kafka client identifier. | `trekindia-production` |
| `KAFKA_SSL` | Kafka | Optional | No | Enable TLS/SSL for Kafka broker connection. | `true` |
| `KAFKA_SASL_MECHANISM` | Kafka | Optional | No | SASL Mechanism (`plain`, `scram-sha-256`, `scram-sha-512`). | `scram-sha-256` |
| `KAFKA_SASL_USERNAME` | Kafka | Optional | **Yes** | Kafka Cloud API key / username. | `[KAFKA_API_KEY]` |
| `KAFKA_SASL_PASSWORD` | Kafka | Optional | **Yes** | Kafka Cloud API secret / password. | `[KAFKA_API_SECRET]` |

### Recommended Production `.env.example`

```env
# ==============================================================================
# TrekIndia Platform — Production Environment Configuration
# ==============================================================================

# Server Environment
NODE_ENV=production
PORT=5000

# Primary PostgreSQL Database (Connection URI preferred)
DATABASE_URL=postgresql://[DB_USER]:[DB_PASSWORD]@[DB_HOST]:5432/[DB_NAME]?sslmode=require
DB_SSL=true
DB_POOL_MAX=10

# Security & JWT Secrets (Generate with: openssl rand -base64 64)
SESSION_SECRET=[GENERATE_LONG_SECURE_RANDOM_SECRET_KEY]

# CORS & Domain Settings
CLIENT_URL=https://trekindia.onrender.com
COOKIE_SAME_SITE=lax

# Optional Apache Kafka KRaft Cloud (Upstash / Confluent Cloud)
# If omitted or unreachable, TrekIndia runs in Graceful Direct WebSocket mode
KAFKA_BOOTSTRAP_SERVERS=
KAFKA_CLIENT_ID=trekindia-platform
KAFKA_SSL=false
KAFKA_SASL_MECHANISM=scram-sha-256
KAFKA_SASL_USERNAME=
KAFKA_SASL_PASSWORD=
```

---

## 5. Database Deployment (PostgreSQL)

### Recommended Provider: Neon.tech (Serverless PostgreSQL)
* **Why Neon?** 100% free tier (0.5 GB storage, autoscaling compute), native connection pooling, standard PostgreSQL 16/17 support, instant branch creation, and low latency.

### Step-by-Step Setup

1. **Create Account & Project**:
   - Go to [neon.tech](https://neon.tech) and sign up with GitHub or Google.
   - Click **Create Project**, name it `trekindia-db`, choose the region closest to your backend (e.g. `Frankfurt (eu-central-1)` or `Singapore (ap-southeast-1)` or `US East`).
2. **Obtain Connection String**:
   - On the Neon Dashboard, locate the **Connection Details** section.
   - Select **Pooled connection** or **Direct connection**.
   - Copy the URI in the format:
     `postgresql://alex:AbCdEfGh123@ep-cool-mountain-123456.eu-central-1.aws.neon.tech/neondb?sslmode=require`
3. **Execute Core Database Schema**:
   - Open Neon's built-in **SQL Editor** or connect via `psql` / DBeaver.
   - Execute the complete baseline SQL schema below to create all tables before starting the backend.

### Complete Baseline DDL SQL Script

```sql
-- =============================================================================
-- TrekIndia Core Database Schema Initialization Script
-- =============================================================================

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    user_id BIGSERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    profile_image TEXT,
    bio TEXT,
    phone VARCHAR(20),
    state VARCHAR(100),
    city VARCHAR(100),
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    role VARCHAR(30) NOT NULL DEFAULT 'user',
    online_status VARCHAR(20) DEFAULT 'offline',
    last_seen_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMPTZ
);

-- 2. User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    profile_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    cover_image TEXT,
    website TEXT,
    location VARCHAR(150),
    preferences JSONB DEFAULT '{"difficulty":[], "terrains":[], "seasons":[]}'::jsonb,
    social_links JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. User Settings Table
CREATE TABLE IF NOT EXISTS user_settings (
    setting_id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    push_notifications BOOLEAN NOT NULL DEFAULT TRUE,
    dark_mode BOOLEAN NOT NULL DEFAULT FALSE,
    language VARCHAR(20) NOT NULL DEFAULT 'en',
    privacy_level VARCHAR(30) NOT NULL DEFAULT 'public',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 4. States Table
CREATE TABLE IF NOT EXISTS states (
    state_id SERIAL PRIMARY KEY,
    state_name VARCHAR(100) NOT NULL UNIQUE,
    state_code VARCHAR(10),
    slug VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Districts Table
CREATE TABLE IF NOT EXISTS districts (
    district_id SERIAL PRIMARY KEY,
    state_id INT NOT NULL REFERENCES states(state_id) ON DELETE CASCADE,
    district_name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_state_district UNIQUE (state_id, district_name)
);

-- 6. Treks Table
CREATE TABLE IF NOT EXISTS treks (
    trek_id SERIAL PRIMARY KEY,
    trek_name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    state_id INT NOT NULL REFERENCES states(state_id) ON DELETE RESTRICT,
    district_id INT REFERENCES districts(district_id) ON DELETE SET NULL,
    difficulty VARCHAR(30) NOT NULL DEFAULT 'Moderate',
    trek_type VARCHAR(50) DEFAULT 'Mountain',
    distance_km NUMERIC(6, 2),
    duration_hours NUMERIC(6, 2),
    duration_label VARCHAR(50),
    elevation_m INT,
    highest_point_m INT,
    altitude_gain_m INT,
    starting_point VARCHAR(150),
    ending_point VARCHAR(150),
    best_time VARCHAR(100),
    entry_fee NUMERIC(10, 2) DEFAULT 0,
    permit_required BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT TRUE,
    status VARCHAR(30) NOT NULL DEFAULT 'active',
    rating NUMERIC(3, 2) DEFAULT 4.5,
    short_description TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 7. Trek Locations (Geo & Coordinates)
CREATE TABLE IF NOT EXISTS trek_locations (
    location_id SERIAL PRIMARY KEY,
    trek_id INT NOT NULL UNIQUE REFERENCES treks(trek_id) ON DELETE CASCADE,
    latitude NUMERIC(10, 7) NOT NULL,
    longitude NUMERIC(10, 7) NOT NULL,
    location_name VARCHAR(150),
    village VARCHAR(150)
);

-- 8. Trek Companies Table
CREATE TABLE IF NOT EXISTS trek_companies (
    company_id SERIAL PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL UNIQUE,
    website_url TEXT,
    treks JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 9. Trek Gear Products Table
CREATE TABLE IF NOT EXISTS trek_gear_products (
    id SERIAL PRIMARY KEY,
    product_name VARCHAR(200) NOT NULL,
    brand VARCHAR(100),
    category VARCHAR(100),
    description TEXT,
    image_url TEXT,
    amazon_url TEXT,
    flipkart_url TEXT,
    brand_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Seed Essential States & Treks from treks.json
INSERT INTO states (state_name, state_code, slug)
VALUES 
    ('Uttarakhand', 'UK', 'uttarakhand'),
    ('Himachal Pradesh', 'HP', 'himachal-pradesh'),
    ('Jammu & Kashmir', 'JK', 'jammu-kashmir'),
    ('Maharashtra', 'MH', 'maharashtra'),
    ('Sikkim', 'SK', 'sikkim'),
    ('Karnataka', 'KA', 'karnataka')
ON CONFLICT (state_name) DO NOTHING;

INSERT INTO treks (trek_name, slug, state_id, difficulty, distance_km, duration_label, elevation_m, rating, best_time, short_description)
VALUES 
    ('Kedarkantha', 'kedarkantha', 1, 'Easy', 20.0, '6 Days', 3810, 4.9, 'Dec – Apr', 'Famous winter snow trek in the Garhwal Himalayas with pristine pine forests.'),
    ('Roopkund Trek', 'roopkund', 1, 'Moderate', 53.0, '8 Days', 5029, 4.9, 'May – Jun', 'The mystery skeleton lake trek surrounded by majestic Trishul and Nanda Ghunti peaks.'),
    ('Valley of Flowers', 'valley-of-flowers', 1, 'Easy', 38.0, '6 Days', 3858, 4.8, 'Jul – Sep', 'UNESCO World Heritage botanical paradise nestled high in West Himalaya.'),
    ('Har Ki Dun', 'har-ki-dun', 1, 'Moderate', 47.0, '7 Days', 3566, 4.8, 'Apr – Jun', 'The legendary cradle-shaped valley steeped in mythological folklore.'),
    ('Hampta Pass', 'hampta-pass', 2, 'Moderate', 26.0, '5 Days', 4287, 4.8, 'Jun – Oct', 'Dramatic crossover trek from lush green Kullu valley to arid desert of Spiti.'),
    ('Kudremukh', 'kudremukh', 6, 'Moderate', 22.0, '2 Days', 1894, 4.8, 'Oct – Feb', 'Horse-face shaped peak in the heart of Western Ghats tropical rainforests.')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO trek_locations (trek_id, latitude, longitude, location_name)
VALUES
    (1, 31.0292, 78.1652, 'Sankri, Uttarkashi'),
    (2, 30.2480, 79.7250, 'Lohajung, Chamoli'),
    (3, 30.7268, 79.6010, 'Govindghat, Chamoli'),
    (4, 31.1667, 78.4167, 'Sankri, Uttarkashi'),
    (5, 32.2396, 77.1887, 'Jobra, Manali'),
    (6, 13.2178, 75.2570, 'Kalasa, Chikmagalur')
ON CONFLICT (trek_id) DO NOTHING;
```

4. **Automatic Migrations Verification**:
   - When the backend starts, `runMigrations()` in `backend/src/config/initDb.js` automatically executes `001_create_profile_tables.sql`, `002_create_community_tables.sql`, and `003_upgrade_messaging_schema.sql` to build the full badge catalog, community feeds, story tables, messaging schemas, and real-time presence columns.

---

## 6. Kafka Deployment & Streaming Strategy

### Deep Inspection of Current Kafka Integration

1. **How Kafka is Integrated in Code**:
   - `backend/src/kafka/coordinator.js` acts as the lifecycle coordinator.
   - `backend/src/kafka/producer.js` handles serialization, idempotency, and partition keys (`conversation_id` or `user_id`).
   - `backend/src/kafka/consumer.js` joins the consumer group `trekindia-message-delivery`, subscribes to `trekindia.messages`, `trekindia.notifications`, `trekindia.user-events`, and relays messages in real-time to active WebSocket sessions.
2. **Can TrekIndia run without Kafka?**:
   - **YES, 100%.** TrekIndia was deliberately designed with a **Graceful Fallback Mode**.
   - If Kafka is offline or unconfigured:
     - `isKafkaBrokerReachable()` returns `false` without crashing.
     - `messageProducer.publishMessageEvent()` detects that Kafka is offline and returns `false`.
     - `communityService.js` catches this and executes `dispatchDirectMessageFallback()`, which immediately stores the message in PostgreSQL, updates unread counts, and delivers the payload directly to the recipient's open WebSocket connection.
3. **Is Docker Compose required in production?**:
   - No. Docker Compose is convenient for local development, but in cloud environments you can either run Kafka-free (Option 1) or use a managed cloud broker (Option 2).

### Production Kafka Decision Guide

```
+---------------------------------------------------------------------------------------+
| DO YOU WANT A DEDICATED KAFKA CLUSTER IN YOUR FIRST PRODUCTION DEPLOYMENT?            |
+-------------------------------------------+-------------------------------------------+
                                            |
                   +------------------------+------------------------+
                   |                                                 |
            [NO (Recommended)]                                [YES (Optional)]
                   |                                                 |
                   v                                                 v
    +------------------------------+                  +------------------------------+
    | ZERO-COST DIRECT WS MODE     |                  | UPSTASH SERVERLESS KAFKA     |
    | - $0/month                   |                  | - Free Tier (10k msgs/day)   |
    | - Zero extra configuration   |                  | - Set KAFKA_BOOTSTRAP_SERVERS|
    | - Instant chats & presence   |                  | - Set KAFKA_SASL credentials |
    | - High reliability           |                  | - Full KRaft event streaming |
    +------------------------------+                  +------------------------------+
```

### How to Configure Upstash Kafka (If Cloud Kafka is Desired)
1. Sign up at [upstash.com](https://upstash.com).
2. Create a new Kafka cluster (Region: choose nearest to backend).
3. Create four topics: `trekindia.messages`, `trekindia.notifications`, `trekindia.user-events`, `trekindia.messages.dlq`.
4. Copy the **Bootstrap Endpoint**, **SASL Username**, and **SASL Password**.
5. Set the corresponding environment variables in your cloud backend dashboard:
   - `KAFKA_BOOTSTRAP_SERVERS=endpoint.upstash.io:9092`
   - `KAFKA_SSL=true`
   - `KAFKA_SASL_MECHANISM=scram-sha-256`
   - `KAFKA_SASL_USERNAME=[YOUR_UPSTASH_USER]`
   - `KAFKA_SASL_PASSWORD=[YOUR_UPSTASH_PASS]`

---

## 7. Backend Deployment Step-by-Step (Render.com)

### Step 1: Push Repository to GitHub
Ensure all code and configuration files are committed and pushed to your GitHub repository.

### Step 2: Create a Web Service on Render
1. Log in to [dashboard.render.com](https://dashboard.render.com).
2. Click **New +** -> **Web Service**.
3. Select your GitHub repository (`trekindia-platform`).
4. Configure the service settings:
   - **Name**: `trekindia-platform`
   - **Region**: Same region as your Neon database (e.g., `Frankfurt` or `Singapore` or `Ohio`).
   - **Branch**: `main`
   - **Root Directory**: `.` (leave blank / root)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`

### Step 3: Configure Environment Variables
In the **Environment** tab on Render, add:
* `NODE_ENV` = `production`
* `DATABASE_URL` = `[Your Neon PostgreSQL Connection String]?sslmode=require`
* `DB_SSL` = `true`
* `SESSION_SECRET` = `[Random string at least 64 characters long]`
* `CLIENT_URL` = `https://trekindia-platform.onrender.com` (use your assigned Render URL)
* `COOKIE_SAME_SITE` = `lax`

### Step 4: Deploy & Verify
1. Click **Create Web Service**. Render will clone the repository, run `npm install`, and execute `npm start`.
2. Open the Render **Logs** tab. You should see:
   ```text
   ✅ Migration executed: 001_create_profile_tables.sql
   ✅ Migration executed: 002_create_community_tables.sql
   ✅ Migration executed: 003_upgrade_messaging_schema.sql
   ✅ [WebSocket Server] Mounted on /ws/messages
   ℹ️  [Kafka KRaft] Broker is offline at localhost:9092.
   💡 [Kafka KRaft] Running in Graceful Fallback Mode (Direct WebSocket messaging active).
   🚀 TrekIndia Server running on http://localhost:10000
   ```
3. Test the health check endpoint:
   `https://trekindia-platform.onrender.com/api/health`
   Expected response:
   ```json
   {
     "success": true,
     "message": "TrekIndia API is active.",
     "kafka": {
       "available": false,
       "mode": "graceful_direct_websocket_fallback"
     },
     "websocket": {
       "online_users_count": 0
     }
   }
   ```

---

## 8. Frontend Deployment (Unified vs. Decoupled)

### Recommended: Unified Full-Stack (Zero Extra Steps)
Because Express already serves the static HTML/CSS/JS frontend (`index.html`, `community.html`, `messages.html`, `profile.html`, `auth.html`), navigating to your Render URL (`https://trekindia-platform.onrender.com`) **instantly opens the complete application**.

* **Why this is best**:
  - No CORS domain mismatches.
  - Cookies work smoothly with `SameSite=Lax`.
  - WebSocket auto-connects to `wss://trekindia-platform.onrender.com/ws/messages` automatically using `window.location.host`.
  - Single place to monitor logs and metrics.

### Alternative: Decoupled on Vercel / Netlify
If you specifically wish to host the static HTML on Vercel while running the API on Render:

1. **Frontend API URL Configuration**:
   - In `auth-client.js`, `trek-api.js`, `community.js`, `messages.js`, and `profile.js`, change relative paths `/api` and `/ws/messages` to point to `https://trekindia-platform.onrender.com/api` and `wss://trekindia-platform.onrender.com/ws/messages`.
2. **CORS on Backend**:
   - Add `https://your-app.vercel.app` to `CLIENT_URL` on Render.
3. **Cookie Configuration on Backend**:
   - Set `COOKIE_SAME_SITE=none` on Render so cross-domain cookies are accepted by Chrome/Safari.
4. **Vercel Settings**:
   - **Framework Preset**: `Other`
   - **Root Directory**: `.`
   - **Output Directory**: `.`

---

## 9. Domain, HTTPS, and Cookie Architecture

1. **Default HTTPS URLs**:
   - Render and Vercel automatically provision valid Let's Encrypt SSL/TLS certificates.
   - HTTPS enables browser access to secure features like `navigator.clipboard`, Web Crypto, and `Secure` cookies.
2. **WebSocket Secure (WSS)**:
   - When loaded over `https://`, browser code automatically upgrades WebSocket connections from `ws://` to `wss://`:
     ```javascript
     const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
     const wsUrl = `${protocol}//${window.location.host}/ws/messages`;
     ```
3. **Cookie Attributes in Production**:
   - `HttpOnly`: Prevents JavaScript `document.cookie` access, blocking XSS token theft.
   - `Secure`: Ensures cookies are only transmitted over encrypted HTTPS channels.
   - `SameSite`: Set to `Lax` for unified deployments (protects against CSRF) or `None` for cross-domain deployments.

---

## 10. Production Security Checklist

- [x] **Zero Hardcoded Secrets**: Ensure `.env` is listed in `.gitignore` and never committed to Git.
- [x] **Strong JWT Secret**: Ensure `SESSION_SECRET` is at least 64 characters long, randomly generated using `openssl rand -base64 64`.
- [x] **Argon2id Password Security**: Confirmed using recommended parameters (64 MB RAM, 3 iterations, 1 parallelism).
- [x] **Rate Limiting Active**: `express-rate-limit` prevents brute-force attempts on sensitive endpoints.
- [x] **SQL Injection Defense**: All database queries use parameterized placeholders (`$1`, `$2`) with whitelisted sort orders.
- [x] **XSS Sanitization**: User input rendered in the DOM is escaped with `escapeHtml()`.
- [x] **Payload Limits**: `express.json({ limit: '10mb' })` protects against memory exhaustion attacks while allowing image uploads.
- [x] **WebSocket Authentication**: Handshake parses and verifies the JWT cookie before accepting message streams.
- [x] **Production Error Masking**: `errorMiddleware.js` conceals internal database stack traces from API responses when `NODE_ENV === 'production'`.

---

## 11. Exact Deployment Sequence

Follow this sequence to ensure zero dependency conflicts during setup:

```
[Step 1: Database Setup]
  └── Create Neon PostgreSQL database instance
  └── Run Baseline DDL SQL Script in Neon SQL Editor

[Step 2: Codebase Preparation]
  └── Apply pre-deployment code adjustments (database.js, cookies.js, server.js)
  └── Commit and push changes to GitHub repository

[Step 3: Backend & Web Service Deployment]
  └── Create new Web Service on Render / Railway
  └── Connect GitHub repository
  └── Configure production environment variables (DATABASE_URL, SESSION_SECRET, etc.)
  └── Trigger first deployment

[Step 4: Verification & Automated Migrations]
  └── Inspect deployment logs for successful migration execution (001, 002, 003)
  └── Query /api/health to verify Express, WebSocket, and Database connectivity

[Step 5: End-to-End Functional Validation]
  └── Test User Registration, Login, and Session Cookie retention
  └── Test Trek Directory, State Filters, and Geo-map markers
  └── Test Community Post creation, Likes, and Comments
  └── Open two browser windows to verify live WebSocket/Kafka messaging
```

---

## 12. Complete Testing & QA Checklist

Execute these tests on your deployed production URL:

### 1. Authentication & Session Security
- [ ] Register a new user (`/auth.html`) with valid password.
- [ ] Confirm automatic redirection to home page with user avatar in navbar.
- [ ] Refresh the page; verify that `/api/auth/me` validates the session cookie without logging out.
- [ ] Open DevTools -> Application -> Cookies; verify `trekindia_session` has `HttpOnly` and `Secure` flags set.
- [ ] Click Logout; confirm cookie is deleted and navbar resets to guest state.

### 2. Exploration & Trek Directory
- [ ] Open home page (`/`); verify trek cards load from PostgreSQL `/api/treks`.
- [ ] Test the search bar with queries like "Kedarkantha" or "Roopkund".
- [ ] Filter by difficulty ("Easy", "Moderate", "Difficult") and state.
- [ ] Open the interactive map section; verify coordinate markers render properly.
- [ ] Click a trek card to open `/trek-detail.html?slug=kedarkantha`; verify altitude, distance, itinerary, and organizing companies load.

### 3. Community & Social Feed
- [ ] Navigate to Community Hub (`/community.html`).
- [ ] Publish a new post with caption, trek tag, and an image upload.
- [ ] Like and bookmark a post; verify counters increment and persist after page reload.
- [ ] Add a comment to a post; verify threaded discussion list updates.

### 4. Real-time Messaging & WebSockets
- [ ] Open two distinct browser sessions (e.g. Chrome normal window and Chrome Incognito window logged in as different users).
- [ ] Open Messages (`/messages.html`) in both windows.
- [ ] Verify the WebSocket connection badge turns **Green (Live)**.
- [ ] Send a message from User A to User B; verify it appears in real time without refreshing.
- [ ] Verify typing indicators appear when typing in the input box.
- [ ] Verify double checkmarks (read receipts) update when User B views the conversation.

---

## 13. Production Troubleshooting Guide

### 1. `no pg_hba.conf entry for host ... SSL off`
* **Cause**: Cloud PostgreSQL providers (Neon, Supabase, Render) enforce encrypted SSL connections.
* **Fix**: Ensure your `DATABASE_URL` ends with `?sslmode=require` and `poolConfig` in `database.js` has `ssl: { rejectUnauthorized: false }`.

### 2. Cookies Not Stored / User Logged Out on Page Refresh
* **Cause**: Browsers reject `SameSite=Strict` cookies across different domain origins or reject `Secure` cookies over non-HTTPS connections.
* **Fix**:
  - If frontend and backend are hosted together on Render, use `COOKIE_SAME_SITE=lax`.
  - If frontend is on Vercel and backend is on Render, set `COOKIE_SAME_SITE=none` and ensure backend runs on `https://`.
  - Ensure `app.set('trust proxy', 1)` is present in `server.js`.

### 3. CORS Error in Browser Console
* **Cause**: Frontend origin is not included in `allowedOrigins`.
* **Fix**: Set `CLIENT_URL` in your backend environment variables to match your exact frontend domain (e.g. `https://trekindia-platform.onrender.com` or `https://my-app.vercel.app` with no trailing slash).

### 4. WebSocket Connection Failed (`4001 Unauthorized` or `ERR_CONNECTION_REFUSED`)
* **Cause**: The WebSocket client attempted to connect before the session cookie was established, or reverse proxy blocked WebSocket upgrade headers.
* **Fix**:
  - Ensure the user is logged in before initiating chat sockets.
  - Verify that the WebSocket URL matches the current host using `${protocol}//${window.location.host}/ws/messages`.
  - On platforms like Render and Railway, WebSocket HTTP upgrades are supported out of the box on the main web service port.

### 5. Render Free Tier Cold Starts (Spin-down)
* **Cause**: Render's free tier spins down web services after 15 minutes of inactivity. The first request after sleep takes 30–50 seconds to start.
* **Fix**:
  - This is standard behavior for free instances.
  - You can set up a free uptime monitor (such as [cron-job.org](https://cron-job.org) or [UptimeRobot](https://uptimerobot.com)) to ping `https://trekindia-platform.onrender.com/api/health` every 10 minutes to keep the instance active.

---

## 14. Final Pre-Flight Launch Checklist

- [ ] Baseline SQL schema executed in Neon / PostgreSQL.
- [ ] `database.js` updated with `DATABASE_URL` and SSL support.
- [ ] `server.js` configured with `app.set('trust proxy', 1)` and production CORS list.
- [ ] `cookies.js` configured with production `SameSite` and `Secure` settings.
- [ ] Code committed and pushed to GitHub main branch.
- [ ] Web Service created on Render / Railway with correct environment variables.
- [ ] `/api/health` returns status `200 OK`.
- [ ] User registration, login, and session persistence verified.
- [ ] Trek directory, search, and map verified.
- [ ] Real-time WebSocket messaging and presence tested across two accounts.

---
*TrekIndia is now fully prepared for zero-cost, high-reliability production deployment!*
