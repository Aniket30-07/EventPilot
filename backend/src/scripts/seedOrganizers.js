// Controlled organizer provisioning (the ONLY way to create organizers).
//   npm run seed:organizers                       -> creates 3 demo organizers
//   npm run seed:organizers -- "Name" a@b.com Pw  -> creates/promotes one specific organizer
import '../config/env.js';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const DEMO = [
  { name: 'Organizer One', email: 'organizer1@eventpilot.dev' },
  { name: 'Organizer Two', email: 'organizer2@eventpilot.dev' },
  { name: 'Organizer Three', email: 'organizer3@eventpilot.dev' },
];

const upsertOrganizer = async ({ name, email, password }) => {
  email = email.toLowerCase().trim();
  if (password.length < 8) throw new Error(`Password for ${email} must be at least 8 characters.`);
  const existing = await User.findOne({ email });
  if (existing) {
    existing.role = 'organizer';
    existing.name = name;
    existing.passwordHash = await User.hashPassword(password);
    await existing.save();
    return 'updated';
  }
  await User.create({ name, email, role: 'organizer', passwordHash: await User.hashPassword(password) });
  return 'created';
};

try {
  await connectDB();
  const [nameArg, emailArg, passArg] = process.argv.slice(2);

  let accounts;
  if (nameArg || emailArg || passArg) {
    if (!nameArg || !emailArg || !passArg) throw new Error('Usage: npm run seed:organizers -- "Name" email password');
    accounts = [{ name: nameArg, email: emailArg, password: passArg }];
  } else {
    const password = process.env.SEED_ORGANIZER_PASSWORD;
    if (!password) throw new Error('Set SEED_ORGANIZER_PASSWORD in backend/.env (min 8 chars) to seed the demo organizers.');
    accounts = DEMO.map((d) => ({ ...d, password }));
  }

  for (const a of accounts) console.log(`[Seed] ${a.email}: ${await upsertOrganizer(a)}`);
} catch (err) {
  console.error('[Seed] Failed:', err.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
