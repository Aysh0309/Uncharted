import { connectDB, closeDB } from '../config/db.js';
import { seedDemoMemories, searchMemories, getMemoriesByAgent } from '../services/memory.js';

async function runSeed() {
  console.log('🌱 Starting Agentic Memory Seeding Script...');
  await connectDB();

  const agentId = 'default-agent';
  console.log(`📦 Seeding demo memories for agent "${agentId}"...`);
  
  const seeded = await seedDemoMemories(agentId);
  console.log(`✅ Seeded ${seeded.length} atomic memories with 1536-dimensional embeddings!`);

  console.log('\n📋 Stored Memories in Database:');
  const allMemories = await getMemoriesByAgent(agentId);
  allMemories.forEach((m, idx) => {
    console.log(`  [${idx + 1}] (${m.category}) "${m.content}" [Importance: ${m.importance_score}]`);
  });

  console.log('\n🔎 Testing Vector Search Retrieval Query: "What backend framework does the user like?"');
  const searchResults = await searchMemories(agentId, 'What backend framework does the user like?', 3);
  console.log('Top Results:');
  searchResults.forEach((res, idx) => {
    console.log(`  [${idx + 1}] Score: ${(res.score * 100).toFixed(1)}% | "${res.content}"`);
  });

  await closeDB();
  console.log('\n🎉 Seed & verification complete!');
}

runSeed().catch(err => {
  console.error('❌ Seed script error:', err);
  process.exit(1);
});
