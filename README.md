# ✈️ EventPilot

> **EventPilot** is a full-stack multi-category event discovery, registration, and attendance management platform. Built with React 19, Vite, Express, and MongoDB Atlas.

---

## 📑 Table of Contents
1. [Project Overview](#-project-overview)
2. [Feature Set by Phase](#-feature-set-by-phase)
3. [Technology Stack](#-technology-stack)
4. [Prerequisites](#-prerequisites)
5. [Environment Configuration](#-environment-configuration)
6. [Installation & Local Setup](#-installation--local-setup)
7. [Running the Application](#-running-the-application)
8. [Database Seeding](#-database-seeding)
9. [Role-Based Access Control](#-role-based-access-control)
10. [API Reference](#-api-reference)
11. [Automated Testing](#-automated-testing)
12. [MVP Design Decisions & Limitations](#-mvp-design-decisions--limitations)

---

## 🌟 Project Overview
EventPilot unifies event discovery across six core categories:
- 💻 **Hackathons & Competitions**
- 🎙️ **Conferences & Seminars**
- 🛠️ **Workshops & Bootcamps**
- 🌐 **Webinars & Online Events**
- 🏆 **Sports & Tournaments**
- 🎭 **Festivals & Cultural Events**

The platform provides a strict separation of concerns between **Participants** (who browse published events, register for tickets, and manage their reservations) and **Organizers** (who create, edit, publish, track portfolio analytics, view attendee rosters, and perform entrance check-ins).

---

## 🚀 Feature Set by Phase

### Phase 1: Authentication & Roles
- Public user registration strictly defaulting to `participant` (immune to body role-injection).
- Secure password hashing using `bcryptjs` (salt rounds: 10).
- Stateless JWT issuance stored in `httpOnly` secure cookies and supported via `Authorization: Bearer <token>` headers.
- Controlled development-only organizer account seed (`organizer@eventpilot.dev`).
- Server-side role authorization middleware (`authorizeRoles`).

### Phase 2: Event Lifecycle & Public Discovery
- Unified `Event` model supporting both in-person (venue) and online (meeting link) formats.
- Complete organizer lifecycle: create draft, edit details, publish to portal, and cancel.
- Strict event ownership enforcement: organizers cannot edit, publish, or cancel events owned by others.
- Public discovery portal with real-time text search and category filtering.

### Phase 3: Registrations, Tickets & Capacity
- Unique compound index `{ eventId: 1, participantId: 1 }` preventing duplicate reservations.
- Server-side capacity enforcement rejecting registrations when maximum capacity is reached.
- Registration deadline validation rejecting sign-ups once the cutoff date has passed.
- Unique human-readable ticket reference code generation (e.g., `EP-HACK-A1B2-C3D4`).
- Registration cancellation releasing seats immediately for other attendees.
- MVP PRD policy enforcement: cancelled registrations cannot be re-opened.
- Participant **“My Tickets”** portal with ticket stubs and status indicators.

### Phase 4: Organizer Command Center & Check-In
- Real-time database-derived portfolio metrics: Total Events, Confirmed Registrations, Checked-In Count, Overall Check-In Rate.
- Owner-only Attendee Roster view with search (name, email, ticket) and status tabs (All, Pending, Checked In, Cancelled).
- Manual entrance check-in endpoint recording exact `checkedInAt` timestamps.
- Idempotent repeated check-in handling: duplicate check-in attempts return `alreadyCheckedIn: true` without double-counting or altering the original timestamp.
- Strict role isolation: participants cannot access attendee rosters or analytics.

### Phase 5 & 6: Security Hardening & Polish
- Organizer seeding endpoint disabled in production (`NODE_ENV === 'production'`).
- Development quick-fill buttons tree-shaken and purged in production builds via `import.meta.env.DEV`.
- Responsive layout adapting smoothly to desktop, tablet, and mobile displays.
- 100% automated test coverage across all 5 MVP phases and security constraints.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, React Router v7, Vite v8, Vanilla CSS Design System, Google Fonts (Inter & Outfit) |
| **Backend** | Node.js (ES Modules), Express 4.x, Cookie-Parser, CORS, Dotenv |
| **Database** | MongoDB Atlas, Mongoose 8.x (ODM) |
| **Security** | JSON Web Tokens (`jsonwebtoken`), `bcryptjs`, Environment Mode Guards |

---

## 📋 Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **MongoDB Atlas**: An active MongoDB connection string (or local MongoDB v6+)

---

## ⚙️ Environment Configuration

### Backend Configuration (`backend/.env`)
Create a `.env` file in the `backend/` directory based on `backend/.env.example`:

```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.acnhm9s.mongodb.net/eventpilot?retryWrites=true&w=majority
FRONTEND_URL=http://localhost:5173
JWT_SECRET=eventpilot_jwt_secure_secret_key_2026
```

### Frontend Configuration (`frontend/.env`)
Create a `.env` file in the `frontend/` directory based on `frontend/.env.example`:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

---

## 📦 Installation & Local Setup

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/EventPilot.git
cd EventPilot

# 2. Install backend dependencies
cd backend
npm install

# 3. Install frontend dependencies
cd ../frontend
npm install
cd ..
```

---

## 🏃 Running the Application

### Option A: Run Backend & Frontend in Parallel (Two Terminals)

**Terminal 1 — Backend:**
```bash
cd backend
npm run dev
# Server running at http://localhost:5000
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm run dev
# Vite client running at http://localhost:5173
```

### Option B: Production Build
```bash
# Build frontend bundle
cd frontend
npm run build

# Start backend in production mode
cd ../backend
npm start
```

---

## 🌱 Database Seeding

To quickly populate the database with demonstration data:

```bash
# Seed the default organizer account (organizer@eventpilot.dev / OrganizerPass123!)
npm --prefix backend run seed:organizer

# Seed sample published events across all 6 categories
npm --prefix backend run seed:events
```

---

## 🔐 Role-Based Access Control

| Role | Default Capabilities | Restricted Actions |
| :--- | :--- | :--- |
| **Participant** | Browse published events, register for events, view ticket codes, cancel own registration, access Participant Portal. | Cannot create events, cannot edit/publish events, cannot access attendee rosters, cannot check in attendees, cannot access analytics. |
| **Organizer** | Create draft events, edit/publish/cancel owned events, view attendee rosters for owned events, check in attendees, view live portfolio analytics. | Cannot modify or view attendees for events owned by other organizers. |

---

## 📡 API Reference

### Authentication (`/api/auth`)
| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Public | Any | Register participant (defaults role to `participant`) |
| `POST` | `/api/auth/login` | Public | Any | Authenticate with email & password, sets JWT cookie |
| `POST` | `/api/auth/logout` | Public | Any | Clear authentication cookie |
| `GET` | `/api/auth/me` | Yes | Any | Retrieve authenticated profile |
| `POST` | `/api/auth/seed-organizer` | Dev Only | Any | Seed demo organizer (disabled in production with 403) |
| `GET` | `/api/auth/organizer-only` | Yes | Organizer | Role verification test endpoint |

### Events (`/api/events`)
| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/events` | Public | Any | List published events with text search and category filters |
| `GET` | `/api/events/mine` | Yes | Organizer | List all events owned by current organizer |
| `GET` | `/api/events/mine/analytics` | Yes | Organizer | Aggregate portfolio attendance & check-in metrics |
| `POST` | `/api/events` | Yes | Organizer | Create a new event (draft or published) |
| `GET` | `/api/events/:eventId` | Optional | Any | Event details (public if published; owner-only if draft) |
| `PATCH` | `/api/events/:eventId` | Yes | Organizer (Owner) | Update owned event details |
| `POST` | `/api/events/:eventId/publish` | Yes | Organizer (Owner) | Publish draft event to public discovery |
| `POST` | `/api/events/:eventId/cancel` | Yes | Organizer (Owner) | Cancel event and withdraw from discovery |
| `GET` | `/api/events/:eventId/attendees` | Yes | Organizer (Owner) | View attendee roster with registration & check-in status |
| `GET` | `/api/events/:eventId/analytics` | Yes | Organizer (Owner) | View single-event database metrics |
| `POST` | `/api/events/:eventId/registrations/:regId/check-in` | Yes | Organizer (Owner) | Manually check in attendee (idempotent) |

### Registrations (`/api/registrations` & `/api/me`)
| Method | Endpoint | Auth | Role | Description |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/events/:eventId/register` | Yes | Participant | Register for event and receive ticket code |
| `GET` | `/api/events/:eventId/my-registration` | Optional | Any | Check current user's registration status & capacity |
| `POST` | `/api/registrations/:regId/cancel` | Yes | Owner | Cancel own registration and release seat |
| `GET` | `/api/me/registrations` | Yes | Participant | Retrieve list of tickets and active registrations |

---

## 🧪 Automated Testing

EventPilot includes a comprehensive suite of automated tests verifying every phase of the project:

```bash
# Run all automated test suites sequentially
npm --prefix backend run test:all

# Run individual phase suites:
npm --prefix backend run test:phase1    # Auth & role boundaries (9 checks)
npm --prefix backend run test:phase2    # Event lifecycle & cross-organizer isolation (13 checks)
npm --prefix backend run test:phase3    # Registrations, capacity & cancellation (13 checks)
npm --prefix backend run test:phase4    # Organizer dashboard & manual check-in (12 checks)
npm --prefix backend run test:phase5    # Full E2E integration test suite (25 checks)
npm --prefix backend run test:security  # Production seeding rejection & DB integrity (4 checks)
```

---

## 📌 MVP Design Decisions & Limitations

1. **Re-Registration Policy:**
   - When a participant cancels their registration, their seat is immediately released to the capacity pool. Per the MVP design specifications, re-registration after cancellation is disallowed to prevent ticket scalping and seat churn.
2. **QR Code Scanning:**
   - In this MVP version, attendance verification is performed via unique human-readable ticket reference codes (e.g. `EP-WORK-XXXX-XXXX`) and organizer check-in buttons. Hardware camera QR scanning is planned for a subsequent release.
3. **Single Organizer Ownership:**
   - Events are strictly owned by the creator organizer. Co-organizer delegation or team permission management is not included in this MVP.
4. **Production Seeding Protection:**
   - The `/api/auth/seed-organizer` endpoint returns `403 Forbidden` whenever `NODE_ENV === 'production'` or `NODE_ENV === 'staging'` to ensure production databases cannot be re-seeded.
