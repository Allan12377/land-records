# Groundwork Uganda Land Registry

A full-stack MVP for registering people and land parcels, searching all districts, editing source-backed records, uploading person photos and title scans, and maintaining administrator and audit trails.

## Stack

- TypeScript, React 19, and Next.js App Router for the web app and API.
- PostgreSQL for accounts, people, parcels, ownership links, documents, security events, and audit history.
- Better Auth for password hashing, session cookies, admin roles, disabled public registration, rate limiting, and account provisioning.
- Private S3-compatible object storage for scans and photos. Local development uses MinIO; production storage is not selected yet.
- Nodemailer for optional, rate-limited security-email alerts. SMTP is not configured until the organization chooses a provider.

## Local development

Prerequisites: Node.js 24 or newer, npm, and PostgreSQL 18 tools (`initdb`, `pg_ctl`, `psql`, and `createdb`). The checked-in local default is `C:\Program Files\PostgreSQL\18\bin`; set `PG_BIN_DIR` in `.env.local` if yours differs. Docker Desktop is optional and is only used here for MinIO document storage.

1. From this project directory, run `npm install`.
2. Run `npm run setup:env`. This creates a git-ignored `.env.local` with random local-development secrets. It will not overwrite an existing file.
3. Start the project-owned database with `npm run db:start`. It creates `.local-postgres/` and binds only to `127.0.0.1:5433`; the existing Windows PostgreSQL service is not modified.
4. Apply Better Auth's account, admin, and two-factor schema with `npm run db:auth-migrate`.
5. Apply registry tables with `npm run db:migrate`.
6. Optionally start private local object storage with `docker compose --env-file .env.local up -d minio minio-init`. Docker Desktop must be running for image and title uploads.
7. Create the five named administrator accounts. For each person, run `npm run db:create-admin -- --email admin@example.org --name "Full Name" --role admin`. The CLI prompts for the password. Do not put passwords in shell history or share accounts.
8. To seed one demo set of ~500 land records for UI testing or presentation, run `npm run db:seed:fake-data`. The script inserts demo people, parcels, ownership links, and a handful of sample documents tagged with `DEMO-` source books so they are easy to identify and delete later.
9. Start the web app with `npm run dev`, then open `http://localhost:3000`.
10. Each administrator signs in and enrolls an authenticator app using the on-screen QR code, then saves their single-use backup codes privately. Registry access is blocked until enrollment is verified.

MinIO's private bucket is initialized with public access disabled and browser CORS limited to `http://localhost:3000`. Local service ports bind to loopback only. For a deployed domain, configure the chosen S3 provider's bucket CORS to allow only that HTTPS application origin and the required `PUT`, `GET`, and `HEAD` methods.

## Vercel demo deployment

The Next.js app can run on Vercel, but its database and document storage must be hosted separately. For a small demo, Neon PostgreSQL and a private Cloudflare R2 bucket are supported. Do not use the local `.local-postgres/` database or `.local-storage/` files for a deployment; Vercel's local filesystem is not persistent.

1. Import this GitHub repository into Vercel and select the production branch.
2. Create a Neon database and a private R2 bucket. Create R2 access keys limited to that bucket.
3. Add these values to the Vercel project's Production environment variables. Use the stable `https://<project>.vercel.app` URL for both application URL variables:
   - `DATABASE_URL`: Neon PostgreSQL connection string.
   - `BETTER_AUTH_SECRET`: a new, randomly generated secret used only for production.
   - `BETTER_AUTH_URL` and `APP_URL`: the stable HTTPS Vercel URL.
   - `S3_ENDPOINT`: `https://<account-id>.r2.cloudflarestorage.com`.
   - `S3_REGION`: `auto`.
   - `S3_BUCKET`: the private R2 bucket name.
   - `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: the bucket-scoped R2 credentials.
   - `S3_FORCE_PATH_STYLE`: `true`.
4. Set the R2 bucket's CORS policy to allow the stable Vercel origin, methods `PUT`, `GET`, and `HEAD`, and the headers required by the signed upload (at minimum `Content-Type`; allowing `*` is simpler for a demo). Keep the bucket private.
5. Deploy to Vercel. Set its `DATABASE_URL` to Neon's pooled connection string for the app runtime. From PowerShell in a local clone, temporarily set `DATABASE_URL` to Neon's direct (unpooled) connection string, plus `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, and `APP_URL`, then run `npm run db:auth-migrate` followed by `npm run db:migrate`. The registry migration uses a session-level advisory lock, so use the direct connection for migrations. These commands target the database in your current `DATABASE_URL`; verify it is the Neon database before running them. Do not commit these values or paste them into chat.
6. Create a production admin using `npm run db:create-admin -- --email "your-email" --name "Your Name" --role admin`, sign in at the deployed URL, and complete MFA enrollment. Seed fake records only if this is a demo.
7. Test login, MFA, record creation, and document upload/download on the deployed URL. Preview deployments may not match the configured trusted origin; test using the stable production URL.

Vercel environment variable changes apply to new deployments, so redeploy after changing them. Free-tier quotas and terms can change; confirm current limits with each provider. Do not load real land or personal records until legal, privacy, backup, and access-control requirements have been reviewed.

## Checks

- `npm run test` runs input-schema tests using Node's built-in test runner.
- `npm run lint` runs ESLint.
- `npx tsc --noEmit` checks TypeScript.
- `npm run build` creates the production build.

## Data model

People and parcels are separate. A person can own multiple parcels; parcel ownership is represented by a join table. A record stores the person name and optional contact/other names, title reference, region/district/county/sub-county/parish/village, area/unit, source book/page, verification status, and notes. National ID numbers, dates of birth, and photos are not mandatory; collect additional sensitive fields only after confirming a clear legal and operational need.

Documents are stored outside PostgreSQL. The database keeps document metadata and a private object key. Uploads are restricted to JPEG, PNG, WebP, or PDF and 15 MB. Admins receive a short-lived upload URL, then the server confirms the stored type and size before marking a file available. Downloads are issued through 60-second signed URLs and audited.

## Records and imports

There are no real or demo records seeded into the database. The UI must not be populated with actual paper-book data until the organization has confirmed lawful processing, access policy, backups, data location, and its incident process.

For paper books, pilot scanning and entry on a small batch first. Record the original book/page reference; retain a clear scan; transcribe names and parcel identifiers; have a second person check entries against the source; and resolve duplicates before bulk entry. OCR may assist with printed text but handwritten values need human verification. Keep immutable originals and maintain a separate corrections history.

## Security and operations

- Public account creation is disabled. Create named administrator accounts through the Better Auth CLI. Each administrator must enroll TOTP before registry access; recovery uses single-use backup codes.
- Every data API requires an authenticated admin role. Each admin can access every district as requested.
- Changes, uploads, downloads, and login attempts are written to `audit_events`. Failed or successful login emails are sent only when SMTP and `SECURITY_ALERT_TO` are configured; alerts are grouped to one email per five minutes and do not include registry details or raw login identifiers.
- `BETTER_AUTH_SECRET`, database credentials, SMTP credentials, and S3 credentials must be separate, randomly generated production secrets stored in the hosting provider's secret manager. Never deploy the local `.env.local` or example credentials.
- Require HTTPS, MFA, least-privilege database/storage credentials, managed encryption at rest, automated encrypted backups, documented retention, and a tested restore before real records are loaded. The current app does not yet include an MFA setup screen or a cloud deployment configuration.
- Choose a hosting/data region and provider only after confirming Uganda data-protection obligations and budget with the organization. No provider account, production region, SMTP sender, domain, or backup target is configured in this workspace.

## Database migration order

Always run `npm run db:auth-migrate` before `npm run db:migrate`; registry tables reference the Better Auth `user` table. The registry migration runner is transactional and tracks applied files in `registry_migrations`. Take a backup before applying later production schema changes.

## Local service controls

Stop the app with Ctrl+C, stop its PostgreSQL cluster with `npm run db:stop`, and stop MinIO with `docker compose --env-file .env.local down`. PostgreSQL data in `.local-postgres/` and MinIO data in its Docker volume are preserved. To erase local development data, stop the services first, then remove `.local-postgres/` and use `docker compose --env-file .env.local down -v`; this permanently deletes local records and uploads.