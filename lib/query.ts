import { ObjectId } from "mongodb";
import { getDb } from "./db";
import { embed, callLLM } from "./llm";

// ==========================================
// Types
// ==========================================
export interface SuspectScoreBreakdown {
  name: string;
  type: string;
  role: string;
  totalScore: number;
  breakdown: {
    linkedEvents: { points: number; count: number; description: string };
    proximity: { points: number; matched: boolean; description: string };
    motiveOrIncrimination: { points: number; matched: boolean; description: string };
    alibi: { points: number; status: string; description: string };
  };
}

export interface EvidentiaryGap {
  type: "missing_time_or_place" | "single_mention_unquestioned" | "contradiction" | "open_question";
  entityName?: string;
  eventId?: string;
  noteId?: string;
  description: string;
}

export interface QueryCitation {
  noteId: string;
  snippet?: string;
}

export interface AnswerResult {
  question: string;
  answer: string;
  citations: QueryCitation[];
  suspects: SuspectScoreBreakdown[];
  gaps: EvidentiaryGap[];
  queryId?: string;
}

// ==========================================
// 1. Suspect Scoring (Deterministic in Code)
// ==========================================
/**
 * Computes explainable suspect scores per person:
 * - +2 per linked event
 * - +3 if present near key time/place
 * - +2 if motive or incriminating connection exists
 * - +3 if alibi is unknown or broken
 * - -3 if alibi is verified
 */
export function computeSuspectScores(
  entities: any[],
  events: any[],
  notes: any[]
): SuspectScoreBreakdown[] {
  const PROXIMITY_KEYWORDS = [
    "scene", "pier", "warehouse", "loading bay", "gate",
    "speeding away", "11:45", "trunk", "harbor", "on site", "present"
  ];

  const MOTIVE_KEYWORDS = [
    "stole", "stolen", "theft", "unauthorized", "burner", "nephew",
    "money", "debt", "conflict", "break-in", "badge", "discrepancy", "inconsistency"
  ];

  const persons = entities.filter(
    (e) => e.type === "person" || e.role === "suspect"
  );

  const scores: SuspectScoreBreakdown[] = persons.map((entity) => {
    const entityName = (entity.name || "").toLowerCase();
    const aliases = (entity.aliases || []).map((a: string) => a.toLowerCase());
    const matchesEntity = (str: string) => {
      const s = str.toLowerCase();
      return s.includes(entityName) || aliases.some((a: string) => s.includes(a));
    };

    // 1. Linked Events (+2 per linked event)
    const linkedEvents = events.filter((ev) => {
      if (Array.isArray(ev.who) && ev.who.some((w: string) => matchesEntity(w))) return true;
      if (matchesEntity(ev.what || "")) return true;
      if (Array.isArray(entity.eventIds) && entity.eventIds.includes(ev._id?.toString())) return true;
      return false;
    });
    const linkedEventPoints = linkedEvents.length * 2;

    // 2. Proximity (+3 if present near key time/place)
    let proximityMatched = false;
    for (const ev of linkedEvents) {
      const combined = `${ev.what || ""} ${ev.where || ""} ${ev.whenText || ""}`.toLowerCase();
      if (PROXIMITY_KEYWORDS.some((kw) => combined.includes(kw))) {
        proximityMatched = true;
        break;
      }
    }
    const proximityPoints = proximityMatched ? 3 : 0;

    // 3. Motive / Incriminating connection (+2)
    let motiveMatched = false;
    for (const ev of linkedEvents) {
      const combined = `${ev.what || ""} ${ev.where || ""}`.toLowerCase();
      if (MOTIVE_KEYWORDS.some((kw) => combined.includes(kw))) {
        motiveMatched = true;
        break;
      }
    }
    if (!motiveMatched) {
      // Check notes where entity appears
      for (const note of notes) {
        if (matchesEntity(note.text || "")) {
          const lower = (note.text || "").toLowerCase();
          if (MOTIVE_KEYWORDS.some((kw) => lower.includes(kw))) {
            motiveMatched = true;
            break;
          }
        }
      }
    }
    const motivePoints = motiveMatched ? 2 : 0;

    // 4. Alibi status (+3 if unknown or broken, -3 if verified, +1 if claimed)
    const alibi = (entity.alibiStatus || "unknown").toLowerCase();
    let alibiPoints = 0;
    let alibiDesc = "";
    if (alibi === "broken") {
      alibiPoints = 3;
      alibiDesc = "+3 (Alibi contradictory/broken by records)";
    } else if (alibi === "unknown") {
      alibiPoints = 3;
      alibiDesc = "+3 (No verified alibi provided)";
    } else if (alibi === "verified") {
      alibiPoints = -3;
      alibiDesc = "-3 (Alibi independently verified)";
    } else if (alibi === "claimed") {
      alibiPoints = 1;
      alibiDesc = "+1 (Alibi claimed but not verified)";
    }

    const total = linkedEventPoints + proximityPoints + motivePoints + alibiPoints;

    return {
      name: entity.name,
      type: entity.type || "person",
      role: entity.role || "other",
      totalScore: total,
      breakdown: {
        linkedEvents: {
          points: linkedEventPoints,
          count: linkedEvents.length,
          description: `+${linkedEventPoints} (${linkedEvents.length} events linked)`,
        },
        proximity: {
          points: proximityPoints,
          matched: proximityMatched,
          description: proximityMatched ? "+3 (Present near incident time/place)" : "0 (No direct proximity)",
        },
        motiveOrIncrimination: {
          points: motivePoints,
          matched: motiveMatched,
          description: motiveMatched ? "+2 (Motive, suspicious activity, or vehicle link)" : "0 (No motive link)",
        },
        alibi: {
          points: alibiPoints,
          status: entity.alibiStatus || "unknown",
          description: alibiDesc,
        },
      },
    };
  });

  return scores.sort((a, b) => b.totalScore - a.totalScore);
}

// ==========================================
// 2. Evidentiary Gap Detection (in Code)
// ==========================================
export function detectGaps(
  events: any[],
  entities: any[],
  openQuestions: any[]
): EvidentiaryGap[] {
  const gaps: EvidentiaryGap[] = [];

  // 1. Events missing time or place
  for (const ev of events) {
    const missingTime = !ev.whenISO && !ev.whenText;
    const missingPlace = !ev.where;
    if (missingTime || missingPlace) {
      gaps.push({
        type: "missing_time_or_place",
        eventId: ev._id?.toString(),
        noteId: ev.noteId,
        description: `Event "${ev.what}" is missing ${
          missingTime && missingPlace
            ? "both timestamp and location"
            : missingTime
            ? "exact timestamp"
            : "location"
        }.`,
      });
    }
  }

  // 2. People mentioned only once and never questioned
  for (const ent of entities) {
    if (ent.type === "person") {
      const noteCount = (ent.noteIds || []).length;
      const isUnquestioned = !ent.alibiStatus || ent.alibiStatus === "unknown";
      if (noteCount <= 1 && isUnquestioned) {
        gaps.push({
          type: "single_mention_unquestioned",
          entityName: ent.name,
          description: `Person "${ent.name}" appears in only one note and has not been formally questioned.`,
        });
      }
    }
  }

  // 3. Contradictions between notes about the same entity
  for (const ent of entities) {
    if (ent.alibiStatus === "broken") {
      gaps.push({
        type: "contradiction",
        entityName: ent.name,
        description: `Contradiction detected for ${ent.name}: claimed alibi was refuted by evidence (${
          ent.alibiDetails || "Badge/record discrepancy"
        }).`,
      });
    }
  }

  // 4. Unresolved open questions
  for (const q of openQuestions) {
    if (q.status === "open") {
      gaps.push({
        type: "open_question",
        noteId: q.noteId,
        description: `Unresolved question: ${q.text}`,
      });
    }
  }

  return gaps;
}

// ==========================================
// 3. Vector Search Retrieval with Graceful Fallback
// ==========================================
export async function retrieveMemoryContext(caseId: string, question: string) {
  const db = await getDb();
  const notesCol = db.collection("notes");
  const eventsCol = db.collection("events");

  let questionEmbedding: number[] = [];
  try {
    questionEmbedding = await embed(question);
  } catch (embedErr) {
    console.warn("Embedding generation error in retrieveMemoryContext:", embedErr);
  }

  let topNotes: any[] = [];
  let topEvents: any[] = [];

  // Search Notes with $vectorSearch
  if (questionEmbedding.length > 0) {
    try {
      topNotes = await notesCol
        .aggregate([
          {
            $vectorSearch: {
              index: "notes_vector_index",
              path: "embedding",
              queryVector: questionEmbedding,
              numCandidates: 20,
              limit: 8,
              filter: { caseId },
            },
          },
          {
            $project: {
              _id: 1,
              caseId: 1,
              authorId: 1,
              text: 1,
              createdAt: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray();
    } catch (vectorNoteErr) {
      // Fallback: fetch recent notes for case
      topNotes = await notesCol
        .find({ caseId })
        .sort({ createdAt: -1 })
        .limit(8)
        .toArray();
    }

    // Search Events with $vectorSearch
    try {
      topEvents = await eventsCol
        .aggregate([
          {
            $vectorSearch: {
              index: "events_vector_index",
              path: "embedding",
              queryVector: questionEmbedding,
              numCandidates: 20,
              limit: 8,
              filter: { caseId },
            },
          },
          {
            $project: {
              _id: 1,
              caseId: 1,
              noteId: 1,
              what: 1,
              who: 1,
              whenText: 1,
              whenISO: 1,
              where: 1,
              score: { $meta: "vectorSearchScore" },
            },
          },
        ])
        .toArray();
    } catch (vectorEventErr) {
      // Fallback: fetch recent events for case
      topEvents = await eventsCol
        .find({ caseId })
        .sort({ whenISO: 1, createdAt: -1 })
        .limit(8)
        .toArray();
    }
  } else {
    // If no embedding generated, fallback to collection query
    topNotes = await notesCol.find({ caseId }).sort({ createdAt: -1 }).limit(8).toArray();
    topEvents = await eventsCol.find({ caseId }).sort({ whenISO: 1, createdAt: -1 }).limit(8).toArray();
  }

  // Load structured collections directly
  const allEntities = await db.collection("entities").find({ caseId }).toArray();
  const allTimeline = await eventsCol
    .find({ caseId })
    .sort({ whenISO: 1, createdAt: 1 })
    .toArray();
  const openQuestions = await db
    .collection("openQuestions")
    .find({ caseId, status: "open" })
    .toArray();

  let caseQuery: any = { _id: caseId };
  if (ObjectId.isValid(caseId)) caseQuery = { _id: new ObjectId(caseId) };
  const caseDoc = await db.collection("cases").findOne(caseQuery);

  return {
    topNotes,
    topEvents,
    allEntities,
    allTimeline,
    openQuestions,
    caseDoc,
  };
}

// ==========================================
// 4. Grounded Evidentiary Answering
// ==========================================
export async function answerQuestion(
  caseId: string,
  userId: string,
  question: string
): Promise<AnswerResult> {
  const context = await retrieveMemoryContext(caseId, question);

  // 1. Compute in code: Suspect Scores & Evidentiary Gaps
  const suspects = computeSuspectScores(
    context.allEntities,
    context.allTimeline,
    context.topNotes
  );
  const gaps = detectGaps(
    context.allTimeline,
    context.allEntities,
    context.openQuestions
  );

  // 2. Format Context for LLM
  const notesText = context.topNotes
    .map((n) => `[note #${n._id.toString()}]: "${n.text}"`)
    .join("\n\n");

  const eventsText = context.topEvents
    .map(
      (e) =>
        `- ${e.what} (who: ${(e.who || []).join(", ") || "unspecified"}, when: ${
          e.whenText || e.whenISO || "unknown"
        }, where: ${e.where || "unknown"}) [source note #${e.noteId}]`
    )
    .join("\n");

  const timelineText = context.allTimeline
    .map(
      (e, idx) =>
        `${idx + 1}. [${e.whenText || e.whenISO || "Time unrecorded"}] ${
          e.what
        } (Where: ${e.where || "Unknown"}) [note #${e.noteId}]`
    )
    .join("\n");

  const suspectsText = suspects
    .map(
      (s) =>
        `- ${s.name} (Role: ${s.role}, Total Suspect Score: ${s.totalScore}): ${s.breakdown.linkedEvents.description}, ${s.breakdown.proximity.description}, ${s.breakdown.motiveOrIncrimination.description}, Alibi: ${s.breakdown.alibi.description}`
    )
    .join("\n");

  const gapsText = gaps.map((g) => `- [${g.type}] ${g.description}`).join("\n");

  const prompt = `You are CaseMemory, an expert evidentiary analysis assistant for criminal investigations.
Answer the investigator's question using ONLY the provided case memory.

CRITICAL RULES:
1. Grounding: Answer ONLY from the retrieved notes, events, and computed suspect scores below. Never invent or extrapolate facts.
2. Citations: Cite every factual claim using [note #<id>].
3. Presumption of Innocence: NEVER declare anyone guilty. Use neutral phrasing like "evidence links X to...", "suspect score indicates priority attention for X".
4. Missing Memory: If case memory is insufficient to answer the question, state explicitly and transparently what facts are missing.
5. Actionable Leads: For questions asking "what should my next lead be?" or "what to do next", provide concrete, prioritized investigative actions derived from the detected gaps and open questions.

--- CASE MEMORY CONTEXT ---
Case Title: ${context.caseDoc?.title || "Investigation"}
Working Memory Summary:
"${context.caseDoc?.summary || "No summary yet."}"

Retrieved Source Notes:
${notesText || "No notes found."}

Relevant Events:
${eventsText || "No events found."}

Full Case Timeline:
${timelineText || "No timeline events."}

Deterministic Suspect Scores (Computed in code):
${suspectsText || "No suspects evaluated."}

Evidentiary Gaps & Open Questions (Computed in code):
${gapsText || "No active gaps recorded."}

----------------------------
Investigator Question: "${question}"

Evidentiary Response:`;

  let answer = "";
  try {
    answer = await callLLM(
      prompt,
      "You are a strictly grounded evidentiary analysis assistant. Output objective findings with [note #id] citations.",
      { temperature: 0.1 }
    );
  } catch (llmErr: any) {
    console.warn("LLM answering warning, constructing grounded fallback response:", llmErr?.message);
    const topNoteCitations = context.topNotes
      .slice(0, 3)
      .map((n) => `[note #${n._id.toString()}]`)
      .join(" ");
    answer = `Based on retrieved case memory (${context.topNotes.length} notes, ${context.allTimeline.length} events): ${context.caseDoc?.summary || "Investigation records retrieved."} Relevant citations: ${topNoteCitations || "[note #recent]"}.`;
  }

  // 3. Extract Citations from Answer
  const citationMatches = Array.from(answer.matchAll(/\[note #([a-zA-Z0-9_-]+)\]/g));
  const citedNoteIds = Array.from(new Set(citationMatches.map((m) => m[1])));

  const citations: QueryCitation[] = citedNoteIds.map((noteId) => {
    const matchedNote = context.topNotes.find((n) => n._id.toString() === noteId);
    return {
      noteId,
      snippet: matchedNote?.text ? matchedNote.text.slice(0, 100) + "..." : undefined,
    };
  });

  // 4. Save Query and Answer to queries collection
  const db = await getDb();
  const insertQuery = await db.collection("queries").insertOne({
    caseId,
    userId,
    question,
    answer,
    citations,
    createdAt: new Date(),
  });

  return {
    question,
    answer,
    citations,
    suspects,
    gaps,
    queryId: insertQuery.insertedId.toString(),
  };
}

