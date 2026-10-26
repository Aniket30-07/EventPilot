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

`backend/.env`: `MONGO_URI`, `JWT_SECRET` (required, long random string), `FRONTEND_URL`, `PORT` (default 5000), `SEED_ORGANIZER_PASSWORD` (only for seeding).
`frontend/.env`: `VITE_API_BASE_URL` (default `http://localhost:5000/api`).

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

## API summary
Auth: `POST /api/auth/register|login|logout`, `GET /api/auth/me`
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

## Known limitations
- Capacity uses count-then-verify (no transactions). Under heavy simultaneous sign-ups the last seat may be refused for everyone but is never oversold.
- No password reset, email verification, rate limiting, waitlist, QR, teams or notifications.
- Events are not auto-marked `completed`; ended events are simply hidden from discovery.
- Auth is an httpOnly cookie. For cross-site hosting (frontend and API on different domains) set `NODE_ENV=production` and serve over HTTPS.
- No automated tests are included; verify manually using the PRD demo flow.
