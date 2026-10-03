import { createHmac } from "node:crypto";
import nodemailer from "nodemailer";
import { pool, hasDatabaseConfig } from "@/lib/db";

type SignInEvent = { email: string; succeeded: boolean; challenged?: boolean; request: Request };

export async function notifySignIn(event: SignInEvent) {
  if (!hasDatabaseConfig()) return;
  const secret = process.env.BETTER_AUTH_SECRET ?? "development-only-secret-change-before-deployment-000000";
  const normalizedEmail = event.email.toLowerCase();
  const emailHash = createHmac("sha256", secret).update(normalizedEmail).digest("hex");
  const action = event.challenged ? "auth.sign_in_challenged" : event.succeeded ? "auth.sign_in_succeeded" : "auth.sign_in_failed";

  try {
    await pool.query(
      `INSERT INTO audit_events (action, entity_type, changes)
       VALUES ($1, 'authentication', $2::jsonb)`,
      [action, JSON.stringify({ emailHash, userAgent: event.request.headers.get("user-agent")?.slice(0, 240) ?? null })],
    );

    const recipients = process.env.SECURITY_ALERT_TO?.split(",").map((value) => value.trim()).filter(Boolean) ?? [];
    if (!recipients.length || !process.env.SMTP_HOST || !process.env.SMTP_FROM) return;

    const throttleKey = createHmac("sha256", secret).update("registry-sign-in-alerts").digest("hex");
    const throttle = await pool.query(
      `INSERT INTO security_alert_throttles (email_hash, last_sent_at, attempt_count)
       VALUES ($1, now(), 1)
       ON CONFLICT (email_hash) DO UPDATE
         SET last_sent_at = now(), attempt_count = security_alert_throttles.attempt_count + 1
         WHERE security_alert_throttles.last_sent_at < now() - interval '5 minutes'
       RETURNING attempt_count`,
      [throttleKey],
    );
    if (!throttle.rowCount) return;

    const port = Number(process.env.SMTP_PORT ?? 587);
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 8000,
    });
    const timestamp = new Date().toISOString();
    const subject = event.challenged ? "Registry second-factor challenge" : event.succeeded ? "Registry administrator sign-in" : "Registry sign-in attempts detected";
    const outcome = event.challenged ? "A correct password reached the second-factor challenge." : event.succeeded ? "A sign-in completed successfully." : "One or more sign-in attempts were rejected or rate limited.";
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: recipients,
      subject,
      text: `${outcome}\nTime: ${timestamp}\nAccount identifier (HMAC): ${emailHash}\nBrowser: ${event.request.headers.get("user-agent")?.slice(0, 240) ?? "Unavailable"}\n\nNo registry record data is included. Alerts are grouped to one email every five minutes.`,
    });
  } catch (error) {
    console.error("Could not record or send a sign-in security alert", error instanceof Error ? error.name : "unknown error");
  }
}