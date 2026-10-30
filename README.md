# CaseMemory: Implementation Plan and Antigravity Prompts

UNCHARTED 2026 (NEXUS x SVNIT Surat) | Problem statement: Agentic Memory

An agentic memory assistant for criminal case investigations. Investigators type case facts or questions into one chat box. Facts are extracted into structured events and entities, embedded, and stored in MongoDB. Questions are answered only from stored memory, with citations to the source notes.

---

## 1. Stack

A single Next.js (TypeScript) app with API routes keeps everything in one repo and one deploy.

| Layer | Choice |
|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind |
| Database | MongoDB Atlas with Atlas Vector Search |
| Auth | Email + password, bcrypt, JWT in httpOnly cookie |
| Validation | zod |
| LLM + embeddings | Any LLM API key you have (Gemini fits well with Antigravity) |
| Hosting | Vercel |

## 2. Roles

| Role | Can do |
|---|---|
| **Admin** | Manage users, see all cases, assign people to cases |
| **Investigator** | Create cases, add facts, ask questions, edit entity roles, on assigned cases |
| **Viewer** | Ask questions and view the timeline on assigned cases. Cannot add or edit facts |

Enforce roles on the server in every API route and filter every database query by case access. Hiding buttons in the UI is not enough.

## 3. How the system works

```
Investigator message
        |
     Router (LLM: fact / question / both)
        |
   +----+-----------------------------+
   |                                  |
 FACT path                       QUESTION path
 1. save raw note + embedding    1. embed question
 2. LLM extracts events,         2. $vectorSearch on notes + events (filtered by case)
    entities, open questions     3. load entities, timeline, open questions, summary
 3. merge entities (no dupes)    4. code computes suspect scores + gaps
 4. embed + store events         5. LLM answers ONLY from this context, cites [note #id]
 5. update running case summary  6. save to queries, return answer + citations
 6. confirm what was saved
```

## 4. Collections

```
users         {email, passwordHash, name, role: "admin"|"investigator"|"viewer"}
cases         {title, description, status, memberIds[], summary, createdBy, createdAt}
notes         {caseId, authorId, text, createdAt, embedding}
events        {caseId, noteId, what, who[], whenText, whenISO|null, where|null, confidence, embedding}
entities      {caseId, name, aliases[], type: person|vehicle|place|phone|object,
               role: victim|suspect|witness|other,
               alibiStatus: unknown|claimed|verified|broken,
               eventIds[], noteIds[]}
openQuestions {caseId, text, status: open|resolved, noteId}
queries       {caseId, userId, question, answer, citations[], createdAt}
```

Suspect score (computed in code, shown with a breakdown so it is explainable):

- +2 per linked event
- +3 if present near the key time or place
- +2 if a motive-related event exists
- +3 if alibi is unknown or broken
- -3 if alibi is verified

Gap detection rules:

- Events missing time or place
- People mentioned only once and never questioned
- Contradictions between two notes about the same entity
- Unresolved open questions

## 5. Time budget (about 12 hours)

| Step | What | Time |
|---|---|---|
| 1 | Scaffold and deploy hello-world | 1h |
| 2 | Database models and vector indexes | 1h |
| 3 | Auth and roles | 1.5h |
| 4 | Ingest pipeline (store facts) | 2h |
| 5 | Ask pipeline (answer questions) | 2h |
| 6 | UI: chat, timeline, suspects panel | in parallel with 4 and 5 |
| 7 | Synthetic seed data | 0.5h |
| 8 | Testing, polish, README | 1.5h |
| 9 | Demo video, PPT, submission | 2.5h |

Suggested split for three people: one on backend (steps 2, 4, 5), one on auth and UI (3, 6), one on deployment, seed data, README, video and PPT. If the build clock is already running, cut the polish items in step 8 first.

---

## 6. Step 0: Before you paste anything

- Create the accounts: Atlas cluster, Vercel, GitHub repo, LLM API key.
- Ask the organizers for their AI-use policy. The rulebook allows AI coding assistants only under that policy, and Antigravity counts.
- Be ready to explain every part of the code. Judges' Q&A covers architecture, code and technology choices.
- Set the agent not to commit or push on its own. Commit manually, because Vercel auto-deploys on push and no commits are allowed after 10 PM on 31 Oct.

## 7. Prompt 0: Master prompt (paste first, keep as a rules file if supported)

```
You are my senior full-stack engineer. We are building "CaseMemory", an agentic memory
assistant for criminal case investigations, for a 24-hour hackathon. Build incrementally,
one step at a time, and wait for my next instruction after each step.

PRODUCT
Users type case facts or questions in one chat box. The system decides which it is.
- Facts are extracted into structured events and entities, embedded, and stored in MongoDB.
- Questions are answered ONLY from stored memory (vector search plus structured lookups),
  with citations to source notes. Examples: "who are the worthy suspects?",
  "what should my next lead be?", "what happened on the night of the 14th?".
- Memory persists across sessions and across users on the same case.

STACK
Next.js (App Router) + TypeScript + Tailwind, API routes for backend, MongoDB Atlas
(official driver) with Atlas Vector Search, JWT auth in httpOnly cookies, bcrypt,
zod validation, an LLM API for extraction and answering plus an embedding model.
Deploy target: Vercel.

COLLECTIONS
users {email, passwordHash, name, role: "admin"|"investigator"|"viewer"}
cases {title, description, status, memberIds[], summary, createdBy, createdAt}
notes {caseId, authorId, text, createdAt, embedding}
events {caseId, noteId, what, who[], whenText, whenISO|null, where|null, confidence, embedding}
entities {caseId, name, aliases[], type: person|vehicle|place|phone|object,
          role: victim|suspect|witness|other, alibiStatus: unknown|claimed|verified|broken,
          eventIds[], noteIds[]}
openQuestions {caseId, text, status: open|resolved, noteId}
queries {caseId, userId, question, answer, citations[], createdAt}

RULES
- RBAC enforced server-side on every route; every query is scoped to cases the user may access.
- All secrets in environment variables. Provide .env.example. Never hardcode keys.
- Use ONLY synthetic data. No real names, phone numbers, or records.
- The LLM must never declare anyone guilty. Output "evidence linked to X" with citations.
- Every answer claim cites a note id. If memory is insufficient, say what is missing.
- Keep code simple and readable. I must be able to explain it to judges.
- Do not run git commit or git push. I do that manually.
- After each step, tell me exactly how to run and test it.

Confirm you understand, then wait for Step 1.
```

## 8. Prompt 1: Scaffold and deploy

```
Step 1: Scaffold the Next.js + TypeScript + Tailwind project. Create folders: /lib (db.ts with a
cached MongoDB client, llm.ts, auth.ts, rbac.ts), /app/api, /components, /scripts.
Add GET /api/health that pings MongoDB. Add .env.example with MONGODB_URI, JWT_SECRET,
LLM_API_KEY. Make it deploy-ready for Vercel. Show me the run steps.
```

Deploy to Vercel immediately and add the env vars there. From here on you work on a live URL.

## 9. Prompt 2: Database models and vector indexes

```
Step 2: Add zod schemas and TypeScript types for all collections. Write
/scripts/setup-db.ts that creates standard indexes (caseId on notes, events, entities,
openQuestions) and creates two Atlas Vector Search indexes: one on notes.embedding and one on
events.embedding. Use cosine similarity, numDimensions matching my embedding model
(ask me the dimension if unsure), and include caseId as a filter field.
Add a small helper embed(text) in /lib/llm.ts and a test route to verify embeddings store
and a $vectorSearch query returns results.
```

Atlas vector indexes take a minute to become ready. Check that they show as active before testing search.

## 10. Prompt 3: Auth and roles

```
Step 3: Implement email+password auth. POST /api/auth/login, POST /api/auth/logout,
GET /api/auth/me, JWT in httpOnly cookie, bcrypt hashing. Create /lib/rbac.ts with
requireRole(...) and canAccessCase(user, caseId). Admin sees all cases; investigator and viewer
only cases where their id is in memberIds. Viewers cannot call write endpoints.
Add admin-only routes: create user, assign user to case. Add a login page, a protected layout,
and a cases list page. Seed three demo users (admin, investigator, viewer) via a script with
obviously fake credentials.
```

These three seeded logins double as the test credentials required in the submission form.

## 11. Prompt 4: Ingest pipeline (storing facts)

```
Step 4: Build POST /api/cases/[id]/message with {text}. Investigator/admin only for facts.
Pipeline:
1. Router: one LLM call classifies the message as "fact", "question", or "both" (JSON output).
2. For facts: save the raw note with embedding. Call the LLM at temperature 0 with a strict
   JSON-only extraction prompt returning {events[], entities[], open_questions[]}. Extract only
   what is stated; use null for missing time or place; never guess. Validate with zod and retry
   once on invalid JSON.
3. Merge: match entities by case-insensitive name or alias within the case; update instead of
   duplicating; link eventIds and noteIds; add new aliases when plausible.
4. Embed each event text and store events.
5. Update cases.summary: a short running summary of the case, regenerated from the previous
   summary plus the new facts (this is the working memory).
6. Return a short confirmation listing what was saved, with note id.
Add a /scripts/test-ingest.ts that posts three sample messages.
```

## 12. Prompt 5: Ask pipeline (answering from memory)

```
Step 5: For questions in the same endpoint:
1. Embed the question; run $vectorSearch on notes and events filtered by caseId (top 8 each).
2. Also load structured data directly: all entities, the full timeline sorted by time, open
   questions, and the case summary.
3. Compute in code (not by the LLM):
   - Suspect score per person: +2 per linked event, +3 if present near the key time/place,
     +2 if a motive-related event exists, +3 if alibi is unknown or broken, -3 if verified.
     Return the score breakdown so it is explainable.
   - Gap detection: events missing time or place, people mentioned only once and never
     questioned, contradictions between two notes about the same entity, unresolved
     open questions.
4. Call the LLM with ONLY this retrieved context. Rules: cite every claim as [note #id];
   never say anyone is guilty; if memory is insufficient, list what is missing; for "next
   lead" questions return concrete actions.
5. Save to queries and return {answer, citations, suspects[], gaps[]}.
```

Build this deterministic version first. If time remains, upgrade it so the LLM calls tools (`search_memory`, `get_timeline`, `get_entities`, `rank_suspects`, `find_gaps`) through function calling, capped at 3 tool rounds. That looks more "agentic" in the demo, but only do it once the basic version works.

## 13. Prompt 6: UI

```
Step 6: Build the case page with three panels: (left) chat with message history and a mode hint
showing "Saved as fact" or "Answered from memory"; (center) timeline of events sorted by time,
each linking to its source note; (right) entities and ranked suspects with score breakdown and
alibi status. Citations like [note #12] open a drawer showing the raw note, author, and time.
Viewers see the chat in ask-only mode. Add loading states and error toasts. Keep the design
clean and dark-themed.
```

## 14. Prompt 7: Synthetic seed data

```
Step 7: Write /scripts/seed.ts that creates one fully synthetic murder case with about 15 notes
authored by two different investigators on different days: a victim, 4 people of interest,
one vehicle, one location, a time of death window, one contradiction between two witnesses,
and one suspect with an unverified alibi. Run the notes through the real ingest pipeline so
events, entities and embeddings are created exactly as in production.
```

Running the seed through the real pipeline also tests ingestion.

## 15. Prompt 8: Hardening and docs

```
Step 8: Add basic rate limiting on the message endpoint, input length limits, a try/catch with
friendly errors around every LLM call, and an audit log entry per write. Write a README with
project overview, architecture diagram (mermaid), setup steps, env vars, roles, demo
credentials, and tech choices. Confirm no secrets exist in the repo.
```

---

## 16. Demo script (for the video and the finals)

1. **Session 1, Investigator A:** enters 4 or 5 facts live and sees them saved as events.
2. **Log out.**
3. **Session 2, Investigator B:** opens the case fresh and asks "What should I do next?" The system answers from Investigator A's memory with citations.
4. **Show memory evolving:** add one new fact and ask again. The suspect ranking and leads change.
5. **Show roles:** log in as Viewer and show that adding facts is blocked.

Keep the video to 7 minutes or less and record it on the deployed app, not localhost.

## 17. Rulebook checklist

| Requirement | Done |
|---|---|
| Exactly 3 eligible SVNIT members | [ ] |
| Built only inside the 24-hour window (30 Oct 9 PM to 31 Oct 9 PM IST) | [ ] |
| Follows the released problem statement and any announced constraints | [ ] |
| AI-use policy checked with organizers | [ ] |
| Live deployment URL works and core features work | [ ] |
| GitHub repo accessible, README explains project, setup, key technologies | [ ] |
| Demo video is 7 minutes or less, shows the deployed app | [ ] |
| PPT covers problem, solution, implementation, tech choices, impact | [ ] |
| Test credentials provided (fake demo logins for all three roles) | [ ] |
| No API keys, passwords or real data in repo, PPT or video | [ ] |
| Only synthetic case data used | [ ] |
| Submission form completed between 9:00 and 10:00 PM on 31 Oct | [ ] |
| Every link tested after submitting | [ ] |
| No commits, pushes or deployed changes after the deadline | [ ] |

## 18. Vibe-coding habits

- Paste one prompt at a time, run it, test it, then commit manually. Do not chain steps.
- When something breaks, paste the full error and the file name, not a description.
- Tell the agent "change only these files" for fixes so it does not rewrite working code.
- Test the ingest and ask endpoints with curl or a script before building the UI on top of them.
- Deploy early and keep the live URL working at all times.