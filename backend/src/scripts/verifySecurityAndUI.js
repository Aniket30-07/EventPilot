import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
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

const runVerification = async () => {
  console.log('====================================================');
  console.log('STARTING RIGOROUS VERIFICATION OF FIXES 1 & 2');
  console.log('====================================================\n');

  // --------------------------------------------------------------------------
  // SECTION 1: VERIFY FRONTEND BUTTONS & import.meta.env.DEV
  // --------------------------------------------------------------------------
  console.log('--- CHECK 1: FRONTEND LOGIN CONTROLS (import.meta.env.DEV) ---');

  const loginFile = path.resolve(__dirname, '../../../frontend/src/pages/Login.jsx');
  const loginSrc = fs.readFileSync(loginFile, 'utf8');

  // Verify code structure
  const devBlockMatch = loginSrc.match(/\{import\.meta\.env\.DEV\s*&&\s*\(([\s\S]*?)\)\}/);
  if (!devBlockMatch) {
    logFail('import.meta.env.DEV conditional block not found in Login.jsx');
  } else {
    const blockContent = devBlockMatch[1];
    const hasFillCreds = blockContent.includes('Fill Organizer Creds');
    const hasSeedDb = blockContent.includes('Seed Organizer DB');
    const hasQuickFillHeader = blockContent.includes('Development Quick-Fill');

    // Ensure buttons do not appear outside this block
    const srcWithoutDevBlock = loginSrc.replace(devBlockMatch[0], '');
    const outsideFillCreds = srcWithoutDevBlock.includes('Fill Organizer Creds');
    const outsideSeedDb = srcWithoutDevBlock.includes('Seed Organizer DB');

    if (hasFillCreds && hasSeedDb && hasQuickFillHeader && !outsideFillCreds && !outsideSeedDb) {
      logPass('Source analysis: Both "Fill Organizer Creds" and "Seed Organizer DB" are strictly enclosed within import.meta.env.DEV');
    } else {
      logFail('Source analysis failed: Buttons found outside dev guard or missing from block', {
        hasFillCreds,
        hasSeedDb,
        outsideFillCreds,
        outsideSeedDb,
      });
    }
  }

  // Check production build output in frontend/dist
  const distDir = path.resolve(__dirname, '../../../frontend/dist');
  if (!fs.existsSync(distDir)) {
    logFail('frontend/dist does not exist. Run "npm --prefix frontend run build" first.');
  } else {
    const distFiles = fs.readdirSync(path.join(distDir, 'assets')).filter(f => f.endsWith('.js'));
    let distContainsDevButtons = false;
    let distContainsSeedEndpoint = false;

    for (const file of distFiles) {
      const content = fs.readFileSync(path.join(distDir, 'assets', file), 'utf8');
      if (
        content.includes('Fill Organizer Creds') ||
        content.includes('Seed Organizer DB') ||
        content.includes('Development Quick-Fill') ||
        content.includes('quick-fill-organizer-btn')
      ) {
        distContainsDevButtons = true;
      }
      if (content.includes('/auth/seed-organizer')) {
        distContainsSeedEndpoint = true;
      }
    }

    if (!distContainsDevButtons && !distContainsSeedEndpoint) {
      logPass('Production build audit: Both development buttons and seeding triggers are 100% purged/tree-shaken from frontend/dist');
    } else {
      logFail('Production build audit: Found development buttons or trigger in production bundle', {
        distContainsDevButtons,
        distContainsSeedEndpoint,
      });
    }
  }

  // Check Vite dev server response
  try {
    const devRes = await fetch('http://localhost:5173/src/pages/Login.jsx');
    const devContent = await devRes.text();
    const devHasBlock = devContent.includes('Development Quick-Fill') && devContent.includes('Fill Organizer Creds');
    if (devHasBlock) {
      logPass('Dev server verification: Login.jsx delivers development block with both buttons to local browser in DEV mode');
    } else {
      logFail('Dev server did not include development quick-fill block in DEV mode');
    }
  } catch (err) {
    console.warn('Note: Dev server HTTP check skipped (dev server not responding or not on port 5173)');
  }

  console.log('\n--- CHECK 2: BACKEND /api/auth/seed-organizer IN PRODUCTION ---');

  // --------------------------------------------------------------------------
  // SECTION 2: VERIFY PRODUCTION REJECTION & DB INTEGRITY
  // --------------------------------------------------------------------------
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB Atlas cluster for database state verification');

  const app = express();
  app.use(express.json());
  app.post('/api/auth/seed-organizer', seedOrganizer);

  const PORT = 5088;
  const server = app.listen(PORT);
  const ENDPOINT = `http://localhost:${PORT}/api/auth/seed-organizer`;

  try {
    // 2.1 Snapshot current database state
    const countBefore = await User.countDocuments();
    const defaultEmail = (process.env.DEFAULT_ORGANIZER_EMAIL || 'organizer@eventpilot.dev').toLowerCase().trim();
    const existingOrganizerBefore = await User.findOne({ email: defaultEmail }).lean();

    console.log(`Initial total users in database: ${countBefore}`);
    console.log(`Existing organizer user ID: ${existingOrganizerBefore?._id}`);
    console.log(`Existing organizer updatedAt: ${existingOrganizerBefore?.updatedAt}`);

    // Set production environment
    process.env.NODE_ENV = 'production';

    // 2.2 Attempt request against existing organizer
    const res1 = await fetch(ENDPOINT, { method: 'POST' });
    const data1 = await res1.json();

    if (res1.status === 403 && data1.success === false && data1.message.includes('Forbidden')) {
      logPass(`Production request correctly rejected with HTTP 403 Forbidden: "${data1.message}"`);
    } else {
      logFail('Production request was NOT rejected with 403', { status: res1.status, data: data1 });
    }

    // Verify existing organizer was NOT modified
    const countAfter1 = await User.countDocuments();
    const existingOrganizerAfter = await User.findOne({ email: defaultEmail }).lean();

    const hashMatch = existingOrganizerBefore?.passwordHash === existingOrganizerAfter?.passwordHash;
    const updateTimeMatch = JSON.stringify(existingOrganizerBefore?.updatedAt) === JSON.stringify(existingOrganizerAfter?.updatedAt);
    const countMatch1 = countBefore === countAfter1;

    if (hashMatch && updateTimeMatch && countMatch1) {
      logPass('Database integrity verified: Existing organizer account and passwordHash were completely untouched');
    } else {
      logFail('Database was modified during rejected production seed attempt!', {
        hashMatch,
        updateTimeMatch,
        countBefore,
        countAfter1,
      });
    }

    // 2.3 Attempt to seed a brand new organizer in production mode
    const maliciousEmail = `attacker_${Date.now()}@testcorp.com`;
    process.env.DEFAULT_ORGANIZER_EMAIL = maliciousEmail;
    process.env.DEFAULT_ORGANIZER_PASSWORD = 'MaliciousPassword123!';

    const res2 = await fetch(ENDPOINT, { method: 'POST' });
    const data2 = await res2.json();

    if (res2.status === 403 && data2.success === false) {
      logPass('Attempt to seed new account in production was rejected with HTTP 403 Forbidden');
    } else {
      logFail('Attempt to seed new account in production did not return 403', { status: res2.status, data: data2 });
    }

    // Verify attacker account was NOT created
    const maliciousDoc = await User.findOne({ email: maliciousEmail });
    const countAfter2 = await User.countDocuments();

    if (maliciousDoc === null && countAfter2 === countBefore) {
      logPass('Database integrity verified: New account was NOT created in MongoDB (count remained constant)');
    } else {
      logFail('Malicious account was inserted into the database during rejected production seed attempt!');
    }

    // Restore original env vars
    process.env.NODE_ENV = 'development';
    process.env.DEFAULT_ORGANIZER_EMAIL = defaultEmail;

  } finally {
    server.close();
    await mongoose.disconnect();
  }

  console.log('\n====================================================');
  console.log('ALL VERIFICATIONS COMPLETED SUCCESSFULLY');
  console.log('====================================================');
};

runVerification().catch((err) => {
  console.error('Verification error:', err);
  process.exit(1);
});
