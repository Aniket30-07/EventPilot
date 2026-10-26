import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const API_BASE = 'http://localhost:5000/api';

const logSection = (title) => {
  console.log(`\n================================================================`);
  console.log(`  ${title}`);
  console.log(`================================================================`);
};

let passCount = 0;
let failCount = 0;

const assertPass = (title) => {
  passCount++;
  console.log(`\x1b[32m✔ PASS:\x1b[0m ${title}`);
};

const assertFail = (title, details) => {
  failCount++;
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${title}`, details || '');
  process.exitCode = 1;
};

// Helper to make authenticated requests with cookies/headers
const loginAndGetToken = async (email, password) => {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Login failed for ${email}: ${data.message}`);
  return { token: data.token, user: data.user };
};

const runE2EVerification = async () => {
  console.log('STARTING PHASE 5: END-TO-END INTEGRATION & SECURITY SUITE');
  console.log(`Connecting to MongoDB Atlas: ${process.env.MONGO_URI ? 'URI Configured' : 'NO URI'}`);

  await mongoose.connect(process.env.MONGO_URI);
  console.log('MongoDB Atlas Connected successfully.');

  const runId = Date.now().toString().slice(-6);

  // Setup Test Accounts
  const pass = 'TestP@ss1234!';
  const hash = await User.hashPassword(pass);

  const orgA = await User.create({
    name: `Org Alpha ${runId}`,
    email: `org_alpha_${runId}@e2e.test`,
    passwordHash: hash,
    role: 'organizer',
  });

  const orgB = await User.create({
    name: `Org Beta ${runId}`,
    email: `org_beta_${runId}@e2e.test`,
    passwordHash: hash,
    role: 'organizer',
  });

  const part1 = await User.create({
    name: `Participant One ${runId}`,
    email: `part_one_${runId}@e2e.test`,
    passwordHash: hash,
    role: 'participant',
  });

  const part2 = await User.create({
    name: `Participant Two ${runId}`,
    email: `part_two_${runId}@e2e.test`,
    passwordHash: hash,
    role: 'participant',
  });

  const { token: tokenOrgA } = await loginAndGetToken(orgA.email, pass);
  const { token: tokenOrgB } = await loginAndGetToken(orgB.email, pass);
  const { token: tokenPart1 } = await loginAndGetToken(part1.email, pass);
  const { token: tokenPart2 } = await loginAndGetToken(part2.email, pass);

  let createdEventA = null;
  let createdEventB = null;
  let reg1 = null;

  try {
    // =========================================================================
    // SECTION 1: PARTICIPANT AUTHENTICATION & PUBLIC JOURNEY
    // =========================================================================
    logSection('SECTION 1: Participant Signup & Discovery Workflow');

    // 1.1 Public participant signup ignores role injection
    const randomSignupEmail = `new_participant_${runId}@e2e.test`;
    const regRes = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `New Part ${runId}`,
        email: randomSignupEmail,
        password: pass,
        role: 'organizer', // Malicious attempt to elevate role
      }),
    });
    const regData = await regRes.json();
    if (regRes.status === 201 && regData.user.role === 'participant') {
      assertPass('Public signup safely defaults to participant and ignores role injection in body');
    } else {
      assertFail('Public signup failed or allowed role injection', regData);
    }

    // 1.2 Unauthenticated access to private route blocked
    const unauthRes = await fetch(`${API_BASE}/auth/me`);
    if (unauthRes.status === 401) {
      assertPass('Unauthenticated request to /api/auth/me rejected with 401');
    } else {
      assertFail('Unauthenticated request was not rejected with 401', unauthRes.status);
    }

    // 1.3 Authenticated participant profile retrieval
    const meRes = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const meData = await meRes.json();
    if (meRes.status === 200 && meData.user.email === part1.email.toLowerCase()) {
      assertPass('Participant session persistence verified via /api/auth/me');
    } else {
      assertFail('Participant /api/auth/me failed', meData);
    }

    // =========================================================================
    // SECTION 2: ORGANIZER EVENT LIFECYCLE & OWNERSHIP BOUNDARIES
    // =========================================================================
    logSection('SECTION 2: Organizer Lifecycle & Cross-Organizer Boundaries');

    // 2.1 Organizer A creates an event
    const start = new Date(Date.now() + 24 * 3600 * 1000);
    const end = new Date(Date.now() + 48 * 3600 * 1000);
    const deadline = new Date(Date.now() + 12 * 3600 * 1000);

    const createRes = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrgA}` },
      body: JSON.stringify({
        title: `E2E Global Hackathon ${runId}`,
        description: 'End to end integration test event for Phase 5.',
        category: 'hackathon',
        mode: 'online',
        onlineLink: 'https://meet.eventpilot.dev/e2e',
        startAt: start,
        endAt: end,
        registrationDeadline: deadline,
        capacity: 2, // Low capacity to test capacity limits
        status: 'draft',
      }),
    });
    const createData = await createRes.json();
    if (createRes.status === 201 && createData.event._id) {
      createdEventA = createData.event;
      assertPass('Organizer A creates draft event successfully');
    } else {
      assertFail('Organizer A event creation failed', createData);
    }

    // 2.2 Draft event is hidden from public discovery
    const pubListRes1 = await fetch(`${API_BASE}/events`);
    const pubListData1 = await pubListRes1.json();
    const isDraftVisible = pubListData1.events.some((e) => e._id === createdEventA._id);
    if (!isDraftVisible) {
      assertPass('Draft event is strictly excluded from public discovery list');
    } else {
      assertFail('Draft event was leaked in public discovery list');
    }

    // 2.3 Cross-organizer protection: Organizer B cannot edit Organizer A's event
    const crossEditRes = await fetch(`${API_BASE}/events/${createdEventA._id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrgB}` },
      body: JSON.stringify({ title: 'Hacked Title By Org B' }),
    });
    if (crossEditRes.status === 403) {
      assertPass('Cross-organizer edit attempt blocked with 403 Forbidden');
    } else {
      assertFail('Cross-organizer edit was not blocked with 403', crossEditRes.status);
    }

    // 2.4 Cross-organizer protection: Organizer B cannot publish Organizer A's event
    const crossPubRes = await fetch(`${API_BASE}/events/${createdEventA._id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    if (crossPubRes.status === 403) {
      assertPass('Cross-organizer publish attempt blocked with 403 Forbidden');
    } else {
      assertFail('Cross-organizer publish was not blocked with 403', crossPubRes.status);
    }

    // 2.5 Organizer A publishes their own event
    const pubRes = await fetch(`${API_BASE}/events/${createdEventA._id}/publish`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const pubData = await pubRes.json();
    if (pubRes.status === 200 && pubData.event.status === 'published') {
      assertPass('Organizer A publishes event successfully (status is published)');
    } else {
      assertFail('Organizer A publishing failed', pubData);
    }

    // 2.6 Published event now discoverable in public list & search query
    const searchRes = await fetch(`${API_BASE}/events?q=${runId}&category=hackathon`);
    const searchData = await searchRes.json();
    const isNowVisible = searchData.events.some((e) => e._id === createdEventA._id);
    if (isNowVisible) {
      assertPass('Published event is discoverable via category filter and keyword search');
    } else {
      assertFail('Published event was not found in public search filter', searchData);
    }

    // =========================================================================
    // SECTION 3: REGISTRATIONS, TICKETS, DUPLICATES & CAPACITY
    // =========================================================================
    logSection('SECTION 3: Registration, Tickets, Capacity & Duplicate Rules');

    // 3.1 Participant 1 registers for Event A
    const regRes1 = await fetch(`${API_BASE}/events/${createdEventA._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const regData1 = await regRes1.json();
    if (
      regRes1.status === 201 &&
      regData1.success &&
      regData1.registration.ticketCode &&
      regData1.registration.ticketCode.startsWith('EP-')
    ) {
      reg1 = regData1.registration;
      assertPass(`Participant 1 registers and receives ticket code: ${reg1.ticketCode}`);
    } else {
      assertFail('Participant 1 registration failed', regData1);
    }

    // 3.2 Duplicate registration attempt by same participant
    const dupRes = await fetch(`${API_BASE}/events/${createdEventA._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const dupData = await dupRes.json();
    if (dupRes.status === 409 && dupData.success === false) {
      assertPass('Duplicate registration by same participant safely rejected with 409 Conflict');
    } else {
      assertFail('Duplicate registration did not return 409', dupData);
    }

    // 3.3 Participant 2 registers (fills event to 2/2 capacity)
    const regRes2 = await fetch(`${API_BASE}/events/${createdEventA._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart2}` },
    });
    if (regRes2.status === 201) {
      assertPass('Participant 2 registers successfully (event reached 2/2 capacity)');
    } else {
      assertFail('Participant 2 registration failed', regRes2.status);
    }

    // 3.4 Third participant attempts to register for full event
    const part3 = await User.create({
      name: `Participant Three ${runId}`,
      email: `part_three_${runId}@e2e.test`,
      passwordHash: hash,
      role: 'participant',
    });
    const { token: tokenPart3 } = await loginAndGetToken(part3.email, pass);

    const fullRes = await fetch(`${API_BASE}/events/${createdEventA._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart3}` },
    });
    const fullData = await fullRes.json();
    if (fullRes.status === 400 && fullData.message.includes('full')) {
      assertPass('Registration on full event rejected with 400 Bad Request (capacity enforced)');
    } else {
      assertFail('Full event capacity check failed', fullData);
    }

    // 3.5 Participant 1 views their tickets
    const myTicketsRes = await fetch(`${API_BASE}/me/registrations`, {
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const myTicketsData = await myTicketsRes.json();
    const hasTicket = myTicketsData.registrations.some((r) => r.ticketCode === reg1.ticketCode);
    if (myTicketsRes.status === 200 && hasTicket) {
      assertPass('Participant retrieves confirmed ticket via /api/me/registrations');
    } else {
      assertFail('Ticket not found in participant registrations list', myTicketsData);
    }

    // 3.6 Cross-participant security: Participant 2 cannot cancel Participant 1's registration
    const crossCancelRes = await fetch(`${API_BASE}/registrations/${reg1._id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart2}` },
    });
    if (crossCancelRes.status === 403) {
      assertPass('Cross-participant cancellation blocked with 403 Forbidden');
    } else {
      assertFail('Cross-participant cancellation was not blocked with 403', crossCancelRes.status);
    }

    // 3.7 Participant 1 cancels own registration
    const cancelRes = await fetch(`${API_BASE}/registrations/${reg1._id}/cancel`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const cancelData = await cancelRes.json();
    if (cancelRes.status === 200 && cancelData.registration.status === 'cancelled') {
      assertPass('Participant 1 cancels registration and seat is released');
    } else {
      assertFail('Participant 1 cancellation failed', cancelData);
    }

    // 3.8 Re-registration after cancellation is blocked per MVP rules
    const reRegRes = await fetch(`${API_BASE}/events/${createdEventA._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    const reRegData = await reRegRes.json();
    if (reRegRes.status === 400 && reRegData.message.toLowerCase().includes('re-registration is not permitted')) {
      assertPass('Re-registration after cancellation safely rejected with 400 (PRD rule enforced)');
    } else {
      assertFail('Re-registration rule failed', reRegData);
    }

    // 3.9 Participant 3 successfully claims the released seat
    const claimRes = await fetch(`${API_BASE}/events/${createdEventA._id}/register`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenPart3}` },
    });
    let reg3 = null;
    if (claimRes.status === 201) {
      const claimData = await claimRes.json();
      reg3 = claimData.registration;
      assertPass(`Participant 3 successfully claims the released seat (Ticket: ${reg3.ticketCode})`);
    } else {
      assertFail('Participant 3 claiming released seat failed', claimRes.status);
    }

    // =========================================================================
    // SECTION 4: ATTENDEE MANAGEMENT, MANUAL CHECK-IN & IDEMPOTENCY
    // =========================================================================
    logSection('SECTION 4: Attendee Management, Check-In & Idempotency');

    // 4.1 Participant forbidden from accessing attendee roster
    const partAttendeesRes = await fetch(`${API_BASE}/events/${createdEventA._id}/attendees`, {
      headers: { Authorization: `Bearer ${tokenPart1}` },
    });
    if (partAttendeesRes.status === 403) {
      assertPass('Participant accessing organizer attendee list blocked with 403 Forbidden');
    } else {
      assertFail('Participant was not blocked from attendee list', partAttendeesRes.status);
    }

    // 4.2 Cross-organizer protection: Organizer B cannot view Organizer A attendees
    const crossOrgAttendeesRes = await fetch(`${API_BASE}/events/${createdEventA._id}/attendees`, {
      headers: { Authorization: `Bearer ${tokenOrgB}` },
    });
    if (crossOrgAttendeesRes.status === 403) {
      assertPass('Organizer B accessing Organizer A attendees blocked with 403 Forbidden');
    } else {
      assertFail('Organizer B was not blocked from Organizer A attendees', crossOrgAttendeesRes.status);
    }

    // 4.3 Organizer A views attendee roster with live database metrics
    const ownerAttendeesRes = await fetch(`${API_BASE}/events/${createdEventA._id}/attendees`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const ownerAttendeesData = await ownerAttendeesRes.json();
    if (
      ownerAttendeesRes.status === 200 &&
      ownerAttendeesData.metrics.confirmedCount === 2 &&
      ownerAttendeesData.metrics.cancelledCount === 1 &&
      ownerAttendeesData.metrics.checkedInCount === 0 &&
      ownerAttendeesData.metrics.remainingSeats === 0
    ) {
      assertPass('Owner retrieves attendee roster with accurate database-derived metrics');
    } else {
      assertFail('Owner attendee metrics mismatch', ownerAttendeesData);
    }

    // 4.4 Cannot check in a cancelled registration
    const cancelCheckInRes = await fetch(
      `${API_BASE}/events/${createdEventA._id}/registrations/${reg1._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const cancelCheckInData = await cancelCheckInRes.json();
    if (cancelCheckInRes.status === 400 && cancelCheckInData.message.includes('cancelled')) {
      assertPass('Check-in on cancelled registration safely rejected with 400 Bad Request');
    } else {
      assertFail('Check-in on cancelled registration did not return 400', cancelCheckInData);
    }

    // 4.5 Valid manual check-in on confirmed registration
    const validCheckInRes = await fetch(
      `${API_BASE}/events/${createdEventA._id}/registrations/${reg3._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const validCheckInData = await validCheckInRes.json();
    let checkedInTimestamp = null;
    if (
      validCheckInRes.status === 200 &&
      validCheckInData.success &&
      validCheckInData.registration.checkedInAt
    ) {
      checkedInTimestamp = validCheckInData.registration.checkedInAt;
      assertPass(`Confirmed registration checked in successfully (checkedInAt: ${checkedInTimestamp})`);
    } else {
      assertFail('Valid check-in failed', validCheckInData);
    }

    // 4.6 Repeated check-in safely rejected without double counting or altering timestamp
    const repeatCheckInRes = await fetch(
      `${API_BASE}/events/${createdEventA._id}/registrations/${reg3._id}/check-in`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenOrgA}` },
      }
    );
    const repeatCheckInData = await repeatCheckInRes.json();

    const dbReg = await Registration.findById(reg3._id);
    const timestampPreserved =
      new Date(dbReg.checkedInAt).toISOString() === new Date(checkedInTimestamp).toISOString();

    if (
      repeatCheckInRes.status === 400 &&
      repeatCheckInData.alreadyCheckedIn === true &&
      timestampPreserved
    ) {
      assertPass('Repeated check-in safely rejected without altering timestamp or double counting');
    } else {
      assertFail('Repeated check-in failed', { status: repeatCheckInRes.status, repeatCheckInData });
    }

    // 4.7 Live portfolio metrics dynamically updated
    const portfolioRes = await fetch(`${API_BASE}/events/mine/analytics`, {
      headers: { Authorization: `Bearer ${tokenOrgA}` },
    });
    const portfolioData = await portfolioRes.json();
    if (
      portfolioRes.status === 200 &&
      portfolioData.summary.checkedInAttendees >= 1 &&
      portfolioData.summary.overallCheckInRate > 0
    ) {
      assertPass(
        `Portfolio analytics reflects live check-in rate: ${portfolioData.summary.overallCheckInRate}%`
      );
    } else {
      assertFail('Portfolio check-in analytics not updated', portfolioData);
    }

    // Clean up temporary participant 3
    await User.deleteOne({ _id: part3._id });

  } finally {
    // Cleanup created test records
    if (createdEventA) {
      await Registration.deleteMany({ eventId: createdEventA._id });
      await Event.deleteOne({ _id: createdEventA._id });
    }
    await User.deleteMany({ _id: { $in: [orgA._id, orgB._id, part1._id, part2._id] } });
    await mongoose.disconnect();
  }

  logSection('PHASE 5 E2E INTEGRATION & SECURITY TEST SUMMARY');
  console.log(`TOTAL TESTS: ${passCount + failCount}`);
  console.log(`PASSED:      ${passCount}`);
  console.log(`FAILED:      ${failCount}`);

  if (failCount > 0) {
    process.exit(1);
  }
};

runE2EVerification().catch((err) => {
  console.error('Fatal E2E runner error:', err);
  process.exit(1);
});
