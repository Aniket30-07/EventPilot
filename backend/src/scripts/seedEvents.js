import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Event from '../models/Event.js';

const seedEvents = async () => {
  try {
    const conn = await connectDB();
    console.log('[Seed Events] Connected to database.');

    const organizerEmail = (process.env.DEFAULT_ORGANIZER_EMAIL || 'organizer@eventpilot.dev').toLowerCase().trim();
    let organizer = await User.findOne({ email: organizerEmail });

    if (!organizer) {
      const passwordHash = await User.hashPassword('OrganizerPass123!');
      organizer = await User.create({
        name: 'EventPilot Organizer',
        email: organizerEmail,
        passwordHash,
        role: 'organizer',
      });
      console.log('[Seed Events] Created demo organizer account.');
    }

    // Clean existing seed events by this organizer
    await Event.deleteMany({ organizerId: organizer._id });

    const now = new Date();
    const day = 24 * 60 * 60 * 1000;

    const demoEvents = [
      {
        title: 'Global AI Agents Hackathon 2026',
        description: 'Compete with 500+ builders worldwide to develop autonomous coding and research agents using cutting-edge foundation models.',
        category: 'hackathon',
        startAt: new Date(now.getTime() + 10 * day),
        endAt: new Date(now.getTime() + 12 * day),
        mode: 'online',
        onlineLink: 'https://meet.eventpilot.dev/ai-hackathon',
        capacity: 250,
        registrationDeadline: new Date(now.getTime() + 8 * day),
        organizerId: organizer._id,
        status: 'published',
      },
      {
        title: 'Modern Web Engineering Conference 2026',
        description: 'Annual flagship engineering summit covering fullstack architectures, React 19, Node 24, high-throughput databases, and microfrontends.',
        category: 'conference',
        startAt: new Date(now.getTime() + 15 * day),
        endAt: new Date(now.getTime() + 16 * day),
        mode: 'in-person',
        venue: 'Grand Tech Convention Center, Hall B, San Francisco, CA',
        capacity: 400,
        registrationDeadline: new Date(now.getTime() + 13 * day),
        organizerId: organizer._id,
        status: 'published',
      },
      {
        title: 'Hands-on Distributed Systems Bootcamp',
        description: 'Intensive 3-day deep dive into distributed consensus (Raft, Paxos), sharded databases, and event-driven microservices.',
        category: 'workshop',
        startAt: new Date(now.getTime() + 20 * day),
        endAt: new Date(now.getTime() + 23 * day),
        mode: 'online',
        onlineLink: 'https://workshop.eventpilot.dev/distributed-systems',
        capacity: 60,
        registrationDeadline: new Date(now.getTime() + 18 * day),
        organizerId: organizer._id,
        status: 'published',
      },
      {
        title: 'National Collegiate Chess Championship',
        description: 'Rapid and Blitz classical tournament for collegiate players. 9 rounds Swiss system with cash prizes and trophies.',
        category: 'sports',
        startAt: new Date(now.getTime() + 25 * day),
        endAt: new Date(now.getTime() + 27 * day),
        mode: 'in-person',
        venue: 'University Arena, East Pavilion',
        capacity: 128,
        registrationDeadline: new Date(now.getTime() + 22 * day),
        organizerId: organizer._id,
        status: 'published',
      },
      {
        title: 'Draft: Winter Indie Film & Culture Festival',
        description: 'Screening independent short films, documentary premieres, and community storytelling workshops.',
        category: 'festival',
        startAt: new Date(now.getTime() + 35 * day),
        endAt: new Date(now.getTime() + 38 * day),
        mode: 'in-person',
        venue: 'Riverside Amphitheater',
        capacity: 300,
        registrationDeadline: new Date(now.getTime() + 30 * day),
        organizerId: organizer._id,
        status: 'draft',
      },
    ];

    const inserted = await Event.insertMany(demoEvents);
    console.log(`[Seed Events] Successfully inserted ${inserted.length} demo events (4 published, 1 draft).`);

    await conn.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Events Error]:', error.message);
    process.exit(1);
  }
};

seedEvents();
