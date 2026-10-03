import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const params = new URL(request.url).searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 25, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  try {
    const result = await pool.query(
      `SELECT document.id, document.category, document.original_filename, document.content_type,
              document.byte_size, document.upload_status, document.created_at,
              person.full_name, person.record_number, parcel.title_reference, parcel.district
       FROM documents document
       LEFT JOIN people person ON person.id = document.person_id
       LEFT JOIN parcels parcel ON parcel.id = document.parcel_id
       ORDER BY document.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const count = await pool.query("SELECT count(*)::int AS total FROM documents");
    return Response.json({ documents: result.rows, total: count.rows[0]?.total ?? 0, limit, offset });
  } catch (error) {
    return jsonError(error);
  }
}