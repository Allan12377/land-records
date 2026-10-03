import assert from "node:assert/strict";
import test from "node:test";
import { recordInputSchema, recordUpdateSchema, uploadRequestSchema } from "../src/lib/record-schemas.ts";

const validRecord = {
  person: { fullName: "Amina Kato", otherNames: "", contactPhone: "" },
  parcel: {
    titleReference: "WKS-01842",
    district: "Wakiso",
    landSize: 0.24,
    landSizeUnit: "acres",
  },
};

test("accepts a complete person and parcel record", () => {
  assert.equal(recordInputSchema.safeParse(validRecord).success, true);
});

test("rejects missing names, title references, and districts", () => {
  assert.equal(recordInputSchema.safeParse({ ...validRecord, person: { fullName: "A" } }).success, false);
  assert.equal(recordInputSchema.safeParse({ ...validRecord, parcel: { ...validRecord.parcel, titleReference: "" } }).success, false);
  assert.equal(recordInputSchema.safeParse({ ...validRecord, parcel: { ...validRecord.parcel, district: "" } }).success, false);
});

test("rejects invalid area and unexpected input keys", () => {
  assert.equal(recordInputSchema.safeParse({ ...validRecord, parcel: { ...validRecord.parcel, landSize: -1 } }).success, false);
  assert.equal(recordInputSchema.safeParse({ ...validRecord, person: { ...validRecord.person, nationalId: "not-collected" } }).success, false);
});

test("allows a partial edit but rejects an empty edit", () => {
  assert.equal(recordUpdateSchema.safeParse({ person: { fullName: "Updated Name" } }).success, true);
  assert.equal(recordUpdateSchema.safeParse({}).success, false);
});

test("requires one compatible parent and caps private uploads at 15 MB", () => {
  const validUpload = {
    personId: "f98afae7-b6b0-42c6-88ec-39acb16b5a00",
    category: "person_photo",
    filename: "portrait.png",
    contentType: "image/png",
    byteSize: 2048,
  };
  assert.equal(uploadRequestSchema.safeParse(validUpload).success, true);
  assert.equal(uploadRequestSchema.safeParse({ ...validUpload, parcelId: "f98afae7-b6b0-42c6-88ec-39acb16b5a00" }).success, false);
  assert.equal(uploadRequestSchema.safeParse({ ...validUpload, category: "title_scan" }).success, false);
  assert.equal(uploadRequestSchema.safeParse({ ...validUpload, byteSize: 16 * 1024 * 1024 }).success, false);
  assert.equal(uploadRequestSchema.safeParse({ ...validUpload, contentType: "text/html" }).success, false);
});