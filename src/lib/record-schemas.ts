import { z } from "zod";

const optionalText = (maximum: number) => z.string().trim().max(maximum).optional().or(z.literal(""));

export const recordInputSchema = z.object({
  person: z.object({
    fullName: z.string().trim().min(2).max(180),
    otherNames: optionalText(180),
    contactPhone: optionalText(40),
  }).strict(),
  parcel: z.object({
    titleReference: z.string().trim().min(1).max(120),
    district: z.string().trim().min(1).max(100),
    region: optionalText(100),
    county: optionalText(100),
    subCounty: optionalText(100),
    parish: optionalText(100),
    village: optionalText(120),
    landSize: z.number().positive().max(1_000_000).nullable().optional(),
    landSizeUnit: z.enum(["acres", "hectares", "square_metres", "unknown"]).default("unknown"),
    sourceBook: optionalText(120),
    sourcePage: optionalText(40),
    notes: optionalText(2000),
  }).strict(),
}).strict();

export const recordUpdateSchema = z.object({
  person: z.object({
    fullName: z.string().trim().min(2).max(180).optional(),
    otherNames: optionalText(180),
    contactPhone: optionalText(40),
  }).strict().optional(),
  parcel: z.object({
    titleReference: z.string().trim().min(1).max(120).optional(),
    district: z.string().trim().min(1).max(100).optional(),
    region: optionalText(100),
    county: optionalText(100),
    subCounty: optionalText(100),
    parish: optionalText(100),
    village: optionalText(120),
    landSize: z.number().positive().max(1_000_000).nullable().optional(),
    landSizeUnit: z.enum(["acres", "hectares", "square_metres", "unknown"]).optional(),
    sourceBook: optionalText(120),
    sourcePage: optionalText(40),
    verificationStatus: z.enum(["verified", "needs_review", "scan_pending"]).optional(),
    notes: optionalText(2000),
  }).strict().optional(),
}).strict().refine((value) => Boolean(value.person || value.parcel), "At least one record section is required");

export const uploadRequestSchema = z.object({
  personId: z.string().uuid().optional(),
  parcelId: z.string().uuid().optional(),
  category: z.enum(["person_photo", "title_scan", "supporting_document"]),
  filename: z.string().trim().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
  byteSize: z.number().int().positive().max(15 * 1024 * 1024),
}).strict().refine((value) => Number(Boolean(value.personId)) + Number(Boolean(value.parcelId)) === 1)
  .refine((value) => value.category === "person_photo" ? Boolean(value.personId) : Boolean(value.parcelId));