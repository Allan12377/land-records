import { HeadObjectCommand } from "@aws-sdk/client-s3";
import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";
import { getPrivateBucket, isS3Available, objectStorage, objectStorageConfigured, readLocalUploadFile } from "@/lib/object-storage";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: RouteContext<"/api/uploads/[documentId]/complete">) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { documentId } = await context.params;

  try {
    const result = await pool.query(
      "SELECT object_key, content_type, byte_size, upload_status FROM documents WHERE id = $1",
      [documentId],
    );
    const document = result.rows[0];
    if (!document) return Response.json({ error: "Document not found." }, { status: 404 });
    if (document.upload_status === "available") return Response.json({ available: true });

    if (!objectStorageConfigured || !(await isS3Available())) {
      const localFile = readLocalUploadFile(document.object_key);
      if (!localFile || localFile.byteSize !== Number(document.byte_size)) {
        return Response.json({ error: "Uploaded file does not match the approved size and type." }, { status: 400 });
      }
      await pool.query("UPDATE documents SET upload_status = 'available' WHERE id = $1", [documentId]);
      await pool.query(
        `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
         VALUES ($1, 'document.upload_completed', 'document', $2)`,
        [access.session.user.id, documentId],
      );
      return Response.json({ available: true });
    }

    const head = await objectStorage.send(new HeadObjectCommand({ Bucket: getPrivateBucket(), Key: document.object_key }));
    if (head.ContentLength !== Number(document.byte_size) || head.ContentType !== document.content_type) {
      return Response.json({ error: "Uploaded file does not match the approved size and type." }, { status: 400 });
    }
    await pool.query("UPDATE documents SET upload_status = 'available' WHERE id = $1", [documentId]);
    await pool.query(
      `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
       VALUES ($1, 'document.upload_completed', 'document', $2)`,
      [access.session.user.id, documentId],
    );
    return Response.json({ available: true });
  } catch (error) {
    return jsonError(error);
  }
}