import { z } from "zod";
import { ObjectId } from "mongodb";

/**
 * Custom Zod helper for MongoDB ObjectId string or instance
 */
export const ObjectIdSchema = z
  .union([z.string(), z.instanceof(ObjectId)])
  .transform((val) => (typeof val === "string" ? val : val.toHexString()));

// ==========================================
// 1. Users Collection
// ==========================================
export const UserRoleSchema = z.enum(["admin", "investigator", "viewer"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const UserSchema = z.object({
  _id: ObjectIdSchema.optional(),
  email: z.string().email(),
  passwordHash: z.string(),
  name: z.string().min(1),
  role: UserRoleSchema,
  createdAt: z.date().default(() => new Date()),
});
export type User = z.infer<typeof UserSchema>;

// ==========================================
// 2. Cases Collection
// ==========================================
export const CaseStatusSchema = z.enum(["active", "closed", "cold"]);
export type CaseStatus = z.infer<typeof CaseStatusSchema>;

export const CaseSchema = z.object({
  _id: ObjectIdSchema.optional(),
  title: z.string().min(1),
  description: z.string().default(""),
  status: CaseStatusSchema.default("active"),
  memberIds: z.array(z.string()).default([]), // User IDs who have access
  summary: z.string().default(""), // Running working memory summary
  createdBy: z.string(), // User ID
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
});
export type Case = z.infer<typeof CaseSchema>;

// ==========================================
// 3. Notes Collection (Raw ingested investigator notes)
// ==========================================
export const NoteSchema = z.object({
  _id: ObjectIdSchema.optional(),
  caseId: z.string(),
  authorId: z.string(),
  text: z.string().min(1),
  createdAt: z.date().default(() => new Date()),
  embedding: z.array(z.number()), // Vector embedding (e.g. 768-dim)
});
export type Note = z.infer<typeof NoteSchema>;

// ==========================================
// 4. Events Collection (Extracted timeline events)
// ==========================================
export const EventSchema = z.object({
  _id: ObjectIdSchema.optional(),
  caseId: z.string(),
  noteId: z.string(), // Source note citation
  what: z.string().min(1),
  who: z.array(z.string()).default([]),
  whenText: z.string().default(""), // Human timestamp as stated (e.g. "night of the 14th")
  whenISO: z.string().nullable().default(null), // ISO 8601 string or null if unknown
  where: z.string().nullable().default(null), // Location or null if unknown
  confidence: z.number().min(0).max(1).default(1.0),
  embedding: z.array(z.number()), // Vector embedding of the event
  createdAt: z.date().default(() => new Date()),
});
export type Event = z.infer<typeof EventSchema>;

// ==========================================
// 5. Entities Collection (Tracked persons, vehicles, places, etc.)
// ==========================================
export const EntityTypeSchema = z.enum([
  "person",
  "vehicle",
  "place",
  "phone",
  "object",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

export const EntityRoleSchema = z.enum([
  "victim",
  "suspect",
  "witness",
  "other",
]);
export type EntityRole = z.infer<typeof EntityRoleSchema>;

export const AlibiStatusSchema = z.enum([
  "unknown",
  "claimed",
  "verified",
  "broken",
]);
export type AlibiStatus = z.infer<typeof AlibiStatusSchema>;

export const EntitySchema = z.object({
  _id: ObjectIdSchema.optional(),
  caseId: z.string(),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  type: EntityTypeSchema,
  role: EntityRoleSchema.default("other"),
  alibiStatus: AlibiStatusSchema.default("unknown"),
  alibiDetails: z.string().optional(),
  eventIds: z.array(z.string()).default([]),
  noteIds: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().optional(),
});
export type Entity = z.infer<typeof EntitySchema>;

// ==========================================
// 6. OpenQuestions Collection (Leads, missing details, contradictions)
// ==========================================
export const OpenQuestionStatusSchema = z.enum(["open", "resolved"]);
export type OpenQuestionStatus = z.infer<typeof OpenQuestionStatusSchema>;

export const OpenQuestionSchema = z.object({
  _id: ObjectIdSchema.optional(),
  caseId: z.string(),
  text: z.string().min(1),
  status: OpenQuestionStatusSchema.default("open"),
  noteId: z.string(), // Originating source note
  createdAt: z.date().default(() => new Date()),
  resolvedAt: z.date().optional(),
});
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;

// ==========================================
// 7. Queries Collection (Audit log of investigative queries & citations)
// ==========================================
export const QueryCitationSchema = z.object({
  noteId: z.string(),
  quote: z.string().optional(),
  relevance: z.string().optional(),
  snippet: z.string().optional(),
});
export type QueryCitation = z.infer<typeof QueryCitationSchema>;

export const QuerySchema = z.object({
  _id: ObjectIdSchema.optional(),
  caseId: z.string(),
  userId: z.string(),
  question: z.string().min(1),
  answer: z.string(),
  citations: z.array(QueryCitationSchema).default([]),
  createdAt: z.date().default(() => new Date()),
});
export type Query = z.infer<typeof QuerySchema>;

// ==========================================
// 8. Messages Collection (Chat history between investigators and CaseMemory)
// ==========================================
export const MessageSchema = z.object({
  _id: ObjectIdSchema.optional(),
  caseId: z.string(),
  userId: z.string(),
  userName: z.string().default("Investigator"),
  userRole: UserRoleSchema.default("investigator"),
  text: z.string().min(1),
  type: z.enum(["fact", "question", "both"]).default("question"),
  assistantReply: z.object({
    text: z.string(),
    noteId: z.string().optional(),
    citations: z.array(QueryCitationSchema).default([]),
    extractedStats: z
      .object({
        eventsSaved: z.number().optional(),
        entitiesCount: z.number().optional(),
        openQuestionsSaved: z.number().optional(),
      })
      .optional(),
  }),
  createdAt: z.date().default(() => new Date()),
});
export type ChatMessageDoc = z.infer<typeof MessageSchema>;

// ==========================================
// Validation Helpers for API input payloads
// ==========================================
export const IngestMessageInputSchema = z.object({
  text: z
    .string()
    .min(1, "Message text cannot be empty")
    .max(2000, "Message exceeds maximum length of 2000 characters"),
});

export const LoginInputSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const SignUpInputSchema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: UserRoleSchema.default("investigator"),
});

export const CreateUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: UserRoleSchema,
});

export const CreateCaseInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
  memberIds: z.array(z.string()).default([]),
});
