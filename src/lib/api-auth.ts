import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { hasDatabaseConfig, pool } from "@/lib/db";

export async function isDatabaseReady() {
  if (!hasDatabaseConfig()) return false;
  try {
    await pool.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function requireAdmin(request: NextRequest) {
  if (!(await isDatabaseReady())) {
    return { response: Response.json({ error: "Database is not configured." }, { status: 503 }) };
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.role?.split(",").includes("admin")) {
    return { response: Response.json({ error: "Authentication required." }, { status: 401 }) };
  }
  if (!session.user.twoFactorEnabled) {
    return { response: Response.json({ error: "Authenticator enrollment is required.", code: "TWO_FACTOR_REQUIRED" }, { status: 403 }) };
  }

  return { session };
}

export function jsonError(error: unknown) {
  if (error instanceof Error && error.name === "ZodError") {
    return Response.json({ error: "The submitted record is invalid." }, { status: 400 });
  }
  console.error("Registry request failed", error instanceof Error ? error.message : "unknown error");
  return Response.json({ error: "The request could not be completed." }, { status: 500 });
}