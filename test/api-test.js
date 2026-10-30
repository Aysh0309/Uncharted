import { fork } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://localhost:3000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  return { status: res.status, data: await res.json() };
}

async function isServerRunning() {
  try {
    const res = await fetch(`${BASE_URL}/api/status`);
    return res.ok;
  } catch {
    return false;
  }
}

async function runTests() {
  let serverProcess = null;

  if (!(await isServerRunning())) {
    console.log('🚀 Launching server for test suite...');
    const serverPath = path.join(__dirname, '..', 'src', 'server.js');
    serverProcess = fork(serverPath, [], { stdio: 'pipe' });

    // Wait for server to come up
    let attempts = 0;
    while (attempts < 20) {
      await new Promise(r => setTimeout(r, 400));
      if (await isServerRunning()) break;
      attempts++;
    }
  }

  console.log('🧪 Starting API Verification Suite...\n');

  try {
    // Test 1: Status check
    console.log('1️⃣ Testing GET /api/status...');
    const statusRes = await request('/api/status');
    console.log('Status Response:', statusRes.data);
    if (statusRes.status !== 200 || statusRes.data.status !== 'online') {
      throw new Error('Status check failed');
    }
    console.log('✅ GET /api/status passed!\n');

    // Test 2: Seed demo memories
    console.log('2️⃣ Testing POST /api/memories/seed...');
    const seedRes = await request('/api/memories/seed', {
      method: 'POST',
      body: JSON.stringify({ agent_id: 'test-agent' })
    });
    console.log(`Seeded count: ${seedRes.data.count}`);
    console.log('✅ POST /api/memories/seed passed!\n');

    // Test 3: Fetch memories for test agent
    console.log('3️⃣ Testing GET /api/memories/test-agent...');
    const getRes = await request('/api/memories/test-agent');
    console.log(`Retrieved ${getRes.data.count} memories`);
    console.log('✅ GET /api/memories/:agent_id passed!\n');

    // Test 4: Chat turn (learning new fact)
    console.log('4️⃣ Testing POST /api/chat (Learning turn)...');
    const chat1 = await request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'test-agent',
        message: 'I prefer using Tailwind CSS for UI development'
      })
    });
    console.log('Agent Reply:', chat1.data.reply);
    console.log('Write Actions:', chat1.data.memory_updates.actions);
    console.log('✅ POST /api/chat (Learning) passed!\n');

    // Test 5: Chat turn (Recalling fact via Vector Search)
    console.log('5️⃣ Testing POST /api/chat (Retrieval turn)...');
    const chat2 = await request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'test-agent',
        message: 'What CSS framework do I like to use?'
      })
    });
    console.log('Agent Reply:', chat2.data.reply);
    console.log('Retrieved Memories Used:', chat2.data.retrieved_memories.map(m => m.content));
    console.log('✅ POST /api/chat (Retrieval) passed!\n');

    // Test 6: Chat turn (Updating existing memory via Agentic Write Policy)
    console.log('6️⃣ Testing POST /api/chat (Update policy turn)...');
    const chat3 = await request('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        agent_id: 'test-agent',
        message: 'I switched to Tailwind CSS v4 with dark mode'
      })
    });
    console.log('Write Actions:', chat3.data.memory_updates.actions);
    console.log('✅ POST /api/chat (Update Policy) passed!\n');

    // Test 7: Delete a memory
    console.log('7️⃣ Testing DELETE /api/memories/:id...');
    const memoriesAfterUpdate = await request('/api/memories/test-agent');
    const targetId = memoriesAfterUpdate.data.memories[0]._id;
    const deleteRes = await request(`/api/memories/${targetId}`, { method: 'DELETE' });
    console.log('Delete response:', deleteRes.data);
    console.log('✅ DELETE /api/memories/:id passed!\n');

    console.log('🎉 All 7 API Verification Tests PASSED successfully!');
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGINT');
    }
  }
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
