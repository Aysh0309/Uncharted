import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessCaseById, canWriteCaseById } from "@/lib/rbac";
import { IngestMessageInputSchema } from "@/lib/models";
import { classifyMessage, ingestFact } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/**
 * POST /api/cases/[id]/message
 * Unified intake endpoint for case messages (facts, questions, or hybrid).
 * - Enforces server-side authentication and case access scoping.
 * - Routes to the extraction & memory ingestion pipeline for facts.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json(
        { status: "unauthenticated", message: "Login required" },
        { status: 401 }
      );
    }

    const caseId = params.id;
    const hasAccess = await canAccessCaseById(session, caseId);
    if (!hasAccess) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: You are not assigned to this case" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = IngestMessageInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          status: "error",
          message: "Validation failed",
          errors: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { text } = parsed.data;

    // 1. Router: Classify message as "fact", "question", or "both"
    const classification = await classifyMessage(text);

    // 2. Fact handling
    if (classification === "fact" || classification === "both") {
      // Check write permissions (Investigator/Admin only)
      const canWrite = await canWriteCaseById(session, caseId);
      if (!canWrite) {
        return NextResponse.json(
          {
            status: "error",
            message: "Forbidden: Viewers have read-only access and cannot submit case facts.",
            classification,
          },
          { status: 403 }
        );
      }

      // Execute ingestion pipeline
      const ingestResult = await ingestFact(caseId, session.id, text);

      return NextResponse.json({
        status: "ok",
        type: classification,
        message: `Fact successfully ingested and linked under Note #${ingestResult.noteId}`,
        noteId: ingestResult.noteId,
        eventsSaved: ingestResult.eventsSaved,
        entitiesCreated: ingestResult.entitiesCreated,
        entitiesUpdated: ingestResult.entitiesUpdated,
        openQuestionsSaved: ingestResult.openQuestionsSaved,
        runningSummary: ingestResult.runningSummary,
        extracted: {
          events: ingestResult.extracted.events,
          entities: ingestResult.extracted.entities,
          openQuestions: ingestResult.extracted.open_questions,
        },
      });
    }

    // 3. Question handling (Foundation for Step 5)
    return NextResponse.json({
      status: "ok",
      type: "question",
      message: "Question classified. Ready for memory retrieval answering in Step 5.",
      query: text,
    });
  } catch (err: any) {
    console.error("Error in /api/cases/[id]/message:", err);
    return NextResponse.json(
      { status: "error", message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

