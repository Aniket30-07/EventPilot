import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';
import Registration from '../models/Registration.js';
import { generateTicketCode } from '../utils/ticketGenerator.js';

const run = async () => {
  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Demo events and accounts cannot be seeded in production.');
    }
    const demoPassword = process.env.SEED_DEMO_PASSWORD;
    if (!demoPassword || demoPassword.length < 12 || demoPassword.length > 72) {
      throw new Error('Set SEED_DEMO_PASSWORD in backend/.env (12–72 characters) before seeding demo data.');
    }
    await connectDB();

    // 1. Get or create Organizer
    let organizer = await User.findOne({ email: 'organizer1@eventpilot.dev' });
    if (!organizer) {
      organizer = await User.create({
        name: 'Organizer One',
        email: 'organizer1@eventpilot.dev',
        role: 'organizer',
        passwordHash: await User.hashPassword(demoPassword),
      });
      console.log('[Seed] Created organizer: organizer1@eventpilot.dev');
    } else {
      organizer.role = 'organizer';
      organizer.passwordHash = await User.hashPassword(demoPassword);
      await organizer.save();
    }

    // 2. Get or create Demo Participant
    let participant = await User.findOne({ email: 'participant@eventpilot.dev' });
    if (!participant) {
      participant = await User.create({
        name: 'Alex Participant',
        email: 'participant@eventpilot.dev',
        role: 'participant',
        passwordHash: await User.hashPassword(demoPassword),
      });
      console.log('[Seed] Created demo participant: participant@eventpilot.dev');
    } else {
      participant.passwordHash = await User.hashPassword(demoPassword);
      await participant.save();
    }

    // 3. Define curated events (Dates relative to Nov/Dec 2026)
    const eventDefinitions = [
      {
        title: 'Global AI & Web3 Hackathon 2026',
        description: '48-hour continuous hackathon bringing together AI engineers and Web3 builders. $50,000 in bounties, mentorship from leading AI labs, and hardware access for GPU compute.',
        category: 'hackathon',
        mode: 'in-person',
        venue: 'Metropolitan Tech Convention Center, Hall B, San Francisco, CA',
        capacity: 300,
        startAt: new Date('2026-11-15T09:00:00.000Z'),
        endAt: new Date('2026-11-17T18:00:00.000Z'),
        registrationDeadline: new Date('2026-11-14T23:59:00.000Z'),
        status: 'published',
      },
      {
        title: 'Fullstack Architecture: Scaling Node.js & React to 1M Users',
        description: 'Deep dive into microservices, Redis caching layers, event-driven message queues, and zero-downtime deployment pipelines with live Q&A and architecture teardowns.',
        category: 'webinar',
        mode: 'online',
        onlineLink: 'https://zoom.us/j/98765432101?pwd=eventpilotlive',
        capacity: 500,
        startAt: new Date('2026-11-05T17:00:00.000Z'),
        endAt: new Date('2026-11-05T19:30:00.000Z'),
        registrationDeadline: new Date('2026-11-05T16:30:00.000Z'),
        status: 'published',
      },
      {
        title: 'CodeSprint: Cloud-Native Microservices Hackathon',
        description: 'Build resilient, auto-scaling Kubernetes microservices. Teams of up to 4 will compete across real-time performance benchmarks, security audits, and developer ergonomics.',
        category: 'hackathon',
        mode: 'online',
        onlineLink: 'https://meet.google.com/abc-defg-hij',
        capacity: 200,
        startAt: new Date('2026-11-20T10:00:00.000Z'),
        endAt: new Date('2026-11-22T20:00:00.000Z'),
        registrationDeadline: new Date('2026-11-19T23:59:00.000Z'),
        status: 'published',
      },
      {
        title: 'Hands-on Rust Systems Programming Bootcamp',
        description: 'Master ownership, borrowing, async runtimes, and memory-safe systems development with real-world networking projects and kernel-level trace tooling.',
        category: 'workshop',
        mode: 'in-person',
        venue: 'Innovation Hub Labs, Room 402, Seattle, WA',
        capacity: 40,
        startAt: new Date('2026-12-02T10:00:00.000Z'),
        endAt: new Date('2026-12-02T16:00:00.000Z'),
        registrationDeadline: new Date('2026-12-01T18:00:00.000Z'),
        status: 'published',
      },
      {
        title: 'NextGen DevOps & Cloud Security Summit 2026',
        description: 'Keynotes and workshops on GitOps, eBPF observability, zero-trust architectures, and container runtime security by leading cloud architects.',
        category: 'conference',
        mode: 'in-person',
        venue: 'Austin Grand Exhibition Center, Austin, TX',
        capacity: 450,
        startAt: new Date('2026-12-10T08:30:00.000Z'),
        endAt: new Date('2026-12-11T17:00:00.000Z'),
        registrationDeadline: new Date('2026-12-09T23:59:00.000Z'),
        status: 'published',
      },
      {
        title: 'Mastering TypeScript 6 & Modern Frontend Patterns',
        description: 'Explore advanced conditional types, template literals, React Server Component patterns, and compiler performance tuning for massive frontend codebases.',
        category: 'webinar',
        mode: 'online',
        onlineLink: 'https://youtube.com/live/eventpilot_ts6_webinar',
        capacity: 1000,
        startAt: new Date('2026-11-12T14:00:00.000Z'),
        endAt: new Date('2026-11-12T15:30:00.000Z'),
        registrationDeadline: new Date('2026-11-12T13:00:00.000Z'),
        status: 'published',
      },
      {
        title: 'TechArt Interactive Showcase & Digital Creators Expo',
        description: 'Celebration of creative coding, generative music, interactive installations, and digital culture. Open to artists, coders, and enthusiasts alike.',
        category: 'festival',
        mode: 'in-person',
        venue: 'City Center Arts Pavilion, Chicago, IL',
        capacity: 600,
        startAt: new Date('2026-12-18T11:00:00.000Z'),
        endAt: new Date('2026-12-19T22:00:00.000Z'),
        registrationDeadline: new Date('2026-12-18T10:00:00.000Z'),
        status: 'published',
      },
      {
        title: 'Internal Engineering Team Hack Week 2027 (Draft)',
        description: 'Upcoming internal hack week proposal for the platform engineering team. Currently in draft planning, invisible to public exploration.',
        category: 'hackathon',
        mode: 'in-person',
        venue: 'Building 4 Cafeteria & Lounge',
        capacity: 50,
        startAt: new Date('2027-01-15T09:00:00.000Z'),
        endAt: new Date('2027-01-17T18:00:00.000Z'),
        registrationDeadline: new Date('2027-01-14T23:59:00.000Z'),
        status: 'draft',
      },
    ];

    const seededEvents = [];
    for (const def of eventDefinitions) {
      let ev = await Event.findOne({ title: def.title });
      if (!ev) {
        ev = await Event.create({
          ...def,
          organizerId: organizer._id,
        });
        console.log(`[Seed] Created event: ${ev.title} (${ev.category}, ${ev.status})`);
      } else {
        Object.assign(ev, def, { organizerId: organizer._id });
        await ev.save();
        console.log(`[Seed] Updated event: ${ev.title}`);
      }
      seededEvents.push(ev);
    }

    // 4. Seed sample registrations for the demo participant
    // Register demo participant for the first 2 events (Hackathon & Webinar)
    const eventsToRegister = seededEvents.filter((e) => e.status === 'published').slice(0, 2);
    for (const ev of eventsToRegister) {
      const existing = await Registration.findOne({ eventId: ev._id, participantId: participant._id });
      if (!existing) {
        await Registration.create({
          eventId: ev._id,
          participantId: participant._id,
          status: 'confirmed',
          ticketCode: generateTicketCode(ev.category),
          registeredAt: new Date(),
        });
        console.log(`[Seed] Registered ${participant.email} for: ${ev.title}`);
      }
    }

    console.log('\n==========================================');
    console.log(' SEED COMPLETED SUCCESSFULLY');
    console.log('==========================================');
    console.log(' Demo account password: the value configured in SEED_DEMO_PASSWORD');
    console.log(' Organizer Login:    organizer1@eventpilot.dev');
    console.log(' Participant Login:  participant@eventpilot.dev (has 2 registered tickets)');
    console.log(` Empty Dashboard:    Register any new user in UI (0 registrations)`);
    console.log(` Empty Category:     Filter by 'Sports' on discovery page (0 events)`);
    console.log('==========================================\n');
  } catch (err) {
    console.error('[Seed] Error:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
};

run();
