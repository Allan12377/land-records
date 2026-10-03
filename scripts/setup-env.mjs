import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const target = join(root, ".env.local");
const template = join(root, ".env.example");

try {
  await readFile(target, "utf8");
  console.log(".env.local already exists; leaving it unchanged.");
  process.exit(0);
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const password = randomBytes(30).toString("base64url");
const minioSecret = randomBytes(36).toString("base64url");
const authSecret = randomBytes(48).toString("base64url");
const accessKey = `gw${randomBytes(15).toString("hex")}`;
const port = 5433;
let contents = await readFile(template, "utf8");
contents = contents
  .replace("BETTER_AUTH_SECRET=generated-by-npm-run-setup-env", `BETTER_AUTH_SECRET=${authSecret}`)
  .replace("POSTGRES_PASSWORD=generated-by-npm-run-setup-env", `POSTGRES_PASSWORD=${password}`)
  .replace("POSTGRES_PORT=5433", `POSTGRES_PORT=${port}`)
  .replace("DATABASE_URL=generated-by-npm-run-setup-env", `DATABASE_URL=postgresql://land_registry:${password}@localhost:${port}/land_registry`)
  .replace("S3_ACCESS_KEY_ID=generated-by-npm-run-setup-env", `S3_ACCESS_KEY_ID=${accessKey}`)
  .replace("S3_SECRET_ACCESS_KEY=generated-by-npm-run-setup-env", `S3_SECRET_ACCESS_KEY=${minioSecret}`);
await writeFile(target, contents, { flag: "wx", mode: 0o600 });
console.log("Created .env.local with random local-development secrets.");
console.log("This file is git-ignored. Never reuse these local credentials in production.");