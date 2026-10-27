import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import Submission from '../models/Submission.js';
import TeamInvite from '../models/TeamInvite.js';
import { generateTicketCode } from '../utils/ticketGenerator.js';

const run = async () => {
  try {
    await connectDB();
    console.log('[Reset] Connected to database.');

    // 1. Wipe all collections completely (no leftover or unwanted content)
    await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      Registration.deleteMany({}),
      Submission.deleteMany({}),
      TeamInvite.deleteMany({}),
    ]);
    console.log('[Reset] Completely emptied all collections: Users, Events, Registrations, Submissions, TeamInvites.');

    // 2. Create Lead Organisers
    const organizer = await User.create({
      name: 'Lead Organiser',
      email: 'organiser1@gmail.com',
      passwordHash: await User.hashPassword('organiser1@'),
      role: 'organizer',
      emailVerified: true,
    });

    const organizerAlt = await User.create({
      name: 'Lead Organiser (Alias)',
      email: 'organiser@gmail.com',
      passwordHash: await User.hashPassword('organiser@'),
      role: 'organizer',
      emailVerified: true,
    });
    console.log(`[Seed] Created Lead Organisers: ${organizer.email} (organiser1@) & ${organizerAlt.email} (organiser@)`);

    // 3. Create 2 New Clean Users (For testing fresh registrations / empty state)
    const newUsers = [
      { name: 'Guest Evaluator', email: 'guest.evaluator@gmail.com', pass: 'guest@' },
      { name: 'New Participant', email: 'newuser@gmail.com', pass: 'newuser@' },
    ];
    for (const nu of newUsers) {
      await User.create({
        name: nu.name,
        email: nu.email,
        passwordHash: await User.hashPassword(nu.pass),
        role: 'participant',
        emailVerified: true,
      });
      console.log(`[Seed] Created Fresh User: ${nu.email} (pass: ${nu.pass})`);
    }

    // 4. Create Users 1 to 10
    const users1to10 = [];
    const userConfigs = [
      { name: 'User 1 (Team Alpha Captain)', email: 'user1@gmail.com', pass: 'user1@' },
      { name: 'User 2 (Team Alpha Dev)', email: 'user2@gmail.com', pass: 'user2@' },
      { name: 'User 3 (Team Alpha Designer)', email: 'user3@gmail.com', pass: 'user3@' },
      { name: 'User 4 (Team Alpha QA)', email: 'user4@gmail.com', pass: 'user4@' },
      { name: 'User 5 (Team Beta Captain)', email: 'user5@gmail.com', pass: 'user5@' },
      { name: 'User 6 (Team Beta Dev)', email: 'user6@gmail.com', pass: 'user6@' },
      { name: 'User 7 (Team Beta Designer)', email: 'user7@gmail.com', pass: 'user7@' },
      { name: 'User 8 (Team Beta QA)', email: 'user8@gmail.com', pass: 'user8@' },
      { name: 'User 9 (Solo Submitter)', email: 'user9@gmail.com', pass: 'user9@' },
      { name: 'User 10 (Solo Non-Submitter)', email: 'user10@gmail.com', pass: 'user10@' },
    ];

    for (const uc of userConfigs) {
      const uDoc = await User.create({
        name: uc.name,
        email: uc.email,
        passwordHash: await User.hashPassword(uc.pass),
        role: 'participant',
        emailVerified: true,
      });
      users1to10.push(uDoc);
      console.log(`[Seed] Created Participant: ${uc.email} (pass: ${uc.pass})`);
    }

    // 5. Create 15 Cricket Players: player1@gmail.com to player15@gmail.com
    const cricketPlayers = [];
    for (let i = 1; i <= 15; i++) {
      const pDoc = await User.create({
        name: `Player ${i} ${i === 1 ? '(Captain)' : '(Squad Player)'}`,
        email: `player${i}@gmail.com`,
        passwordHash: await User.hashPassword(`player${i}@`),
        role: 'participant',
        emailVerified: true,
      });
      cricketPlayers.push(pDoc);
      console.log(`[Seed] Created Cricket Player: player${i}@gmail.com (pass: player${i}@)`);
    }

    const now = new Date();
    const addHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
    const addDays = (d, days) => new Date(d.getTime() + days * 24 * 3600 * 1000);

    // =========================================================================
    // EVENT 1: Live Hackathon of 2 teams of 4 members each, ending in 1 hour
    // =========================================================================
    const liveHackathon = await Event.create({
      title: 'Global AI Agents & Full-Stack Hackathon 2026',
      description: '48-hour competitive team hackathon building autonomous AI agents and resilient cloud architectures. Form a team of 4 members, build your prototype, and submit your GitHub repository and live demo URL.',
      category: 'hackathon',
      mode: 'online',
      onlineLink: 'https://zoom.us/j/987654321',
      capacity: 2, // 2 Teams
      startAt: addHours(now, -23),
      endAt: addHours(now, 1), // Live with 1 hour remaining!
      registrationDeadline: addHours(now, -24),
      organizerId: organizer._id,
      status: 'published',
      resultsPublished: false,
      hackathonConfig: {
        teamMode: 'team',
        teamSize: 4,
        requiredMembers: 4,
        maxTeams: 2,
      },
    });
    console.log(`[Seed] Created Live Hackathon: "${liveHackathon.title}" (Ends in 1 hour)`);

    // --- Team Alpha (Users 1 to 4) ---
    const regAlphaCaptain = await Registration.create({
      eventId: liveHackathon._id,
      participantId: users1to10[0]._id, // user1
      ticketCode: generateTicketCode('hackathon'),
      status: 'confirmed',
      registeredAt: addHours(now, -24),
      teamName: 'Team Alpha',
      squadSize: 4,
      isCaptain: true,
      roleInTeam: 'captain',
    });

    for (let i = 1; i <= 3; i++) {
      await Registration.create({
        eventId: liveHackathon._id,
        participantId: users1to10[i]._id, // user2, user3, user4
        ticketCode: generateTicketCode('hackathon'),
        status: 'confirmed',
        registeredAt: addHours(now, -23),
        teamName: 'Team Alpha',
        isCaptain: false,
        roleInTeam: 'player',
        captainRegistrationId: regAlphaCaptain._id,
      });

      await TeamInvite.create({
        eventId: liveHackathon._id,
        registrationId: regAlphaCaptain._id,
        teamName: 'Team Alpha',
        captainId: users1to10[0]._id,
        captainName: users1to10[0].name,
        invitedUserId: users1to10[i]._id,
        invitedEmail: users1to10[i].email,
        invitedName: users1to10[i].name,
        role: 'player',
        status: 'accepted',
        respondedAt: addHours(now, -23),
      });
    }

    // Team Alpha has already submitted their project!
    await Submission.create({
      eventId: liveHackathon._id,
      participantId: users1to10[0]._id,
      captainRegistrationId: regAlphaCaptain._id,
      teamName: 'Team Alpha',
      ticketCode: regAlphaCaptain.ticketCode,
      projectName: 'Autonomous Agent Workflow Engine',
      tagline: 'Zero-shot multi-agent orchestration for cloud ops',
      description: 'A distributed platform for managing autonomous software development agents with verified tool execution, real-time telemetry, and resilient failover pipelines.',
      githubUrl: 'https://github.com/EventPilot/agent-workflow-engine',
      deployedUrl: 'https://eventpilot-e4wb.onrender.com',
      demoVideoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      status: 'submitted',
    });
    console.log('[Seed] Registered Team Alpha (4/4 members confirmed, Project Submitted)');

    // --- Team Beta (Users 5 to 8) ---
    const regBetaCaptain = await Registration.create({
      eventId: liveHackathon._id,
      participantId: users1to10[4]._id, // user5
      ticketCode: generateTicketCode('hackathon'),
      status: 'confirmed',
      registeredAt: addHours(now, -24),
      teamName: 'Team Beta',
      squadSize: 4,
      isCaptain: true,
      roleInTeam: 'captain',
    });

    for (let i = 5; i <= 7; i++) {
      await Registration.create({
        eventId: liveHackathon._id,
        participantId: users1to10[i]._id, // user6, user7, user8
        ticketCode: generateTicketCode('hackathon'),
        status: 'confirmed',
        registeredAt: addHours(now, -23),
        teamName: 'Team Beta',
        isCaptain: false,
        roleInTeam: 'player',
        captainRegistrationId: regBetaCaptain._id,
      });

      await TeamInvite.create({
        eventId: liveHackathon._id,
        registrationId: regBetaCaptain._id,
        teamName: 'Team Beta',
        captainId: users1to10[4]._id,
        captainName: users1to10[4].name,
        invitedUserId: users1to10[i]._id,
        invitedEmail: users1to10[i].email,
        invitedName: users1to10[i].name,
        role: 'player',
        status: 'accepted',
        respondedAt: addHours(now, -23),
      });
    }
    // Team Beta has NOT submitted yet: ready for evaluator testing!
    console.log('[Seed] Registered Team Beta (4/4 members confirmed, Ready to Submit)');

    // =========================================================================
    // EVENT 2: Hackathon that has already ended (1 submitted, 1 did not submit)
    // =========================================================================
    const endedHackathon = await Event.create({
      title: 'Decentralized Infrastructure & Systems Hackathon (Concluded)',
      description: 'A 72-hour engineering challenge focused on distributed systems, replicated state machines, and Byzantine fault-tolerant protocols. This event has concluded.',
      category: 'hackathon',
      mode: 'online',
      onlineLink: 'https://meet.google.com/abc-defg-hij',
      capacity: 10,
      startAt: addDays(now, -3),
      endAt: addDays(now, -1), // Ended 1 day ago!
      registrationDeadline: addDays(now, -4),
      organizerId: organizer._id,
      status: 'published',
      resultsPublished: false,
      hackathonConfig: {
        teamMode: 'solo',
        teamSize: 1,
        requiredMembers: 1,
        maxTeams: 10,
      },
    });
    console.log(`[Seed] Created Concluded Hackathon: "${endedHackathon.title}"`);

    // Participant 9 (user9) registered and SUBMITTED
    const regU9 = await Registration.create({
      eventId: endedHackathon._id,
      participantId: users1to10[8]._id,
      ticketCode: generateTicketCode('hackathon'),
      status: 'confirmed',
      registeredAt: addDays(now, -4),
      isCaptain: false,
      roleInTeam: 'solo',
    });

    await Submission.create({
      eventId: endedHackathon._id,
      participantId: users1to10[8]._id,
      ticketCode: regU9.ticketCode,
      projectName: 'Distributed Consensus Key-Value Store',
      tagline: 'Fault-tolerant replicated log engine with Raft consensus',
      description: 'High-throughput replicated log storage engine featuring leader election, log compaction, snapshot distribution, and linearizable reads.',
      githubUrl: 'https://github.com/EventPilot/distributed-kv',
      deployedUrl: 'https://eventpilot-e4wb.onrender.com',
      demoVideoUrl: 'N/A',
      score: 93.5,
      feedback: 'Exceptional systems architecture and concurrency test coverage. Very impressive submission!',
      status: 'evaluated',
      evaluatedAt: addHours(now, -12),
    });
    console.log('[Seed] Registered user9@gmail.com with evaluated submission (93.5/100)');

    // Participant 10 (user10) registered but DID NOT SUBMIT
    await Registration.create({
      eventId: endedHackathon._id,
      participantId: users1to10[9]._id,
      ticketCode: generateTicketCode('hackathon'),
      status: 'confirmed',
      registeredAt: addDays(now, -4),
      isCaptain: false,
      roleInTeam: 'solo',
    });
    console.log('[Seed] Registered user10@gmail.com (Did NOT submit project)');

    // =========================================================================
    // EVENT 3: Cricket Event (1 v 1 Championship Match with 15 Players)
    // =========================================================================
    const cricketEvent = await Event.create({
      title: 'Premier Cricket Championship 2026 - 1v1 Final',
      description: 'The Grand Championship Final between two premier cricket clubs. Captain registers the 15-player squad (Playing XI + 4 reserves) for the championship trophy.',
      category: 'sports',
      mode: 'in-person',
      venue: 'Lord\'s Varsity Cricket Ground, Main Oval',
      capacity: 2, // 2 Teams (1 v 1 Match)
      startAt: addDays(now, 2),
      endAt: addDays(now, 4),
      registrationDeadline: addDays(now, 1),
      organizerId: organizer._id,
      status: 'published',
      sportsData: {
        sportType: 'cricket',
        tournamentFormat: 'knockout_2',
        maxTeams: 2,
        matches: [
          {
            round: 'Grand Championship Final',
            teamA: 'Thunder Strikers XI',
            teamB: 'Royal Challengers XI',
            scoreA: '-',
            scoreB: '-',
            status: 'scheduled',
            winner: '',
            matchDate: 'Sun, Nov 1, 2026 - Lord\'s Main Oval',
          },
        ],
        standings: [
          { teamName: 'Thunder Strikers XI', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
          { teamName: 'Royal Challengers XI', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
        ],
      },
    });
    console.log(`[Seed] Created Cricket 1v1 Final Event: "${cricketEvent.title}"`);

    // Register Team 1: "Thunder Strikers XI" with Captain (player1) and 14 Squad Players (player2 to player15)
    const regCricketCaptain = await Registration.create({
      eventId: cricketEvent._id,
      participantId: cricketPlayers[0]._id, // player1
      ticketCode: generateTicketCode('sports'),
      status: 'confirmed',
      registeredAt: addHours(now, -10),
      teamName: 'Thunder Strikers XI',
      squadSize: 15,
      isCaptain: true,
      roleInTeam: 'captain',
    });

    for (let i = 1; i <= 14; i++) {
      await Registration.create({
        eventId: cricketEvent._id,
        participantId: cricketPlayers[i]._id, // player2 to player15
        ticketCode: generateTicketCode('sports'),
        status: 'confirmed',
        registeredAt: addHours(now, -9),
        teamName: 'Thunder Strikers XI',
        isCaptain: false,
        roleInTeam: 'player',
        captainRegistrationId: regCricketCaptain._id,
      });

      await TeamInvite.create({
        eventId: cricketEvent._id,
        registrationId: regCricketCaptain._id,
        teamName: 'Thunder Strikers XI',
        captainId: cricketPlayers[0]._id,
        captainName: cricketPlayers[0].name,
        invitedUserId: cricketPlayers[i]._id,
        invitedEmail: cricketPlayers[i].email,
        invitedName: cricketPlayers[i].name,
        role: 'player',
        status: 'accepted',
        respondedAt: addHours(now, -9),
      });
    }
    console.log('[Seed] Registered Thunder Strikers XI: player1 (Captain) + 14 Players (player2..player15) = 15 Squad Total');

    console.log('\n======================================================');
    console.log(' DATABASE RESET & SEEDING COMPLETED WITH ZERO ERRORS');
    console.log('======================================================');
    console.log('1. Organisers:');
    console.log('   - organiser1@gmail.com / organiser1@');
    console.log('   - organiser@gmail.com  / organiser@');
    console.log('2. Fresh Evaluator Users:');
    console.log('   - guest.evaluator@gmail.com / guest@');
    console.log('   - newuser@gmail.com         / newuser@');
    console.log('3. Participants User 1 to 10:');
    console.log('   - user1@gmail.com .. user10@gmail.com (pass: user1@ .. user10@)');
    console.log('4. Cricket Players 1 to 15:');
    console.log('   - player1@gmail.com .. player15@gmail.com (pass: player1@ .. player15@)');
    console.log('5. Events:');
    console.log('   - Live Hackathon (Ends in 1 hr, 2 teams of 4, Team Alpha submitted, Team Beta ready)');
    console.log('   - Concluded Hackathon (Ended 1 day ago, user9 submitted 93.5/100, user10 did not submit)');
    console.log('   - Cricket 1v1 Final (Thunder Strikers XI with 15 players vs Royal Challengers XI)');
    console.log('======================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('[Reset Error]', err);
    process.exit(1);
  }
};

run();
