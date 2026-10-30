/**
 * Agentic Memory System Frontend Application
 * Interacts with MongoDB Atlas Vector Search backend and displays live updates.
 */

// Application State
const state = {
  agentId: 'default-agent',
  memories: [],
  activeFilter: 'all',
  chatHistory: [],
  isSending: false,
  isAtlasConnected: false
};

// DOM Elements
const chatMessagesEl = document.getElementById('chat-messages');
const chatFormEl = document.getElementById('chat-form');
const userInputEl = document.getElementById('user-input');
const sendBtnEl = document.getElementById('send-btn');
const agentSelectEl = document.getElementById('agent-select');
const memoriesListEl = document.getElementById('memories-list');
const memoriesEmptyStateEl = document.getElementById('memories-empty-state');
const memoryCountBadgeEl = document.getElementById('memory-count-badge');
const statLatencyEl = document.getElementById('stat-latency');
const statWriteActionEl = document.getElementById('stat-write-action');
const pipelineLogContentEl = document.getElementById('pipeline-log-content');
const togglePipelineLogEl = document.getElementById('toggle-pipeline-log');
const pipelineChevronEl = document.getElementById('pipeline-chevron');
const dbStatusTextEl = document.getElementById('db-status-text');
const dbStatusPillEl = document.getElementById('db-status-pill');
const btnSeedEl = document.getElementById('btn-seed');
const btnClearMemoriesEl = document.getElementById('btn-clear-memories');
const btnClearChatEl = document.getElementById('btn-clear-chat');
const toastEl = document.getElementById('toast');
const toastMessageEl = document.getElementById('toast-message');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  checkSystemStatus();
  loadMemories();
  refreshIcons();
});

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

/**
 * Event Listeners Setup
 */
function setupEventListeners() {
  // Chat submit
  chatFormEl.addEventListener('submit', (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  // Auto-expand textarea & Enter key submission
  userInputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  userInputEl.addEventListener('input', () => {
    userInputEl.style.height = 'auto';
    userInputEl.style.height = Math.min(userInputEl.scrollHeight, 120) + 'px';
  });

  // Agent selector
  agentSelectEl.addEventListener('change', (e) => {
    state.agentId = e.target.value;
    logPipeline(`[Agent] Switched active session to "${state.agentId}"`);
    loadMemories();
    showToast(`Switched agent session to: ${state.agentId}`);
  });

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      state.activeFilter = tab.getAttribute('data-filter');
      renderMemories();
    });
  });

  // Preset buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      userInputEl.value = btn.textContent.trim();
      userInputEl.style.height = 'auto';
      handleSendMessage();
    });
  });

  // Seed Demo Data button
  btnSeedEl.addEventListener('click', handleSeedData);

  // Clear Memories button
  btnClearMemoriesEl.addEventListener('click', handleClearMemories);

  // Clear Chat button
  btnClearChatEl.addEventListener('click', () => {
    state.chatHistory = [];
    chatMessagesEl.innerHTML = `
      <div class="flex items-start space-x-3 max-w-3xl">
        <div class="w-8 h-8 rounded-full bg-mongo/15 border border-mongo/30 flex items-center justify-center text-mongo shrink-0 shadow-sm">
          <i data-lucide="bot" class="w-4 h-4"></i>
        </div>
        <div class="flex-1 space-y-2">
          <div class="flex items-center space-x-2">
            <span class="font-medium text-xs text-slate-300">Atlas Memory Agent</span>
            <span class="text-[10px] text-slate-500">Live</span>
          </div>
          <div class="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 shadow-md">
            Chat cleared! Stored persistent memories in MongoDB remain intact.
          </div>
        </div>
      </div>
    `;
    refreshIcons();
    showToast('Chat history cleared.');
  });

  // Refresh Memories button
  document.getElementById('btn-refresh-memories').addEventListener('click', () => {
    loadMemories();
    showToast('Refreshed memory cards from MongoDB.');
  });

  // Toggle Pipeline Log Drawer
  togglePipelineLogEl.addEventListener('click', () => {
    const isHidden = pipelineLogContentEl.classList.toggle('hidden');
    pipelineChevronEl.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
  });
}

/**
 * Checks backend health, MongoDB connection mode and Atlas vector index
 */
async function checkSystemStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    state.isAtlasConnected = data.isUsingAtlas;

    if (data.isUsingAtlas) {
      dbStatusTextEl.textContent = 'Atlas Connected ($vectorSearch)';
      dbStatusTextEl.classList.add('text-emerald-400');
      logPipeline(`[Atlas] Connected to cluster database: "${data.dbName}"`);
      logPipeline(`[Atlas] Vector Search Index: "${data.vectorIndexName}" (cosine similarity, 1536 dims)`);
    } else {
      dbStatusTextEl.textContent = 'In-Memory Simulation (Atlas URI unset)';
      dbStatusTextEl.classList.add('text-amber-400');
      logPipeline(`[Notice] Running in zero-config mode. To connect Atlas, set MONGODB_URI in .env`);
    }
  } catch (err) {
    dbStatusTextEl.textContent = 'Backend Offline';
    dbStatusTextEl.classList.add('text-rose-400');
    console.error('Status check failed:', err);
  }
}

/**
 * Loads all memories for active agent from MongoDB
 */
async function loadMemories(highlightIds = []) {
  try {
    const res = await fetch(`/api/memories/${state.agentId}`);
    const data = await res.json();

    if (data.success) {
      state.memories = data.memories || [];
      memoryCountBadgeEl.textContent = `${state.memories.length} facts`;
      renderMemories(highlightIds);
    }
  } catch (err) {
    console.error('Failed to load memories:', err);
  }
}

/**
 * Renders memories list with filtering and styling
 */
function renderMemories(highlightIds = []) {
  const filtered = state.activeFilter === 'all'
    ? state.memories
    : state.memories.filter(m => m.category === state.activeFilter);

  if (filtered.length === 0) {
    memoriesEmptyStateEl.classList.remove('hidden');
    memoriesListEl.innerHTML = '';
    memoriesListEl.appendChild(memoriesEmptyStateEl);
    return;
  }

  memoriesEmptyStateEl.classList.add('hidden');
  memoriesListEl.innerHTML = '';

  filtered.forEach(memory => {
    const isHighlighted = highlightIds.includes(memory._id);
    const card = document.createElement('div');
    card.className = `memory-card group relative bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 shadow-sm space-y-2 ${
      isHighlighted ? 'memory-updated-flash' : ''
    }`;

    const badgeClass = `badge-${memory.category || 'fact'}`;
    const formattedDate = formatRelativeTime(memory.updated_at);
    const importancePercent = Math.round((memory.importance_score || 0.5) * 100);

    card.innerHTML = `
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-2">
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${badgeClass}">
            ${memory.category || 'fact'}
          </span>
          <span class="text-[10px] text-slate-500 font-mono">1536 dims</span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-[10px] text-slate-400 font-mono">${formattedDate}</span>
          <button
            class="btn-delete-memory opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity"
            data-id="${memory._id}"
            title="Delete this memory"
          >
            <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
          </button>
        </div>
      </div>

      <p class="text-xs text-slate-200 font-normal leading-relaxed pr-2">
        ${escapeHtml(memory.content)}
      </p>

      <div class="pt-1 flex items-center justify-between border-t border-slate-800/60 text-[10px] text-slate-400">
        <div class="flex items-center space-x-1.5">
          <span>Importance:</span>
          <div class="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-full bg-mongo rounded-full" style="width: ${importancePercent}%"></div>
          </div>
          <span class="font-mono text-slate-300">${(memory.importance_score || 0.5).toFixed(2)}</span>
        </div>
        <span class="text-slate-500 font-mono text-[9px] truncate max-w-[120px]" title="${memory._id}">
          ID: ${memory._id.substring(0, 8)}...
        </span>
      </div>
    `;

    // Hook up delete button
    const deleteBtn = card.querySelector('.btn-delete-memory');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      handleDeleteMemory(memory._id);
    });

    memoriesListEl.appendChild(card);
  });

  refreshIcons();
}

/**
 * Handles sending a message
 */
async function handleSendMessage() {
  const text = userInputEl.value.trim();
  if (!text || state.isSending) return;

  state.isSending = true;
  sendBtnEl.disabled = true;
  userInputEl.value = '';
  userInputEl.style.height = 'auto';

  // 1. Append user message to UI
  appendMessage('user', text);
  state.chatHistory.push({ role: 'user', content: text });

  // 2. Append typing indicator
  const typingIndicatorId = appendTypingIndicator();

  // Log pipeline initiation
  logPipeline(`\n[Turn] Querying Vector Search with prompt: "${text.substring(0, 35)}..."`);

  try {
    const startTime = performance.now();
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: state.agentId,
        message: text,
        history: state.chatHistory.slice(-4)
      })
    });

    const data = await res.json();
    removeTypingIndicator(typingIndicatorId);

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Chat request failed');
    }

    const elapsed = Math.round(performance.now() - startTime);

    // Update stats bar
    statLatencyEl.textContent = `${data.meta.vectorSearchLatencyMs || 25} ms`;

    // 3. Append agent response with injected memory inspector
    appendMessage('agent', data.reply, data.retrieved_memories);
    state.chatHistory.push({ role: 'assistant', content: data.reply });

    // 4. Log and inspect write policy report
    const updates = data.memory_updates;
    const modifiedIds = [];

    if (updates && updates.actions && updates.actions.length > 0) {
      let actionSummary = [];
      if (updates.insertedCount > 0) actionSummary.push(`✨ ${updates.insertedCount} inserted`);
      if (updates.updatedCount > 0) actionSummary.push(`🔄 ${updates.updatedCount} updated`);
      statWriteActionEl.textContent = actionSummary.join(', ');

      updates.actions.forEach(act => {
        if (act.type === 'UPDATE') {
          logPipeline(`[Write: updateOne] Overwrote memory #${act.memoryId.substring(0, 6)} (Similarity: ${(act.similarity * 100).toFixed(1)}%) -> "${act.newContent}"`);
          modifiedIds.push(act.memoryId);
          showToast(`🔄 Memory Updated: "${act.newContent}"`);
        } else if (act.type === 'INSERT') {
          logPipeline(`[Write: insertOne] Stored new fact [${act.category}] -> "${act.content}"`);
          modifiedIds.push(act.memoryId);
          showToast(`✨ New Memory Stored: "${act.content}"`);
        }
      });
    } else {
      statWriteActionEl.textContent = 'Turn analyzed (no new facts)';
      logPipeline(`[Write Policy] Turn analyzed. No persistent facts needed storing.`);
    }

    if (data.retrieved_memories && data.retrieved_memories.length > 0) {
      logPipeline(`[VectorSearch] Injected ${data.retrieved_memories.length} relevant memories into LLM prompt (top score: ${(data.retrieved_memories[0].score * 100).toFixed(1)}%)`);
    }

    // 5. Reload Live MongoDB Memory Inspector
    await loadMemories(modifiedIds);

  } catch (err) {
    removeTypingIndicator(typingIndicatorId);
    appendMessage('agent', `⚠️ Error communicating with agentic backend: ${err.message}`);
    console.error('Error during chat:', err);
  } finally {
    state.isSending = false;
    sendBtnEl.disabled = false;
    userInputEl.focus();
  }
}

/**
 * Appends a message bubble into the chat window
 */
function appendMessage(role, content, retrievedMemories = []) {
  const isUser = role === 'user';
  const msgWrapper = document.createElement('div');
  msgWrapper.className = `flex items-start space-x-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse space-x-reverse' : ''}`;

  const avatar = isUser
    ? `<div class="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 shrink-0 text-xs font-semibold">You</div>`
    : `<div class="w-8 h-8 rounded-full bg-mongo/15 border border-mongo/30 flex items-center justify-center text-mongo shrink-0 shadow-sm"><i data-lucide="bot" class="w-4 h-4"></i></div>`;

  const bubbleClasses = isUser
    ? 'bg-mongo text-slate-950 font-medium rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm shadow-md'
    : 'bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-slate-200 shadow-md leading-relaxed';

  let contextAccordionHtml = '';
  if (!isUser && retrievedMemories && retrievedMemories.length > 0) {
    const memoryPills = retrievedMemories.map(m => {
      const score = m.score ? ` · ${(m.score * 100).toFixed(1)}% match` : '';
      return `
        <div class="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] text-slate-300">
          <div class="flex items-center justify-between text-[9px] text-slate-500 font-mono mb-1">
            <span class="text-mongo uppercase">${m.category}</span>
            <span>${score}</span>
          </div>
          <div>${escapeHtml(m.content)}</div>
        </div>
      `;
    }).join('');

    contextAccordionHtml = `
      <div class="mt-2.5 pt-2 border-t border-slate-800/80">
        <details class="group cursor-pointer">
          <summary class="text-[11px] text-slate-400 font-medium flex items-center space-x-1 hover:text-mongo transition-colors select-none">
            <i data-lucide="brain-circuit" class="w-3.5 h-3.5 text-mongo"></i>
            <span>Retrieved ${retrievedMemories.length} Memories from Atlas Vector Search</span>
            <i data-lucide="chevron-down" class="w-3 h-3 group-open:rotate-180 transition-transform"></i>
          </summary>
          <div class="mt-2 space-y-1.5 pl-1">
            ${memoryPills}
          </div>
        </details>
      </div>
    `;
  }

  msgWrapper.innerHTML = `
    ${avatar}
    <div class="flex-1 space-y-1 max-w-[85%]">
      <div class="flex items-center space-x-2 ${isUser ? 'justify-end' : ''}">
        <span class="font-medium text-xs text-slate-400">${isUser ? 'You' : 'Atlas Memory Agent'}</span>
      </div>
      <div class="${bubbleClasses}">
        <p class="whitespace-pre-wrap">${formatMarkdown(content)}</p>
        ${contextAccordionHtml}
      </div>
    </div>
  `;

  chatMessagesEl.appendChild(msgWrapper);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  refreshIcons();
}

/**
 * Appends a typing animation bubble
 */
function appendTypingIndicator() {
  const id = 'typing-' + Date.now();
  const wrapper = document.createElement('div');
  wrapper.id = id;
  wrapper.className = 'flex items-start space-x-3 max-w-3xl';
  wrapper.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-mongo/15 border border-mongo/30 flex items-center justify-center text-mongo shrink-0">
      <i data-lucide="bot" class="w-4 h-4"></i>
    </div>
    <div class="bg-slate-900 border border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center space-x-1.5">
      <span class="w-2 h-2 rounded-full bg-mongo typing-dot"></span>
      <span class="w-2 h-2 rounded-full bg-mongo typing-dot"></span>
      <span class="w-2 h-2 rounded-full bg-mongo typing-dot"></span>
    </div>
  `;
  chatMessagesEl.appendChild(wrapper);
  chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  refreshIcons();
  return id;
}

function removeTypingIndicator(id) {
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * Handles deleting a memory document
 */
async function handleDeleteMemory(id) {
  if (!confirm('Are you sure you want to delete this memory from MongoDB Atlas?')) {
    return;
  }

  try {
    const res = await fetch(`/api/memories/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      logPipeline(`[Delete] Deleted memory document #${id.substring(0, 8)} from Atlas`);
      showToast('Memory deleted successfully.');
      await loadMemories();
    } else {
      showToast('Failed to delete memory: ' + (data.error || 'Unknown error'));
    }
  } catch (err) {
    showToast('Network error while deleting memory');
    console.error(err);
  }
}

/**
 * Seeds sample memories for quick hackathon judging
 */
async function handleSeedData() {
  btnSeedEl.disabled = true;
  btnSeedEl.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i><span>Seeding...</span>`;
  refreshIcons();

  try {
    const res = await fetch('/api/memories/seed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_id: state.agentId })
    });
    const data = await res.json();
    if (data.success) {
      logPipeline(`[Seed] Seeded ${data.count} demo memories into MongoDB with 1536-dim embeddings.`);
      showToast(`Seeded ${data.count} memories into Atlas!`);
      await loadMemories();
    }
  } catch (err) {
    console.error('Seed failed:', err);
    showToast('Failed to seed memories.');
  } finally {
    btnSeedEl.disabled = false;
    btnSeedEl.innerHTML = `<i data-lucide="sparkles" class="w-3.5 h-3.5"></i><span class="hidden md:inline">Seed Demo Data</span>`;
    refreshIcons();
  }
}

/**
 * Clears all memories for active agent
 */
async function handleClearMemories() {
  if (!confirm(`Are you sure you want to clear ALL memories for agent "${state.agentId}"?`)) {
    return;
  }

  try {
    const res = await fetch(`/api/memories/all/${state.agentId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      logPipeline(`[Clear] Deleted ${data.deletedCount} memories for agent "${state.agentId}"`);
      showToast(`Cleared ${data.deletedCount} memories.`);
      await loadMemories();
    }
  } catch (err) {
    console.error('Clear failed:', err);
    showToast('Failed to clear memories');
  }
}

/**
 * Logs a message to the real-time terminal drawer
 */
function logPipeline(msg) {
  const line = document.createElement('div');
  const time = new Date().toLocaleTimeString();
  line.innerHTML = `<span class="text-slate-600">[${time}]</span> ${escapeHtml(msg)}`;
  pipelineLogContentEl.appendChild(line);
  pipelineLogContentEl.scrollTop = pipelineLogContentEl.scrollHeight;
}

/**
 * Displays a non-blocking toast notification
 */
let toastTimeout = null;
function showToast(msg) {
  clearTimeout(toastTimeout);
  toastMessageEl.textContent = msg;
  toastEl.classList.remove('translate-y-20', 'opacity-0');
  toastEl.classList.add('translate-y-0', 'opacity-100');
  toastTimeout = setTimeout(() => {
    toastEl.classList.remove('translate-y-0', 'opacity-100');
    toastEl.classList.add('translate-y-20', 'opacity-0');
  }, 3500);
}

/**
 * Utilities
 */
function formatRelativeTime(dateInput) {
  if (!dateInput) return 'just now';
  const diffSec = Math.floor((new Date() - new Date(dateInput)) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatMarkdown(text) {
  if (!text) return '';
  // Basic bold formatting
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');
}
