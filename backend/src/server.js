import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

import app from './app.js';
import { connectDB } from './config/db.js';

const PORT = process.env.PORT || 8081;

const server = app.listen(PORT, () => {
  console.log(`[EventPilot Backend] Server running at http://localhost:${PORT}`);
  console.log(`[EventPilot Backend] Health check: http://localhost:${PORT}/api/health`);
});

// Connect to MongoDB
connectDB().catch((err) => {
  console.warn(`[EventPilot Backend] Initial DB connection failed: ${err.message}`);
  console.warn('[EventPilot Backend] Waiting for valid MONGO_URI in .env...');
});

export default server;
