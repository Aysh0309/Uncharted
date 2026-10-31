import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessCase } from "@/lib/rbac";
import { computeSuspectScores, detectGaps } from "@/lib/query";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[id]
 * Retrieves comprehensive case context (case metadata, timeline events, entities,
 * notes, open questions, computed suspects & gaps), enforcing RBAC.
 */
export async function GET(
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
    let query: any = { _id: caseId };
    if (ObjectId.isValid(caseId)) {
      query = { _id: new ObjectId(caseId) };
    }

    const db = await getDb();
    const caseDoc = await db.collection("cases").findOne(query);

    if (!caseDoc) {
      return NextResponse.json(
        { status: "error", message: "Case not found" },
        { status: 404 }
      );
    }

    if (!canAccessCase(session, caseDoc as any)) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: You are not assigned to this case" },
        { status: 403 }
      );
    }

    // Parallel fetch of all case collections (omitting high-dimensional vectors for fast wire transfer)
    const [events, entities, notes, openQuestions, queriesHistory] =
      await Promise.all([
        db
          .collection("events")
          .find({ caseId }, { projection: { embedding: 0 } })
          .sort({ whenISO: 1, createdAt: 1 })
          .toArray(),
        db
          .collection("entities")
          .find({ caseId })
          .sort({ role: 1, name: 1 })
          .toArray(),
        db
          .collection("notes")
          .find({ caseId }, { projection: { embedding: 0 } })
          .sort({ createdAt: -1 })
          .toArray(),
        db
          .collection("openQuestions")
          .find({ caseId, status: "open" })
          .sort({ createdAt: -1 })
          .toArray(),
        db
          .collection("queries")
          .find({ caseId })
          .sort({ createdAt: 1 })
          .limit(20)
          .toArray(),
      ]);

    // Compute suspect ranking & evidentiary gaps in code
    const suspects = computeSuspectScores(entities, events, notes);
    const gaps = detectGaps(events, entities, openQuestions);

    return NextResponse.json({
      status: "ok",
      case: {
        id: caseDoc._id.toString(),
        title: caseDoc.title,
        description: caseDoc.description || "",
        status: caseDoc.status || "active",
        memberIds: caseDoc.memberIds || [],
        summary: caseDoc.summary || "",
        createdBy: caseDoc.createdBy,
        createdAt: caseDoc.createdAt,
      },
      events: events.map((e) => ({
        id: e._id.toString(),
        noteId: e.noteId,
        what: e.what,
        who: e.who || [],
        whenText: e.whenText || "",
        whenISO: e.whenISO || null,
        where: e.where || null,
        confidence: e.confidence ?? 1.0,
        createdAt: e.createdAt,
      })),
      entities: entities.map((ent) => ({
        id: ent._id.toString(),
        name: ent.name,
        aliases: ent.aliases || [],
        type: ent.type || "person",
        role: ent.role || "other",
        alibiStatus: ent.alibiStatus || "unknown",
        alibiDetails: ent.alibiDetails || "",
        eventIds: ent.eventIds || [],
        noteIds: ent.noteIds || [],
      })),
      notes: notes.map((n) => ({
        id: n._id.toString(),
        text: n.text,
        authorId: n.authorId,
        createdAt: n.createdAt,
      })),
      openQuestions: openQuestions.map((q) => ({
        id: q._id.toString(),
        text: q.text,
        status: q.status,
        noteId: q.noteId,
        createdAt: q.createdAt,
      })),
      suspects,
      gaps,
      queries: queriesHistory.map((q) => ({
        id: q._id.toString(),
        question: q.question,
        answer: q.answer,
        citations: q.citations || [],
        createdAt: q.createdAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to load case data" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/cases/[id]
 * Administrator-only endpoint to permanently remove a case and all linked records
 * (notes, timeline events, entities, open questions, and queries).
 */
export async function DELETE(
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

    if (session.role !== "admin") {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Only administrators can delete cases" },
        { status: 403 }
      );
    }

    const caseId = params.id;
    let query: any = { _id: caseId };
    if (ObjectId.isValid(caseId)) {
      query = { _id: new ObjectId(caseId) };
    }

    const db = await getDb();
    const caseDoc = await db.collection("cases").findOne(query);

    if (!caseDoc) {
      return NextResponse.json(
        { status: "error", message: "Case not found" },
        { status: 404 }
      );
    }

    // Cascade delete across all linked collections
    await Promise.all([
      db.collection("cases").deleteOne(query),
      db.collection("notes").deleteMany({ caseId }),
      db.collection("events").deleteMany({ caseId }),
      db.collection("entities").deleteMany({ caseId }),
      db.collection("openQuestions").deleteMany({ caseId }),
      db.collection("queries").deleteMany({ caseId }),
    ]);

    return NextResponse.json({
      status: "ok",
      message: `Case "${caseDoc.title}" and all associated evidentiary records have been deleted.`,
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to delete case" },
      { status: 500 }
    );
  }
}
