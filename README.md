# EventPilot ✳

> **Next-Generation Event Operating System & Lifecycle Management Platform**  
> An end-to-end, full-stack application built for organizing, participating in, and managing competitive hackathons, sports tournaments, conferences, webinars, and community events.

[![Backend Tests](https://img.shields.io/badge/backend%20tests-9%2F9%20passing-brightgreen)](file:///backend)
[![Frontend Build](https://img.shields.io/badge/frontend%20build-passing-brightgreen)](file:///frontend)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-blue)](https://nodejs.org/)
[![React](https://img.shields.io/badge/react-19.0.0-61dafb)](https://react.dev/)
[![MongoDB](https://img.shields.io/badge/database-MongoDB%20Atlas-47A248)](https://www.mongodb.com/)
[![Render](https://img.shields.io/badge/deploy-Render-46E3B7)](https://eventpilot-e4wb.onrender.com)
[![Vercel](https://img.shields.io/badge/deploy-Vercel-black)](https://vercel.com/)

---

## 🌐 Live Deployments

| Component | Platform | URL | Status |
|---|---|---|---|
| **Backend API** | Render | [https://eventpilot-e4wb.onrender.com](https://eventpilot-e4wb.onrender.com) | Live 🟢 |
| **Health Check** | Render | [https://eventpilot-e4wb.onrender.com/api/health](https://eventpilot-e4wb.onrender.com/api/health) | `{"status":"ok","database":"connected"}` |
| **Frontend Client** | Vercel | Configured with `VITE_API_BASE_URL` | Live 🟢 |

> **Note on Render Free Tier**: The backend service automatically spins down after inactivity. The first request may take 30–50 seconds to warm up the container. Once awake, subsequent requests respond in milliseconds.

---

## 1. Problem Statement
Traditional event ticketing platforms (e.g. Eventbrite, Meetup) only handle basic ticket sales and generic QR check-ins. They fail to support domain-specific lifecycle workflows required by real-world events:
1. **Hackathons** require project submission windows (GitHub repositories, deployed live demo links, video demos), judge evaluation portals, scoring rubrics, team formation quorums, and dynamic live leaderboards.
2. **Competitive Sports & Esports** require team/squad registration limits, knockout bracket scheduling (Quarter-Finals ➔ Semi-Finals ➔ Grand Finals), automated winner progression, squad member invitation workflows, and points tables.
3. **Conferences & Webinars** need post-event knowledge hubs with executive summaries, key takeaways, slide deck links, and recording video archives.
4. **Organizer Teams** lack granular delegation controls to assign co-organizers, pause access, or securely manage admissions without sharing root administrator credentials.

**EventPilot** bridges this gap by providing a unified, multi-tenant event operating system tailored for hackathons, sports championships, webinars, and conferences.

---

## 2. Target Users
* **Lead Organizers & Event Directors**: Create events, configure capacities, manage co-organizers, evaluate hackathon project submissions, update tournament brackets, and publish recaps.
* **Co-Organizers / Delegated Staff**: Check in attendees, inspect participant rosters, and evaluate submissions without root administrative permissions.
* **Participants & Hackers**: Discover events, register for tickets, form teams, submit projects (GitHub, deployed apps, video demos), and track real-time leaderboard standings.
* **Team Captains & Squad Players**: Register team slots for competitive sports (Cricket 11 Playing XI, Football 11v11) and Team Hackathons (2–4 members), send squad invitations to player dashboards, accept invites, and view live tournament brackets.

---

## 3. Core Workflows (Application Logic)

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               EVENTPILOT CORE WORKFLOWS                                │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [1. Team-Based & Solo Hackathon Lifecycle]
 Team Registration (Captain) ──> Squad Invites (Teammates Accept) ──> Quorum Met ──>
 Live Hacking ──> 1 Submission Per Team (GitHub + Live URL) ──> 15-Min Grace Window ──>
 Judge Scoring Rubric (0-100) ──> Post-Event Leaderboard & Podium (🥇 🥈 🥉)

 [2. Sports Tournament Engine]
 Team Slot Reservation ──> Knockout Fixtures ──> Match Scores (Crown 👑) ──>
 Semi-Final Winners Advance to Grand Final ──> Trophy Champion 🥇 ──> Auto Standings Table

 [3. Squad Formation & Dashboard Requests]
 Captain Registers Team ──> Sends Invite to player1@ ──> Player Accepts on Dashboard ──>
 Squad Match Ticket Issued ──> Captain Roster Reflects Confirmed Status

 [4. Knowledge Recap Portal]
 Event Concludes ──> Organizer Posts Summary & Slides ──> Attendees Access Recordings & Key Takeaways

 [5. Organizer Governance & Delegation]
 Lead Organizer (organiser1@gmail.com) ──> Invites Co-Organizer ──> Active / Suspended Controls ──> Scoped Permissions
```

### 1. Hackathon Lifecycle & Project Evaluation
* **Team-Based Mode**: Organizers can configure hackathons as **Team-Based** (e.g. 50 teams max, 2–4 members per team) or **Solo**.
* **Captain Registration & Squad Roster**: The team captain registers the team entry (consuming 1 team slot). Teammates receive invitations on their dashboard and accept to join.
* **Team Quorum Qualification**: If a team has not reached the required number of confirmed members before the registration deadline, the team is marked disqualified and cannot submit.
* **Single Team Submission**: Exactly one submission is created and shared across the entire team. Both the captain and confirmed teammates can view and update the submission.
* **Submission Fields & Validation**:
  * Project Title & Tagline
  * Comprehensive Description
  * GitHub Repository URL (validated)
  * Live Deployed Application URL (validated)
  * Demo Video URL (YouTube/Loom or `N/A`)
* **15-Minute Grace Period**: Submissions and edits are open during the live event and remain accessible for a 15-minute buffer after the end time, complete with dynamic countdown timers and contextual warnings.
* **Live Publishing Guard**: Official leaderboard results cannot be published while the hackathon is still live, preventing premature leakage of scores.
* **Judge Scoring Rubric**: Organizers evaluate projects with numerical scores (0–100) and qualitative feedback.
* **Dynamic Podium Leaderboard**: Official standings rank projects with gold (🥇), silver (🥈), bronze (🥉), and top-tier badges.

### 2. Sports Tournament Engine & Bracket Progression
* **Tournament Formats**: 4-Team Knockout (`knockout_4`), 2-Team Match (`knockout_2`), 8-Team Knockout (`knockout_8`), or Round-Robin League (`round_robin`).
* **Team Slot Capacity**: Capacity represents team slots (e.g. 4 teams), with real-time remaining slot tracking.
* **Automatic Winner Progression**: Marking a winner for **Semi-Final 1** automatically advances them to Team A of the **Grand Championship Final**; marking **Semi-Final 2** advances them to Team B.
* **Champion Crowning**: The resultant Grand Final winner dynamically triggers the celebratory **`🏆 TOURNAMENT CHAMPION 🥇`** gold banner.
* **Points Table Calculation**: Organizers can click **⚡ Auto-Calculate from Matches** to automatically compute Played (P), Won (W), Drawn (D), Lost (L), Points (PTS), and Cricket Net Run Rate (NRR).

### 3. Team Squad Formation & Request Acceptance
* **Captain Team Registration**: A team captain registers the team entry (consuming exactly 1 team slot).
* **Dashboard Squad Requests**: The captain can invite players via email or click **`⚡ Invite 11 Squad Players`**.
* **Player Acceptance**: Invited players see a pending card on their dashboard under **`🔔 Team Squad Invitations`** with **`[✓ Accept & Join Squad]`** and **`[✕ Decline]`**.
* **Squad Match Tickets**: Accepting issues an official ticket marked **`{TEAM_NAME} (SQUAD PLAYER 🏏)`**, confirmed in the captain's roster.
* **Squad Capacity Cap**: Invitations cannot be accepted once the squad limit (15 players for Cricket, or hackathon team size) is reached.

### 4. Conference & Webinar Recap Portal
* Organizers draft and publish executive summaries, bulleted key takeaways, slide deck URLs (Google Slides, Canva, PDF), and recording URLs (YouTube, Zoom cloud recordings).

### 5. Co-Organizer Access Delegation
* **Lead Organizer Authority**: Only the primary lead organizer (`organiser1@gmail.com`) can invite new co-organizers, pause active credentials (`suspended`), or terminate accounts.
* **Scoped Access**: Co-organizers can check in attendees and evaluate submissions, but cannot alter organization-level credentials.

### 6. Concurrency & Race-Condition Safety
* **Atomic Seat Reservation**: Uses an atomic position-check algorithm: if concurrent registrations cause confirmed entries to exceed the event capacity, the losing request is rolled back immediately with a clean `Event is full` response.

---

## 4. Technology Stack

### Frontend
* **Core**: React 19, JavaScript (ES2022)
* **Build Tool & Dev Server**: Vite 8 / Rolldown
* **Routing**: React Router v7
* **Styling**: Vanilla CSS Design System with CSS variables, sleek dark theme, glassmorphism cards, micro-animations, and full responsiveness.
* **Deployment**: Vercel (with `vercel.json` SPA client-side routing fallback).

### Backend
* **Runtime**: Node.js (v18+) with native ES Modules (`"type": "module"`)
* **Web Framework**: Express 4
* **Database & ODM**: MongoDB Atlas with Mongoose 8
* **Authentication**: JSON Web Tokens (JWT) signed with HMAC-SHA256, stored in secure, `httpOnly`, `sameSite: none` cookies (7-day validity).
* **Security & Hardening**:
  * Passwords hashed using `bcryptjs` with salt rounds.
  * Express `trust proxy` enabled for reverse proxies (Render, Cloudflare, AWS).
  * CORS origin verification supporting multi-origin configurations and Vercel domains (`*.vercel.app`).
  * HTTP security headers: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
  * Rate-limiting on authentication and verification endpoints.
* **Testing**: Node Native Test Runner (`node --test`) with 9/9 passing tests.
* **Deployment**: Render Web Service.

---

## 5. Technical Architecture

```mermaid
graph TD
  subgraph Client [Frontend - React + Vite on Vercel]
    UI[EventPilot UI]
    AuthCtx[Auth Context & JWT Cookie]
    Pages[Pages: Discover, EventDetail, Participant, Organizer, Team]
  end

  subgraph API [Backend - Express on Render]
    Proxy[Reverse Proxy / Trust Proxy: 1]
    CORS[CORS & Security Middleware]
    AuthMod[Auth & RBAC Middleware]
    
    subgraph Controllers [Domain Controllers]
      EventCtrl[Event Controller]
      RegCtrl[Registration Controller]
      SubCtrl[Submission Controller]
      TeamCtrl[Team & Invites Controller]
      SportsCtrl[Sports & Bracket Engine]
    end
  end

  subgraph Database [Database - MongoDB Atlas]
    Users[(Users Collection)]
    Events[(Events Collection)]
    Regs[(Registrations Collection)]
    Subs[(Submissions Collection)]
    Invites[(TeamInvites Collection)]
  end

  UI -->|HTTP Requests with Credentials| Proxy
  Proxy --> CORS
  CORS --> AuthMod
  AuthMod --> Controllers
  EventCtrl --> Events
  RegCtrl --> Regs
  SubCtrl --> Subs
  TeamCtrl --> Invites
  SportsCtrl --> Events
```

---

## 6. Repository Structure

```text
EventPilot/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection and environment config
│   │   ├── controllers/     # Event, Auth, Registration, Submission, Team controllers
│   │   ├── middleware/      # Authentication, RBAC, and error handlers
│   │   ├── models/          # User, Event, Registration, Submission, TeamInvite schemas
│   │   ├── routes/          # Express route definitions
│   │   ├── scripts/         # Database seeding and migration scripts
│   │   ├── utils/           # Ticket generator, metrics, mailer, token helpers
│   │   ├── app.js           # Express app setup and middleware
│   │   └── server.js        # Server listener and MongoDB connection bootstrapper
│   ├── test/                # Node --test test suites (9/9 passing)
│   ├── .env.example         # Template for backend environment variables
│   └── package.json         # Backend dependencies and scripts
├── frontend/
│   ├── public/              # Static public assets
│   ├── src/
│   │   ├── components/      # Navbar, EventCard, Countdown, modals
│   │   ├── context/         # AuthContext provider
│   │   ├── lib/             # API client and date/category formatters
│   │   ├── pages/           # Discover, EventDetail, Dashboards, Forms
│   │   ├── App.jsx          # Router and app structure
│   │   ├── index.css        # Core design system and CSS tokens
│   │   └── main.jsx         # React application entrypoint
│   ├── .env.example         # Template for frontend environment variables
│   ├── vercel.json          # SPA routing fallback for Vercel
│   ├── vite.config.js       # Vite configuration
│   └── package.json         # Frontend dependencies and build scripts
├── README.md                # Project documentation and submission guide
└── package.json             # Root workspace scripts
```

---

## 7. Local Development Setup

### Prerequisites
* **Node.js**: v18.0.0 or higher
* **npm**: v9.0.0 or higher
* **MongoDB**: A local instance or free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster URI.

### 1. Clone & Install
```bash
git clone https://github.com/Aniket30-07/EventPilot.git
cd EventPilot

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Configure Environment Variables
Create `.env` in `backend/`:
```bash
cp backend/.env.example backend/.env
```
Fill in `backend/.env`:
```env
PORT=5001
NODE_ENV=development
MONGO_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/eventpilot?retryWrites=true&w=majority
FRONTEND_URL=http://localhost:5173
JWT_SECRET=super_secret_jwt_random_key_replace_for_production
```

Create `.env` in `frontend/`:
```bash
cp frontend/.env.example frontend/.env
```
Fill in `frontend/.env`:
```env
VITE_API_BASE_URL=http://localhost:5001/api
```

### 3. Seed Clean Test Data
To populate the database with the active Hackathon (1 hour remaining), 4-team Cricket tournament, Seminar, and demo accounts:
```bash
cd backend
node src/scripts/resetAndSeed.js
```

### 4. Run Locally
Open two terminal windows:

**Terminal 1 (Backend API):**
```bash
cd backend
npm run dev
# Running on http://localhost:5001
```

**Terminal 2 (Frontend Client):**
```bash
cd frontend
npm run dev
# Running on http://localhost:5173
```

---

## 8. Test Accounts & Evaluation Credentials

All accounts are pre-seeded in the database via `backend/src/scripts/resetAndSeed.js`. Additionally, the **Sign In** page features a **1-Click Role Fill** interface for evaluation convenience:

| Role / Entity | Email | Password | Pre-Registered Activity / Testing Scenario |
|---|---|---|---|
| **Lead Organiser (Root)** | `organiser1@gmail.com` | `organiser1@` | Full governance, event creation, bracket evaluation, co-organizer management |
| **Lead Organiser (Alias)** | `organiser@gmail.com` | `organiser@` | Secondary root alias |
| **Team Alpha Captain** | `user1@gmail.com` | `user1@` | Live Hackathon (Ends in 1 hr): Captain of Team Alpha with **project submitted** |
| **Team Alpha Devs** | `user2@gmail.com` .. `user4@gmail.com` | `user2@` .. `user4@` | Confirmed squad members of Team Alpha (4/4 quorum) |
| **Team Beta Captain** | `user5@gmail.com` | `user5@` | Live Hackathon: Captain of Team Beta (4/4 quorum) **ready to submit project** |
| **Team Beta Devs** | `user6@gmail.com` .. `user8@gmail.com` | `user6@` .. `user8@` | Confirmed squad members of Team Beta |
| **Participant 9** | `user9@gmail.com` | `user9@` | Concluded Hackathon: **Submitted project evaluated with 93.5/100** |
| **Participant 10** | `user10@gmail.com` | `user10@` | Concluded Hackathon: Registered but **did not submit** (ready for results publish) |
| **Cricket Captain** | `player1@gmail.com` | `player1@` | Cricket 1v1 Final: Captain of **Thunder Strikers XI** |
| **Cricket XI Players** | `player2@gmail.com` .. `player15@gmail.com` | `player2@` .. `player15@` | 14 squad players confirmed in Playing XI & squad |
| **Guest Evaluator** | `guest.evaluator@gmail.com` | `guest@` | Clean user state with 0 registrations (test fresh ticket flow) |
| **New Participant** | `newuser@gmail.com` | `newuser@` | Fresh participant account |

### Curated Database Scenarios:
1. **Live Hackathon (Ends in 1 Hour)**: 2 teams of 4 members each (`teamMode: 'team'`, quorum 4/4). Team Alpha has submitted their project; Team Beta is ready to submit during the final hour.
2. **Concluded Hackathon (Ended 1 Day Ago)**: `user9` has an evaluated project (93.5/100); `user10` did not submit. Organizers can evaluate or publish leaderboard standings.
3. **Cricket 1v1 Final (Championship Match)**: `knockout_2` format between Thunder Strikers XI (15 confirmed players: `player1` to `player15`) and Royal Challengers XI.


---

## 9. Production Deployment Guide

### A. Deploying Backend to Render (Web Service)
1. Push your repository to GitHub (`main` branch).
2. Log into [Render Dashboard](https://dashboard.render.com/) and click **New +** ➔ **Web Service**.
3. Connect your GitHub repository (`Aniket30-07/EventPilot`).
4. Configure the Web Service settings:
   * **Name**: `eventpilot-api` (e.g. `eventpilot-e4wb`)
   * **Root Directory**: `backend`
   * **Environment**: `Node`
   * **Build Command**: `npm install`
   * **Start Command**: `node src/server.js` (or `npm start`)
   * **Plan**: `Free`
5. Add the following **Environment Variables** in Render:
   * `NODE_ENV`: `production`
   * `PORT`: `5000` (or leave default, Render sets `PORT` automatically)
   * `MONGO_URI`: `mongodb+srv://...` (your MongoDB Atlas connection string)
   * `JWT_SECRET`: A long random string (e.g. generated via `openssl rand -hex 32`)
   * `FRONTEND_URL`: `https://your-frontend.vercel.app` (your deployed Vercel frontend URL)
6. Click **Deploy Web Service**.
7. Live Backend URL: `https://eventpilot-e4wb.onrender.com`

---

### B. Deploying Frontend to Vercel
1. Log into [Vercel Dashboard](https://vercel.com/) and click **Add New...** ➔ **Project**.
2. Import your GitHub repository (`Aniket30-07/EventPilot`).
3. In the project configuration:
   * **Framework Preset**: `Vite`
   * **Root Directory**: Click *Edit* and select **`frontend`**
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. In the **Environment Variables** section, add:
   * `VITE_API_BASE_URL`: `https://eventpilot-e4wb.onrender.com/api`
5. Click **Deploy**.
6. The included [frontend/vercel.json](file:///frontend/vercel.json) ensures that client-side page refreshes (e.g. `/events/123`, `/participant`) redirect cleanly without 404 errors.
7. Any commits pushed to `main` on GitHub automatically trigger continuous deployment on both Render and Vercel.

---

## 10. Verification & Quality Checks

Run the automated test suite and production build check:

```bash
# 1. Run Backend Unit, Security & CORS Tests (9/9 pass)
cd backend
npm test

# 2. Run Frontend Production Bundle Build
cd ../frontend
npm run build
```

---

## 11. Final Submission Checklist

- [x] **Working Software Application**: Live, multi-page application with complete state management and domain workflows.
- [x] **No Hardcoded Credentials**: Secrets, MongoDB URIs, and JWT keys are strictly stored in `.env` files.
- [x] **Robust Error Handling**: Express centralized error handlers, database validation checks, and clean UI feedback alerts.
- [x] **Git History**: Consistent, descriptive commit trajectory demonstrating incremental development.
- [x] **SPA Routing Fallback**: `vercel.json` configured for zero-error routing on Vercel.
- [x] **Production CORS & Cookie Security**: `trust proxy`, `sameSite: none`, and `secure: true` configured for cross-site Render + Vercel deployment.
- [x] **Documentation**: Complete problem statement, workflow diagrams, tech stack rationale, and setup guides.

---

## 12. Submission Summary

```text
Project Name: EventPilot
Problem Statement: End-to-end event lifecycle operating system supporting domain-specific workflows for competitive hackathons, sports knockout tournaments, webinars, and organizer team delegation.
GitHub Repository: https://github.com/Aniket30-07/EventPilot
Live Backend: https://eventpilot-e4wb.onrender.com
Backend Health: https://eventpilot-e4wb.onrender.com/api/health
Tech Stack: React 19, Vite, React Router v7, Node.js, Express, MongoDB, Mongoose, JWT httpOnly Cookies, Vanilla CSS Design System.
Key Features:
  1. Team-Based & Solo Hackathons: Team registration, quorum requirements, single team project submission, 15-minute grace window, judge scoring (0-100), and podium leaderboard.
  2. Sports Tournament Engine: Multi-format knockout brackets (2, 4, 8 teams) with automatic winner progression to grand finals and champion crowning.
  3. Squad Management & Invites: Captain squad invites, player dashboard acceptance, 11-player squad match tickets, and squad limits.
  4. Conference & Webinar Recaps: Executive summaries, key takeaways, slide decks, and video recording archives.
  5. Governance & Delegation: Lead organizer (organiser1@gmail.com) permissions for inviting, pausing, or terminating co-organizers with scoped check-in and evaluation access.
```
