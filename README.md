# TrekIndia Backend — Production-Ready Authentication & Community Platform

> 🚀 **Quick Start & Kafka Guide**: See [KAFKA_AND_STARTUP_GUIDE.md](file:///c:/Users/SANJAY%20LADE/Downloads/trekindia-platform/KAFKA_AND_STARTUP_GUIDE.md) for step-by-step instructions on running the platform, Kafka KRaft setup, and laptop sleep auto-recovery.

TrekIndia is a trekking platform focused on Indian treks. This module provides a complete, secure, production-ready backend built with Node.js, Express.js, PostgreSQL 18 (`pg`), Apache Kafka KRaft event streaming, WebSockets, Argon2id password hashing, and HttpOnly session cookies.

---

## 🏗️ Backend Directory Architecture

```text
backend/
│
├── src/
│   ├── config/
│   │   └── database.js       # PostgreSQL Pool connection & helper functions
│   │
│   ├── controllers/
│   │   └── authController.js # Handles request/response for register, login, logout, me
│   │
│   ├── middleware/
│   │   ├── authMiddleware.js # Cookie-based auth verification & RBAC middleware
│   │   └── errorMiddleware.js# Centralized error handler hiding internal stack traces
│   │
│   ├── routes/
│   │   └── authRoutes.js     # Express routes with rate limiting
│   │
│   ├── services/
│   │   └── authService.js    # Business logic, Argon2id hashing & DB transactions
│   │
│   ├── utils/
│   │   ├── validation.js     # Input validation & normalization
│   │   └── cookies.js        # HttpOnly cookie & JWT helpers
│   │
│   └── server.js             # Express application entrypoint
│
├── .env.example              # Environment variables template
├── .gitignore                # Prevents committing secrets & dependencies
├── package.json              # ES Modules dependencies & scripts
└── README.md
```

---

## 🔒 Authentication Security Strategy

### 1. Password Security (Argon2id)
- Uses **Argon2id** algorithm (`argon2.hash` with `argon2id` variant).
- Parameters: 64MB memory cost (`memoryCost: 65536`), 3 iterations (`timeCost: 3`), parallelism `1`.
- Plaintext passwords are **never** stored or logged. Password hashes are **never** returned in API responses.

### 2. Session Management (HttpOnly Cookies)
- Authenticated user sessions are managed via signed **HttpOnly** cookies containing JWT tokens.
- Cookie attributes:
  - `HttpOnly: true` (prevents JavaScript token theft & XSS extraction).
  - `SameSite: 'lax'` (CSRF protection).
  - `Secure: true` in production environment.
  - `maxAge`: 7 days.
- Tokens are **never** stored in `localStorage` or `sessionStorage`.

### 3. Database Security & Transactions
- PostgreSQL queries use strict parameterization (`$1`, `$2`, etc.) via `pg.Pool` to prevent SQL injection.
- User creation uses explicit PostgreSQL transactions (`BEGIN` -> `INSERT users` -> `INSERT user_profiles` -> `INSERT user_settings` -> `COMMIT`). Any failure triggers an automatic `ROLLBACK`.

### 4. Generic Authentication Errors
- Login failure errors return a generic message (`"Invalid email or password."`) to prevent account enumeration.

---

## 🛠️ Environment Configuration

Create a `.env` file in the root directory (based on `.env.example`):

```env
PORT=5000

DB_HOST=localhost
DB_PORT=5432
DB_NAME=trekindia
DB_USER=postgres
DB_PASSWORD=your_password_here

SESSION_SECRET=your_long_random_session_secret_here

CLIENT_URL=http://localhost:5000

NODE_ENV=development
```

---

## 📡 API Endpoints Summary

### Healthcheck
- `GET /api/health`
  - Returns `{ "success": true, "message": "TrekIndia API is running." }`

### Authentication V1
- `POST /api/auth/register`
  - **Body**: `{ "full_name": "...", "username": "...", "email": "...", "password": "...", "confirm_password": "..." }`
  - **Returns**: 201 Created on success, auto-logins via HttpOnly cookie.
- `POST /api/auth/login`
  - **Body**: `{ "email": "...", "password": "..." }`
  - **Returns**: 200 OK on success with safe user info, sets HttpOnly cookie.
- `POST /api/auth/logout`
  - **Returns**: 200 OK, clears HttpOnly cookie.
- `GET /api/auth/me`
  - **Returns**: 200 OK with authenticated user object or 401 Unauthorized.

### Treks API
- `GET /api/treks`
  - **Query Params**: `page`, `limit`, `state`, `district`, `difficulty`, `minRating`, `minDuration`, `maxDuration`, `minElevation`, `maxElevation`, `minDistance`, `maxDistance`, `season`, `sort`, `order`
  - **Returns**: Paginated list of treks with total count and page metadata.
- `GET /api/treks/map`
  - **Returns**: Optimized lightweight list of coordinates, trek names, slugs, state, district, difficulty, rating for Leaflet map markers.
- `GET /api/treks/search?q=query`
  - **Returns**: Treks matching search query in name, district, state, description, or starting point.
- `GET /api/treks/:id`
  - **Returns**: Complete trek details by numeric ID.
- `GET /api/treks/slug/:slug`
  - **Returns**: Complete trek details by slug.

### States & Districts API
- `GET /api/states`
  - **Returns**: All 27 states with live PostgreSQL-generated trek counts.
- `GET /api/states/:state/treks`
  - **Returns**: Paginated list of treks for a specific state.
- `GET /api/states/:state/districts`
  - **Returns**: Districts for a given state with trek counts.
- `GET /api/districts`
  - **Returns**: All districts grouped by state.

---

## 🗺️ PostGIS Spatial Integration

- PostGIS geometry column: `trek_locations.location` (type: `geometry(Point, 4326)`).
- Spatial Index: `idx_trek_locations_gist` (GiST index for spatial queries).
- All 692 treks in the PostgreSQL database have valid coordinates and appear on the Leaflet interactive map with marker clustering and popup detail cards.

---

## 🗄️ Database Schema & Data Integrity

- The single source of truth is PostgreSQL (`trekindia`).
- **692 treks** across 27 Indian states and 248 districts are loaded dynamically via REST APIs.
- Trek images remain blank/null by design until real assets are attached; neutral CSS placeholders prevent broken image icons.

---

## 🗄️ Database Tables Used

The authentication backend uses the following existing tables in PostgreSQL:
1. `users`: Stores core credentials, hashed passwords, roles (`user`, `admin`), verified state, and login timestamps.
2. `user_profiles`: Stores cover image, website, and social links (Foreign Key to `users.user_id`).
3. `user_settings`: Stores notification and display preferences (Foreign Key to `users.user_id`).

---

## 🚀 Running the Project

```bash
# Install dependencies
npm install

# Run backend in development mode with nodemon
npm run dev

# Run in production mode
npm start
```
