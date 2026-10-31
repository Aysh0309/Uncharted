import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

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
const numDimensions = parseInt(process.env.EMBEDDING_DIMENSIONS || "768", 10);

async function setupDatabase() {
  console.log("====================================================");
  console.log(" CaseMemory: MongoDB Database & Vector Index Setup ");
  console.log("====================================================");
  console.log(`Database Name: ${dbName}`);
  console.log(`Embedding Dimensions: ${numDimensions} (Cosine Similarity)`);

  if (!uri) {
    console.error("\n❌ Error: MONGODB_URI is not defined.");
    console.error("Please add your MongoDB Atlas connection string to .env.local:\n");
    console.error("MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/casememory?retryWrites=true&w=majority\n");
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log(" Connected to MongoDB Atlas cluster.\n");
    const db = client.db(dbName);

    // ----------------------------------------------------
    // 1. Standard B-Tree Indexes
    // ----------------------------------------------------
    console.log("Creating standard collection indexes...");

    // users
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    console.log("  ✓ users: { email: 1 } (unique)");

    // cases
    await db.collection("cases").createIndex({ createdBy: 1 });
    await db.collection("cases").createIndex({ memberIds: 1 });
    console.log("  ✓ cases: { createdBy: 1 }, { memberIds: 1 }");

    // notes: caseId (critical for multi-tenant isolation) & createdAt
    await db.collection("notes").createIndex({ caseId: 1, createdAt: -1 });
    console.log("  ✓ notes: { caseId: 1, createdAt: -1 }");

    // events: caseId, noteId, whenISO
    await db.collection("events").createIndex({ caseId: 1, whenISO: 1 });
    await db.collection("events").createIndex({ noteId: 1 });
    console.log("  ✓ events: { caseId: 1, whenISO: 1 }, { noteId: 1 }");

    // entities: caseId, name, role, type
    await db.collection("entities").createIndex({ caseId: 1, name: 1 });
    await db.collection("entities").createIndex({ caseId: 1, role: 1 });
    await db.collection("entities").createIndex({ caseId: 1, type: 1 });
    console.log("  ✓ entities: { caseId: 1, name: 1 }, { caseId: 1, role: 1 }, { caseId: 1, type: 1 }");

    // openQuestions: caseId, status
    await db.collection("openQuestions").createIndex({ caseId: 1, status: 1 });
    await db.collection("openQuestions").createIndex({ noteId: 1 });
    console.log("  ✓ openQuestions: { caseId: 1, status: 1 }, { noteId: 1 }");

    // queries: caseId, userId, createdAt
    await db.collection("queries").createIndex({ caseId: 1, createdAt: -1 });
    console.log("  ✓ queries: { caseId: 1, createdAt: -1 }");

    // rateLimits: TTL index (prunes entries older than 120s automatically)
    await db.collection("rateLimits").createIndex({ createdAt: 1 }, { expireAfterSeconds: 120 });
    await db.collection("rateLimits").createIndex({ userId: 1, createdAt: -1 });
    console.log("  ✓ rateLimits: { createdAt: 1 } (TTL 120s), { userId: 1, createdAt: -1 }");

    // ----------------------------------------------------
    // 2. Atlas Vector Search Indexes
    // ----------------------------------------------------
    console.log("\nConfiguring Atlas Vector Search Indexes...");

    const vectorIndexDefinition = {
      fields: [
        {
          type: "vector",
          path: "embedding",
          numDimensions: numDimensions,
          similarity: "cosine",
        },
        {
          type: "filter",
          path: "caseId",
        },
      ],
    };

    // Index on notes.embedding
    await createVectorSearchIndex(
      db,
      "notes",
      "notes_vector_index",
      vectorIndexDefinition
    );

    // Index on events.embedding
    await createVectorSearchIndex(
      db,
      "events",
      "events_vector_index",
      vectorIndexDefinition
    );

    console.log("\nDatabase setup complete!");
    console.log("Note: Atlas Vector Search indexes usually take 1-2 minutes to transition to 'READY'.");
  } catch (error: any) {
    console.error("\n❌ Setup error:", error?.message || error);
  } finally {
    await client.close();
  }
}

async function createVectorSearchIndex(
  db: any,
  collectionName: string,
  indexName: string,
  definition: any
) {
  const collection = db.collection(collectionName);

  try {
    // Check if the search index already exists
    if (typeof collection.listSearchIndexes === "function") {
      try {
        const existingIndexes = await collection.listSearchIndexes().toArray();
        const exists = existingIndexes.some((idx: any) => idx.name === indexName);
        if (exists) {
          console.log(`  ℹ  Vector index '${indexName}' already exists on '${collectionName}'.`);
          return;
        }
      } catch (listErr: any) {
        // listSearchIndexes might not be available on some clusters/permissions; proceed to create
      }
    }

    if (typeof collection.createSearchIndex === "function") {
      await collection.createSearchIndex({
        name: indexName,
        type: "vectorSearch",
        definition: definition,
      });
      console.log(`  ✓ Created Atlas Vector Search index '${indexName}' on '${collectionName}'`);
    } else {
      printManualAtlasSearchInstructions(collectionName, indexName, definition);
    }
  } catch (err: any) {
    if (
      err.message?.includes("already exists") ||
      err.codeName === "IndexAlreadyExists"
    ) {
      console.log(`  ℹ  Vector index '${indexName}' already exists on '${collectionName}'.`);
    } else {
      console.warn(
        `  ⚠️  Driver could not automatically create search index '${indexName}' on '${collectionName}': ${err.message}`
      );
      printManualAtlasSearchInstructions(collectionName, indexName, definition);
    }
  }
}

function printManualAtlasSearchInstructions(
  collectionName: string,
  indexName: string,
  definition: any
) {
  console.log(`\n  ┌────────────────────────────────────────────────────────┐`);
  console.log(`  │ Manual Atlas Vector Search Setup for '${collectionName}' │`);
  console.log(`  └────────────────────────────────────────────────────────┘`);
  console.log(`  1. In MongoDB Atlas, go to "Atlas Search" -> "Create Search Index".`);
  console.log(`  2. Select "Atlas Vector Search" -> "JSON Editor".`);
  console.log(`  3. Select Database "${dbName}" and Collection "${collectionName}".`);
  console.log(`  4. Set Index Name to: "${indexName}"`);
  console.log(`  5. Paste this JSON configuration:`);
  console.log(JSON.stringify(definition, null, 2));
  console.log(`  ─────────────────────────────────────────────────────────\n`);
}

setupDatabase();
