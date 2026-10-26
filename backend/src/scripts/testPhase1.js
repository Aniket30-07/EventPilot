import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api/auth';

const logPass = (title) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${title}`);
const logFail = (title, details) => {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${title}`, details || '');
  process.exitCode = 1;
};

const runTests = async () => {
  console.log('--- STARTING PHASE 1 AUTHENTICATION & AUTHORIZATION TESTS ---');

  const randomId = Date.now().toString().slice(-6);
  const testParticipant = {
    name: `Test User ${randomId}`,
    email: `testuser_${randomId}@example.com`,
    password: 'Password123!',
    role: 'organizer', // Malicious attempt to self-promote to organizer
  };

  let participantToken = null;
  let organizerToken = null;

  // 1. Test public registration & role injection immunity
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testParticipant),
    });
    const data = await res.json();

    if (res.status === 201 && data.success && data.user.role === 'participant') {
      logPass('Public registration defaults to participant and ignores role injection in body');
      participantToken = data.token;
    } else {
      logFail('Registration failed or allowed role injection', data);
    }
  } catch (err) {
    logFail('Registration network error', err.message);
  }

  // 2. Test duplicate email rejection
  try {
    const res = await fetch(`${API_BASE}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testParticipant),
    });
    const data = await res.json();

    if (res.status === 409 && !data.success) {
      logPass('Duplicate registration with existing email is safely rejected with 409');
    } else {
      logFail('Duplicate registration test failed', { status: res.status, data });
    }
  } catch (err) {
    logFail('Duplicate registration network error', err.message);
  }

  // 3. Test invalid login (bad password)
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testParticipant.email, password: 'WrongPassword' }),
    });
    const data = await res.json();

    if (res.status === 401 && !data.success) {
      logPass('Invalid login credentials safely rejected with 401');
    } else {
      logFail('Invalid login did not return 401', { status: res.status, data });
    }
  } catch (err) {
    logFail('Invalid login network error', err.message);
  }

  // 4. Test valid organizer login (seeded account)
  try {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'organizer@eventpilot.dev',
        password: 'OrganizerPass123!',
      }),
    });
    const data = await res.json();

    if (res.status === 200 && data.success && data.user.role === 'organizer') {
      logPass('Organizer logs in successfully with seeded credentials');
      organizerToken = data.token;
    } else {
      logFail('Organizer login failed', data);
    }
  } catch (err) {
    logFail('Organizer login network error', err.message);
  }

  // 5. Test unauthenticated access to protected route
  try {
    const res = await fetch(`${API_BASE}/me`);
    const data = await res.json();

    if (res.status === 401 && !data.success) {
      logPass('Unauthenticated request to /api/auth/me is blocked with 401');
    } else {
      logFail('Unauthenticated access should have been blocked', { status: res.status, data });
    }
  } catch (err) {
    logFail('Unauthenticated test network error', err.message);
  }

  // 6. Test authenticated /me endpoint
  try {
    const res = await fetch(`${API_BASE}/me`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    const data = await res.json();

    if (res.status === 200 && data.success && data.user.email === testParticipant.email.toLowerCase()) {
      logPass('Authenticated user retrieves own profile via /api/auth/me');
    } else {
      logFail('Authenticated /me test failed', data);
    }
  } catch (err) {
    logFail('Authenticated /me network error', err.message);
  }

  // 7. Test role-based authorization: Participant attempting organizer route
  try {
    const res = await fetch(`${API_BASE}/organizer-only`, {
      headers: { Authorization: `Bearer ${participantToken}` },
    });
    const data = await res.json();

    if (res.status === 403 && !data.success) {
      logPass('Participant accessing organizer-only endpoint is blocked with 403 Forbidden');
    } else {
      logFail('Participant should be forbidden from organizer endpoint', { status: res.status, data });
    }
  } catch (err) {
    logFail('Role authorization network error', err.message);
  }

  // 8. Test role-based authorization: Organizer accessing organizer route
  try {
    const res = await fetch(`${API_BASE}/organizer-only`, {
      headers: { Authorization: `Bearer ${organizerToken}` },
    });
    const data = await res.json();

    if (res.status === 200 && data.success) {
      logPass('Organizer successfully accesses organizer-only endpoint with 200 OK');
    } else {
      logFail('Organizer should be allowed to access organizer endpoint', data);
    }
  } catch (err) {
    logFail('Organizer access network error', err.message);
  }

  // 9. Test logout
  try {
    const res = await fetch(`${API_BASE}/logout`, { method: 'POST' });
    const data = await res.json();

    if (res.status === 200 && data.success) {
      logPass('Logout endpoint responds with 200 and clears authentication');
    } else {
      logFail('Logout test failed', data);
    }
  } catch (err) {
    logFail('Logout network error', err.message);
  }

  console.log('--- ALL PHASE 1 BACKEND CHECKS FINISHED ---');
};

runTests();
