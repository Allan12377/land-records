import dotenv from "dotenv";
import { Client } from "pg";

dotenv.config({ path: ".env.local" });

const fallbackTarget = 500;
const requestedTarget = Number.parseInt(process.argv[2] ?? "", 10);
const targetPeople = Number.isFinite(requestedTarget) && requestedTarget > 0 ? requestedTarget : fallbackTarget;

const districts = [
  { name: "Wakiso", region: "Central", county: "Wakiso", subCounty: "Busukuma", parish: "Nabweru", village: "Munyonyo" },
  { name: "Kampala", region: "Central", county: "Kampala", subCounty: "Makindye", parish: "Kibuye", village: "Kajjansi" },
  { name: "Mukono", region: "Central", county: "Mukono", subCounty: "Goma", parish: "Nabaale", village: "Bweyogerere" },
  { name: "Jinja", region: "Eastern", county: "Jinja", subCounty: "Kagoma", parish: "Budondo", village: "Walukuba" },
  { name: "Mbale", region: "Eastern", county: "Mbale", subCounty: "Bungokho", parish: "Busiu", village: "Nalukolongo" },
  { name: "Mbarara", region: "Western", county: "Mbarara", subCounty: "Kakiika", parish: "Nyamitanga", village: "Ruti" },
  { name: "Fort Portal", region: "Western", county: "Kabarole", subCounty: "Burahya", parish: "Kicwamba", village: "Rwimi" },
  { name: "Gulu", region: "Northern", county: "Gulu", subCounty: "Laroo", parish: "Bardege", village: "Awere" },
  { name: "Arua", region: "Northern", county: "Arua", subCounty: "Ayivu", parish: "Ociru", village: "Logiri" },
  { name: "Soroti", region: "Eastern", county: "Soroti", subCounty: "Asuret", parish: "Amuria", village: "Arapai" },
];

const firstNames = [
  "Amina", "Michael", "Joseph", "Sarah", "Peter", "Hope", "Daniel", "Patricia", "Henry", "Rose", "David", "Faith",
  "Abdul", "Esther", "Moses", "Jane", "Richard", "Catherine", "Paul", "Irene", "John", "Vivian", "Isaac", "Mercy",
  "Samuel", "Dorothy", "Robert", "Lillian", "Simon", "Grace", "George", "Margaret", "Brian", "Naomi", "Joshua", "Joy",
  "Emmanuel", "Diana", "Noah", "Mabel", "Alex", "Ann", "Charles", "Ruth", "Stephen", "Sylvia", "Philip", "Betty"
];

const lastNames = [
  "Kato", "Mugisha", "Nakyejwe", "Nsubuga", "Odongo", "Atim", "Nabirye", "Otim", "Aine", "Kiyingi", "Lwanga", "Sserwanga",
  "Tukamushaba", "Arua", "Opio", "Muwonge", "Kayondo", "Mukasa", "Okello", "Mutebi", "Kyomugisha", "Bagonza", "Nabukenya",
  "Wamala", "Amooti", "Orikiriza", "Kansiime", "Ahabwe", "Ojok", "Baluku", "Wanyana", "Mwesigwa", "Tumusiime", "Lukooya",
  "Nandutu", "Biryabarema", "Kabagambe", "Byamukama", "Ojara", "Kyeyune", "Lutalo", "Musinguzi", "Nakyagaba", "Mugyenyi"
];

const titlePrefixes = ["WKS", "UG-LR", "MTN", "KLA", "BUN", "LBR"];
const statusOptions = ["verified", "needs_review", "scan_pending"];
const landUnits = ["acres", "hectares", "square_metres", "unknown"];

const randomFrom = (items) => items[Math.floor(Math.random() * items.length)];
const randomPhone = () => `+2567${String(Math.floor(Math.random() * 90000000) + 10000000)}`;
const buildName = (index) => `${firstNames[index % firstNames.length]} ${lastNames[(index * 7 + 3) % lastNames.length]} ${lastNames[(index * 11 + 5) % lastNames.length]}`;

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function main() {
  await client.connect();

  const totalPeople = await client.query("SELECT count(*)::int AS total FROM people");
  const totalParcels = await client.query("SELECT count(*)::int AS total FROM parcels");
  const peopleCount = Number(totalPeople.rows[0].total ?? 0);
  const parcelCount = Number(totalParcels.rows[0].total ?? 0);

  const neededPeople = Math.max(0, targetPeople - peopleCount);
  if (neededPeople > 0) {
    const peopleRows = [];
    const values = [];
    const now = new Date();

    for (let i = 0; i < neededPeople; i += 1) {
      const nextIndex = peopleCount + i;
      const fullName = buildName(nextIndex + 1);
      const createdAt = new Date(now.getTime() - i * 3600000).toISOString();
      const updatedAt = new Date(now.getTime() - i * 1800000).toISOString();
      peopleRows.push({ fullName, otherNames: i % 3 === 0 ? randomFrom(firstNames) : "", contactPhone: randomPhone(), createdAt, updatedAt });
      values.push(
        peopleRows[i].fullName,
        peopleRows[i].otherNames || null,
        peopleRows[i].contactPhone,
        peopleRows[i].createdAt,
        peopleRows[i].updatedAt,
      );
    }

    await client.query(
      `INSERT INTO people (full_name, other_names, contact_phone, created_at, updated_at)
       VALUES ${peopleRows.map((_, idx) => `($${idx * 5 + 1}, $${idx * 5 + 2}, $${idx * 5 + 3}, $${idx * 5 + 4}, $${idx * 5 + 5})`).join(", ")}`,
      values,
    );
  }

  const currentPeople = await client.query("SELECT id, full_name FROM people ORDER BY created_at ASC");
  const currentParcels = await client.query("SELECT id FROM parcels");
  const missingParcels = Math.max(0, targetPeople - currentParcels.rows.length);

  if (missingParcels > 0) {
    const availablePeople = currentPeople.rows.slice(0, Math.max(missingParcels, currentPeople.rows.length));
    const peopleToPair = availablePeople.slice(-missingParcels);
    const parcelValues = [];
    const parcelOwnerPairs = [];
    const insertedParcels = [];

    for (let i = 0; i < peopleToPair.length; i += 1) {
      const person = peopleToPair[i];
      const districtIndex = (parcelCount + i) % districts.length;
      const district = districts[districtIndex];
      const createdAt = new Date(Date.now() - i * 300000).toISOString();
      const updatedAt = new Date(Date.now() - i * 180000).toISOString();
      parcelValues.push(
        `${titlePrefixes[(parcelCount + i) % titlePrefixes.length]}-${String((parcelCount + i + 1) * 29).padStart(6, "0")}`,
        district.name,
        district.region,
        district.county,
        district.subCounty,
        district.parish,
        `${district.village}-${(parcelCount + i % 20) + 1}`,
        Number((Math.random() * 12 + 0.5).toFixed(2)),
        randomFrom(landUnits),
        `DEMO-${String((parcelCount + i % 12) + 1).padStart(2, "0")}`,
        String((parcelCount + i % 48) + 1),
        randomFrom(statusOptions),
        `Demo presentation record for ${person.full_name}. Source record kept for view testing only.`,
        createdAt,
        updatedAt,
        null,
        null,
      );
    }

    const result = await client.query(
      `INSERT INTO parcels (
        title_reference, district, region, county, sub_county, parish, village,
        land_size, land_size_unit, source_book, source_page, verification_status,
        notes, created_at, updated_at, created_by, updated_by
      )
      VALUES ${peopleToPair.map((_, idx) => `($${idx * 17 + 1}, $${idx * 17 + 2}, $${idx * 17 + 3}, $${idx * 17 + 4}, $${idx * 17 + 5}, $${idx * 17 + 6}, $${idx * 17 + 7}, $${idx * 17 + 8}, $${idx * 17 + 9}, $${idx * 17 + 10}, $${idx * 17 + 11}, $${idx * 17 + 12}, $${idx * 17 + 13}, $${idx * 17 + 14}, $${idx * 17 + 15}, $${idx * 17 + 16}, $${idx * 17 + 17})`).join(", ")}
      RETURNING id, title_reference`,
      parcelValues,
    );

    for (let i = 0; i < result.rows.length; i += 1) {
      insertedParcels.push({ id: result.rows[i].id, personId: peopleToPair[i].id });
      parcelOwnerPairs.push(peopleToPair[i].id, result.rows[i].id);
    }

    await client.query(
      `INSERT INTO parcel_owners (person_id, parcel_id)
       VALUES ${insertedParcels.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(", ")}
       ON CONFLICT (person_id, parcel_id) DO NOTHING`,
      parcelOwnerPairs,
    );
  }

  const allParcels = await client.query("SELECT p.id, po.person_id FROM parcels p LEFT JOIN parcel_owners po ON po.parcel_id = p.id ORDER BY p.created_at DESC LIMIT $1", [targetPeople]);
  const docValues = [];

  for (let i = 0; i < allParcels.rows.length; i += 1) {
    const parcel = allParcels.rows[i];
    const personId = parcel.person_id;
    if (personId && i % 3 === 0) {
      const personPhotoKey = `demo/person/${personId}.jpg`;
      docValues.push(
        personId,
        null,
        "person_photo",
        personPhotoKey,
        `${personId}.jpg`,
        "image/jpeg",
        240000 + (i % 8) * 1500,
        "available",
        new Date(Date.now() - i * 400000).toISOString(),
      );
    }
    if (i % 2 === 0) {
      const titleScanKey = `demo/parcel/${parcel.id}.pdf`;
      docValues.push(
        null,
        parcel.id,
        "title_scan",
        titleScanKey,
        `${parcel.id}.pdf`,
        "application/pdf",
        760000 + (i % 11) * 1800,
        "available",
        new Date(Date.now() - i * 500000).toISOString(),
      );
    }
  }

  if (docValues.length > 0) {
    await client.query(
      `INSERT INTO documents (person_id, parcel_id, category, object_key, original_filename, content_type, byte_size, upload_status, created_at)
       VALUES ${Array.from({ length: docValues.length / 9 }, (_, idx) => `($${idx * 9 + 1}, $${idx * 9 + 2}, $${idx * 9 + 3}, $${idx * 9 + 4}, $${idx * 9 + 5}, $${idx * 9 + 6}, $${idx * 9 + 7}, $${idx * 9 + 8}, $${idx * 9 + 9})`).join(", ")}
       ON CONFLICT (object_key) DO NOTHING`,
      docValues,
    );
  }

  const finalPeople = await client.query("SELECT count(*)::int AS total FROM people");
  const finalParcels = await client.query("SELECT count(*)::int AS total FROM parcels");
  const finalDocs = await client.query("SELECT count(*)::int AS total FROM documents");

  console.log(`Demo seeding complete: ${finalPeople.rows[0].total} people, ${finalParcels.rows[0].total} parcels, ${finalDocs.rows[0].total} documents.`);
  console.log("The demo rows are safe for presentation and can be cleaned up later.");
}

try {
  await main();
} catch (error) {
  console.error("Failed to insert demo data:", error);
  process.exitCode = 1;
} finally {
  await client.end();
}
