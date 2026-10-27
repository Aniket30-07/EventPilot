import './config/env.js';
import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 5001;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('[EventPilot] JWT_SECRET must be set in backend/.env (min 16 chars).');
  process.exit(1);
}

try {
  await connectDB();
} catch (err) {
  console.error(`[EventPilot] Cannot start without database: ${err.message}`);
  process.exit(1);
}

app.listen(PORT, () => {
  console.log(`[EventPilot] API running at http://localhost:${PORT} (health: /api/health)`);
});
