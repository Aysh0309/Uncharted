import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { canAccessCaseById, canWriteCaseById } from "@/lib/rbac";
import { IngestMessageInputSchema } from "@/lib/models";
import { classifyMessage, ingestFact } from "@/lib/ingest";
import { answerQuestion } from "@/lib/query";
import { checkRateLimit } from "@/lib/ratelimit";
import { embed } from "@/lib/llm";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // 60s max serverless duration budget for robust pipeline completion

/**
 * POST /api/cases/[id]/message
 * Unified intake endpoint for case messages (facts, questions, or hybrid).
 * - Enforces server-side authentication, per-user MongoDB TTL rate-limiting, and case access scoping.
 * - Concurrently runs intent classification + text embedding to eliminate redundant network round trips.
 * - Routes to the extraction & memory ingestion pipeline for facts.
 * - Routes to vector retrieval + deterministic suspect/gap code + grounded LLM answering for questions.
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

    // 1. Rate Limiting: Max 20 requests per minute per user stored in MongoDB with TTL index
    const rateCheck = await checkRateLimit(session.id, 20, 60);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          status: "error",
          message: "Rate limit exceeded (maximum 20 requests per minute). Please wait a moment before trying again.",
          limit: rateCheck.limit,
          resetInSeconds: rateCheck.resetInSeconds,
        },
        { status: 429 }
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

    // 2. Parallel Router & Embedding: Run classification + text embedding concurrently
    const [classification, textEmbedding] = await Promise.all([
      classifyMessage(text),
      embed(text),
    ]);

    // 3. Fact Ingestion Path
    if (classification === "fact") {
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

      // Pass precomputed textEmbedding to skip redundant embedding step
      const ingestResult = await ingestFact(caseId, session.id, text, textEmbedding);
      return NextResponse.json({
        status: "ok",
        type: "fact",
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

    // 4. Question Path (Grounded Memory Retrieval + Deterministic Code Analysis)
    if (classification === "question") {
      // Pass precomputed textEmbedding directly as questionEmbedding
      const answerResult = await answerQuestion(caseId, session.id, text, textEmbedding);
      return NextResponse.json({
        status: "ok",
        type: "question",
        queryId: answerResult.queryId,
        question: answerResult.question,
        answer: answerResult.answer,
        citations: answerResult.citations,
        suspects: answerResult.suspects,
        gaps: answerResult.gaps,
      });
    }

    // 5. Hybrid Path ("both"): Fact Ingestion + Grounded Answer
    const canWrite = await canWriteCaseById(session, caseId);
    let ingestResult = null;
    if (canWrite) {
      ingestResult = await ingestFact(caseId, session.id, text, textEmbedding);
    }

    const answerResult = await answerQuestion(caseId, session.id, text, textEmbedding);

    return NextResponse.json({
      status: "ok",
      type: "both",
      message: ingestResult
        ? `Fact ingested (Note #${ingestResult.noteId}) and question answered from case memory.`
        : "Question answered from case memory (Viewer mode: fact ingestion skipped).",
      ingested: ingestResult,
      queryId: answerResult.queryId,
      question: answerResult.question,
      answer: answerResult.answer,
      citations: answerResult.citations,
      suspects: answerResult.suspects,
      gaps: answerResult.gaps,
    });
  } catch (err: any) {
    console.error("Error in /api/cases/[id]/message:", err);
    return NextResponse.json(
      { status: "error", message: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
