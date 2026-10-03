import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const { Client } = pg;
const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), "..", "db", "migrations");
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("DATABASE_URL is required. Copy .env.example to .env.local and configure it first.");
  process.exit(1);
}

const client = new Client({ connectionString });

try {
  await client.connect();
  await client.query("SELECT pg_advisory_lock(724116240)");
  await client.query("CREATE TABLE IF NOT EXISTS registry_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const appliedResult = await client.query("SELECT name FROM registry_migrations");
  const applied = new Set(appliedResult.rows.map((row) => row.name));
  const migrations = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();

  for (const name of migrations) {
    if (applied.has(name)) continue;
    const sql = await readFile(join(migrationsDirectory, name), "utf8");
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO registry_migrations (name) VALUES ($1)", [name]);
      await client.query("COMMIT");
      console.log(`Applied ${name}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
  console.log("Registry database migrations are up to date.");
} catch (error) {
  console.error("Database migration failed:", error instanceof Error ? error.message : "unknown error");
  process.exitCode = 1;
} finally {
  try { await client.query("SELECT pg_advisory_unlock(724116240)"); } catch {}
  await client.end();
}