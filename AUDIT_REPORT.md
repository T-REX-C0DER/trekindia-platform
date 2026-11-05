# TrekIndia Technical Audit

**Audit date:** 2026-11-05  
**Scope:** Repository inspection, authenticated browser/API checks, and messaging integration tests against the user-confirmed disposable database.

## Executive summary

The project is a static HTML/CSS/JavaScript frontend with a Node.js/Express backend, PostgreSQL access, Leaflet mapping, and Kafka/WebSocket modules. A concrete authentication UI defect was fixed: recovery and email-verification screens previously displayed success without performing those operations. They now state that the feature is unavailable and do not claim an email was sent, a code verified, or a password changed. Messaging source issues were fixed and tested against a user-confirmed disposable database, including Kafka/WebSocket delivery, authorization, duplicate starter-chat prevention, and mobile overflow.

This is a **limited audit, not a complete production certification**. The backend and six migrations were run against the confirmed disposable database. Live checks covered selected public/protected APIs, messaging routes, Kafka/WebSocket behavior, and authenticated messaging UI. The test accounts and verified test-only conversations were removed afterward. Broader trek/profile/community regression, performance, backup/restore, payment, and production-database behavior remain unverified. Production readiness is **Not Ready** until remaining gaps below are addressed and the complete application is tested in staging.

## 1. Project overview

| Area | Observed implementation |
|---|---|
| Frontend | Static HTML, CSS, and browser JavaScript |
| Backend | Node.js 24 / Express 4 |
| Database | PostgreSQL via `pg`; six migrations and selected messaging operations verified on the disposable database |
| Mapping | Leaflet with OpenStreetMap tiles; API-backed map data and a local `treks.json` fallback |
| Community/realtime | Selected community/messaging routes and Kafka/WebSocket delivery verified; broader community and failure/reconnect behavior remains untested |
| Other integrations | External fonts and image URLs are referenced |
| Payments | No Stripe package, payment routes, checkout, or webhook implementation was found |
| Automated tests | No `test` script is declared in the root `package.json`; focused live integration/smoke checks and syntax/diff checks were run |

The root `README.md` describes PostgreSQL/PostGIS and Kafka integrations. Those descriptions were treated as claims to verify, not evidence that the services are currently running.

## 2. Feature inventory

Statuses describe repository evidence and the checks performed, not an assurance that untested backend behavior works.

| Feature | Status | Evidence / limitation |
|---|---|---|
| Landing page and navigation | PARTIAL | Static page rendered; backend-fed sections were unavailable in the static-only browser run |
| Trek search, filtering, details, and map | PARTIAL | Frontend and API routes exist; live data, filter correctness, and marker accuracy were not tested |
| Sign-in and registration | PARTIAL | UI and API routes exist; database-backed flows were not tested |
| Password recovery and email verification | NOT IMPLEMENTED | No corresponding backend endpoints or email provider integration were found; misleading frontend success states were removed |
| Profile, saved/completed treks, reviews, badges, checklist | PARTIAL | UI/API code and migrations exist; no authenticated database tests were run |
| Community and messaging | PARTIAL | Selected messaging delivery, persistence, authorization, and UI interactions passed live checks. Broader community flows, reconnect/failure behavior, and full regression remain untested |
| Gear marketplace | PARTIAL | Gear API and frontend are present; product data and destination links were not live-tested |
| Subscription and payment | NOT IMPLEMENTED | No Stripe or other payment implementation was found |
| Admin surface | NOT TESTED | No admin page or dedicated admin route was identified in the inspected surfaces |
| Database integrity/performance | PARTIAL | Migrations and scoped messaging read/write tests ran on disposable DB; production data, broad integrity, and performance were not audited |

## 3. Page-by-page results

| Page / route | Functional status | UI / responsive status | Security status | Notes |
|---|---|---|---|---|
| `/` (`index.html`) | PARTIAL | Rendered in browser; no horizontal overflow measured at 320, 375, 425, 768, 1024, or 1440 CSS pixels | NOT TESTED dynamically | API-backed content could not be verified without Express and PostgreSQL |
| `/auth.html` | PARTIAL | Rendered; no horizontal overflow measured at the same viewport widths | NOT TESTED dynamically | Login/registration backend flows were unavailable; recovery/verification false-success behavior was fixed |
| `/community` (`community.html`) | NOT TESTED | Source and route exist | NOT TESTED dynamically | Requires a running backend and authenticated account for meaningful checks |
| `/profile` (`profile.html`) | NOT TESTED | Source and route exist | NOT TESTED dynamically | Protected profile behavior was not exercised |
| `/messages` (`messages.html`) | PARTIAL | Authenticated send and responsive widths 320–1440 CSS pixels tested; 320px overflow fixed | Selected messaging authorization paths dynamically tested | One starter conversation rendered after signup; live state showed WebSocket/Kafka delivery |
| Trek detail (`trek-detail.html`) | NOT TESTED | Source exists | NOT TESTED dynamically | Requires live trek API data |

The static-only test server returned 404 for `/api/*`; those responses are a limitation of that test harness, not a finding about the Express application.

## 4. Security review

A delegated source-level review initially returned no findings. A subsequent focused manual review of messaging found the following authorization/privacy issues, which were corrected in source. Dynamic retesting is still blocked.

| # | Severity | File | Lines | Vulnerability | Confidence |
|---|----------|------|-------|---------------|------------|
| 1 | 🟡 MEDIUM | backend/src/services/communityService.js | 1929-1953 | Read-receipt endpoint updated messages before verifying conversation membership, allowing authenticated outsiders to mark another conversation as read. Fixed with a participant/visibility check. | 9/10 |
| 2 | 🟡 MEDIUM | backend/src/services/communityService.js | 1611-1639 | Hidden conversations remained retrievable by their participant through the history endpoint. Fixed by returning not-found for hidden membership. | 8/10 |
| 3 | ⚪ LOW | backend/src/websocket/wsServer.js | 139-155 | Any authenticated WebSocket client could spoof typing events into a conversation. Fixed by requiring accepted, visible membership before relay. | 9/10 |
| 4 | ⚪ LOW | backend/src/services/communityService.js | 1830-1838 | Idempotency lookup was global to client key rather than scoped to sender and conversation, risking cross-user message disclosure on a key collision/known key. Fixed by scoping the query. | 7/10 |

These source-level findings were corrected. The messaging authorization/privacy fixes were included in disposable-database live tests; this is not a comprehensive security assessment, and no claim is made that the remaining application is secure.

## 5. Database audit

PostgreSQL access and six SQL migration files were identified. On the user-confirmed disposable database, all six migrations ran, selected messaging reads/writes were exercised, and test-created disposable accounts were deleted. Verified test-only orphan conversations from the test run were also removed after checking their participants and starter-message contents.

The server calls `runMigrations()` during startup; therefore it was started only after the user confirmed the configured database was disposable. The exercised transaction paths behaved as expected. A Kafka Admin `TimeoutNegativeWarning` appeared during startup, but the broker, producer, consumer, and required topics became available. Production database records, broad integrity, indexes, query performance, and backups remain unverified.

## 6. Bug report

| ID | Feature | Severity | Root cause | Fix | Retest |
|---|---|---|---|---|---|
| TI-01 | Password recovery / email verification | Medium | Frontend-only timers navigated to success screens and claimed email/code actions succeeded without matching backend endpoints | Removed simulated success transitions; show explicit unavailable errors and mark error messages with `role="alert"` in [auth.js](./auth.js) | Browser-tested recovery, reset, and verification submissions; all remained on their forms and showed truthful errors |
| TI-02 | Messaging read receipts | High | Read endpoint changed message status for any conversation ID without checking membership | Verify the caller is a visible conversation participant before updating messages; database errors now propagate instead of being reported as success in [communityService.js](./backend/src/services/communityService.js) | Static authorization-path review and JavaScript syntax checks passed; live DB/API test blocked |
| TI-03 | Messaging idempotency | Medium | Duplicate lookup used `client_message_id` globally and could return another sender's message record | Scope lookup to the authenticated sender and conversation in [communityService.js](./backend/src/services/communityService.js) | Live collision-isolation assertion passed |
| TI-04 | Hidden conversations | Medium | Conversation history endpoint did not reject a participant's soft-hidden conversation | Return not-found for a hidden membership in [communityService.js](./backend/src/services/communityService.js) | Live hidden-history rejection assertion passed |
| TI-05 | WebSocket typing events | Medium | Authenticated clients could relay typing events into conversations they did not belong to | Require accepted, visible membership before relay and cap WebSocket frames at 16 KiB in [wsServer.js](./backend/src/websocket/wsServer.js) | Authorized typing delivery and outsider rejection passed live |
| TI-06 | Messaging request handling | Low | Invalid actions and already-handled/nonexistent requests returned success-shaped responses | Validate action and require a pending participant row in [communityService.js](./backend/src/services/communityService.js) | Static validation-path review and syntax checks passed |
| TI-07 | Messaging send/load failures | Medium | Failed HTTP sends could leave optimistic messages looking delivered; conversation loading could remain on skeletons after API errors | Roll back failed optimistic messages, restore typed text, show an error, and render a conversation-load error state in [messages.js](./messages.js) | Authenticated UI message send passed; error-state behavior was source-reviewed |
| TI-08 | Duplicate starter conversations | Medium | Concurrent initial conversation loads could both insert a starter chat for a new user | Serialize per-user seeding inside a transaction with a PostgreSQL advisory lock in [communityService.js](./backend/src/services/communityService.js) | Fresh-account browser startup rendered exactly one starter conversation |
| TI-09 | Messaging mobile overflow | Low | Header contents caused horizontal overflow at 320px | Reduce mobile header padding and hide the long trek badge at small widths in [messages.css](./messages.css) | Document and body widths matched viewport at 320, 375, 425, 768, 1024, and 1440px |

## 7. Test results

- **Live messaging assertions:** 13/13 passed on the disposable database, covering Kafka/WebSocket delivery, authorized typing/read receipts, outsider rejection, unread counts, delete ownership, idempotency isolation, and hidden-history rejection.
- **API/page smoke checks:** 11 public API endpoints and six public pages returned 200; profile and messaging APIs returned 401 unauthenticated; unauthenticated WebSocket was rejected with close code 4001.
- **Authenticated messaging UI:** Disposable account signup loaded the starter chat, showed live WebSocket status, sent a message, and rendered exactly one starter conversation. The account and verified test conversation were removed afterward.
- **Responsive messaging UI:** No horizontal overflow at 320, 375, 425, 768, 1024, or 1440 CSS pixels.
- **JavaScript syntax:** `node --check` passed for the updated `messages.js` and community service; previous checks also passed for the WebSocket server.
- **Whitespace validation:** `git diff --check` passed before the final report update.
- **Still untested:** Full API/UI regression, unrelated profile/trek/community workflows, browser reload/reconnect and failure modes, payment, production database behavior, and performance.

## 8. Production readiness

**Assessment: Not Ready.**

Before staging or production approval:

1. Provide an isolated disposable database and run API, auth, profile, trek, community, and messaging tests against it.
2. Implement password-recovery and email-verification UI with a configured mail provider if those flows are required.
3. Implement and test payment/subscription behavior if it is in scope; no payment integration currently exists.
4. Run authenticated end-to-end and authorization tests, plus responsive checks on all protected and detail pages.
5. Verify the actual database schema and data integrity without modifying production data.
6. Validate Kafka/WebSocket operation and failure/reconnect behavior in a controlled environment.

No claim is made that the application is completely secure or bug-free.
