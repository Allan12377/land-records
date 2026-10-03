import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { NextRequest } from "next/server";
import { pool } from "@/lib/db";
import { jsonError, requireAdmin } from "@/lib/api-auth";
import { getPrivateBucket, isS3Available, objectStorage, objectStorageConfigured, readLocalUploadBytes } from "@/lib/object-storage";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: RouteContext<"/api/uploads/[documentId]/download">) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const { documentId } = await context.params;

  try {
    const result = await pool.query(
      "SELECT object_key, original_filename, upload_status FROM documents WHERE id = $1",
      [documentId],
    );
    const document = result.rows[0];
    if (!document || document.upload_status !== "available") {
      return Response.json({ error: "Document is not available." }, { status: 404 });
    }
    await pool.query(
      `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
       VALUES ($1, 'document.download_link_created', 'document', $2)`,
      [access.session.user.id, documentId],
    );

    if (!objectStorageConfigured || !(await isS3Available())) {
      const bytes = readLocalUploadBytes(document.object_key);
      if (!bytes) return Response.json({ error: "Document is not available." }, { status: 404 });
      if (new URL(request.url).searchParams.get("redirect") === "1") {
        return new Response(bytes, {
          headers: {
            "Content-Type": document.content_type ?? "application/octet-stream",
            "Content-Disposition": `inline; filename="${document.original_filename.replace(/["\\\r\n]/g, "_")}"`,
          },
        });
      }
      return Response.json({ url: `/api/uploads/local?key=${encodeURIComponent(document.object_key)}`, expiresInSeconds: 60 });
    }

    const url = await getSignedUrl(objectStorage, new GetObjectCommand({
      Bucket: getPrivateBucket(),
      Key: document.object_key,
      ResponseContentDisposition: `inline; filename="${document.original_filename.replace(/["\\\r\n]/g, "_")}"`,
    }), { expiresIn: 60 });
    if (new URL(request.url).searchParams.get("redirect") === "1") return Response.redirect(url, 302);
    return Response.json({ url, expiresInSeconds: 60 });
  } catch (error) {
    return jsonError(error);
  }
}