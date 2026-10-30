import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { embed, getEmbeddingDimension } from "@/lib/llm";

export const dynamic = "force-dynamic";

/**
 * Test endpoint to verify embedding generation, storing vectors in MongoDB,
 * and performing a live $vectorSearch query with cosine similarity and caseId filtering.
 */
export async function GET(req: NextRequest) {
  const testCaseId = `test-case-${Date.now()}`;
  const testText =
    "Witness reported a dark blue sedan speeding away from the industrial warehouse near 4th street at 11:45 PM.";
  const queryText = "What car was seen near the warehouse at night?";

  const results: Record<string, unknown> = {
    testCaseId,
    configuredDimension: getEmbeddingDimension(),
  };

  try {
    // 1. Generate embedding for test note
    const noteEmbedding = await embed(testText);
    results.noteEmbeddingLength = noteEmbedding.length;

    // 2. Insert test note with embedding into MongoDB
    const db = await getDb();
    const notesCol = db.collection("notes");

    const insertRes = await notesCol.insertOne({
      caseId: testCaseId,
      authorId: "test-system",
      text: testText,
      embedding: noteEmbedding,
      createdAt: new Date(),
      isTestRecord: true,
    });
    results.insertedNoteId = insertRes.insertedId.toString();

    // 3. Generate embedding for search query
    const queryEmbedding = await embed(queryText);
    results.queryEmbeddingLength = queryEmbedding.length;

    // 4. Run $vectorSearch query
    try {
      const vectorSearchResults = await notesCol
        .aggregate([
          {
            $vectorSearch: {
              index: "notes_vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 10,
              limit: 5,
              filter: {
                caseId: testCaseId,
              },
            },
          },
          {
            $project: {
              _id: 1,
              caseId: 1,
              text: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray();

      results.vectorSearchStatus = "success";
      results.vectorSearchResults = vectorSearchResults;
      results.matchedCount = vectorSearchResults.length;
    } catch (searchError: any) {
      results.vectorSearchStatus = "index_pending_or_error";
      results.vectorSearchError = searchError.message;
      results.hint =
        "If you recently ran setup-db.ts, Atlas Vector Search takes ~1-2 minutes to finish building the index. Once the index shows 'Active' in Atlas, this query will succeed.";
    }

    // 5. Clean up test record
    await notesCol.deleteOne({ _id: insertRes.insertedId });
    results.cleanedUp = true;

    return NextResponse.json({
      status: "ok",
      message: "Embedding generation and MongoDB vector storage verified successfully",
      data: results,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: "error",
        message: err?.message || "Vector test failed",
        data: results,
      },
      { status: 500 }
    );
  }
}

