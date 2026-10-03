import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { S3Client } from "@aws-sdk/client-s3";

const endpoint = process.env.S3_ENDPOINT;
const bucket = process.env.S3_BUCKET;

export const objectStorageConfigured = Boolean(
  endpoint && bucket && process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY,
);

export const objectStorage = new S3Client({
  region: process.env.S3_REGION ?? "us-east-1",
  endpoint,
  forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
  credentials: process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
    ? { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY }
    : undefined,
});

export async function isS3Available() {
  if (!objectStorageConfigured || !endpoint) return false;
  const endpointUrl = new URL(endpoint);
  const isLocalMinIO =
    (endpointUrl.hostname === "localhost" || endpointUrl.hostname === "127.0.0.1") &&
    endpointUrl.port === "9000";
  if (!isLocalMinIO) return true;

  try {
    const response = await fetch(`${endpoint.replace(/\/$/, "")}/minio/health/live`, { cache: "no-store" });
    return response.ok;
  } catch {
    return false;
  }
}

export function getLocalStorageRoot() {
  const root = path.join(process.cwd(), ".local-storage", "uploads");
  mkdirSync(root, { recursive: true });
  return root;
}

export function getLocalStoragePath(objectKey: string) {
  const relativeKey = objectKey
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .map((segment) => segment.replace(/[^a-zA-Z0-9._-]/g, "_"))
    .join("/");
  const safeKey = relativeKey || "upload.bin";
  return path.join(getLocalStorageRoot(), safeKey);
}

export async function writeLocalUploadFile(objectKey: string, arrayBuffer: ArrayBuffer) {
  const filePath = getLocalStoragePath(objectKey);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, Buffer.from(arrayBuffer));
  return filePath;
}

export function readLocalUploadFile(objectKey: string) {
  const filePath = getLocalStoragePath(objectKey);
  if (!existsSync(filePath)) return null;
  const stat = statSync(filePath);
  return { filePath, byteSize: stat.size };
}

export function readLocalUploadBytes(objectKey: string) {
  const filePath = getLocalStoragePath(objectKey);
  if (!existsSync(filePath)) return null;
  return readFileSync(filePath);
}

export function getPrivateBucket() {
  if (!bucket) throw new Error("Private document storage is not configured.");
  return bucket;
}