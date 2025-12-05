import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL environment variable is required. Get one free at https://neon.tech");
}

// Create a connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create drizzle instance
export const db = drizzle(pool);

// For compatibility with code that imports 'sql'
export const sql = {
  exec: () => { throw new Error("Direct SQL exec not supported in PostgreSQL mode. Use drizzle queries."); },
  prepare: () => { throw new Error("Direct SQL prepare not supported in PostgreSQL mode. Use drizzle queries."); },
  close: () => pool.end(),
};

// Dummy function for compatibility
export function recreateConnection(): void {
  console.log('ℹ️  Using Neon PostgreSQL - connection is managed automatically');
}

// Export db path as empty for compatibility
export const dbPath = '';
