import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

const API_BASE = 'http://localhost:5000/api';

const logPass = (title) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${title}`);
const logFail = (title, details) => {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${title}`, details || '');
  process.exitCode = 1;
};

const runTests = async () => {
  console.log('--- STARTING PHASE 3 REGISTRATION & TICKET TESTS ---');

  await connectDB();

  // Create Organizer
  const orgPassword = await User.hashPassword('OrgPass123!');
  const organizer = await User.findOneAndUpdate(
    { email: 'p3_organizer@eventpilot.dev' },
    { name: 'P3 Organizer', email: 'p3_organizer@eventpilot.dev', passwordHash: orgPassword, role: 'organizer' },
    { upsert: true, new: true }
  );

  // Create Participant 1
  const p1Password = await User.hashPassword('P1Pass123!');
  const p1 = await User.findOneAndUpdate(
    { email: 'p3_participant1@eventpilot.dev' },
    { name: 'Participant One', email: 'p3_participant1@eventpilot.dev', passwordHash: p1Password, role: 'participant' },
    { upsert: true, new: true }
  );

  // Create Participant 2
  const p2Password = await User.hashPassword('P2Pass123!');
  const p2 = await User.findOneAndUpdate(
    { email: 'p3_participant2@eventpilot.dev' },
    { name: 'Participant Two', email: 'p3_participant2@eventpilot.dev', passwordHash: p2Password, role: 'participant' },
    { upsert: true, new: true }
  );

  // Create Participant 3
  const p3Password = await User.hashPassword('P3Pass123!');
  const p3 = await User.findOneAndUpdate(
    { email: 'p3_participant3@eventpilot.dev' },
    { name: 'Participant Three', email: 'p3_participant3@eventpilot.dev', passwordHash: p3Password, role: 'participant' },
    { upsert: true, new: true }
  );

  // Login helper
  const loginUser = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return data.token;
  };

  const tokenP1 = await loginUser('p3_participant1@eventpilot.dev', 'P1Pass123!');
  const tokenP2 = await loginUser('p3_participant2@eventpilot.dev', 'P2Pass123!');
  const tokenP3 = await loginUser('p3_participant3@eventpilot.dev', 'P3Pass123!');

  // Cleanup past test data
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // Event with capacity = 2
  const testEvent = await Event.create({
    title: 'Tight Capacity AI Workshop',
    description: 'An exclusive small-group workshop with strict capacity of 2.',
    category: 'workshop',
    startAt: new Date(now.getTime() + 5 * day),
    endAt: new Date(now.getTime() + 6 * day),
    mode: 'online',
    onlineLink: 'https://workshop.eventpilot.dev',
    capacity: 2,
    registrationDeadline: new Date(now.getTime() + 4 * day),
    organizerId: organizer._id,
    status: 'published',
  });

  // Event with expired deadline
  const expiredEvent = await Event.create({
    title: 'Past Deadline Event',
    description: 'An event whose registration deadline has passed.',
    category: 'conference',
    startAt: new Date(now.getTime() + 5 * day),
    endAt: new Date(now.getTime() + 6 * day),
    mode: 'in-person',
    capacity: 100,
    registrationDeadline: new Date(now.getTime() - 1 * day), // In the past!
    organizerId: organizer._id,
    status: 'published',
  });

  // Draft event
  const draftEvent = await Event.create({
    title: 'Unpublished Draft Event',
    description: 'An event that is not yet published.',
    category: 'hackathon',
    startAt: new Date(now.getTime() + 5 * day),
    endAt: new Date(now.getTime() + 6 * day),
    mode: 'online',
    capacity: 50,
    registrationDeadline: new Date(now.getTime() + 3 * day),
    organizerId: organizer._id,
    status: 'draft',
  });

  await Registration.deleteMany({ eventId: { $in: [testEvent._id, expiredEvent._id, draftEvent._id] } });

  let p1RegistrationId = null;
  let p1TicketCode = null;

  // 1. Unauthenticated registration attempt
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, { method: 'POST' });
    if (res.status === 401) {
      logPass('Unauthenticated registration rejected with 401 Unauthorized');
    } else {
      logFail('Unauthenticated registration should return 401', res.status);
    }
  } catch (err) {
    logFail('Unauthenticated test error', err.message);
  }

  // 2. Participant 1 registers successfully
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP1}` },
    });
    const data = await res.json();
    if (res.status === 201 && data.success && data.registration.status === 'confirmed' && data.registration.ticketCode) {
      p1RegistrationId = data.registration._id;
      p1TicketCode = data.registration.ticketCode;
      logPass(`Participant 1 registered successfully (Ticket: ${p1TicketCode})`);
    } else {
      logFail('Participant 1 registration failed', data);
    }
  } catch (err) {
    logFail('Participant 1 registration error', err.message);
  }

  // 3. Duplicate registration rejection (Compound index check)
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP1}` },
    });
    const data = await res.json();
    if (res.status === 409) {
      logPass('Duplicate registration by same participant safely rejected with 409 Conflict');
    } else {
      logFail('Duplicate registration should return 409', { status: res.status, data });
    }
  } catch (err) {
    logFail('Duplicate registration error', err.message);
  }

  // 4. Participant 2 registers (fills event to capacity 2/2)
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP2}` },
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      logPass('Participant 2 registered successfully (Event at full capacity 2/2)');
    } else {
      logFail('Participant 2 registration failed', data);
    }
  } catch (err) {
    logFail('Participant 2 registration error', err.message);
  }

  // 5. Server-side capacity enforcement: Participant 3 attempt when full
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP3}` },
    });
    const data = await res.json();
    if (res.status === 400 && data.message.includes('capacity')) {
      logPass('Registration on full event rejected with 400 (Capacity enforced)');
    } else {
      logFail('Registration should have been blocked due to capacity', { status: res.status, data });
    }
  } catch (err) {
    logFail('Capacity enforcement error', err.message);
  }

  // 6. Expired deadline enforcement
  try {
    const res = await fetch(`${API_BASE}/events/${expiredEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP3}` },
    });
    const data = await res.json();
    if (res.status === 400 && data.message.includes('deadline')) {
      logPass('Registration on expired deadline event rejected with 400 (Deadline enforced)');
    } else {
      logFail('Registration should have been blocked due to deadline', { status: res.status, data });
    }
  } catch (err) {
    logFail('Deadline enforcement error', err.message);
  }

  // 7. Unpublished / Draft event registration check
  try {
    const res = await fetch(`${API_BASE}/events/${draftEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP3}` },
    });
    const data = await res.json();
    if (res.status === 400 && data.message.includes('status')) {
      logPass('Registration on draft event rejected with 400 (Status enforced)');
    } else {
      logFail('Registration on draft event should return 400', { status: res.status, data });
    }
  } catch (err) {
    logFail('Draft registration check error', err.message);
  }

  // 8. Cross-participant cancellation permission check
  try {
    const res = await fetch(`${API_BASE}/registrations/${p1RegistrationId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP2}` }, // P2 trying to cancel P1's registration
    });
    if (res.status === 403) {
      logPass('Participant cannot cancel another participant registration (blocked with 403 Forbidden)');
    } else {
      logFail('Cross-participant cancellation should return 403', res.status);
    }
  } catch (err) {
    logFail('Cross cancellation error', err.message);
  }

  // 9. Participant 1 cancels own registration
  try {
    const res = await fetch(`${API_BASE}/registrations/${p1RegistrationId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP1}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.registration.status === 'cancelled') {
      logPass('Participant 1 cancels own registration successfully (Status: cancelled)');
    } else {
      logFail('Cancellation failed', data);
    }
  } catch (err) {
    logFail('Own cancellation error', err.message);
  }

  // 10. Duplicate cancellation rejection
  try {
    const res = await fetch(`${API_BASE}/registrations/${p1RegistrationId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP1}` },
    });
    if (res.status === 400) {
      logPass('Repeated cancellation safely rejected with 400 (Idempotent rejection)');
    } else {
      logFail('Repeated cancellation should return 400', res.status);
    }
  } catch (err) {
    logFail('Duplicate cancellation error', err.message);
  }

  // 11. Re-registration rule: Cancelled registration cannot be re-created
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP1}` },
    });
    const data = await res.json();
    if (res.status === 400 && data.message.includes('previously cancelled')) {
      logPass('Re-registration after cancellation safely rejected (PRD Rule Enforced)');
    } else {
      logFail('Re-registration after cancellation should return 400', { status: res.status, data });
    }
  } catch (err) {
    logFail('Re-registration test error', err.message);
  }

  // 12. Capacity release verification: Participant 3 can now claim the freed seat
  try {
    const res = await fetch(`${API_BASE}/events/${testEvent._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenP3}` },
    });
    const data = await res.json();
    if (res.status === 201 && data.success) {
      logPass('Participant 3 successfully claims freed seat after cancellation (Capacity dynamic)');
    } else {
      logFail('Participant 3 should be able to register after seat released', data);
    }
  } catch (err) {
    logFail('Capacity release test error', err.message);
  }

  // 13. My Registrations endpoint check
  try {
    const res = await fetch(`${API_BASE}/me/registrations`, {
      headers: { Authorization: `Bearer ${tokenP1}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.success && data.registrations.length > 0 && data.registrations[0].ticketCode === p1TicketCode) {
      logPass('Participant retrieves own registrations via /api/me/registrations with ticket codes');
    } else {
      logFail('My registrations endpoint check failed', data);
    }
  } catch (err) {
    logFail('My registrations error', err.message);
  }

  // Cleanup test artifacts
  await Event.deleteMany({ _id: { $in: [testEvent._id, expiredEvent._id, draftEvent._id] } });
  await Registration.deleteMany({ eventId: { $in: [testEvent._id, expiredEvent._id, draftEvent._id] } });

  console.log('--- ALL PHASE 3 BACKEND CHECKS FINISHED ---');
  process.exit(0);
};

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
