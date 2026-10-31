# CaseMemory — Developer Guide & API Reference

> **Agentic memory assistant for criminal case investigations** (Built for UNCHARTED 2026 | Track: Agentic Memory).
> Ingests raw investigator notes into structured vector memory, maintains running working memory, and answers questions strictly with grounded citations and deterministic suspect scoring.

---

## 1. Tech Stack Overview

| Component | Technology | Description |
|---|---|---|
| **Framework** | Next.js 14 (App Router) | Unified TypeScript React frontend & Node.js API routes |
| **Database** | MongoDB Atlas (Official Driver) | Multi-collection document store |
| **Vector Search** | Atlas Vector Search | Cosine similarity on 768-dim embeddings (`gemini-embedding-001`) |
| **Authentication** | JWT in `httpOnly` cookies | Stateless session tokens signed with HS256 |
| **Security / Hash** | `bcryptjs` | Password hashing with 10 salt rounds |
| **Validation** | `zod` | Runtime schema validation for API payloads & LLM outputs |
| **LLM & Embeddings** | Google Gemini API (or OpenAI) | Gemini 3.8 Flash for extraction & answering, `gemini-embedding-001` (768-dim) for vectors |
| **Styling** | Tailwind CSS + Lucide Icons | Dark-themed, responsive investigative terminal |
| **Deployment Target** | Vercel | Zero-config serverless deployment |

---

## 2. Prerequisites & Setup

### Requirements
- **Node.js**: v20.x or higher (v24 tested)
- **npm**: v10.x or higher
- **MongoDB Atlas Cluster**: Free tier (M0) or dedicated with Atlas Search enabled.
- **LLM API Key**: Google Gemini API key (free tier supported) or OpenAI API key.

### Environment Configuration
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Configure the following variables in `.env.local`:

```ini
# MongoDB Atlas Connection URI
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/casememory?retryWrites=true&w=majority
MONGODB_DB_NAME=casememory

# JWT Secret for Session Authentication (generate via: openssl rand -base64 32)
JWT_SECRET=your_super_secret_jwt_key_at_least_32_characters

# LLM API Key (Google Gemini API key)
LLM_API_KEY=your_gemini_api_key_here

# LLM Provider Configuration
LLM_PROVIDER=gemini
EMBEDDING_MODEL=gemini-embedding-001
EMBEDDING_DIMENSIONS=768
LLM_MODEL=gemini-3.8-flash
```

> **Note on OpenAI**: If using OpenAI, set `LLM_PROVIDER=openai`, `EMBEDDING_MODEL=text-embedding-3-small`, and `EMBEDDING_DIMENSIONS=1536`.

---

## 3. How to Start the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database Indexes & Atlas Vector Search
Creates standard indexes (uniqueness, query optimization) and two Atlas Vector Search indexes (`notes_vector_index` and `events_vector_index`):
```bash
npm run setup:db
```
*(Atlas Vector Search indexes take ~1–2 minutes to become active in the Atlas console).*

### 3. Seed Demo Users & Starter Case
Seeds 3 pre-configured demo users and an initial synthetic test case:
```bash
npm run seed:users
```

### 4. Run the Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

### 5. Production Build
```bash
npm run build
npm start
```

---

## 4. Pre-configured Demo Accounts (For Hackathon Judges)

The login screen at `/login` includes **1-click quick-fill buttons** for testing all RBAC roles:

| Role | Name | Email | Password | Permissions |
|---|---|---|---|---|
| **Admin** | Chief Inspector Sterling | `admin@casememory.local` | `AdminPass123!` | Access all cases, assign members, create users, manage system |
| **Investigator** | Det. Sarah Miller | `investigator@casememory.local` | `InvestPass123!` | Read & write on assigned cases, ingest facts, ask questions, create cases |
| **Viewer** | Analyst James Cole | `viewer@casememory.local` | `ViewerPass123!` | Read-only access on assigned cases, ask questions, view timeline. **Cannot write facts** |

---

## 5. Developer & Testing Scripts

| Command | Script File | Purpose |
|---|---|---|
| `npm run setup:db` | `scripts/setup-db.ts` | Configures B-tree indexes & Atlas Vector Search indexes |
| `npm run seed:users` | `scripts/seed-users.ts` | Upserts the 3 demo users and creates initial demo case |
| `npm run test:ingest` | `scripts/test-ingest.ts` | Ingests 3 synthetic factual notes, extracting events, merging entities, and updating case summary |
| `npm run test:query` | `scripts/test-query.ts` | Tests grounded evidentiary Q&A, citations, suspect scores, and gap detection |

---

## 6. Complete API Reference

All protected routes accept authentication via either:
1. `httpOnly` cookie named `casememory_token` (automatically set on browser login).
2. HTTP Header: `Authorization: Bearer <jwt_token>`.

---

### System & Health

#### `GET /api/health`
Checks database connectivity and server latency.
- **Auth**: None
- **Response**:
```json
{
  "status": "ok",
  "service": "CaseMemory API",
  "database": "connected",
  "ping": "pong",
  "latencyMs": 42,
  "timestamp": "2026-10-31T00:20:00.000Z"
}
```

#### `GET /api/test-vector`
Tests embedding generation, inserting test vector into MongoDB, and running `$vectorSearch`.
- **Auth**: None
- **Response**:
```json
{
  "status": "ok",
  "message": "Embedding generation and MongoDB vector storage verified successfully",
  "data": {
    "configuredDimension": 768,
    "vectorSearchStatus": "success",
    "matchedCount": 1
  }
}
```

---

### Authentication

#### `POST /api/auth/login`
Authenticates user with email and password.
- **Auth**: None
- **Body**:
```json
{
  "email": "investigator@casememory.local",
  "password": "InvestPass123!"
}
```
- **Response**: Sets `casememory_token` in `httpOnly` cookie and returns:
```json
{
  "status": "ok",
  "message": "Login successful",
  "user": {
    "id": "6723b7829a8c...",
    "email": "investigator@casememory.local",
    "name": "Det. Sarah Miller",
    "role": "investigator"
  }
}
```

#### `POST /api/auth/logout`
Clears session cookie.
- **Auth**: None
- **Response**: `{ "status": "ok", "message": "Logged out successfully" }`

#### `GET /api/auth/me`
Returns current session payload.
- **Auth**: Required
- **Response**: `{ "status": "ok", "user": { "id": "...", "email": "...", "role": "..." } }`

---

### Case Management

#### `GET /api/cases`
Lists cases accessible to the authenticated user.
- **Auth**: Required
- **RBAC**: Admin sees all cases; Investigator & Viewer see cases where `user.id` is in `memberIds`.
- **Response**:
```json
{
  "status": "ok",
  "cases": [
    {
      "id": "6723b...",
      "title": "The Waterfront Warehouse Incident",
      "description": "Investigation into midnight unauthorized entry...",
      "status": "active",
      "memberIds": ["6723..."],
      "summary": "Working memory summary of the case...",
      "createdAt": "2026-10-31T00:00:00.000Z"
    }
  ]
}
```

#### `POST /api/cases`
Creates a new case file.
- **Auth**: Admin or Investigator (Viewer returns `403 Forbidden`).
- **Body**:
```json
{
  "title": "Stolen Industrial Manifest",
  "description": "Unauthorized access reported at Gate 4",
  "memberIds": []
}
```

#### `GET /api/cases/[id]`
Fetches details of a specific case file.
- **Auth**: Enforces case access membership.

#### `POST /api/cases/[id]/assign`
Assigns an investigator or viewer to a case.
- **Auth**: **Admin only** (`403 Forbidden` for all others).
- **Body**:
```json
{
  "userId": "6723b7829a..."
}
```

---

### Agentic Intake & Answering (Core Engine)

#### `POST /api/cases/[id]/message`
Unified input console for investigators. Automatically routes between fact ingestion, question answering, or hybrid execution.
- **Auth**: User must have access to case.

#### Mode A: Fact Message Ingestion
- **Input**:
```json
{
  "text": "Harbor Blvd traffic cameras at 11:52 PM captured the blue sedan, confirmed as a 2018 Honda Accord (registered to Damon Vance, alias 'D-Money'). Damon has no verified alibi for that night."
}
```
- **Permission**: Investigator and Admin only (Viewers get `403 Forbidden`).
- **Pipeline Execution**:
  1. Router classifies message as `"fact"`.
  2. Embeds and stores raw note in `notes` collection.
  3. LLM extracts `{ events, entities, open_questions }` at temperature 0 with Zod schema validation.
  4. Merges entities by case-insensitive name or known alias (deduplicating).
  5. Computes vector embeddings for each event and saves into `events`.
  6. Regenerates and saves updated working memory in `cases.summary`.
- **Response**:
```json
{
  "status": "ok",
  "type": "fact",
  "noteId": "6723b789...",
  "eventsSaved": 1,
  "entitiesCreated": 0,
  "entitiesUpdated": 2,
  "openQuestionsSaved": 0,
  "runningSummary": "On October 14 at 11:45 PM, a dark blue sedan was observed fleeing Pier 14. Camera logs link the vehicle to Damon Vance...",
  "extracted": {
    "events": [
      {
        "what": "Traffic camera captured blue sedan",
        "who": ["Damon Vance"],
        "whenText": "11:52 PM",
        "whenISO": "2026-10-14T23:52:00Z",
        "where": "Harbor Blvd"
      }
    ],
    "entities": [
      {
        "name": "Damon Vance",
        "aliases": ["D-Money"],
        "type": "person",
        "role": "suspect",
        "alibiStatus": "unknown"
      }
    ],
    "openQuestions": []
  }
}
```

#### Mode B: Investigative Query Answering
- **Input**:
```json
{
  "text": "Who are the worthy suspects and what links them to the crime?"
}
```
- **Permission**: Admin, Investigator, and Viewer.
- **Pipeline Execution**:
  1. Router classifies message as `"question"`.
  2. Runs `$vectorSearch` on notes and events filtered by `caseId`.
  3. Loads structured entities, chronological timeline, and open questions.
  4. **Code-computed deterministic suspect scores** (+2 linked events, +3 proximity, +2 motive, +3/-3 alibi).
  5. **Code-computed evidentiary gaps** (missing timestamps, single-mention unquestioned, alibi contradictions).
  6. LLM generates answer strictly from memory, enforcing `[note #id]` citations and presumption of innocence.
  7. Audit log saved to `queries` collection.
- **Response**:
```json
{
  "status": "ok",
  "type": "question",
  "queryId": "6723c01...",
  "question": "Who are the worthy suspects and what links them to the crime?",
  "answer": "Based on case memory, evidence links two individuals of investigative interest:\n\n1. Damon Vance (Alias: 'D-Money'): Linked to the blue 2018 Honda Accord [note #6723b789...] observed fleeing Pier 14 [note #6723b785...]. Has no verified alibi [note #6723b789...].\n\n2. Marcus Vance: Guard who claimed he was in the restroom, but gate badge logs refute this statement [note #6723b78d...].",
  "citations": [
    { "noteId": "6723b785...", "snippet": "On the night of October 14th around 11:45 PM..." },
    { "noteId": "6723b789...", "snippet": "Harbor Blvd traffic cameras at 11:52 PM..." }
  ],
  "suspects": [
    {
      "name": "Marcus Vance",
      "role": "witness",
      "totalScore": 10,
      "breakdown": {
        "linkedEvents": { "points": 4, "count": 2, "description": "+4 (2 events linked)" },
        "proximity": { "points": 3, "matched": true, "description": "+3 (Present near incident time/place)" },
        "motiveOrIncrimination": { "points": 0, "matched": false, "description": "0 (No motive link)" },
        "alibi": { "points": 3, "status": "broken", "description": "+3 (Alibi contradictory/broken by records)" }
      }
    },
    {
      "name": "Damon Vance",
      "role": "suspect",
      "totalScore": 10,
      "breakdown": {
        "linkedEvents": { "points": 2, "count": 1, "description": "+2 (1 events linked)" },
        "proximity": { "points": 3, "matched": true, "description": "+3 (Present near incident time/place)" },
        "motiveOrIncrimination": { "points": 2, "matched": true, "description": "+2 (Motive, suspicious activity, or vehicle link)" },
        "alibi": { "points": 3, "status": "unknown", "description": "+3 (No verified alibi provided)" }
      }
    }
  ],
  "gaps": [
    {
      "type": "contradiction",
      "entityName": "Marcus Vance",
      "description": "Contradiction detected for Marcus Vance: claimed alibi was refuted by evidence (Badge/record discrepancy)."
    },
    {
      "type": "missing_time_or_place",
      "description": "Event 'Burner phone recovered' is missing exact timestamp."
    }
  ]
}
```

---

## 7. Database Collections Structure

```text
users         { _id, email, passwordHash, name, role ("admin"|"investigator"|"viewer"), createdAt }
cases         { _id, title, description, status, memberIds[], summary, createdBy, createdAt, updatedAt }
notes         { _id, caseId, authorId, text, createdAt, embedding: [768] }
events        { _id, caseId, noteId, what, who[], whenText, whenISO, where, confidence, embedding: [768] }
entities      { _id, caseId, name, aliases[], type, role, alibiStatus, alibiDetails, eventIds[], noteIds[] }
openQuestions { _id, caseId, text, status ("open"|"resolved"), noteId, createdAt }
queries       { _id, caseId, userId, question, answer, citations[], createdAt }
```

---

## 8. Evidentiary & Architecture Principles for Judges

1. **Deterministic Suspect Scoring in Code**:
   Rather than letting the LLM hallucinate guilt or bias scores, scores are computed deterministically in TypeScript (`lib/query.ts`) based on verified links and evidentiary rules.
2. **Strict Grounding & Mandatory Note Citations**:
   The LLM is prompted at low temperature to answer *only* with facts present in the retrieved memory context. Any claim must reference its source note ID (`[note #<id>]`).
3. **Presumption of Innocence**:
   The model is strictly governed never to declare an individual "guilty", using objective terms like *"evidence links X"* and *"suspect priority score indicates attention is warranted"*.
4. **Server-Enforced RBAC**:
   Case boundaries are verified server-side on every API call. Viewers cannot ingest facts; users cannot query cases they are not assigned to.

