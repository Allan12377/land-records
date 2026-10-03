import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import { dirname, delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFile, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import dotenv from "dotenv";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: join(root, ".env.local") });

const isWindows = process.platform === "win32";
const suffix = isWindows ? ".exe" : "";
const defaultBin = isWindows ? "C:\\Program Files\\PostgreSQL\\18\\bin" : "/usr/bin";
const binDirectory = process.env.PG_BIN_DIR || defaultBin;
const binary = (name) => join(binDirectory, `${name}${suffix}`);
const dataDirectory = join(root, ".local-postgres");
const environmentFile = join(root, ".env.local");
const port = Number(process.env.POSTGRES_PORT || 5433);
const password = process.env.POSTGRES_PASSWORD;
const mode = process.argv[2];

if (!password) {
  console.error("Run npm run setup:env before starting the local database.");
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    stdio: options.stdio ?? "inherit",
    env: { ...process.env, ...options.env, PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}` },
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${command} exited with status ${result.status ?? "unknown"}.`);
  }
  return result;
}

function runDetached(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      env: { ...process.env, PATH: `${binDirectory}${delimiter}${process.env.PATH ?? ""}` },
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with status ${code ?? "unknown"}.`));
    });
  });
}

async function configureConnection() {
  const contents = await readFile(environmentFile, "utf8");
  const url = new URL(process.env.DATABASE_URL);
  url.port = String(port);
  const updated = contents
    .replace(/^POSTGRES_PORT=.*$/m, `POSTGRES_PORT=${port}`)
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${url.toString()}`);
  await writeFile(environmentFile, updated, { mode: 0o600 });
}

async function start() {
  await configureConnection();
  const status = run(binary("pg_ctl"), ["-D", dataDirectory, "status"], { stdio: "ignore", allowFailure: true });
  if (status.status === 0) {
    console.log(`Project PostgreSQL is already running on port ${port}.`);
    return;
  }

  try {
    await readFile(join(dataDirectory, "PG_VERSION"), "utf8");
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const temporaryDirectory = await mkdtemp(join(tmpdir(), "groundwork-pg-"));
    const passwordFile = join(temporaryDirectory, `password-${randomBytes(6).toString("hex")}.txt`);
    try {
      await writeFile(passwordFile, `${password}\n`, { mode: 0o600 });
      run(binary("initdb"), [
        "--pgdata", dataDirectory,
        "--username", "land_registry",
        "--encoding", "UTF8",
        "--auth-local", "scram-sha-256",
        "--auth-host", "scram-sha-256",
        "--pwfile", passwordFile,
      ]);
    } finally {
      await rm(temporaryDirectory, { recursive: true, force: true });
    }
  }

  await runDetached(binary("pg_ctl"), [
    "-D", dataDirectory,
    "-l", join(root, ".local-postgres.log"),
    "-o", `-h 127.0.0.1 -p ${port}`,
    "-w", "start",
  ]);

  const childEnvironment = { PGPASSWORD: password };
  const databaseExists = run(binary("psql"), [
    "-h", "127.0.0.1", "-p", String(port), "-U", "land_registry", "-d", "postgres",
    "-tA", "-c", "SELECT 1 FROM pg_database WHERE datname = 'land_registry'",
  ], { env: childEnvironment, stdio: "pipe", allowFailure: true });
  if (databaseExists.status !== 0) throw new Error("Could not verify the local database.");
  if (databaseExists.stdout.trim() !== "1") {
    run(binary("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "land_registry", "land_registry"], { env: childEnvironment });
  }
  console.log(`Project PostgreSQL is ready on 127.0.0.1:${port}.`);
}

function stop() {
  const result = run(binary("pg_ctl"), ["-D", dataDirectory, "-m", "fast", "-w", "stop"], { allowFailure: true });
  if (result.status === 0) console.log("Project PostgreSQL stopped; its local data was preserved.");
  else console.log("Project PostgreSQL is not running.");
}

try {
  if (mode === "start") await start();
  else if (mode === "stop") stop();
  else {
    console.error("Usage: node scripts/local-postgres.mjs <start|stop>");
    process.exitCode = 2;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Local PostgreSQL could not be started.");
  if (isWindows && !process.env.PG_BIN_DIR) {
    console.error("If PostgreSQL is installed elsewhere, set PG_BIN_DIR in .env.local to its bin directory.");
  }
  process.exitCode = 1;
}