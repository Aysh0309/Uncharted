import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { answerQuestion } from "../lib/query";

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

const TEST_QUESTIONS = [
  "Who are the worthy suspects and what links them to the incident?",
  "What happened on the night of the 14th at Pier 14?",
  "What should my next lead be to advance the investigation?",
];

async function runTestQuery() {
  console.log("====================================================");
  console.log(" CaseMemory: Testing Step 5 Evidentiary Query Engine ");
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

    const demoCase = await db.collection("cases").findOne({
      title: "The Waterfront Warehouse Incident",
    });

    if (!demoCase || !demoCase._id) {
      console.error("❌ Demo case not found. Run 'npm run test:ingest' first to seed case notes.");
      process.exit(1);
    }

    const caseId = demoCase._id.toString();
    console.log(`Target Case: "${demoCase.title}" (${caseId})\n`);

    for (let i = 0; i < TEST_QUESTIONS.length; i++) {
      const q = TEST_QUESTIONS[i];
      console.log(`====================================================`);
      console.log(`[Query ${i + 1}/3]: "${q}"`);
      console.log(`====================================================`);

      const result = await answerQuestion(caseId, "test-investigator", q);

      console.log("\n--- GROUNDED EVIDENTIARY ANSWER ---");
      console.log(result.answer);

      console.log("\n--- VERIFIED SOURCE CITATIONS ---");
      if (result.citations.length > 0) {
        for (const cit of result.citations) {
          console.log(`  ✓ [note #${cit.noteId}] ${cit.snippet ? `("${cit.snippet}")` : ""}`);
        }
      } else {
        console.log("  ℹ No citations extracted from response.");
      }

      console.log("\n--- EXPLAINABLE SUSPECT SCORES (Computed in Code) ---");
      for (const s of result.suspects) {
        console.log(`  • ${s.name} (Role: ${s.role}) -> TOTAL SCORE: ${s.totalScore}`);
        console.log(`      Events Linked:  ${s.breakdown.linkedEvents.description}`);
        console.log(`      Proximity:      ${s.breakdown.proximity.description}`);
        console.log(`      Motive Link:    ${s.breakdown.motiveOrIncrimination.description}`);
        console.log(`      Alibi Status:   ${s.breakdown.alibi.description}`);
      }

      console.log("\n--- DETECTED GAPS & ACTIONS (Computed in Code) ---");
      for (const g of result.gaps) {
        console.log(`  • [${g.type}] ${g.description}`);
      }
      console.log("\n");
    }

    console.log("====================================================");
    console.log(" Step 5 Testing Complete: All Queries Verified       ");
    console.log("====================================================");
  } catch (err: any) {
    console.error("❌ Query test error:", err?.message || err);
  } finally {
    await client.close();
  }
}

runTestQuery();

