import { drizzle } from 'drizzle-orm/node-postgres';
import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import { eq, and, or, inArray, ilike, gt, isNull, sql } from 'drizzle-orm';
import { Pool } from 'pg';
import 'dotenv/config';

// Export all database-related types and functions
export { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb };
export { eq, and, or, inArray, ilike, gt, isNull, sql };
export type { InferSelectModel, InferInsertModel };

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

export const initDatabase = async () => {
  try {
    // Test the connection with a simple query
    await pool.query('SELECT 1');
    console.info('✅ PostgreSQL connection via Supabase successful (Pooler)');
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection via Supabase failed:', error);
    throw error;
  }
}; 

// Create a new Drizzle instance
export const db = drizzle(pool);