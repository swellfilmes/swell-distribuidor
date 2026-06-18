import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';
import { globalConfig } from '../config';

const sql = neon(globalConfig.DATABASE_URL);
export const db = drizzle(sql, { schema });
export { schema };
