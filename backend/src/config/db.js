import dns from 'node:dns';
import mongoose from 'mongoose';

export const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  if (mongoUri.startsWith('mongodb+srv://')) {
    const configuredServers = process.env.MONGODB_DNS_SERVERS
      ?.split(',')
      .map((server) => server.trim())
      .filter(Boolean);
    dns.setServers(configuredServers?.length ? configuredServers : ['1.1.1.1', '1.0.0.1']);
  }

  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected successfully to host: ${conn.connection.host}, database: ${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
};
