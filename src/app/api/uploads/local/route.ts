import type { NextRequest } from "next/server";
import { readLocalUploadBytes, writeLocalUploadFile } from "@/lib/object-storage";
import { jsonError, requireAdmin } from "@/lib/api-auth";
import { pool } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const key = new URL(request.url).searchParams.get("key");
  const documentId = new URL(request.url).searchParams.get("documentId");
  if (!key || !documentId) {
    return Response.json({ error: "Upload metadata is incomplete." }, { status: 400 });
  }

  try {
    const arrayBuffer = await request.arrayBuffer();
    await writeLocalUploadFile(key, arrayBuffer);
    await pool.query("UPDATE documents SET upload_status = 'available' WHERE id = $1", [documentId]);
    await pool.query(
      `INSERT INTO audit_events (actor_user_id, action, entity_type, entity_id)
       VALUES ($1, 'document.upload_completed', 'document', $2)`,
      [access.session.user.id, documentId],
    );
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}

export async function GET(request: NextRequest) {
  const access = await requireAdmin(request);
  if ("response" in access) return access.response;
  const key = new URL(request.url).searchParams.get("key");
  if (!key) return Response.json({ error: "Upload key is missing." }, { status: 400 });

  try {
    const bytes = readLocalUploadBytes(key);
    if (!bytes) return Response.json({ error: "Document is not available." }, { status: 404 });
    return new Response(bytes, { headers: { "Content-Type": "application/octet-stream" } });
  } catch (error) {
    return jsonError(error);
  }
}
