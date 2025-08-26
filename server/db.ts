import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
console.error("DATABASE_URL is not set. Make sure you have:");
  console.error("1. Provisioned a PostgreSQL database in Render");
  console.error("2. Added DATABASE_URL to your environment variables");
  console.error("3. Connected the database to your service in render.yaml");
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle({ client: pool, schema });