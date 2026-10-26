import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Loads backend/.env regardless of the directory the process is started from.
const dir = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dir, '../../.env') });
