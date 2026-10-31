import fs from "fs";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { ingestFact } from "../lib/ingest";
import { computeSuspectScores, detectGaps } from "../lib/query";

/**
 * Loads .env.local and .env files manually if process.env.MONGODB_URI is not set.
 */
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

interface SeedNote {
  title: string;
  investigatorName: string;
  investigatorKey: "investigator1" | "investigator2";
  date: Date;
  text: string;
}

/**
 * 15 Synthetic Case Notes:
 * - Victim: Julian Vance
 * - 4 People of Interest: Victor Sterling (suspect), Elena Rostova (witness A), David Chen (witness B), Claire Vance (person of interest)
 * - Vehicle: Silver 2021 Audi A6 sedan (plate 7XYZ89)
 * - Location: Blackwood Manor (440 Blackwood Ridge Road)
 * - Time of Death Window: 10:15 PM - 11:15 PM on October 24, 2026
 * - Contradiction: Elena claims intruder escaped via open garden gate at 10:45 PM; David Chen states gate was padlocked shut from 10:00 PM to 11:30 PM.
 * - Suspect with Unverified Alibi: Victor Sterling claims he was alone in his apartment watching soccer from 9:00 PM to midnight; lobby camera refutes this by showing him leaving at 9:45 PM and returning at 12:15 AM.
 * - Authored by two different investigators (Det. Sarah Miller & Det. Marcus Cruz) across different days (Oct 25 - Oct 28, 2026).
 */
const SYNTHETIC_NOTES: SeedNote[] = [
  // --- DAY 1: October 25, 2026 ---
  {
    title: "Note 1: Initial Crime Scene Response & Victim Discovery",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-25T08:30:00Z"),
    text: "Dispatched to Blackwood Manor at 440 Blackwood Ridge Road following a 911 emergency call placed at 08:05 AM. Victim Julian Vance was found deceased inside the private ground-floor study, slumped over his mahogany desk with fatal blunt force trauma to the occipital region.",
  },
  {
    title: "Note 2: Physical Evidence & Point of Entry Inspection",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-25T11:15:00Z"),
    text: "Crime scene technician processed the study at Blackwood Manor. A heavy bronze paperweight stained with blood was recovered from the Persian rug near victim Julian Vance. No sign of forced entry was observed at the front entrance or study French doors, suggesting the perpetrator was admitted voluntarily or possessed a key.",
  },
  {
    title: "Note 3: Medical Examiner Time of Death Window",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-25T14:40:00Z"),
    text: "County Medical Examiner completed initial post-mortem examination of victim Julian Vance. The estimated time of death window is established between 10:15 PM and 11:15 PM on the evening of October 24, 2026, determined by core body temperature, rigor mortis progression, and vitreous potassium levels.",
  },
  {
    title: "Note 4: Housekeeper Preliminary Statement & Vehicle Sighting",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-25T17:00:00Z"),
    text: "Interviewed head housekeeper Elena Rostova at Blackwood Manor. Rostova stated she served chamomile tea to Julian Vance in the library at 09:00 PM on October 24th. She reported seeing an unfamiliar silver sedan parked down the gravel driveway near the gatehouse around 10:00 PM.",
  },

  // --- DAY 2: October 26, 2026 ---
  {
    title: "Note 5: Ridge Road Perimeter Camera Capture",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-26T09:15:00Z"),
    text: "Reviewed automated perimeter highway camera logs along Blackwood Ridge Road. A silver 2021 Audi A6 sedan bearing license plate 7XYZ89 was captured turning onto the Blackwood Manor access road at 10:18 PM on October 24th, and recorded departing at high speed at 11:22 PM.",
  },
  {
    title: "Note 6: Vehicle Registration & Suspect Connection",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-26T11:30:00Z"),
    text: "DMV records search on the silver 2021 Audi A6 sedan (plate 7XYZ89) confirms ownership registered to Victor Sterling, Julian Vance's venture partner at Vance-Sterling Technologies. Sterling's residential address is listed as 820 Elm Street, Apt 4B.",
  },
  {
    title: "Note 7: Housekeeper Elena Rostova Witness Account (Garden Gate Claim)",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-26T14:00:00Z"),
    text: "Follow-up recorded interview conducted with housekeeper Elena Rostova. Rostova claimed under oath that at approximately 10:45 PM on October 24th, she heard raised voices from the study and witnessed an unidentified figure in dark clothing flee on foot through the estate garden gate, claiming the garden gate was standing wide open.",
  },
  {
    title: "Note 8: Groundskeeper David Chen Statement (Witness Contradiction)",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-26T16:45:00Z"),
    text: "Interviewed groundskeeper David Chen at Blackwood Manor. In direct contradiction to Elena Rostova's account, Chen stated that he personally secured the estate garden gate with a heavy steel chain and padlock at 10:00 PM on October 24th. Chen inspected the gate at 11:30 PM and confirmed the padlock remained locked and completely undisturbed, making foot escape through the garden gate physically impossible.",
  },

  // --- DAY 3: October 27, 2026 ---
  {
    title: "Note 9: Victor Sterling Interrogation & Claimed Alibi",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-27T09:30:00Z"),
    text: "Formal interrogation conducted with business partner Victor Sterling at precinct headquarters. Sterling admitted a severe financial dispute with Julian Vance over missing corporate funds, but denied visiting Blackwood Manor. Sterling claimed an alibi of being alone at his 820 Elm Street apartment watching a televised soccer broadcast between 09:00 PM and midnight on October 24th.",
  },
  {
    title: "Note 10: Surveillance Review & Unverified/Broken Alibi",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-27T13:15:00Z"),
    text: "Subpoenaed lobby surveillance footage from 820 Elm Street. The timestamped video refutes Victor Sterling's alibi: Sterling was recorded exiting the building lobby at 09:45 PM on October 24th dressed in dark clothing, and did not return until 12:15 AM on October 25th. His claimed alibi is unverified, broken by physical video records.",
  },
  {
    title: "Note 11: Estranged Spouse Claire Vance Interview",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-27T16:00:00Z"),
    text: "Interviewed estranged spouse Claire Vance at her attorney's office. Claire Vance admitted visiting Julian Vance at Blackwood Manor on the evening of October 24th between 08:30 PM and 09:15 PM to deliver contested divorce documents. She stated Julian was alive and alone when she departed in a rideshare vehicle at 09:20 PM.",
  },

  // --- DAY 4: October 28, 2026 ---
  {
    title: "Note 12: Claire Vance Rideshare Alibi Corroboration",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-28T10:00:00Z"),
    text: "Uber transit records and GPS verification for Claire Vance corroborate her testimony: rideshare pickup confirmed at Blackwood Manor main gate at 09:22 PM on October 24th, arriving at her downtown residence at 09:55 PM. Claire Vance's alibi for the established time of death window (10:15 PM - 11:15 PM) is independently verified.",
  },
  {
    title: "Note 13: Financial Audit & Embezzlement Motive",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-28T13:30:00Z"),
    text: "Forensic financial audit of Vance-Sterling Technologies reveals Victor Sterling embezzled $1.8 million from partnership escrow accounts over the preceding six months. A draft termination and criminal referral notice dated October 24, 2026, addressed to Victor Sterling, was discovered open on Julian Vance's desktop computer at Blackwood Manor.",
  },
  {
    title: "Note 14: Latent Fingerprint Forensic Match on Weapon",
    investigatorName: "Det. Marcus Cruz",
    investigatorKey: "investigator2",
    date: new Date("2026-10-28T15:45:00Z"),
    text: "Crime laboratory latent print analysis completed on the bronze paperweight recovered from the Blackwood Manor study. A partial latent thumbprint matching the right thumb of suspect Victor Sterling was positively identified on the base of the paperweight.",
  },
  {
    title: "Note 15: Search Warrant Execution & Vehicle Impound",
    investigatorName: "Det. Sarah Miller",
    investigatorKey: "investigator1",
    date: new Date("2026-10-28T17:30:00Z"),
    text: "Search warrant executed on Victor Sterling's silver 2021 Audi A6 sedan (plate 7XYZ89). Forensics impounded the vehicle and detected microscopic blood spatter on the steering column. Blood samples from the Audi A6 and Sterling's dark jacket submitted for rapid DNA sequencing against victim Julian Vance.",
  },
];

async function seed() {
  console.log("==================================================================");
  console.log(" CaseMemory: Synthetic Murder Case Seeding (Step 7)");
  console.log("==================================================================");

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
    console.log("✓ Connected to MongoDB Atlas cluster.\n");
    const db = client.db(dbName);
    const usersCol = db.collection("users");
    const casesCol = db.collection("cases");

    // ------------------------------------------------------------------
    // 1. Seed or Verify Demo Users (Investigators, Admin, Viewer)
    // ------------------------------------------------------------------
    console.log("1. Seeding Investigator & Demo Accounts...");
    const userCredentials = [
      {
        key: "admin",
        email: "admin@casememory.local",
        password: "AdminPass123!",
        name: "Chief Inspector Sterling",
        role: "admin",
      },
      {
        key: "investigator1",
        email: "investigator@casememory.local",
        password: "InvestPass123!",
        name: "Det. Sarah Miller",
        role: "investigator",
      },
      {
        key: "investigator2",
        email: "cruz@casememory.local",
        password: "InvestPass123!",
        name: "Det. Marcus Cruz",
        role: "investigator",
      },
      {
        key: "viewer",
        email: "viewer@casememory.local",
        password: "ViewerPass123!",
        name: "Analyst James Cole",
        role: "viewer",
      },
    ];

    const userMap: Record<string, { id: string; name: string }> = {};

    for (const u of userCredentials) {
      const passwordHash = await bcrypt.hash(u.password, 10);
      const res = await usersCol.findOneAndUpdate(
        { email: u.email },
        {
          $set: {
            name: u.name,
            role: u.role,
            passwordHash,
            updatedAt: new Date(),
          },
          $setOnInsert: {
            createdAt: new Date(),
          },
        },
        { upsert: true, returnDocument: "after" }
      );

      const id = res?._id?.toString() || "";
      userMap[u.key] = { id, name: u.name };
      console.log(`  ✓ [${u.role.toUpperCase()}] ${u.name} (${u.email})`);
    }

    // ------------------------------------------------------------------
    // 2. Initialize The Blackwood Manor Homicide Case (Idempotent cleanup)
    // ------------------------------------------------------------------
    const caseTitle = "The Blackwood Manor Homicide";
    console.log(`\n2. Initializing Target Case: "${caseTitle}"...`);

    const existingCase = await casesCol.findOne({ title: caseTitle });
    if (existingCase) {
      const oldCaseId = existingCase._id.toString();
      console.log(`  ⚠ Found previous seed for Case ID: ${oldCaseId}. Cleaning up stale records...`);
      await db.collection("notes").deleteMany({ caseId: oldCaseId });
      await db.collection("events").deleteMany({ caseId: oldCaseId });
      await db.collection("entities").deleteMany({ caseId: oldCaseId });
      await db.collection("openQuestions").deleteMany({ caseId: oldCaseId });
      await db.collection("queries").deleteMany({ caseId: oldCaseId });
      await casesCol.deleteOne({ _id: existingCase._id });
      console.log("  ✓ Previous records removed.");
    }

    const memberIds = [
      userMap.investigator1.id,
      userMap.investigator2.id,
      userMap.viewer.id,
    ].filter(Boolean);

    const insertCaseRes = await casesCol.insertOne({
      title: caseTitle,
      description:
        "Forensic homicide investigation into the death of tech entrepreneur Julian Vance at the Blackwood Manor estate.",
      status: "active",
      memberIds,
      summary: "",
      createdBy: userMap.admin.id || "admin",
      createdAt: new Date("2026-10-25T08:00:00Z"),
      updatedAt: new Date("2026-10-25T08:00:00Z"),
    });

    const caseId = insertCaseRes.insertedId.toString();
    console.log(`  ✓ Created Case Document with ID: ${caseId}`);
    console.log(`    Assigned Member IDs: ${memberIds.join(", ")}\n`);

    // ------------------------------------------------------------------
    // 3. Ingest All 15 Synthetic Notes Sequentially via Real Pipeline
    // ------------------------------------------------------------------
    console.log("3. Ingesting 15 Synthetic Notes via Real Production Pipeline...");
    console.log("   (Each note runs through LLM extraction, embedding, entity deduplication & memory synthesis)\n");

    for (let i = 0; i < SYNTHETIC_NOTES.length; i++) {
      const note = SYNTHETIC_NOTES[i];
      const authorId = userMap[note.investigatorKey]?.id || note.investigatorName;
      const formattedDate = note.date.toISOString().split("T")[0];

      console.log(`------------------------------------------------------------------`);
      console.log(`[Note ${i + 1}/15] ${note.title}`);
      console.log(`Author: ${note.investigatorName} | Date: ${formattedDate}`);
      console.log(`Text: "${note.text}"\n`);

      const startTime = Date.now();
      const result = await ingestFact(caseId, authorId, note.text, undefined, note.date);
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

      console.log(`  ✓ Note #${result.noteId} stored in ${elapsed}s`);
      console.log(`  ✓ Events Extracted & Embedded: ${result.eventsSaved}`);
      for (const ev of result.extracted.events) {
        console.log(`     • [Event] ${ev.what} (when: ${ev.whenText || "null"}, where: ${ev.where || "null"})`);
      }

      console.log(`  ✓ Entities: +${result.entitiesCreated} created, ${result.entitiesUpdated} updated`);
      for (const ent of result.extracted.entities) {
        console.log(`     • [${ent.type.toUpperCase()}] ${ent.name} (role: ${ent.role}, alibi: ${ent.alibiStatus})`);
      }

      if (result.openQuestionsSaved > 0) {
        console.log(`  ✓ Open Questions Logged: ${result.openQuestionsSaved}`);
        for (const q of result.extracted.open_questions) {
          console.log(`     ? ${q}`);
        }
      }

      console.log(`  ✓ Updated Working Memory Summary:\n    "${result.runningSummary}"\n`);

      // Gentle pause to respect API rate limits
      if (i < SYNTHETIC_NOTES.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // ------------------------------------------------------------------
    // 4. Verify Case Memory, Suspect Scoring & Evidentiary Gaps
    // ------------------------------------------------------------------
    console.log("==================================================================");
    console.log(" 4. Post-Ingest Case Intelligence Verification");
    console.log("==================================================================");

    const [allNotes, allEvents, allEntities, allQuestions, finalCaseDoc] =
      await Promise.all([
        db.collection("notes").find({ caseId }).sort({ createdAt: 1 }).toArray(),
        db.collection("events").find({ caseId }).sort({ whenISO: 1, createdAt: 1 }).toArray(),
        db.collection("entities").find({ caseId }).toArray(),
        db.collection("openQuestions").find({ caseId, status: "open" }).toArray(),
        casesCol.findOne({ _id: new ObjectId(caseId) }),
      ]);

    const suspectScores = computeSuspectScores(allEntities, allEvents, allNotes);
    const gaps = detectGaps(allEvents, allEntities, allQuestions);

    console.log(`Total Notes Ingested:        ${allNotes.length}`);
    console.log(`Total Timeline Events:       ${allEvents.length}`);
    console.log(`Total Unique Entities:       ${allEntities.length}`);
    console.log(`Total Active Open Questions: ${allQuestions.length}`);
    console.log(`Detected Evidentiary Gaps:   ${gaps.length}`);

    console.log("\n--- Suspect Score Rankings (Dynamic Memory Computation) ---");
    for (let i = 0; i < suspectScores.length; i++) {
      const s = suspectScores[i];
      console.log(`  #${i + 1} ${s.name} (Role: ${s.role}, Alibi: ${s.breakdown.alibi.status}) -> Total Score: ${s.totalScore}`);
      console.log(`     Breakdown: Events=${s.breakdown.linkedEvents.points}, Proximity=${s.breakdown.proximity.points}, Motive=${s.breakdown.motiveOrIncrimination.points}, Alibi=${s.breakdown.alibi.points}`);
    }

    console.log("\n--- Final Executive Working Memory Summary ---");
    console.log(`"${finalCaseDoc?.summary}"`);

    console.log("\n==================================================================");
    console.log(" Synthetic Seed Case Successfully Generated!");
    console.log("==================================================================");
    console.log(`Case Title: "${caseTitle}"`);
    console.log(`Case ID:    ${caseId}`);
    console.log(`\nView in browser: http://localhost:3000/cases/${caseId}`);
    console.log("==================================================================\n");
  } catch (err: any) {
    console.error("❌ Synthetic Seeding Error:", err?.message || err);
    process.exit(1);
  } finally {
    await client.close();
  }
}

seed();

