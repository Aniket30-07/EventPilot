import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import express from 'express';
import { seedOrganizer } from '../controllers/authController.js';
import User from '../models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const logPass = (title) => console.log(`\x1b[32m✔ PASS:\x1b[0m ${title}`);
const logFail = (title, details) => {
  console.error(`\x1b[31m✖ FAIL:\x1b[0m ${title}`, details || '');
  process.exitCode = 1;
};

const runTests = async () => {
  console.log('--- STARTING SECURITY FIXES VERIFICATION ---');

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas for state verification');

  // Set up a mock express app to test seedOrganizer endpoint with different NODE_ENV values
  const app = express();
  app.use(express.json());
  app.post('/seed-test', seedOrganizer);

  const server = app.listen(5099);
  const TEST_URL = 'http://localhost:5099/seed-test';

  try {
    // 1. Test Production Rejection & DB Integrity Check
    process.env.NODE_ENV = 'production';

    // Count users before
    const initialUserCount = await User.countDocuments();
    const organizerBefore = await User.findOne({ email: 'organizer@eventpilot.dev' }).lean();

    const prodRes = await fetch(TEST_URL, { method: 'POST' });
    const prodData = await prodRes.json();

    if (prodRes.status === 403 && prodData.success === false) {
      logPass('Production-mode seeding rejected with HTTP 403 Forbidden');
    } else {
      logFail('Production-mode seeding was NOT rejected with 403', { status: prodRes.status, prodData });
    }

    // Verify DB was NOT modified
    const postUserCount = await User.countDocuments();
    const organizerAfter = await User.findOne({ email: 'organizer@eventpilot.dev' }).lean();

    if (
      initialUserCount === postUserCount &&
      JSON.stringify(organizerBefore?.updatedAt) === JSON.stringify(organizerAfter?.updatedAt) &&
      organizerBefore?.passwordHash === organizerAfter?.passwordHash
    ) {
      logPass('Database was NOT modified when production seeding was rejected');
    } else {
      logFail('Database state changed during rejected production seed attempt');
    }

    // 2. Test Staging Rejection
    process.env.NODE_ENV = 'staging';
    const stagingRes = await fetch(TEST_URL, { method: 'POST' });
    const stagingData = await stagingRes.json();

    if (stagingRes.status === 403 && stagingData.success === false) {
      logPass('Staging-mode seeding rejected with HTTP 403 Forbidden by default');
    } else {
      logFail('Staging-mode seeding was NOT rejected with 403', { status: stagingRes.status, stagingData });
    }

    // 3. Test Local Development Seeding
    process.env.NODE_ENV = 'development';
    const devRes = await fetch(TEST_URL, { method: 'POST' });
    const devData = await devRes.json();

    if (devRes.status === 200 && devData.success === true && devData.credentials.email === 'organizer@eventpilot.dev') {
      logPass('Local development mode seeding succeeds with HTTP 200');
    } else {
      logFail('Development-mode seeding failed', { status: devRes.status, devData });
    }

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('--- SECURITY FIXES VERIFICATION FINISHED ---');
};

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
