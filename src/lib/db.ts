import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { registryPool?: Pool };

export const pool =
  globalForPg.registryPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 12,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPg.registryPool = pool;
}

pool.on("error", (error) => {
  console.error("PostgreSQL pool error", error.name);
});

export function hasDatabaseConfig() {
  return Boolean(process.env.DATABASE_URL);
}