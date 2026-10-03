import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  try {
    const result = await pool.query(
      "SELECT district, count(*)::int AS parcel_count FROM parcels GROUP BY district ORDER BY district",
    );
    return Response.json({ districts: result.rows });
  } catch (error) {
    return jsonError(error);
  }
}