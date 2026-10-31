import { NextRequest, NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { canAccessCaseById, canWriteCaseById } from "@/lib/rbac";
import { computeSuspectScores, detectGaps } from "@/lib/query";
import { normalizeEntityName } from "@/lib/entity-matcher";

export const dynamic = "force-dynamic";

/**
 * GET /api/cases/[id]/entities
 * Lists all tracked entities (persons, vehicles, places, objects) for the case.
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
    const hasAccess = await canAccessCaseById(session, caseId);
    if (!hasAccess) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: You are not assigned to this case" },
        { status: 403 }
      );
    }

    const db = await getDb();
    const entities = await db
      .collection("entities")
      .find({ caseId })
      .sort({ role: 1, name: 1 })
      .toArray();

    return NextResponse.json({
      status: "ok",
      entities: entities.map((e) => ({
        id: e._id.toString(),
        name: e.name,
        aliases: e.aliases || [],
        type: e.type || "person",
        role: e.role || "other",
        alibiStatus: e.alibiStatus || "unknown",
        alibiDetails: e.alibiDetails || "",
        eventIds: e.eventIds || [],
        noteIds: e.noteIds || [],
        createdAt: e.createdAt,
        updatedAt: e.updatedAt,
      })),
    });
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to fetch entities" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cases/[id]/entities
 * Directly update an entity's alibi status, role, name (typo correction), or aliases.
 * Supports resolving contradictions (e.g., superseding School ABCD with PQRT).
 */
export async function PATCH(
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
    const canWrite = await canWriteCaseById(session, caseId);
    if (!canWrite) {
      return NextResponse.json(
        { status: "error", message: "Forbidden: Viewers have read-only access and cannot modify entity records." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { entityId, name, role, alibiStatus, alibiDetails, aliases, supersedesEntityId } = body;

    if (!entityId || typeof entityId !== "string") {
      return NextResponse.json(
        { status: "error", message: "entityId is required" },
        { status: 400 }
      );
    }

    const db = await getDb();
    const entitiesCol = db.collection("entities");

    let targetQuery: any = { _id: entityId, caseId };
    if (ObjectId.isValid(entityId)) {
      targetQuery = { _id: new ObjectId(entityId), caseId };
    }

    const existing = await entitiesCol.findOne(targetQuery);
    if (!existing) {
      return NextResponse.json(
        { status: "error", message: "Entity not found in this case" },
        { status: 404 }
      );
    }

    const updateFields: any = {
      updatedAt: new Date(),
    };

    if (name && typeof name === "string") {
      updateFields.name = name.trim();
    }

    if (role && ["victim", "suspect", "witness", "other"].includes(role)) {
      updateFields.role = role;
    }

    if (alibiStatus && ["unknown", "claimed", "verified", "broken"].includes(alibiStatus)) {
      updateFields.alibiStatus = alibiStatus;
    }

    if (typeof alibiDetails === "string") {
      updateFields.alibiDetails = alibiDetails.trim();
    }

    if (Array.isArray(aliases)) {
      const mergedAliases = Array.from(
        new Set([
          ...(existing.aliases || []),
          ...aliases.map((a: string) => a.trim()).filter(Boolean),
        ])
      );
      updateFields.aliases = mergedAliases;
    }

    // Handle superseding / resolving an older incorrect entity (e.g. ABCD superseded by PQRT)
    if (supersedesEntityId && typeof supersedesEntityId === "string") {
      let superQuery: any = { _id: supersedesEntityId, caseId };
      if (ObjectId.isValid(supersedesEntityId)) {
        superQuery = { _id: new ObjectId(supersedesEntityId), caseId };
      }
      const supersededDoc = await entitiesCol.findOne(superQuery);
      if (supersededDoc) {
        // Merge eventIds and noteIds
        const combinedEventIds = Array.from(
          new Set([...(existing.eventIds || []), ...(supersededDoc.eventIds || [])])
        );
        const combinedNoteIds = Array.from(
          new Set([...(existing.noteIds || []), ...(supersededDoc.noteIds || [])])
        );
        const combinedAliases = Array.from(
          new Set([
            ...(existing.aliases || []),
            supersededDoc.name,
            ...(supersededDoc.aliases || []),
          ])
        );

        updateFields.eventIds = combinedEventIds;
        updateFields.noteIds = combinedNoteIds;
        updateFields.aliases = combinedAliases;

        // Remove the superseded erroneous entity
        await entitiesCol.deleteOne(superQuery);

        // Resolve open questions referencing this contradiction
        await db.collection("openQuestions").updateMany(
          {
            caseId,
            status: "open",
            text: { $regex: new RegExp(supersededDoc.name, "i") },
          },
          {
            $set: {
              status: "resolved",
              resolvedAt: new Date(),
            },
          }
        );
      }
    }

    await entitiesCol.updateOne(targetQuery, { $set: updateFields });

    // Fetch updated data for real-time recalculation
    const [allEntities, allEvents, allNotes, allQuestions] = await Promise.all([
      entitiesCol.find({ caseId }).sort({ role: 1, name: 1 }).toArray(),
      db.collection("events").find({ caseId }).sort({ whenISO: 1, createdAt: 1 }).toArray(),
      db.collection("notes").find({ caseId }).sort({ createdAt: -1 }).toArray(),
      db.collection("openQuestions").find({ caseId, status: "open" }).toArray(),
    ]);

    const updatedSuspects = computeSuspectScores(allEntities, allEvents, allNotes);
    const updatedGaps = detectGaps(allEvents, allEntities, allQuestions);

    const updatedEntity = await entitiesCol.findOne(targetQuery);

    return NextResponse.json({
      status: "ok",
      message: `Entity "${updatedEntity?.name || existing.name}" updated successfully.`,
      entity: {
        id: updatedEntity?._id?.toString(),
        name: updatedEntity?.name,
        aliases: updatedEntity?.aliases || [],
        type: updatedEntity?.type,
        role: updatedEntity?.role,
        alibiStatus: updatedEntity?.alibiStatus,
        alibiDetails: updatedEntity?.alibiDetails || "",
      },
      suspects: updatedSuspects,
      gaps: updatedGaps,
    });
  } catch (err: any) {
    console.error("Error updating entity:", err);
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to update entity" },
      { status: 500 }
    );
  }
}

