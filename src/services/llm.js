import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

let openaiClient = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
  try {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    console.warn('⚠️  [LLM] Failed to initialize OpenAI client:', err.message);
  }
}

/**
 * Builds the system prompt injecting retrieved long-term memories.
 */
function buildSystemPrompt(pastMemories = []) {
  let memoryBlock = 'None retrieved (no past matching memories found).';

  if (pastMemories && pastMemories.length > 0) {
    memoryBlock = pastMemories
      .map((m, idx) => {
        const score = m.score ? ` (similarity: ${(m.score * 100).toFixed(1)}%)` : '';
        return `[${idx + 1}] [${m.category?.toUpperCase() || 'FACT'}] ${m.content}${score} (importance: ${m.importance_score || 0.5})`;
      })
      .join('\n');
  }

  return `You are an advanced, empathetic AI assistant equipped with an Agentic Long-Term Memory System powered by MongoDB Atlas Vector Search.

### RELEVANT LONG-TERM MEMORIES RETRIEVED FROM MONGODB ATLAS:
${memoryBlock}

### INSTRUCTIONS:
1. Seamlessly personalize your response using the retrieved memories above whenever relevant.
2. If the user mentions something that updates or changes a past memory (e.g., "I switched from Python to Node.js"), acknowledge the update warmly.
3. Be clear, helpful, concise, and professional.
4. If memories were used in shaping your answer, feel free to subtly confirm your recollection (e.g., "As you mentioned earlier...", "Keeping in mind your preference for...").`;
}

/**
 * Generates an agent conversational response.
 *
 * @param {string} userMessage - User's current prompt
 * @param {Array} pastMemories - Array of memories retrieved from MongoDB Vector Search
 * @param {Array} history - Optional recent chat turns
 * @returns {Promise<{ reply: string, isMock: boolean, model: string }>}
 */
export async function generateAgentResponse(userMessage, pastMemories = [], history = []) {
  const systemPrompt = buildSystemPrompt(pastMemories);

  if (openaiClient) {
    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6).map(h => ({ role: h.role, content: h.content })),
        { role: 'user', content: userMessage }
      ];

      const completion = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 600,
      });

      return {
        reply: completion.choices[0].message.content,
        isMock: false,
        model: 'gpt-4o-mini'
      };
    } catch (error) {
      console.warn(`⚠️  [LLM] OpenAI chat completion failed (${error.message}). Using smart fallback generator.`);
    }
  }

  // Zero-Config Smart Fallback Generator
  return {
    reply: generateSmartFallbackResponse(userMessage, pastMemories),
    isMock: true,
    model: 'mock-llm-engine'
  };
}

/**
 * Intelligent fallback conversational response generator
 * that acknowledges retrieved past memories and the user message.
 */
function generateSmartFallbackResponse(userMessage, pastMemories = []) {
  const msgLower = userMessage.toLowerCase();
  let memoryContextAcknowledgment = '';

  if (pastMemories && pastMemories.length > 0) {
    const memoryFacts = pastMemories.map(m => `"${m.content}"`).join(', ');
    memoryContextAcknowledgment = `\n\n*(Recalled from MongoDB Atlas Vector Search: ${memoryFacts})*`;
  }

  // Question about preferences / stack
  if (msgLower.includes('what is my') || msgLower.includes('what do i') || msgLower.includes('what am i') || msgLower.includes('do you remember')) {
    if (pastMemories.length > 0) {
      const topMemory = pastMemories[0];
      return `Based on my long-term memory in MongoDB Atlas, I remember that **${topMemory.content}**! ${memoryContextAcknowledgment}`;
    } else {
      return `I don't have any recorded memories about that yet for this session. Tell me what you'd like me to remember!`;
    }
  }

  // Update or preference statement
  if (msgLower.includes('switch') || msgLower.includes('changed') || msgLower.includes('instead') || msgLower.includes('now using')) {
    return `Noted! I have updated my long-term memory with this change. MongoDB Atlas Vector Search will now prioritize your updated preference. ${memoryContextAcknowledgment}`;
  }

  if (msgLower.includes('i prefer') || msgLower.includes('i like') || msgLower.includes('my favorite') || msgLower.includes('i love')) {
    return `Got it! I have committed this preference to my persistent memory storage. I will keep this in mind for all our future conversations! ${memoryContextAcknowledgment}`;
  }

  if (msgLower.includes('i am working on') || msgLower.includes('building') || msgLower.includes('project')) {
    return `That sounds like an exciting project! I've stored these details in my MongoDB Atlas knowledge base so I can assist you with full context as we build. ${memoryContextAcknowledgment}`;
  }

  if (pastMemories.length > 0) {
    return `Understood! With your preferences in mind (especially that *${pastMemories[0].content}*), I'm ready to help. What specific aspect would you like to explore next? ${memoryContextAcknowledgment}`;
  }

  return `I've noted that! My Agentic Memory system has evaluated our conversation and saved any key facts into MongoDB Atlas. How else can I assist you today?`;
}

/**
 * Analyzes conversation turn and extracts persistent facts/preferences.
 * Follows the Agentic Write Policy:
 * extracts atomic facts, classifies category, and assigns importance score.
 *
 * @param {string} userMessage - User's prompt
 * @param {string} agentReply - Agent's reply
 * @returns {Promise<Array<{ content: string, category: string, importance_score: number }>>}
 */
export async function extractFactsFromTurn(userMessage, agentReply) {
  if (openaiClient) {
    try {
      const prompt = `Analyze this conversation turn between a user and an AI assistant.
Extract any new atomic facts, personal preferences, project details, tech stack choices, constraints, or goals stated by or learned about the user.

USER MESSAGE: "${userMessage}"
AI RESPONSE: "${agentReply}"

RULES:
1. Extract only meaningful, persistent long-term information (e.g. "User prefers Node.js backend", "User is building an Agentic Memory System for MongoDB Hackathon").
2. Do not extract temporary conversational pleasantries ("User said hello", "User asked a question").
3. Categorize each item as one of: "preference", "project", "fact", "constraint", or "goal".
4. Assign an importance_score between 0.1 and 1.0 (1.0 = highest importance / core preference).
5. If no persistent information is present, return an empty array [].

Respond ONLY with valid JSON array in this exact format:
[
  {
    "content": "Atomic fact statement in third person",
    "category": "preference|project|fact|constraint|goal",
    "importance_score": 0.85
  }
]`;

      const response = await openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      });

      const raw = response.choices[0].message.content.trim();
      const cleaned = raw.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) {
        return parsed.map(item => ({
          content: String(item.content || '').trim(),
          category: ['preference', 'project', 'fact', 'constraint', 'goal'].includes(item.category)
            ? item.category
            : 'fact',
          importance_score: Math.min(1.0, Math.max(0.1, parseFloat(item.importance_score) || 0.7))
        })).filter(item => item.content.length > 5);
      }
    } catch (err) {
      console.warn(`⚠️  [LLM] OpenAI fact extraction failed (${err.message}). Using rule-based fallback extractor.`);
    }
  }

  // Fallback rule-based extractor
  return extractFactsRuleBased(userMessage);
}

/**
 * Deterministic NLP rule-based fact extractor for zero-config offline runs.
 */
function extractFactsRuleBased(userMessage) {
  const facts = [];
  const text = userMessage.trim();

  // Pattern 1: Preferences ("I prefer X", "I like X", "I love X")
  const prefMatch = text.match(/i\s+(?:prefer|like|love|favor)\s+([^.!?]+)/i);
  if (prefMatch) {
    facts.push({
      content: `User prefers ${prefMatch[1].trim()}`,
      category: 'preference',
      importance_score: 0.85
    });
  }

  // Pattern 2: Switching/Updating ("I switched to X", "I changed to X", "I am now using X")
  const switchMatch = text.match(/i\s+(?:switched\s+to|changed\s+to|am\s+now\s+using|decided\s+on)\s+([^.!?]+)/i);
  if (switchMatch) {
    facts.push({
      content: `User is now using ${switchMatch[1].trim()}`,
      category: 'project',
      importance_score: 0.95
    });
  }

  // Pattern 3: Projects ("I am building X", "I am working on X", "My project is X")
  const projMatch = text.match(/i\s+(?:am\s+building|am\s+working\s+on|work\s+on)\s+([^.!?]+)/i);
  if (projMatch) {
    facts.push({
      content: `User is building ${projMatch[1].trim()}`,
      category: 'project',
      importance_score: 0.90
    });
  }

  // Pattern 4: Identity / Facts ("My name is X", "I am a X")
  const idMatch = text.match(/my\s+name\s+is\s+([A-Za-z]+)/i);
  if (idMatch) {
    facts.push({
      content: `User's name is ${idMatch[1].trim()}`,
      category: 'fact',
      importance_score: 0.95
    });
  }

  // Pattern 5: Constraints ("I cannot use X", "I must use X", "I need to use X")
  const constMatch = text.match(/i\s+(?:must|need\s+to|have\s+to)\s+use\s+([^.!?]+)/i);
  if (constMatch) {
    facts.push({
      content: `User requires using ${constMatch[1].trim()}`,
      category: 'constraint',
      importance_score: 0.85
    });
  }

  // Fallback heuristic: If the user provides an informative statement of 4-15 words
  if (facts.length === 0 && text.split(/\s+/).length >= 4 && !text.endsWith('?')) {
    facts.push({
      content: `User noted: "${text}"`,
      category: 'fact',
      importance_score: 0.70
    });
  }

  return facts;
}
