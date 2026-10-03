import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const params = new URL(request.url).searchParams;
  const entityId = params.get("entityId");
  const limit = Math.min(Math.max(Number(params.get("limit")) || 20, 1), 100);
  try {
    const values: (string | number)[] = [];
    const filter = entityId ? `WHERE event.entity_id = $${values.push(entityId)}` : "";
    values.push(limit);
    const result = await pool.query(
      `SELECT event.action, event.entity_type, event.entity_id, event.changes, event.created_at,
              account.name AS actor_name
       FROM audit_events event
       LEFT JOIN "user" account ON account.id = event.actor_user_id
       ${filter}
       ORDER BY event.created_at DESC
       LIMIT $${values.length}`,
      values,
    );
    return Response.json({ events: result.rows });
  } catch (error) {
    return jsonError(error);
  }
}