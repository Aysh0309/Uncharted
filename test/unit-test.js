import { connectDB, closeDB } from '../src/config/db.js';
import {
  seedDemoMemories,
  searchMemories,
  executeAgenticWritePolicy,
  getMemoriesByAgent,
  deleteMemory,
  clearAgentMemories
} from '../src/services/memory.js';
import { generateAgentResponse } from '../src/services/llm.js';
import { getEmbedding, cosineSimilarity } from '../src/services/embedding.js';

async function runUnitTests() {
  console.log('🧪 Starting Direct In-Process Service Verification Tests...\n');
  await connectDB();

  const testAgentId = 'unit-test-agent';

  // Clear any existing test data
  await clearAgentMemories(testAgentId);

  // 1. Embedding Engine
  console.log('1️⃣ Testing Embedding Generation & Cosine Similarity...');
  const emb1 = await getEmbedding('I love building AI agents with MongoDB Atlas');
  const emb2 = await getEmbedding('I enjoy creating agentic systems on MongoDB Atlas');
  const emb3 = await getEmbedding('Bananas and apples are sweet tropical fruits');

  const simClose = cosineSimilarity(emb1.embedding, emb2.embedding);
  const simFar = cosineSimilarity(emb1.embedding, emb3.embedding);

  console.log(`- Close match similarity: ${(simClose * 100).toFixed(1)}%`);
  console.log(`- Distant match similarity: ${(simFar * 100).toFixed(1)}%`);
  if (simClose <= simFar) {
    throw new Error('Semantic vector search similarity ranking failed!');
  }
  console.log('✅ Embedding engine passed!\n');

  // 2. Seeding memories
  console.log('2️⃣ Testing Seeding Demo Memories...');
  const seeded = await seedDemoMemories(testAgentId);
  console.log(`Seeded ${seeded.length} memories for ${testAgentId}`);
  if (seeded.length !== 5) {
    throw new Error(`Expected 5 seeded memories, got ${seeded.length}`);
  }
  console.log('✅ Seeding passed!\n');

  // 3. Vector Search Retrieval
  console.log('3️⃣ Testing Vector Search ($vectorSearch logic)...');
  const query = 'What backend framework is preferred?';
  const searchResults = await searchMemories(testAgentId, query, 3);
  console.log(`Search returned ${searchResults.length} results:`);
  searchResults.forEach((r, i) => console.log(`   [${i + 1}] (${r.category}) ${r.content} (score: ${(r.score * 100).toFixed(1)}%)`));

  if (searchResults.length === 0 || !searchResults[0].content.includes('Node.js')) {
    throw new Error('Vector search did not surface the relevant backend memory!');
  }
  console.log('✅ Vector search retrieval passed!\n');

  // 4. LLM Generation with Injected Memories
  console.log('4️⃣ Testing LLM Response with Injected Memory Context...');
  const agentResponse = await generateAgentResponse(query, searchResults, []);
  console.log(`Agent reply:\n"${agentResponse.reply}"`);
  if (!agentResponse.reply) {
    throw new Error('LLM did not produce a reply!');
  }
  console.log('✅ LLM response generation passed!\n');

  // 5. Agentic Write Policy: Learning a brand new fact (INSERT)
  console.log('5️⃣ Testing Agentic Write Policy: New Fact Insertion...');
  const insertReport = await executeAgenticWritePolicy(
    testAgentId,
    'I prefer using Tailwind CSS for UI design',
    'Got it, I will remember that you like Tailwind CSS!'
  );
  console.log('Insert report:', insertReport);
  if (insertReport.insertedCount < 1) {
    throw new Error('Agentic Write Policy failed to insert new memory!');
  }
  console.log('✅ Write Policy (Insert) passed!\n');

  // 6. Agentic Write Policy: Duplicate/Update of an existing fact (UPDATE)
  console.log('6️⃣ Testing Agentic Write Policy: Duplicate / Update Detection (updateOne)...');
  const updateReport = await executeAgenticWritePolicy(
    testAgentId,
    'I prefer using Tailwind CSS with dark mode theme',
    'Noted! I updated your UI preferences.'
  );
  console.log('Update report:', updateReport);
  if (updateReport.updatedCount < 1) {
    throw new Error('Agentic Write Policy failed to update existing similar memory!');
  }
  console.log('✅ Write Policy (Update / Deduplication) passed!\n');

  // 7. Verification of all memories
  console.log('7️⃣ Testing getMemoriesByAgent & deletion...');
  const allMemories = await getMemoriesByAgent(testAgentId);
  console.log(`Agent now has ${allMemories.length} total persistent memories`);
  const targetId = allMemories[0]._id;
  const deleted = await deleteMemory(targetId);
  if (!deleted) {
    throw new Error('Failed to delete memory!');
  }
  console.log(`✅ Successfully deleted memory #${targetId}`);

  await clearAgentMemories(testAgentId);
  await closeDB();
  console.log('\n🎉 ALL 7 UNIT TESTS PASSED SUCCESSFULLY! 🚀');
}

runUnitTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
