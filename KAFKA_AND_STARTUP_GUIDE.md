# 🏔️ TrekIndia — Kafka & Platform Startup Guide

This document provides a complete explanation and step-by-step procedure for running TrekIndia smoothly, understanding how Kafka KRaft and WebSockets operate, and resolving any issues when restarting after laptop sleep or shutdown.

---

## 🔍 Why Did the Previous Error Occur?

When you close your laptop (sleep/hibernate) or reboot:
1. **Docker Desktop & WSL2 Engine Pause/Stop**: The background Docker daemon (`docker-desktop`) and the Kafka container (`trekindia-kafka`) are paused or stopped.
2. **KafkaJS Connection Flood**: When running `npm start` while Kafka was offline, the Kafka client attempted 8 consecutive retries for Admin, Producer, and Consumer, dumping massive `AggregateError [ECONNREFUSED]` JSON error logs to the console and delaying API requests.
3. **Missing Graceful Fallback**: If Kafka was offline, real-time message delivery to WebSockets failed because the consumer wasn't running.

---

## ⚡ What We Fixed (New Resilient Architecture)

We upgraded the platform with a **Zero-Downtime Dual-Mode Architecture**:

1. **Instant, Non-Blocking Startup (< 1s)**:
   - The backend checks Kafka broker reachability (`localhost:9092`) in milliseconds using a lightweight TCP probe.
   - If Kafka is offline, the server boots immediately without hanging or throwing errors.

2. **Graceful Direct WebSocket Fallback**:
   - When Kafka is **Online**: Messages, notifications, and presence stream through the Kafka KRaft pipeline (partition-ordered, persistent topic log).
   - When Kafka is **Offline**: The system automatically switches to **Direct WebSocket & Database Mode**. Messages, read receipts, and typing indicators work in real time with 0 downtime.

3. **Background Auto-Discovery & Hot Reconnect**:
   - If you start Docker Desktop / Kafka *after* running `npm start`, the coordinator automatically detects Kafka on `localhost:9092`, creates topics, connects Producer & Consumer, and switches to Kafka streaming mode **without needing to restart the server**!

4. **Clean Logging**:
   - Noisy `kafkajs` JSON error traces are silenced and replaced with clean, human-friendly status banners.

---

## 🚀 Step-by-Step Procedure to Start Everything Correctly

### Option 1: Standard / Quick Start (Works Always — With or Without Docker)

If you just want to run and test the website immediately:

```bash
npm start
```
*(Or `npm run dev` for auto-reload during development)*

- 🌐 **Website**: [http://localhost:5000](http://localhost:5000)
- 💬 **Community Hub**: [http://localhost:5000/community](http://localhost:5000/community)
- ✉️ **Live Messages**: [http://localhost:5000/messages](http://localhost:5000/messages)
- 👤 **Profile Dashboard**: [http://localhost:5000/profile](http://localhost:5000/profile)
- 🩺 **Health Check**: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### Option 2: Full Architecture Start (Docker Kafka KRaft + Website)

To run the complete event-driven Kafka pipeline with Kafka UI dashboard:

#### Step 1: Start Docker & Kafka Containers
Run the automated Kafka startup script:
```bash
npm run kafka:start
```
*This command checks if Docker Desktop is running, starts the containers (`trekindia-kafka` and `trekindia-kafka-ui`), and waits until port 9092 is ready.*

> **Note for Docker Desktop**: If Docker Desktop is completely closed, open Docker Desktop from your Start Menu, wait ~15 seconds until the engine is green, then run `npm run kafka:start`.

#### Step 2: Start the TrekIndia Server
In your terminal, run:
```bash
npm start
```
You will see:
```text
====================================================
🚀 TrekIndia Server running on http://localhost:5000
   Community Hub:     http://localhost:5000/community
   WebSocket Server:  ws://localhost:5000/ws/messages
   Profile Dashboard: http://localhost:5000/profile
   Healthcheck:       http://localhost:5000/api/health
====================================================
✅ [Kafka Admin] Connected to Kafka KRaft broker.
✅ [Kafka Admin] All required topics exist.
✅ [Kafka Producer] Connected to Kafka KRaft broker.
✅ [Kafka Consumer] Connected to Kafka KRaft broker.
🚀 [Kafka KRaft] Full pipeline active: Producer & Consumer connected to localhost:9092.
```

#### Step 3: Access Kafka UI Dashboard
Open your browser to:
- 📊 **Kafka UI Dashboard**: [http://localhost:8080](http://localhost:8080)
- View real-time topics: `trekindia.messages`, `trekindia.notifications`, `trekindia.user-events`, `trekindia.messages.dlq`.

---

### Option 3: Single-Command Full Start

To attempt starting Kafka containers and launch the server in one go:
```bash
npm run start:all
```

---

## 💻 What to Do When You Close Your Laptop and Resume

When you reopen your laptop after sleep:

1. **If you were running `npm start`**:
   - Simply start it again:
     ```bash
     npm start
     ```
   - It will start instantly in < 1 second.

2. **If you want Kafka KRaft active**:
   - Make sure **Docker Desktop** is open in the Windows taskbar.
   - Run:
     ```bash
     npm run kafka:start
     ```
   - The backend coordinator will automatically connect to Kafka in the background within a few seconds!

---

## 🛠️ Handy NPM Command Cheat Sheet

| Command | Purpose |
| :--- | :--- |
| `npm start` | Starts TrekIndia server on port 5000 (Safe, instant startup) |
| `npm run dev` | Starts server with `nodemon` for auto-reloading during code edits |
| `npm run start:all` | Starts Kafka (if Docker is up) and launches the server |
| `npm run kafka:start` | Starts Kafka KRaft broker & Kafka UI via Docker Compose |
| `npm run kafka:status` | Checks if Kafka containers are running (`docker compose ps`) |
| `npm run kafka:logs` | Streams live logs from the Kafka broker container |
| `npm run kafka:stop` | Stops Kafka containers (`docker compose down`) |

---

## 🩺 Verifying System Health

You can verify the status of the entire stack at any time by visiting:
**[http://localhost:5000/api/health](http://localhost:5000/api/health)**

### Response when Kafka is Online:
```json
{
  "success": true,
  "message": "TrekIndia API is active.",
  "kafka": {
    "available": true,
    "mode": "kafka_kraft_stream",
    "producer_connected": true,
    "consumer_running": true
  },
  "websocket": {
    "online_users_count": 2
  }
}
```

### Response when Kafka is Offline (Direct WebSocket Mode):
```json
{
  "success": true,
  "message": "TrekIndia API is active.",
  "kafka": {
    "available": false,
    "mode": "graceful_direct_websocket_fallback",
    "producer_connected": false,
    "consumer_running": false
  },
  "websocket": {
    "online_users_count": 2
  }
}
```

---

## 🔧 Troubleshooting

1. **Docker error: `failed to connect to the docker API`**:
   - Open **Docker Desktop** from the Windows Start menu.
   - Wait until the Docker Desktop icon in the system tray shows "Engine running".
   - Re-run `npm run kafka:start`.

2. **Port 5000 or 9092 already in use**:
   - To stop existing node processes: `taskkill /F /IM node.exe`
   - To restart Kafka containers: `npm run kafka:stop` followed by `npm run kafka:start`.

3. **Database connection issues**:
   - PostgreSQL runs as a Windows Service (`postgresql-x64-18`).
   - Check `.env` file for credentials (`DB_HOST=localhost`, `DB_PORT=5432`, `DB_USER=postgres`).
