import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { connectDB } from '../config/db.js';
import User from '../models/User.js';

const seed = async () => {
  try {
    const conn = await connectDB();
    console.log('[Seed] Connected to database.');

    const defaultEmail = (process.env.DEFAULT_ORGANIZER_EMAIL || 'organizer@eventpilot.dev').toLowerCase().trim();
    const defaultPassword = process.env.DEFAULT_ORGANIZER_PASSWORD || 'OrganizerPass123!';
    const defaultName = process.env.DEFAULT_ORGANIZER_NAME || 'Demo Organizer';

    let user = await User.findOne({ email: defaultEmail });
    const passwordHash = await User.hashPassword(defaultPassword);

    if (user) {
      user.name = defaultName;
      user.role = 'organizer';
      user.passwordHash = passwordHash;
      await user.save();
      console.log(`[Seed] Existing user '${defaultEmail}' successfully updated to Organizer role.`);
    } else {
      user = await User.create({
        name: defaultName,
        email: defaultEmail,
        passwordHash,
        role: 'organizer',
      });
      console.log(`[Seed] Created new Organizer user '${defaultEmail}'.`);
    }

    console.log('----------------------------------------------------');
    console.log('ORGANIZER CREDENTIALS:');
    console.log(`Email:    ${defaultEmail}`);
    console.log(`Password: ${defaultPassword}`);
    console.log(`Role:     ${user.role}`);
    console.log('----------------------------------------------------');

    await conn.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error.message);
    process.exit(1);
  }
};

seed();
