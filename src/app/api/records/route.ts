import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";
import { recordInputSchema } from "@/lib/record-schemas";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  const params = new URL(request.url).searchParams;
  const query = params.get("q")?.trim().slice(0, 120) ?? "";
  const district = params.get("district")?.trim().slice(0, 100) ?? "";
  const status = params.get("status") ?? "";
  const limit = Math.min(Math.max(Number(params.get("limit")) || 50, 1), 100);
  const offset = Math.max(Number(params.get("offset")) || 0, 0);
  const values: (string | number)[] = [];
  const filters: string[] = [];

  if (query) {
    values.push(`%${query.replace(/[\\%_]/g, "\\$&")}%`);
    filters.push(`(pe.full_name ILIKE $${values.length} ESCAPE '\\' OR pe.other_names ILIKE $${values.length} ESCAPE '\\' OR pe.record_number ILIKE $${values.length} ESCAPE '\\' OR pa.title_reference ILIKE $${values.length} ESCAPE '\\' OR pa.village ILIKE $${values.length} ESCAPE '\\')`);
  }
  if (district) {
    values.push(district);
    filters.push(`pa.district = $${values.length}`);
  }
  if (["verified", "needs_review", "scan_pending"].includes(status)) {
    values.push(status);
    filters.push(`pa.verification_status = $${values.length}`);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const resultValues = [...values, limit, offset];

  try {
    const result = await pool.query(
      `SELECT pe.id AS person_id, pe.record_number, pe.full_name, pe.other_names, pe.contact_phone,
              pa.id AS parcel_id, pa.title_reference, pa.district, pa.region, pa.county, pa.sub_county,
              pa.parish, pa.village, pa.land_size, pa.land_size_unit, pa.source_book, pa.source_page,
              pa.verification_status, pa.updated_at
       FROM parcels pa
       JOIN parcel_owners po ON po.parcel_id = pa.id
       JOIN people pe ON pe.id = po.person_id
       ${where}
       ORDER BY pa.updated_at DESC, pe.full_name ASC
       LIMIT $${resultValues.length - 1} OFFSET $${resultValues.length}`,
      resultValues,
    );
    const count = await pool.query(
      `SELECT count(*)::int AS total
       FROM parcels pa JOIN parcel_owners po ON po.parcel_id = pa.id JOIN people pe ON pe.id = po.person_id
       ${where}`,
      values,
    );

    return Response.json({ records: result.rows, total: count.rows[0]?.total ?? 0, limit, offset });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;

  try {
    const input = recordInputSchema.parse(await request.json());
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const person = await client.query(
        `INSERT INTO people (full_name, other_names, contact_phone, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $4) RETURNING id, record_number`,
        [input.person.fullName, input.person.otherNames || null, input.person.contactPhone || null, access.session.user.id],
      );
      const parcel = await client.query(
        `INSERT INTO parcels (title_reference, district, region, county, sub_county, parish, village,
                             land_size, land_size_unit, source_book, source_page, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13) RETURNING id`,
        [input.parcel.titleReference, input.parcel.district, input.parcel.region || null, input.parcel.county || null,
          input.parcel.subCounty || null, input.parcel.parish || null, input.parcel.village || null,
          input.parcel.landSize ?? null, input.parcel.landSizeUnit, input.parcel.sourceBook || null,
          input.parcel.sourcePage || null, input.parcel.notes || null, access.session.user.id],
      );
      await client.query("INSERT INTO parcel_owners (parcel_id, person_id) VALUES ($1, $2)", [parcel.rows[0].id, person.rows[0].id]);
      await client.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'record.created', 'parcel', $2, $3::jsonb)`,
        [access.session.user.id, parcel.rows[0].id, JSON.stringify({ personId: person.rows[0].id, recordNumber: person.rows[0].record_number })],
      );
      await client.query("COMMIT");
      return Response.json({ personId: person.rows[0].id, recordNumber: person.rows[0].record_number, parcelId: parcel.rows[0].id }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return jsonError(error);
  }
}