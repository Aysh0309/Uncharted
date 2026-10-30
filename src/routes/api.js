import express from 'express';
import {
  searchMemories,
  executeAgenticWritePolicy,
  getMemoriesByAgent,
  deleteMemory,
  seedDemoMemories,
  clearAgentMemories
} from '../services/memory.js';
import { generateAgentResponse } from '../services/llm.js';
import { isUsingAtlas } from '../config/db.js';

const router = express.Router();

/**
 * POST /api/chat
 * Primary conversation endpoint orchestrating vector retrieval, LLM generation,
 * and the Agentic Write Policy.
 */
router.post('/chat', async (req, res) => {
  try {
    const { agent_id = 'default-agent', message, history = [] } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Field "message" is required and cannot be empty.' });
    }

    const startTime = Date.now();

    // 1. Vector Search: Fetch top 3-5 relevant memories for this agent
    console.log(`\n🔍 [Chat] User prompt received: "${message}"`);
    console.log(`🔍 [Chat] Performing MongoDB Vector Search for agent: "${agent_id}"...`);
    
    const retrievedMemories = await searchMemories(agent_id, message, 4);
    const vectorSearchLatencyMs = Date.now() - startTime;
    console.log(`⚡ [Chat] Retrieved ${retrievedMemories.length} relevant memories in ${vectorSearchLatencyMs}ms`);

    // 2. LLM Generation: Inject retrieved memories into system prompt
    const { reply, isMock: isMockLLM, model } = await generateAgentResponse(
      message,
      retrievedMemories,
      history
    );

    // 3. Agentic Write Policy:
    // Analyze conversation turn, extract facts, check similarity, and update/insert
    console.log(`🧠 [Chat] Executing Agentic Write Policy on turn...`);
    const writeReport = await executeAgenticWritePolicy(agent_id, message, reply);

    const totalLatencyMs = Date.now() - startTime;

    return res.json({
      success: true,
      agent_id,
      reply,
      retrieved_memories: retrievedMemories,
      memory_updates: writeReport,
      meta: {
        latencyMs: totalLatencyMs,
        vectorSearchLatencyMs,
        isUsingAtlas: isUsingAtlas(),
        model,
        isMockLLM
      }
    });
  } catch (error) {
    console.error('❌ [Chat Error]:', error);
    return res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

/**
 * GET /api/memories/:agent_id
 * Fetches all persistent memories for an agent to inspect live in the UI.
 */
router.get('/memories/:agent_id', async (req, res) => {
  try {
    const { agent_id } = req.params;
    const memories = await getMemoriesByAgent(agent_id);
    return res.json({
      success: true,
      agent_id,
      count: memories.length,
      memories
    });
  } catch (error) {
    console.error('❌ [Get Memories Error]:', error);
    return res.status(500).json({ error: 'Failed to fetch memories', details: error.message });
  }
});

/**
 * DELETE /api/memories/:id
 * Deletes a specific memory document.
 */
router.delete('/memories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteMemory(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Memory not found or could not be deleted' });
    }
    return res.json({ success: true, message: 'Memory deleted successfully', id });
  } catch (error) {
    console.error('❌ [Delete Memory Error]:', error);
    return res.status(500).json({ error: 'Failed to delete memory', details: error.message });
  }
});

/**
 * POST /api/memories/seed
 * Seed realistic demo memories for quick hackathon presentation.
 */
router.post('/memories/seed', async (req, res) => {
  try {
    const { agent_id = 'default-agent' } = req.body;
    const seeded = await seedDemoMemories(agent_id);
    return res.json({
      success: true,
      message: `Successfully seeded ${seeded.length} sample memories into MongoDB`,
      count: seeded.length,
      memories: seeded
    });
  } catch (error) {
    console.error('❌ [Seed Error]:', error);
    return res.status(500).json({ error: 'Failed to seed memories', details: error.message });
  }
});

/**
 * DELETE /api/memories/all/:agent_id
 * Clears all memories for an agent.
 */
router.delete('/memories/all/:agent_id', async (req, res) => {
  try {
    const { agent_id } = req.params;
    const deletedCount = await clearAgentMemories(agent_id);
    return res.json({
      success: true,
      message: `Cleared ${deletedCount} memories for agent "${agent_id}"`,
      deletedCount
    });
  } catch (error) {
    console.error('❌ [Clear Error]:', error);
    return res.status(500).json({ error: 'Failed to clear memories', details: error.message });
  }
});

/**
 * GET /api/status
 * Health and configuration status endpoint.
 */
router.get('/status', (req, res) => {
  res.json({
    status: 'online',
    isUsingAtlas: isUsingAtlas(),
    hasOpenAIKey: Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== ''),
    dbName: process.env.DB_NAME || 'agentic_memory_db',
    vectorIndexName: 'vector_index',
    timestamp: new Date()
  });
});

export default router;
