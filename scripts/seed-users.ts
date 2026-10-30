import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

function loadEnv() {
  const envFiles = [".env.local", ".env"];
  for (const file of envFiles) {
    const fullPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if (
            (val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))
          ) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || "casememory";

const DEMO_USERS = [
  {
    email: "admin@casememory.local",
    password: "AdminPass123!",
    name: "Chief Inspector Sterling",
    role: "admin",
  },
  {
    email: "investigator@casememory.local",
    password: "InvestPass123!",
    name: "Det. Sarah Miller",
    role: "investigator",
  },
  {
    email: "viewer@casememory.local",
    password: "ViewerPass123!",
    name: "Analyst James Cole",
    role: "viewer",
  },
];

async function seed() {
  console.log("====================================================");
  console.log(" CaseMemory: Seeding Demo Users & Initial Case      ");
  console.log("====================================================");

  if (!uri) {
    console.error("❌ MONGODB_URI is not set. Add it in .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const usersCol = db.collection("users");
    const casesCol = db.collection("cases");

    const userIds: Record<string, string> = {};

    console.log("Seeding Demo Users (idempotent upsert)...");
    for (const demo of DEMO_USERS) {
      const passwordHash = await bcrypt.hash(demo.password, 10);
      const res = await usersCol.findOneAndUpdate(
        { email: demo.email },
        {
          $set: {
            name: demo.name,
            role: demo.role,
            passwordHash,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      const id = res?._id?.toString() || "id";
      userIds[demo.role] = id;
      console.log(`  ✓ [${demo.role.toUpperCase()}] ${demo.name}`);
      console.log(`    Email:    ${demo.email}`);
      console.log(`    Password: ${demo.password}`);
    }

    // Seed initial demo case
    console.log("\nSeeding Initial Demo Case...");
    const existingCase = await casesCol.findOne({ title: "The Waterfront Warehouse Incident" });
    if (!existingCase) {
      const sampleCase = {
        title: "The Waterfront Warehouse Incident",
        description: "Investigation into midnight unauthorized entry and stolen manifest at Pier 14.",
        status: "active",
        memberIds: [userIds.investigator, userIds.viewer].filter(Boolean),
        summary: "Preliminary facts: Witness observed a dark sedan speeding away from Pier 14 at 11:45 PM.",
        createdBy: userIds.admin,
        createdAt: new Date(),
      };
      const caseRes = await casesCol.insertOne(sampleCase);
      console.log(`  ✓ Created Demo Case: "The Waterfront Warehouse Incident" (ID: ${caseRes.insertedId.toString()})`);
      console.log(`    Assigned members: Investigator & Viewer`);
    } else {
      console.log(`  ℹ Demo Case already exists (ID: ${existingCase._id.toString()})`);
    }

    console.log("\n Seeding completed successfully!");
  } catch (err: any) {
    console.error("❌ Seeding failed:", err.message);
  } finally {
    await client.close();
  }
}

seed();

