import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";
import { uploadRequestSchema } from "@/lib/record-schemas";
import { getPrivateBucket, isS3Available, objectStorage, objectStorageConfigured } from "@/lib/object-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const useLocalStorage = !objectStorageConfigured || !(await isS3Available());
  if (!objectStorageConfigured && !useLocalStorage) return Response.json({ error: "Private document storage is not configured." }, { status: 503 });

  try {
    const input = uploadRequestSchema.parse(await request.json());
    const parentCheck = input.personId
      ? await pool.query("SELECT id FROM people WHERE id = $1", [input.personId])
      : await pool.query("SELECT id FROM parcels WHERE id = $1", [input.parcelId]);
    if (!parentCheck.rowCount) return Response.json({ error: "The linked record was not found." }, { status: 404 });

    const suffix = input.filename.toLowerCase().match(/\.(jpg|jpeg|png|webp|pdf)$/)?.[1] ?? "bin";
    const objectKey = `${access.session.user.id}/${randomUUID()}.${suffix}`;
    const document = await pool.query(
      `INSERT INTO documents (person_id, parcel_id, category, object_key, original_filename, content_type, byte_size, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [input.personId ?? null, input.parcelId ?? null, input.category, objectKey,
        input.filename.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 180), input.contentType, input.byteSize, access.session.user.id],
    );

    let uploadUrl = "";
    if (useLocalStorage) {
      uploadUrl = `/api/uploads/local?key=${encodeURIComponent(objectKey)}&documentId=${document.rows[0].id}`;
    } else {
      const command = new PutObjectCommand({
        Bucket: getPrivateBucket(),
        Key: objectKey,
        ContentType: input.contentType,
        ContentLength: input.byteSize,
      });
      uploadUrl = await getSignedUrl(objectStorage, command, { expiresIn: 300 });
    }

    await pool.query(
      `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id, changes)
       VALUES ($1, 'document.upload_started', 'document', $2, $3::jsonb)`,
      [access.session.user.id, document.rows[0].id, JSON.stringify({ category: input.category, byteSize: input.byteSize })],
    );
    return Response.json({ documentId: document.rows[0].id, uploadUrl, expiresInSeconds: 300 }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}