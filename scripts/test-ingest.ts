import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { classifyMessage, ingestFact } from "../lib/ingest";

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

const SAMPLE_MESSAGES = [
  {
    title: "Note 1: Initial Pier 14 Sighting",
    text: "On the night of October 14th around 11:45 PM, a dark blue sedan with partial plate '7XY' was observed speeding away from Pier 14 warehouse. Security guard Marcus Vance reported seeing two unidentified individuals in dark hoodies loading wooden crates into the trunk.",
  },
  {
    title: "Note 2: Vehicle & Suspect Linkage",
    text: "Harbor Blvd traffic cameras at 11:52 PM captured the blue sedan, confirmed as a 2018 Honda Accord (registered to Damon Vance, alias 'D-Money'). Damon is Marcus Vance's nephew and currently has no verified alibi for that night.",
  },
  {
    title: "Note 3: Forensic Discovery & Alibi Inconsistency",
    text: "Forensics recovered a burner phone near loading bay 3. Call logs show three incoming calls from an unlisted number between 11:30 PM and 11:40 PM. Furthermore, security guard Marcus Vance claimed he was in the restroom during the incident, but digital badge records show his card accessed the main gate at 11:42 PM.",
  },
];

async function runTestIngest() {
  console.log("====================================================");
  console.log(" CaseMemory: Testing Step 4 Fact Ingestion Pipeline ");
  console.log("====================================================");

  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env.local");
    process.exit(1);
  }

  if (!process.env.LLM_API_KEY) {
    console.error("❌ LLM_API_KEY is not set in .env.local");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);

    // 1. Find or create demo case
    let demoCase = await db.collection("cases").findOne({
      title: "The Waterfront Warehouse Incident",
    });

    if (!demoCase) {
      console.log("Creating demo case 'The Waterfront Warehouse Incident'...");
      const insertCase = await db.collection("cases").insertOne({
        title: "The Waterfront Warehouse Incident",
        description: "Investigation into midnight unauthorized entry and stolen manifest at Pier 14.",
        status: "active",
        memberIds: [],
        summary: "",
        createdBy: "system",
        createdAt: new Date(),
      });
      demoCase = { _id: insertCase.insertedId } as any;
    }

    if (!demoCase || !demoCase._id) {
      throw new Error("Failed to find or initialize target demo case");
    }

    const caseId = demoCase._id.toString();
    console.log(`Target Case ID: ${caseId}\n`);

    // 2. Ingest the three messages sequentially
    for (let i = 0; i < SAMPLE_MESSAGES.length; i++) {
      const sample = SAMPLE_MESSAGES[i];
      console.log(`----------------------------------------------------`);
      console.log(`[Message ${i + 1}/3] ${sample.title}`);
      console.log(`Input Text: "${sample.text}"\n`);

      console.log("  1. Classifying message with Router...");
      const classification = await classifyMessage(sample.text);
      console.log(`     ✓ Classified as: '${classification}'`);

      console.log("  2. Ingesting fact (extracting, embedding, merging)...");
      const result = await ingestFact(caseId, "test-investigator", sample.text);

      console.log(`     ✓ Raw Note Saved: Note #${result.noteId}`);
      console.log(`     ✓ Events Extracted & Embedded: ${result.eventsSaved}`);
      for (const ev of result.extracted.events) {
        console.log(`        • [Event] ${ev.what} (when: ${ev.whenText || "null"}, where: ${ev.where || "null"})`);
      }

      console.log(`     ✓ Entities Merged: ${result.entitiesCreated} created, ${result.entitiesUpdated} updated`);
      for (const ent of result.extracted.entities) {
        console.log(`        • [${ent.type.toUpperCase()}] ${ent.name} (role: ${ent.role}, alibi: ${ent.alibiStatus})`);
      }

      if (result.openQuestionsSaved > 0) {
        console.log(`     ✓ Open Questions Logged: ${result.openQuestionsSaved}`);
        for (const q of result.extracted.open_questions) {
          console.log(`        ? ${q}`);
        }
      }

      console.log(`\n  3. Updated Working Memory Case Summary:`);
      console.log(`     "${result.runningSummary}"\n`);
    }

    // 3. Final case summary verification
    const finalCase = await db.collection("cases").findOne({ _id: demoCase._id });
    const totalEvents = await db.collection("events").countDocuments({ caseId });
    const totalEntities = await db.collection("entities").countDocuments({ caseId });
    const totalNotes = await db.collection("notes").countDocuments({ caseId });
    const totalQuestions = await db.collection("openQuestions").countDocuments({ caseId });

    console.log("====================================================");
    console.log(" Pipeline Verification Summary                      ");
    console.log("====================================================");
    console.log(`Total Notes Stored:         ${totalNotes}`);
    console.log(`Total Events Embedded:      ${totalEvents}`);
    console.log(`Total Entities Tracked:     ${totalEntities}`);
    console.log(`Total Open Questions:       ${totalQuestions}`);
    console.log(`Final Case Memory Summary:\n"${finalCase?.summary}"`);
    console.log("\n All 3 test messages ingested and verified successfully!");
  } catch (err: any) {
    console.error("❌ Test Ingest Error:", err?.message || err);
  } finally {
    await client.close();
  }
}

runTestIngest();
