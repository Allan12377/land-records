import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { isDatabaseReady } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!(await isDatabaseReady())) return Response.json({ error: "Database is not available. Start PostgreSQL and apply the setup steps in the README." }, { status: 503 });
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user.role?.split(",").includes("admin")) {
    return Response.json({ error: "Administrator sign-in required." }, { status: 401 });
  }
  const user = { id: session.user.id, name: session.user.name, email: session.user.email, twoFactorEnabled: session.user.twoFactorEnabled };
  if (!user.twoFactorEnabled && new URL(request.url).searchParams.get("setup") !== "1") {
    return Response.json({ error: "Authenticator enrollment is required.", code: "TWO_FACTOR_REQUIRED" }, { status: 403 });
  }
  return Response.json({ user });
}