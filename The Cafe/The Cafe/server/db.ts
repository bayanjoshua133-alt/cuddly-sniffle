import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

// Configure Neon to use WebSocket
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL environment variable is required.\n" +
    "Get a free PostgreSQL database at https://neon.tech\n" +
    "Then add DATABASE_URL to your Render environment variables."
  );
}

// Create a connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Create drizzle instance
export const db = drizzle(pool);

// Compatibility exports for code that uses these
export const sql = {
  exec: () => { console.warn("sql.exec not supported in PostgreSQL mode"); },
  prepare: () => { console.warn("sql.prepare not supported in PostgreSQL mode"); },
  close: () => pool.end(),
};

export function recreateConnection(): void {
  console.log('ℹ️  Using Neon PostgreSQL - connection is managed automatically');
}

export const dbPath = '';
