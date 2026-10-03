import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";
import { recordUpdateSchema } from "@/lib/record-schemas";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext<"/api/records/[parcelId]">) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { parcelId } = await context.params;

  try {
    const result = await pool.query(
      `SELECT pe.id AS person_id, pe.record_number, pe.full_name, pe.other_names, pe.contact_phone,
              pa.id AS parcel_id, pa.title_reference, pa.district, pa.region, pa.county, pa.sub_county,
              pa.parish, pa.village, pa.land_size, pa.land_size_unit, pa.source_book, pa.source_page,
              pa.verification_status, pa.notes, pa.updated_at
       FROM parcels pa JOIN parcel_owners po ON po.parcel_id = pa.id JOIN people pe ON pe.id = po.person_id
       WHERE pa.id = $1 ORDER BY pe.full_name`,
      [parcelId],
    );
    if (!result.rowCount) return Response.json({ error: "Record not found." }, { status: 404 });
    const documents = await pool.query(
      `SELECT id, category, original_filename, content_type, byte_size, upload_status, created_at
       FROM documents WHERE parcel_id = $1 OR person_id = ANY($2::uuid[]) ORDER BY created_at DESC`,
      [parcelId, result.rows.map((row) => row.person_id)],
    );
    return Response.json({ record: result.rows, documents: documents.rows });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext<"/api/records/[parcelId]">) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { parcelId } = await context.params;

  try {
    const input = recordUpdateSchema.parse(await request.json());
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const owner = await client.query("SELECT person_id FROM parcel_owners WHERE parcel_id = $1 LIMIT 1", [parcelId]);
      if (!owner.rowCount) {
        await client.query("ROLLBACK");
        return Response.json({ error: "Record not found." }, { status: 404 });
      }

      const changedFields: { person: string[]; parcel: string[] } = { person: [], parcel: [] };
      if (input.person) {
        const fields: Record<string, string | null | undefined> = {
          fullName: input.person.fullName,
          otherNames: input.person.otherNames === undefined ? undefined : input.person.otherNames || null,
          contactPhone: input.person.contactPhone === undefined ? undefined : input.person.contactPhone || null,
        };
        const columns: Record<string, string> = { fullName: "full_name", otherNames: "other_names", contactPhone: "contact_phone" };
        const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
        if (updates.length) {
          const assignments = updates.map(([key], index) => `${columns[key]} = $${index + 1}`);
          await client.query(`UPDATE people SET ${assignments.join(", ")}, updated_at = now(), updated_by = $${updates.length + 1} WHERE id = $${updates.length + 2}`,
            [...updates.map(([, value]) => value), access.session.user.id, owner.rows[0].person_id]);
          changedFields.person = updates.map(([key]) => key);
        }
      }
      if (input.parcel) {
        const fields: Record<string, string | number | null | undefined> = {
          titleReference: input.parcel.titleReference,
          district: input.parcel.district,
          region: input.parcel.region === undefined ? undefined : input.parcel.region || null,
          county: input.parcel.county === undefined ? undefined : input.parcel.county || null,
          subCounty: input.parcel.subCounty === undefined ? undefined : input.parcel.subCounty || null,
          parish: input.parcel.parish === undefined ? undefined : input.parcel.parish || null,
          village: input.parcel.village === undefined ? undefined : input.parcel.village || null,
          landSize: input.parcel.landSize,
          landSizeUnit: input.parcel.landSizeUnit,
          sourceBook: input.parcel.sourceBook === undefined ? undefined : input.parcel.sourceBook || null,
          sourcePage: input.parcel.sourcePage === undefined ? undefined : input.parcel.sourcePage || null,
          verificationStatus: input.parcel.verificationStatus,
          notes: input.parcel.notes === undefined ? undefined : input.parcel.notes || null,
        };
        const columns: Record<string, string> = {
          titleReference: "title_reference", district: "district", region: "region", county: "county",
          subCounty: "sub_county", parish: "parish", village: "village", landSize: "land_size",
          landSizeUnit: "land_size_unit", sourceBook: "source_book", sourcePage: "source_page",
          verificationStatus: "verification_status", notes: "notes",
        };
        const updates = Object.entries(fields).filter(([, value]) => value !== undefined);
        if (updates.length) {
          const assignments = updates.map(([key], index) => `${columns[key]} = $${index + 1}`);
          await client.query(`UPDATE parcels SET ${assignments.join(", ")}, updated_at = now(), updated_by = $${updates.length + 1} WHERE id = $${updates.length + 2}`,
            [...updates.map(([, value]) => value), access.session.user.id, parcelId]);
          changedFields.parcel = updates.map(([key]) => key);
        }
      }
      await client.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, changes)
         VALUES ($1, 'record.updated', 'parcel', $2, $3::jsonb)`,
        [access.session.user.id, parcelId, JSON.stringify(changedFields)],
      );
      await client.query("COMMIT");
      return Response.json({ updated: true });
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