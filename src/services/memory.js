import { ObjectId } from 'mongodb';
import { getMemoriesCollection, isUsingAtlas, getInMemoryStore } from '../config/db.js';
import { getEmbedding, cosineSimilarity } from './embedding.js';
import { extractFactsFromTurn } from './llm.js';

// Similarity threshold above which a candidate fact is considered a duplicate/update of existing memory
// 0.80+ for dense production models (text-embedding-3-small); 0.65 for zero-config mock embeddings
const DEFAULT_SIMILARITY_THRESHOLD = process.env.SIMILARITY_THRESHOLD
  ? parseFloat(process.env.SIMILARITY_THRESHOLD)
  : (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '' ? 0.80 : 0.65);

/**
 * Searches the agent's memories using MongoDB Atlas Vector Search ($vectorSearch).
 *
 * @param {string} agentId - The agent/session identifier
 * @param {string} queryText - The text to embed and search against
 * @param {number} limit - Maximum number of memories to return (default: 4)
 * @returns {Promise<Array>} Array of memory objects with relevance scores
 */
export async function searchMemories(agentId, queryText, limit = 4) {
  const { embedding: queryVector } = await getEmbedding(queryText);
  const collection = getMemoriesCollection();

  // 1. Try Native MongoDB Atlas $vectorSearch Aggregation Pipeline
  if (isUsingAtlas() && collection) {
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: 'vector_index',
            path: 'embedding',
            queryVector: queryVector,
            numCandidates: 20,
            limit: limit,
            filter: {
              agent_id: { $eq: agentId }
            }
          }
        },
        {
          $project: {
            _id: 1,
            agent_id: 1,
            content: 1,
            category: 1,
            importance_score: 1,
            updated_at: 1,
            score: { $meta: 'vectorSearchScore' }
          }
        }
      ];

      const results = await collection.aggregate(pipeline).toArray();
      return results;
    } catch (atlasError) {
      console.warn(`⚠️  [Atlas VectorSearch] Query failed (${atlasError.message}).`);
      console.warn(`ℹ️  Note: Ensure an Atlas Search Vector Index named "vector_index" is active on the "memories" collection.`);
      console.warn(`👉 Executing fallback client-side cosine similarity search on Atlas documents...`);

      // Fallback: Fetch agent's documents and compute cosine similarity locally
      const docs = await collection.find({ agent_id: agentId }).toArray();
      return rankByCosineSimilarity(docs, queryVector, limit);
    }
  }

  // 2. In-Memory Mode (Fallback when Atlas URI not configured)
  const store = getInMemoryStore();
  const agentMemories = Array.from(store.memories.values()).filter(m => m.agent_id === agentId);
  return rankByCosineSimilarity(agentMemories, queryVector, limit);
}

/**
 * Helper to compute cosine similarity against a list of documents and return the top N.
 */
function rankByCosineSimilarity(docs, queryVector, limit = 4) {
  const scored = docs.map(doc => {
    const sim = cosineSimilarity(queryVector, doc.embedding || []);
    return {
      _id: doc._id,
      agent_id: doc.agent_id,
      content: doc.content,
      category: doc.category,
      importance_score: doc.importance_score,
      updated_at: doc.updated_at,
      score: sim
    };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * The Agentic Write Policy:
 * Analyzes conversation turn, extracts atomic facts, checks for existing similar
 * memories via vector search, and either updates (updateOne) or inserts (insertOne).
 *
 * @param {string} agentId - Target agent ID
 * @param {string} userMessage - User's prompt
 * @param {string} agentReply - AI's response
 * @returns {Promise<Object>} Statistics of extracted, updated, and inserted memories
 */
export async function executeAgenticWritePolicy(agentId, userMessage, agentReply) {
  // 1. Extract candidate facts from the conversation turn
  const extractedFacts = await extractFactsFromTurn(userMessage, agentReply);

  const report = {
    extractedCount: extractedFacts.length,
    insertedCount: 0,
    updatedCount: 0,
    actions: []
  };

  if (extractedFacts.length === 0) {
    return report;
  }

  const collection = getMemoriesCollection();
  const store = getInMemoryStore();

  for (const fact of extractedFacts) {
    const { embedding: factEmbedding } = await getEmbedding(fact.content);

    // 2. Search for the closest existing memory for this agent
    const closestMatches = await searchMemories(agentId, fact.content, 1);
    const topMatch = closestMatches && closestMatches.length > 0 ? closestMatches[0] : null;

    const isDuplicateOrUpdate = topMatch && topMatch.score >= DEFAULT_SIMILARITY_THRESHOLD;

    if (isDuplicateOrUpdate) {
      // 3A. UPDATE POLICY: Modify existing memory using MongoDB updateOne
      const updatedFields = {
        content: fact.content,
        category: fact.category,
        importance_score: fact.importance_score,
        embedding: factEmbedding,
        updated_at: new Date()
      };

      if (isUsingAtlas() && collection) {
        await collection.updateOne(
          { _id: new ObjectId(topMatch._id) },
          { $set: updatedFields }
        );
      } else {
        const existing = store.memories.get(topMatch._id.toString());
        if (existing) {
          store.memories.set(topMatch._id.toString(), {
            ...existing,
            ...updatedFields
          });
        }
      }

      report.updatedCount++;
      report.actions.push({
        type: 'UPDATE',
        memoryId: topMatch._id,
        previousContent: topMatch.content,
        newContent: fact.content,
        category: fact.category,
        similarity: topMatch.score
      });
      console.log(`🔄 [Agentic Write] Updated memory ${topMatch._id} (similarity: ${(topMatch.score * 100).toFixed(1)}%): "${fact.content}"`);
    } else {
      // 3B. INSERT POLICY: Insert a new document
      const newMemory = {
        agent_id: agentId,
        content: fact.content,
        category: fact.category,
        embedding: factEmbedding,
        importance_score: fact.importance_score,
        updated_at: new Date()
      };

      let insertedId = null;
      if (isUsingAtlas() && collection) {
        const result = await collection.insertOne(newMemory);
        insertedId = result.insertedId;
      } else {
        insertedId = new ObjectId().toString();
        store.memories.set(insertedId, { _id: insertedId, ...newMemory });
      }

      report.insertedCount++;
      report.actions.push({
        type: 'INSERT',
        memoryId: insertedId,
        content: fact.content,
        category: fact.category,
        importance: fact.importance_score
      });
      console.log(`✨ [Agentic Write] Inserted new memory [${fact.category}]: "${fact.content}"`);
    }
  }

  return report;
}

/**
 * Fetches all memories for a given agent, sorted by most recently updated.
 */
export async function getMemoriesByAgent(agentId) {
  const collection = getMemoriesCollection();

  if (isUsingAtlas() && collection) {
    const memories = await collection
      .find({ agent_id: agentId })
      .project({ embedding: 0 }) // Omit large vector payload for clean UI inspection
      .sort({ updated_at: -1 })
      .toArray();
    return memories;
  }

  const store = getInMemoryStore();
  const memories = Array.from(store.memories.values())
    .filter(m => m.agent_id === agentId)
    .map(m => {
      const { embedding, ...rest } = m;
      return rest;
    })
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

  return memories;
}

/**
 * Deletes a memory by its ID.
 */
export async function deleteMemory(id) {
  const collection = getMemoriesCollection();

  if (isUsingAtlas() && collection) {
    try {
      const result = await collection.deleteOne({ _id: new ObjectId(id) });
      return result.deletedCount > 0;
    } catch {
      return false;
    }
  }

  const store = getInMemoryStore();
  return store.memories.delete(id);
}

/**
 * Seeds demo memories for hackathon presentation.
 */
export async function seedDemoMemories(agentId = 'default-agent') {
  const sampleFacts = [
    {
      content: 'User prefers Node.js and Express for backend development',
      category: 'preference',
      importance_score: 0.90
    },
    {
      content: 'User is building an Agentic Memory System for the MongoDB Atlas Hackathon',
      category: 'project',
      importance_score: 1.00
    },
    {
      content: 'User prefers dark mode interfaces with high contrast badges',
      category: 'preference',
      importance_score: 0.80
    },
    {
      content: 'Database must use MongoDB Atlas native Vector Search ($vectorSearch)',
      category: 'constraint',
      importance_score: 0.95
    },
    {
      content: 'User prefers concise, bulleted explanations over verbose paragraphs',
      category: 'preference',
      importance_score: 0.75
    }
  ];

  const results = [];
  for (const item of sampleFacts) {
    const { embedding } = await getEmbedding(item.content);
    const doc = {
      agent_id: agentId,
      content: item.content,
      category: item.category,
      embedding: embedding,
      importance_score: item.importance_score,
      updated_at: new Date(Date.now() - Math.floor(Math.random() * 3600000))
    };

    const collection = getMemoriesCollection();
    if (isUsingAtlas() && collection) {
      const res = await collection.insertOne(doc);
      results.push({ ...doc, _id: res.insertedId });
    } else {
      const store = getInMemoryStore();
      const id = new ObjectId().toString();
      store.memories.set(id, { _id: id, ...doc });
      results.push({ ...doc, _id: id });
    }
  }

  return results;
}

/**
 * Clears all memories for an agent.
 */
export async function clearAgentMemories(agentId) {
  const collection = getMemoriesCollection();
  if (isUsingAtlas() && collection) {
    const result = await collection.deleteMany({ agent_id: agentId });
    return result.deletedCount;
  }

  const store = getInMemoryStore();
  let count = 0;
  for (const [id, mem] of store.memories.entries()) {
    if (mem.agent_id === agentId) {
      store.memories.delete(id);
      count++;
    }
  }
  return count;
}
