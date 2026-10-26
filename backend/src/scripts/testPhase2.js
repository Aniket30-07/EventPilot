import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';

const API_BASE = 'http://localhost:5000/api';

const logPass = (title) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${title}`);
const logFail = (title, details) => {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${title}`, details || '');
  process.exitCode = 1;
};

const runTests = async () => {
  console.log('--- STARTING PHASE 2 EVENT LIFECYCLE & DISCOVERY TESTS ---');

  // Connect to DB directly for seeding test users
  await connectDB();

  // Create/update Organizer A
  const orgAPassword = await User.hashPassword('PassA123!');
  const orgA = await User.findOneAndUpdate(
    { email: 'organizer_a@eventpilot.dev' },
    { name: 'Organizer Alpha', email: 'organizer_a@eventpilot.dev', passwordHash: orgAPassword, role: 'organizer' },
    { upsert: true, new: true }
  );

  // Create/update Organizer B
  const orgBPassword = await User.hashPassword('PassB123!');
  const orgB = await User.findOneAndUpdate(
    { email: 'organizer_b@eventpilot.dev' },
    { name: 'Organizer Beta', email: 'organizer_b@eventpilot.dev', passwordHash: orgBPassword, role: 'organizer' },
    { upsert: true, new: true }
  );

  // Create/update Participant
  const partPassword = await User.hashPassword('PartPass123!');
  const participant = await User.findOneAndUpdate(
    { email: 'participant_test@eventpilot.dev' },
    { name: 'Test Participant', email: 'participant_test@eventpilot.dev', passwordHash: partPassword, role: 'participant' },
    { upsert: true, new: true }
  );

  // Obtain JWT tokens for each
  const loginUser = async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    return data.token;
  };

  const tokenOrgA = await loginUser('organizer_a@eventpilot.dev', 'PassA123!');
  const tokenOrgB = await loginUser('organizer_b@eventpilot.dev', 'PassB123!');
  const tokenPart = await loginUser('participant_test@eventpilot.dev', 'PartPass123!');

  // Clean previous test events created by orgA and orgB
  await Event.deleteMany({ organizerId: { $in: [orgA._id, orgB._id] } });

  // 1. Participant attempting to create an event
  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenPart}` },
      body: JSON.stringify({ title: 'Illegal Event', description: 'Participant creating event', category: 'hackathon', startAt: new Date(), endAt: new Date(), capacity: 10 }),
    });
    const data = await res.json();
    if (res.status === 403) {
      logPass('Participant cannot create an event (blocked with 403 Forbidden)');
    } else {
      logFail('Participant should not be able to create events', data);
    }
  } catch (err) {
    logFail('Participant create test error', err.message);
  }

  // 2. Date validation: endAt before startAt
  const now = new Date();
  const futureStart = new Date(now.getTime() + 86400000); // +1 day
  const pastEnd = new Date(now.getTime() + 43200000); // +12 hours (before startAt!)

  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrgA}` },
      body: JSON.stringify({
        title: 'Invalid Date Event',
        description: 'Testing invalid dates',
        category: 'hackathon',
        startAt: futureStart,
        endAt: pastEnd,
        registrationDeadline: now,
        capacity: 50,
      }),
    });
    if (res.status === 400) {
      logPass('Date validation rejects endAt <= startAt with 400 Bad Request');
    } else {
      logFail('Invalid date should have failed with 400', res.status);
    }
  } catch (err) {
    logFail('Date validation test error', err.message);
  }

  // 3. Organizer A creates a valid draft event
  let createdEventId = null;
  const eventStart = new Date(now.getTime() + 7 * 86400000); // +7 days
  const eventEnd = new Date(now.getTime() + 8 * 86400000);   // +8 days
  const eventDeadline = new Date(now.getTime() + 6 * 86400000); // +6 days

  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrgA}` },
      body: JSON.stringify({
        title: 'Global AI Hackathon 2026',
        description: 'Build cutting-edge autonomous agents in 48 hours.',
        category: 'hackathon',
        startAt: eventStart,
        endAt: eventEnd,
        mode: 'online',
        onlineLink: 'https://meet.eventpilot.dev/ai-hack',
        capacity: 100,
        registrationDeadline: eventDeadline,
        status: 'draft',
      }),
    });
    const data = await res.json();
    if (res.status === 201 && data.success && data.event.status === 'draft') {
      logPass('Organizer A creates a draft event successfully');
      createdEventId = data.event._id;
    } else {
      logFail('Draft event creation failed', data);
    }
  } catch (err) {
    logFail('Event creation error', err.message);
  }

  // 4. Draft event should NOT appear in public discovery
  try {
    const res = await fetch(`${API_BASE}/events`);
    const data = await res.json();
    const found = data.events.find((e) => e._id === createdEventId);
    if (!found) {
      logPass('Draft event is hidden from public discovery');
    } else {
      logFail('Draft event leaked to public discovery list!');
    }
  } catch (err) {
    logFail('Public discovery test error', err.message);
  }

  // 5. Cross-organizer ownership: Organizer B attempts to edit Organizer A's event
  try {
    const res = await fetch(`${API_BASE}/events/${createdEventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrgB}` },
      body: JSON.stringify({ title: 'Hijacked Event Title' }),
    });
    const data = await res.json();
    if (res.status === 403) {
      logPass('Organizer B cannot edit Organizer A event (blocked with 403 Forbidden)');
    } else {
      logFail('Cross-organizer edit should be forbidden with 403', data);
    }
  } catch (err) {
    logFail('Cross-organizer edit test error', err.message);
  }

  // 6. Cross-organizer ownership: Organizer B attempts to publish Organizer A's event
  try {
    const res = await fetch(`${API_BASE}/events/${createdEventId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    const data = await res.json();
    if (res.status === 403) {
      logPass('Organizer B cannot publish Organizer A event (blocked with 403 Forbidden)');
    } else {
      logFail('Cross-organizer publish should be forbidden with 403', data);
    }
  } catch (err) {
    logFail('Cross-organizer publish test error', err.message);
  }

  // 7. Organizer A edits own event
  try {
    const res = await fetch(`${API_BASE}/events/${createdEventId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrgA}` },
      body: JSON.stringify({ capacity: 150, title: 'Global AI Agents Hackathon 2026' }),
    });
    const data = await res.json();
    if (res.status === 200 && data.event.capacity === 150) {
      logPass('Organizer A edits their own event successfully');
    } else {
      logFail('Organizer edit failed', data);
    }
  } catch (err) {
    logFail('Organizer edit error', err.message);
  }

  // 8. Organizer A publishes own event
  try {
    const res = await fetch(`${API_BASE}/events/${createdEventId}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.event.status === 'published') {
      logPass('Organizer A publishes event successfully (status is published)');
    } else {
      logFail('Event publish failed', data);
    }
  } catch (err) {
    logFail('Event publish error', err.message);
  }

  // 9. Published event NOW appears in public discovery
  try {
    const res = await fetch(`${API_BASE}/events`);
    const data = await res.json();
    const found = data.events.find((e) => e._id === createdEventId);
    if (found) {
      logPass('Published event is now discoverable in public event list');
    } else {
      logFail('Published event not found in public discovery');
    }
  } catch (err) {
    logFail('Discovery verification error', err.message);
  }

  // 10. Search & category filter verification
  try {
    // Search by text "Agents"
    const searchRes = await fetch(`${API_BASE}/events?q=Agents`);
    const searchData = await searchRes.json();
    const searchFound = searchData.events.some((e) => e._id === createdEventId);

    // Filter by matching category "hackathon"
    const catMatchRes = await fetch(`${API_BASE}/events?category=hackathon`);
    const catMatchData = await catMatchRes.json();
    const catFound = catMatchData.events.some((e) => e._id === createdEventId);

    // Filter by non-matching category "sports"
    const catNoMatchRes = await fetch(`${API_BASE}/events?category=sports`);
    const catNoMatchData = await catNoMatchRes.json();
    const catNotFound = !catNoMatchData.events.some((e) => e._id === createdEventId);

    if (searchFound && catFound && catNotFound) {
      logPass('Search query and category filters operate accurately');
    } else {
      logFail('Search or category filter failed', { searchFound, catFound, catNotFound });
    }
  } catch (err) {
    logFail('Filter test error', err.message);
  }

  // 11. Cross-organizer ownership: Organizer B attempts to cancel Organizer A's event
  try {
    const res = await fetch(`${API_BASE}/events/${createdEventId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    if (res.status === 403) {
      logPass('Organizer B cannot cancel Organizer A event (blocked with 403 Forbidden)');
    } else {
      logFail('Cross-organizer cancellation should be forbidden with 403', res.status);
    }
  } catch (err) {
    logFail('Cross-organizer cancel error', err.message);
  }

  // 12. Organizer A cancels own event
  try {
    const res = await fetch(`${API_BASE}/events/${createdEventId}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const data = await res.json();
    if (res.status === 200 && data.event.status === 'cancelled') {
      logPass('Organizer A cancels own event (status changed to cancelled)');
    } else {
      logFail('Event cancellation failed', data);
    }
  } catch (err) {
    logFail('Event cancellation error', err.message);
  }

  // 13. Cancelled event is removed from public discovery
  try {
    const res = await fetch(`${API_BASE}/events`);
    const data = await res.json();
    const found = data.events.find((e) => e._id === createdEventId);
    if (!found) {
      logPass('Cancelled event is excluded from public discovery');
    } else {
      logFail('Cancelled event should not appear in public discovery!');
    }
  } catch (err) {
    logFail('Cancelled discovery check error', err.message);
  }

  console.log('--- ALL PHASE 2 BACKEND CHECKS FINISHED ---');
  process.exit(0);
};

runTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
