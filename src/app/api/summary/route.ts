import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  try {
    const result = await pool.query(
      `SELECT (SELECT count(*)::int FROM people) AS people_count,
              (SELECT count(*)::int FROM parcels) AS parcel_count,
              (SELECT count(*)::int FROM parcels WHERE verification_status = 'verified') AS verified_count,
              (SELECT count(*)::int FROM parcels WHERE verification_status <> 'verified') AS attention_count,
              (SELECT count(DISTINCT district)::int FROM parcels) AS district_count,
              (SELECT count(*)::int FROM documents WHERE upload_status = 'available') AS document_count`,
    );
    return Response.json(result.rows[0]);
  } catch (error) {
    return jsonError(error);
  }
}