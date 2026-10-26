import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api';

const logPass = (title) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${title}`);
const logFail = (title, details) => {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${title}`, details || '');
  process.exitCode = 1;
};

const createToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email },
    process.env.JWT_SECRET || 'eventpilot_dev_jwt_secret_key_super_secure_2026',
    { expiresIn: '1d' }
  );
};

const runTests = async () => {
  console.log('--- STARTING PHASE 4 ORGANIZER DASHBOARD, ATTENDEES & CHECK-IN TESTS ---');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas for Phase 4 test runner');

  const randomId = Date.now().toString().slice(-6);

  // 1. Setup Organizer A, Organizer B, Participant 1, Participant 2
  const hash = await User.hashPassword('Pass1234!');

  const organizerA = await User.create({
    name: `Organizer A ${randomId}`,
    email: `org_a_${randomId}@example.com`,
    passwordHash: hash,
    role: 'organizer',
  });

  const organizerB = await User.create({
    name: `Organizer B ${randomId}`,
    email: `org_b_${randomId}@example.com`,
    passwordHash: hash,
    role: 'organizer',
  });

  const participant1 = await User.create({
    name: `Participant 1 ${randomId}`,
    email: `part1_${randomId}@example.com`,
    passwordHash: hash,
    role: 'participant',
  });

  const participant2 = await User.create({
    name: `Participant 2 ${randomId}`,
    email: `part2_${randomId}@example.com`,
    passwordHash: hash,
    role: 'participant',
  });

  const tokenOrgA = createToken(organizerA);
  const tokenOrgB = createToken(organizerB);
  const tokenPart1 = createToken(participant1);
  const tokenPart2 = createToken(participant2);

  // 2. Setup Events
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  const nextDay = new Date(Date.now() + 48 * 3600 * 1000);
  const deadline = new Date(Date.now() + 12 * 3600 * 1000);

  const eventA = await Event.create({
    title: `Event A Phase 4 ${randomId}`,
    description: 'Organizer A flagship workshop on AI agents.',
    category: 'workshop',
    startAt: tomorrow,
    endAt: nextDay,
    registrationDeadline: deadline,
    capacity: 10,
    organizerId: organizerA._id,
    status: 'published',
  });

  const eventB = await Event.create({
    title: `Event B Phase 4 ${randomId}`,
    description: 'Organizer B conference.',
    category: 'conference',
    startAt: tomorrow,
    endAt: nextDay,
    registrationDeadline: deadline,
    capacity: 5,
    organizerId: organizerB._id,
    status: 'published',
  });

  // 3. Setup Registrations on Event A
  const reg1 = await Registration.create({
    eventId: eventA._id,
    participantId: participant1._id,
    status: 'confirmed',
    ticketCode: `EP-TEST-${randomId}-0001`,
  });

  const reg2 = await Registration.create({
    eventId: eventA._id,
    participantId: participant2._id,
    status: 'cancelled',
    cancelledAt: new Date(),
    ticketCode: `EP-TEST-${randomId}-0002`,
  });

  // Registration on Event B
  const regB = await Registration.create({
    eventId: eventB._id,
    participantId: participant1._id,
    status: 'confirmed',
    ticketCode: `EP-TEST-${randomId}-0003`,
  });

  try {
    // ---------------------------------------------------------
    // TEST 1: Unauthenticated request rejected with 401
    // ---------------------------------------------------------
    const unauthRes = await fetch(`${API_BASE}/events/${eventA._id}/attendees`);
    if (unauthRes.status === 401) {
      logPass('Unauthenticated request to attendee list is blocked with 401 Unauthorized');
    } else {
      logFail('Unauthenticated request should return 401', unauthRes.status);
    }

    // ---------------------------------------------------------
    // TEST 2: Participant cannot access attendee list (403)
    // ---------------------------------------------------------
    const partAttendeesRes = await fetch(`${API_BASE}/events/${eventA._id}/attendees`, {
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    if (partAttendeesRes.status === 403) {
      logPass('Participant accessing attendee list is blocked with 403 Forbidden');
    } else {
      logFail('Participant accessing attendee list did not return 403', partAttendeesRes.status);
    }

    // ---------------------------------------------------------
    // TEST 3: Participant cannot access analytics (403)
    // ---------------------------------------------------------
    const partAnalyticsRes = await fetch(`${API_BASE}/events/${eventA._id}/analytics`, {
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const partMineAnalyticsRes = await fetch(`${API_BASE}/events/mine/analytics`, {
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    if (partAnalyticsRes.status === 403 && partMineAnalyticsRes.status === 403) {
      logPass('Participant accessing event and portfolio analytics is blocked with 403 Forbidden');
    } else {
      logFail('Participant was not forbidden from analytics endpoints');
    }

    // ---------------------------------------------------------
    // TEST 4: Organizer B cannot access Organizer A's attendee list (403)
    // ---------------------------------------------------------
    const crossOrgAttendeesRes = await fetch(`${API_BASE}/events/${eventA._id}/attendees`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    if (crossOrgAttendeesRes.status === 403) {
      logPass('Organizer B cannot access Organizer A attendee list (blocked with 403 Forbidden)');
    } else {
      logFail('Organizer B was not forbidden from Organizer A attendee list', crossOrgAttendeesRes.status);
    }

    // ---------------------------------------------------------
    // TEST 5: Organizer B cannot check in attendees for Organizer A (403)
    // ---------------------------------------------------------
    const crossOrgCheckInRes = await fetch(
      `${API_BASE}/events/${eventA._id}/registrations/${reg1._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgB}` },
      }
    );
    if (crossOrgCheckInRes.status === 403) {
      logPass('Organizer B cannot check in attendees for Organizer A (blocked with 403 Forbidden)');
    } else {
      logFail('Organizer B check-in attempt on Event A did not return 403', crossOrgCheckInRes.status);
    }

    // ---------------------------------------------------------
    // TEST 6: Check-in fails if registration does not belong to event (400)
    // ---------------------------------------------------------
    const mismatchRes = await fetch(
      `${API_BASE}/events/${eventA._id}/registrations/${regB._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const mismatchData = await mismatchRes.json();
    if (mismatchRes.status === 400 && mismatchData.message.includes('belong to this event')) {
      logPass('Check-in rejected with 400 when registration does not belong to specified event');
    } else {
      logFail('Mismatched registration check-in was not rejected with 400', mismatchData);
    }

    // ---------------------------------------------------------
    // TEST 7: Check-in fails on cancelled registration (400)
    // ---------------------------------------------------------
    const cancelCheckInRes = await fetch(
      `${API_BASE}/events/${eventA._id}/registrations/${reg2._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const cancelCheckInData = await cancelCheckInRes.json();
    if (cancelCheckInRes.status === 400 && cancelCheckInData.message.includes('cancelled')) {
      logPass('Check-in rejected with 400 on cancelled registration');
    } else {
      logFail('Check-in on cancelled registration did not return 400', cancelCheckInData);
    }

    // ---------------------------------------------------------
    // TEST 8: Valid manual check-in succeeds (200) & stores checkedInAt
    // ---------------------------------------------------------
    const checkInRes = await fetch(
      `${API_BASE}/events/${eventA._id}/registrations/${reg1._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const checkInData = await checkInRes.json();
    let initialCheckedInAt = null;

    if (
      checkInRes.status === 200 &&
      checkInData.success &&
      checkInData.registration.checkedInAt
    ) {
      initialCheckedInAt = checkInData.registration.checkedInAt;
      logPass(`Confirmed registration checked in successfully (checkedInAt: ${initialCheckedInAt})`);
    } else {
      logFail('Valid check-in failed', { status: checkInRes.status, checkInData });
    }

    // ---------------------------------------------------------
    // TEST 9: Repeated check-in safely rejected without double-counting (400)
    // ---------------------------------------------------------
    const repeatRes = await fetch(
      `${API_BASE}/events/${eventA._id}/registrations/${reg1._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const repeatData = await repeatRes.json();

    const regInDb = await Registration.findById(reg1._id);
    const isTimestampPreserved =
      new Date(regInDb.checkedInAt).toISOString() === new Date(initialCheckedInAt).toISOString();

    if (
      repeatRes.status === 400 &&
      repeatData.alreadyCheckedIn === true &&
      isTimestampPreserved
    ) {
      logPass('Repeated check-in safely rejected (alreadyCheckedIn: true) without altering timestamp');
    } else {
      logFail('Repeated check-in did not handle duplicate safely', { status: repeatRes.status, repeatData });
    }

    // ---------------------------------------------------------
    // TEST 10: Owner retrieves attendee list with live database metrics
    // ---------------------------------------------------------
    const attendeesRes = await fetch(`${API_BASE}/events/${eventA._id}/attendees`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const attendeesData = await attendeesRes.json();

    if (
      attendeesRes.status === 200 &&
      attendeesData.success &&
      attendeesData.metrics.totalCount === 2 &&
      attendeesData.metrics.confirmedCount === 1 &&
      attendeesData.metrics.checkedInCount === 1 &&
      attendeesData.metrics.checkInRate === 100 &&
      attendeesData.metrics.remainingSeats === 9 &&
      attendeesData.attendees.length === 2
    ) {
      logPass('Owner retrieves attendee list with accurate database-derived check-in metrics');
    } else {
      logFail('Attendee list metrics inaccurate', attendeesData);
    }

    // ---------------------------------------------------------
    // TEST 11: Single event analytics endpoint
    // ---------------------------------------------------------
    const analyticsRes = await fetch(`${API_BASE}/events/${eventA._id}/analytics`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const analyticsData = await analyticsRes.json();

    if (
      analyticsRes.status === 200 &&
      analyticsData.success &&
      analyticsData.metrics.confirmedCount === 1 &&
      analyticsData.metrics.checkedInCount === 1 &&
      analyticsData.metrics.checkInRate === 100
    ) {
      logPass('Event analytics endpoint returns accurate confirmed, check-in, and rate metrics');
    } else {
      logFail('Event analytics failed', analyticsData);
    }

    // ---------------------------------------------------------
    // TEST 12: Aggregated portfolio analytics for Organizer A
    // ---------------------------------------------------------
    const portfolioRes = await fetch(`${API_BASE}/events/mine/analytics`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const portfolioData = await portfolioRes.json();

    if (
      portfolioRes.status === 200 &&
      portfolioData.success &&
      portfolioData.summary.totalEvents >= 1 &&
      portfolioData.summary.confirmedRegistrations >= 1 &&
      portfolioData.summary.checkedInAttendees >= 1 &&
      portfolioData.summary.overallCheckInRate > 0
    ) {
      logPass('Portfolio analytics calculates aggregate attendance and check-in rates across owned events');
    } else {
      logFail('Portfolio analytics failed', portfolioData);
    }

  } finally {
    // Cleanup created test records
    await Registration.deleteMany({ _id: { $in: [reg1._id, reg2._id, regB._id] } });
    await Event.deleteMany({ _id: { $in: [eventA._id, eventB._id] } });
    await User.deleteMany({ _id: { $in: [organizerA._id, organizerB._id, participant1._id, participant2._id] } });
    await mongoose.disconnect();
  }

  console.log('--- ALL PHASE 4 BACKEND TESTS FINISHED ---');
};

runTests().catch((err) => {
  console.error('Phase 4 Test Runner Error:', err);
  process.exit(1);
});
