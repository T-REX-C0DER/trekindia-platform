# TrekIndia Backend — Production-Ready Authentication System

TrekIndia is a trekking platform focused on Indian treks. This module provides a complete, secure, production-ready V1 authentication backend built with Node.js, Express.js, PostgreSQL 18 (`pg`), Argon2id password hashing, and HttpOnly session cookies.

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
