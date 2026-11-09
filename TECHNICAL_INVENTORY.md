# TrekIndia AI Ecosystem: Technical Inventory & Architectural Baseline

## 1. Existing Architecture
- **Runtime & Language**: Node.js (ES Modules, `"type": "module"`) on Express v4.21.0.
- **Database**: PostgreSQL with PostGIS extension (v3.6.2). Connection pooling via `pg` (Pool of 20 connections, 30s idle timeout).
- **Messaging & Streaming**: Apache Kafka KRaft broker with KafkaJS (`producer.js`, `consumer.js`, `admin.js`, `coordinator.js`) + Native WebSocket server (`wsServer.js`) attached to the Node HTTP server.
- **Frontend**: Vanilla ES6+ JavaScript, CSS3 design tokens (`style.css`, `profile.css`, `map.css`), Leaflet v1.9.4 with MarkerCluster v1.5.3, OpenStreetMap & ESRI tile providers. Modular components in `src/components` and `src/utils`.
- **Security**: Argon2 password hashing, JWT signed tokens (`jsonwebtoken`), HttpOnly SameSite cookies (`trekindia_session`), Express rate-limiting.

## 2. Existing Database Schema
- **`treks`** (692 records): Primary catalog with `trek_id`, `trek_name`, `slug`, `state_id`, `district_id`, `distance_km`, `duration_hours`, `elevation_m`, `highest_point_m`, `difficulty`, `rating`, `starting_point`, `ending_point`, `best_time`, `entry_fee`, `permit_required`.
- **`trek_locations`** (692 records): Geographical points with `latitude`, `longitude`, `location` (PostGIS `geometry(Point, 4326)`), `location_name`, `address`.
- **`states`** (28+ records) & **`districts`**: Territorial normalization.
- **`users`** (19 records): `user_id`, `username`, `email`, `password_hash`, `full_name`, `profile_image`, `bio`, `role`.
- **`user_profiles`**: Extended profile details with `location`, `preferences` (JSONB), `social_links`.
- **`user_treks`**: Junction table for trek statuses (`completed`, `saved`, `wishlist`), personal ratings, notes, completion timestamps.
- **`badges`** & **`user_badges`**: Milestone & trek badges catalog and user unlocked achievements.
- **`user_activities`**: Timeline events feed.
- **`user_checklists`**: Packing checklist items.
- **`trek_reviews`**: Community ratings and feedback.
- **`trek_images`**: Trek imagery table (schema present, zero records currently populated).
- **`community_posts`**, **`community_comments`**, **`conversations`**, **`messages`**: Community and direct chat feeds.

## 3. Existing Frontend Routes & Pages
- `/` (`index.html`): Main landing page with Hero, Explore treks with filters, Leaflet Interactive State Map, AI Trek Planner, Gear Marketplace, Physical Readiness Dashboard, Smart Packing Checklist.
- `/profile` (`profile.html`): Explorer dashboard (Overview, My Treks, Saved Treks, Wishlist, Badges, Reviews, Activity, Settings).
- `/community` (`community.html`): Community social hub.
- `/messages` (`messages.html`): Full-screen real-time Kafka/WebSocket messaging.
- `trek-detail.html?slug=:slug`: Detailed trek view with key metrics, trail info, review form, Leaflet map, and operator listings.
- `auth.html`: 7-screen interactive auth (login, registration, OTP, reset).

## 4. Existing Backend API Endpoints
- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- **Users**: `GET /api/users/me`, `GET /api/users/search`.
- **Treks**: `GET /api/treks`, `GET /api/treks/:id`, `GET /api/treks/map`, `GET /api/treks/search`, `GET /api/treks/slug/:slug`, `POST /api/treks/slug/:slug/complete`, `POST /api/treks/slug/:slug/uncomplete`, `POST /api/treks/slug/:slug/save`, `GET /api/treks/slug/:slug/user-status`, `GET /api/treks/slug/:slug/companies`.
- **States & Districts**: `GET /api/states`, `GET /api/states/:slug/treks`, `GET /api/districts`.
- **Profile**: `GET /api/profile`, `PUT /api/profile`, `GET /api/profile/treks`, `POST /api/profile/treks/:trekId/status`, `POST /api/profile/treks/:trekId/complete`, `GET /api/profile/badges`, `GET /api/profile/activity`, `GET /api/profile/reviews`, `POST /api/profile/reviews`, `GET /api/profile/checklist`, `PUT /api/profile/checklist`, `DELETE /api/profile/account`.
- **Gear**: `GET /api/gear`, `GET /api/gear/categories`.
- **Community**: Posts, comments, likes, stories, follows.
- **System**: `GET /api/health`.

## 5. Existing Authentication Flow
- HttpOnly JWT cookie named `trekindia_session` signed with `SESSION_SECRET`.
- Verified on incoming requests via `authMiddleware` and `requireAuth`.
- Frontend `auth-client.js` checks `/api/auth/me` on load and updates navbar user menu.

## 6. Existing External Service Integrations
- Kafka KRaft broker (`localhost:9092`).
- OpenStreetMap, OpenTopoMap, and ESRI tile servers.
- DiceBear avatar CDN.
- Unsplash imagery fallback resolver.

## 7. Existing Broken or Incomplete Functionality Identified
- `trek_images` table contains 0 records; trek cards on index currently render fallback placeholders.
- `AI Trek Planner` on `index.html` used simulated client-side logic with static recommendations.
- No visual embedding or mountain recognition models connected yet.
- Offline support lacked dedicated Service Worker package generation and IndexedDB storage.
- Emergency SOS flow and trusted contact alerts were not implemented.
- Cost calculator and Nutrition planner were placeholder concepts.

## 8. Required Changes for the 8 AI Features
1. **AI TrekVision**: Vision analysis backend with Gemini/configurable provider + confidence scores + terrain/flora/wildlife detection + landmark matching to database treks + image retention controls.
2. **AI Altitude Guardian**: Deterministic AMS & altitude safety rules + weather freshness + medically reviewed altitude guidelines + AI safety explanation + preparation checklist.
3. **AI Trek Cost Intelligence**: Deterministic backend pricing calculator (transport, permits, guides, gear, food, accommodation, contingency) with budget/standard/comfortable tiers + AI breakdown insights.
4. **AI Trek Memory Map**: `GET /api/users/me/adventure-map` + `POST /api/treks/:trekId/completions` + `POST /api/treks/:trekId/memories` with Leaflet visualization of completed summits, badges, photos, and adventure logs.
5. **AI Offline Trek Companion**: `sw.js` Service Worker + IndexedDB client package sync + `GET /api/offline/treks/:trekId/package` with route coordinates, safety guidelines, offline tiles, and emergency info.
6. **AI Emergency SOS Intelligence**: `POST /api/sos/incidents` + trusted contact management + GPS location capture + incident audit logging + first aid advice.
7. **AI Photo-to-Trek Discovery**: Perceptual visual embeddings for TrekIndia destinations + cosine similarity visual retrieval in PostgreSQL + trek matching with filters.
8. **AI Trek Nutrition Planner**: `POST /api/ai/nutrition/plan` + dietary constraints + day-by-day lightweight meal planner + shopping list + packing checklist + cost integration.

## 9. Potential Conflicts & Dependencies
- Must strictly preserve existing table schemas and relationships (`treks`, `users`, `user_treks`, `badges`, etc.).
- `vector` extension is not compiled into the system Postgres, so vector similarity must use native PostgreSQL mathematical functions (`cosine_similarity`).
- All calculations (costs, safety thresholds, badges, completions) must remain deterministic on the server without relying solely on LLMs.
- AI provider failures must fail gracefully with descriptive notifications without breaking core trek discovery.

