# EventPilot

Event discovery, registration and attendance management (MERN: React + Vite, Express, MongoDB/Mongoose).

## Roles
| Role | Can do |
|---|---|
| Participant | Sign up, browse/search events, register, see own tickets, cancel own registration |
| Organizer | Create/edit/publish/cancel **own** events, view attendees + counts, manually check in |

Public sign-up **always** creates a participant. Organizers cannot be created from the website; they are provisioned from the server (see below).

## Setup
Prerequisites: Node 18+, a MongoDB instance (local or Atlas).

```bash
cd backend && npm install && cp .env.example .env   # then fill in .env
cd ../frontend && npm install && cp .env.example .env
```

`backend/.env`: `MONGO_URI`, `JWT_SECRET` (required, long random string), `FRONTEND_URL`, `PORT` (default 5000), `MONGODB_DNS_SERVERS` (optional DNS resolvers for Atlas SRV connections), SMTP settings for email, `MFA_ENCRYPTION_KEY` for organizer MFA, `SEED_ORGANIZER_PASSWORD` (organizer seeding only), and `SEED_DEMO_PASSWORD` (local demo seeding only).
`frontend/.env`: `VITE_API_BASE_URL` (default `http://localhost:5000/api`).

The backend uses `dns.setServers()` with Cloudflare DNS by default when `MONGO_URI` uses `mongodb+srv://`; override it with a comma-separated `MONGODB_DNS_SERVERS` list if your network requires other resolvers. Configure SMTP_HOST, SMTP_PORT, and SMTP_FROM (and SMTP_USER/SMTP_PASS when authentication is required) to send verification and reset emails. Set APP_URL to the deployed frontend URL when it differs from FRONTEND_URL. Generate MFA_ENCRYPTION_KEY with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and keep it stable and backed up; losing it makes stored organizer MFA secrets unusable. The root `npm run lint` and `npm run build` commands run the corresponding frontend checks.

## Run
```bash
cd backend && npm run dev      # API on :5000  (health: /api/health)
cd frontend && npm run dev     # UI  on :5173
```

## Organizer accounts
```bash
cd backend
npm run seed:organizers                                   # 3 demo organizers: organizer1/2/3@eventpilot.dev (password = SEED_ORGANIZER_PASSWORD)
npm run seed:organizers -- "Jane Doe" jane@club.org Pw12345678   # add/promote one real organizer
```
Re-running updates the password/role of an existing email. Run it on the server/with the production `MONGO_URI` to add organizers in production.

Demo event data is for local development only. Set `SEED_DEMO_PASSWORD` to a unique password of 12–72 characters in `backend/.env` before running `npm run seed:events`; the script refuses production mode and never uses a built-in password. Demo account passwords are not exposed in the frontend.

## API summary
Auth: `POST /api/auth/register|login|login/mfa|logout`, `GET /api/auth/me`; email verification and password recovery use `/verify-email`, `/resend-verification`, `/password/forgot`, and `/password/reset`; organizer MFA uses `/mfa`, `/mfa/setup`, `/mfa/enable`, and `/mfa/disable`.
Events: `GET /api/events`, `GET /api/events/:id`, `POST /api/events`, `PATCH /api/events/:id`, `POST /api/events/:id/publish|cancel`, `GET /api/events/mine/analytics`
Registrations: `POST /api/events/:id/register`, `POST /api/registrations/:id/cancel`, `GET /api/me/registrations`
Attendance: `GET /api/events/:id/attendees`, `GET /api/events/:id/analytics`, `POST /api/events/:id/registrations/:rid/check-in`

## Rules implemented
- Roles and event ownership are enforced on the server for every protected route.
- One registration per participant per event (unique compound index). Cancelled registrations cannot re-register.
- Registration needs: published event, before deadline, event not ended, seat available.
- A participant can cancel until the event starts, and not after check-in.
- Check-in: owner only, confirmed registration of that event only, published event only; repeating it reports "already checked in" and never double-counts.
- The online meeting link is visible only to the owner and confirmed registrants.
- Public list shows only published events that have not ended.
- Discovery supports category, online/in-person, text-search, and sort filters.
- Unsafe API requests with a browser `Origin` are restricted to the configured frontend origin; health reports database readiness with HTTP 503 when the database is unavailable.
- New participant accounts must verify their email before login; old accounts are treated as verified for compatibility.
- Password reset tokens and verification tokens are stored hashed and expire; password reset revokes existing sessions.
- Organizers can optionally enable authenticator-app MFA with one-time recovery codes; MFA secrets are encrypted at rest.
- Authentication, verification, recovery, and MFA endpoints have per-process IP rate limits.

## Known limitations
- Capacity uses count-then-verify without transactions. Under heavy simultaneous sign-ups seat allocation is not strictly atomic; use a MongoDB replica set and transactional/atomic reservations before relying on strict capacity guarantees.
- Email-dependent features require working SMTP configuration; rate limits are per-process and should use a shared store for multi-instance deployments.
- No distributed rate limiting, waitlist, QR, teams or notifications.
- Events are not auto-marked `completed`; ended events are simply hidden from discovery.
- Auth is an httpOnly cookie. For cross-site hosting (frontend and API on different domains) set `NODE_ENV=production` and serve over HTTPS.

## Checks
Run `npm run lint` and `npm run build` at the project root for the frontend. Run `npm test` from `backend` for API smoke tests; these tests do not require a MongoDB connection.
