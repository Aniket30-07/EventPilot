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

    // 1. Wipe all collections
    await Promise.all([
      User.deleteMany({}),
      Event.deleteMany({}),
      Registration.deleteMany({}),
      Submission.deleteMany({}),
      TeamInvite.deleteMany({}),
    ]);
    console.log('[Reset] Emptied all collections (Users, Events, Registrations, Submissions, TeamInvites).');

    // 2. Create Organiser: organiser1@gmail.com / organiser1@
    const organizer = await User.create({
      name: 'Organiser One',
      email: 'organiser1@gmail.com',
      passwordHash: await User.hashPassword('organiser1@'),
      role: 'organizer',
      emailVerified: true,
    });
    console.log(`[Seed] Created Organiser: ${organizer.email} (password: organiser1@)`);

    // 3. Create Existing Users (Participants)
    const baseUsers = [
      { name: 'User One', email: 'user1@gmail.com', pass: 'user1@' },
      { name: 'User Two', email: 'user2@gmail.com', pass: 'user2@' },
      { name: 'User Three', email: 'user3@gmail.com', pass: 'user3@' },
    ];

    const createdUsers = [];
    for (const u of baseUsers) {
      const userDoc = await User.create({
        name: u.name,
        email: u.email,
        passwordHash: await User.hashPassword(u.pass),
        role: 'participant',
        emailVerified: true,
      });
      createdUsers.push(userDoc);
      console.log(`[Seed] Created Participant: ${u.email} (password: ${u.pass})`);
    }

    // 4. Create 11 Cricket Players: player1@gmail.com .. player11@gmail.com
    const createdPlayers = [];
    for (let i = 1; i <= 11; i++) {
      const playerDoc = await User.create({
        name: `Player ${i}`,
        email: `player${i}@gmail.com`,
        passwordHash: await User.hashPassword(`player${i}@`),
        role: 'participant',
        emailVerified: true,
      });
      createdPlayers.push(playerDoc);
      console.log(`[Seed] Created Cricket Player: player${i}@gmail.com (password: player${i}@)`);
    }

    const now = new Date();
    const addHours = (d, h) => new Date(d.getTime() + h * 3600 * 1000);
    const addDays = (d, days) => new Date(d.getTime() + days * 24 * 3600 * 1000);

    // 5. Create 1 Hackathon:
    // Started 23 hours ago, ends in 1 hour (Live with 1 hour remaining!)
    const hackathon = await Event.create({
      title: 'National AI & Web3 Hackathon 2026',
      description: '48-hour continuous hackathon to build intelligent AI agents and Web3 applications. Submit your GitHub repository and live deployed link for evaluation by judges.',
      category: 'hackathon',
      mode: 'online',
      onlineLink: 'https://zoom.us/j/987654321',
      capacity: 5,
      startAt: addHours(now, -23),
      endAt: addHours(now, 1), // Has 1 hour to end!
      registrationDeadline: addHours(now, -24),
      organizerId: organizer._id,
      status: 'published',
      resultsPublished: false,
    });
    console.log(`[Seed] Created Live Hackathon: "${hackathon.title}" (Ends in 1 hour)`);

    // Register User 1 and User 2 for the Hackathon (ready to submit projects)
    const regH1 = await Registration.create({
      eventId: hackathon._id,
      participantId: createdUsers[0]._id, // user1@gmail.com
      ticketCode: generateTicketCode('hackathon'),
      status: 'confirmed',
      registeredAt: addHours(now, -24),
    });
    console.log(`[Seed] Registered user1@gmail.com for Hackathon -> Ticket: ${regH1.ticketCode}`);

    const regH2 = await Registration.create({
      eventId: hackathon._id,
      participantId: createdUsers[1]._id, // user2@gmail.com
      ticketCode: generateTicketCode('hackathon'),
      status: 'confirmed',
      registeredAt: addHours(now, -24),
    });
    console.log(`[Seed] Registered user2@gmail.com for Hackathon -> Ticket: ${regH2.ticketCode}`);

    // 6. Create 1 Cricket Tournament (Sports)
    const cricket = await Event.create({
      title: 'Inter-College Cricket Premier League 2026',
      description: 'Prestigious T20 knockout cricket championship. Captains register 11 Playing XI squads and invite squad members.',
      category: 'sports',
      mode: 'in-person',
      venue: 'Lord\'s Varsity Cricket Grounds, Main Oval',
      capacity: 4, // 4 Teams
      startAt: addDays(now, 3),
      endAt: addDays(now, 6),
      registrationDeadline: addDays(now, 2),
      organizerId: organizer._id,
      status: 'published',
      sportsData: {
        sportType: 'cricket',
        tournamentFormat: 'knockout_4',
        maxTeams: 4,
        matches: [
          { round: 'Semi-Final 1', teamA: 'Royal Strikers XI', teamB: 'Thunderbolts XI', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Sat, Nov 1, 2026' },
          { round: 'Semi-Final 2', teamA: 'Red Lions XI', teamB: 'Phoenix Strikers XI', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Sat, Nov 1, 2026' },
          { round: 'Grand Championship Final', teamA: 'Winner SF1', teamB: 'Winner SF2', scoreA: '-', scoreB: '-', status: 'scheduled', winner: '', matchDate: 'Tue, Nov 4, 2026' },
        ],
        standings: [
          { teamName: 'Royal Strikers XI', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
          { teamName: 'Thunderbolts XI', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
          { teamName: 'Red Lions XI', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
          { teamName: 'Phoenix Strikers XI', played: 0, won: 0, drawn: 0, lost: 0, points: 0, extra: '+0.00' },
        ],
      },
    });
    console.log(`[Seed] Created Cricket Event: "${cricket.title}"`);

    // 7. Create 1 Seminar / Webinar
    const seminar = await Event.create({
      title: 'Global AI & Next-Gen Cloud Architecture Seminar 2026',
      description: 'Join cloud leaders and AI researchers exploring autonomous agents, resilient distributed databases, and high-performance inference pipelines.',
      category: 'webinar',
      mode: 'in-person',
      venue: 'Metropolitan Tech Center, Hall A',
      capacity: 100,
      startAt: addDays(now, 2),
      endAt: addDays(now, 2.15),
      registrationDeadline: addDays(now, 1),
      organizerId: organizer._id,
      status: 'published',
      recap: {
        summary: '',
        keyTakeaways: [],
        recordingUrl: '',
        slidesUrl: '',
        publishedAt: null,
      },
    });
    console.log(`[Seed] Created Seminar: "${seminar.title}"`);

    // Register User 3 for Seminar
    const regS3 = await Registration.create({
      eventId: seminar._id,
      participantId: createdUsers[2]._id, // user3@gmail.com
      ticketCode: generateTicketCode('webinar'),
      status: 'confirmed',
      registeredAt: now,
    });
    console.log(`[Seed] Registered user3@gmail.com for Seminar -> Ticket: ${regS3.ticketCode}`);

    console.log('\n=============================================');
    console.log('DATABASE RESET & SEEDING COMPLETED SUCCESSFULLY!');
    console.log('Organiser: organiser1@gmail.com / organiser1@');
    console.log('Participants: user1@gmail.com (pass user1@), user2@gmail.com (user2@), user3@gmail.com (user3@)');
    console.log('Cricket Players: player1@gmail.com .. player11@gmail.com (pass player1@ .. player11@)');
    console.log('1 Hackathon (Live with 1 hr remaining, user1 & user2 registered)');
    console.log('1 Cricket Tournament (4 Teams Knockout, ready for 11 squad players)');
    console.log('1 Seminar (user3 registered)');
    console.log('=============================================');
  } catch (err) {
    console.error('[Reset Error]', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
