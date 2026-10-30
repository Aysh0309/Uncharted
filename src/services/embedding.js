import OpenAI from 'openai';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const EMBEDDING_DIMENSION = 1536; // Standard for text-embedding-3-small

let openaiClient = null;
if (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim() !== '') {
  try {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  } catch (err) {
    console.warn('⚠️  [Embedding] Failed to initialize OpenAI client:', err.message);
  }
}

/**
 * Calculates cosine similarity between two numeric vectors.
 * Returns value between -1.0 and 1.0 (typically 0.0 to 1.0 for normalized embeddings).
 */
export function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Deterministic semantic mock embedding generator.
 * Produces a normalized 1536-dimensional float vector.
 * Words and semantic stems project onto deterministic sparse/dense basis vectors,
 * ensuring that semantically similar texts yield high cosine similarity (>0.80).
 */
function generateDeterministicEmbedding(text) {
  const vector = new Float32Array(EMBEDDING_DIMENSION);
  const normalizedText = (text || '').toLowerCase().trim();
  const words = normalizedText.split(/\W+/).filter(Boolean);

  if (words.length === 0) {
    // Return unit vector for empty input
    vector[0] = 1.0;
    return Array.from(vector);
  }

  // Common semantic synonym clusters for mock testing
  const synonyms = {
    theme: ['theme', 'mode', 'dark', 'light', 'ui', 'color', 'appearance'],
    database: ['database', 'mongodb', 'atlas', 'nosql', 'db', 'storage', 'collection'],
    backend: ['backend', 'server', 'node', 'nodejs', 'express', 'api', 'fastapi'],
    frontend: ['frontend', 'react', 'ui', 'html', 'tailwind', 'vue', 'nextjs'],
    stack: ['stack', 'tech', 'technology', 'framework', 'tools'],
    language: ['javascript', 'typescript', 'python', 'lang', 'language', 'js', 'ts'],
    identity: ['name', 'user', 'developer', 'engineer', 'author', 'creator'],
    preference: ['like', 'prefer', 'love', 'favor', 'choice', 'hate', 'dislike']
  };

  // 1. Text-level hash seed
  const fullHash = crypto.createHash('sha256').update(normalizedText).digest();
  for (let i = 0; i < 32; i++) {
    const idx = (fullHash[i] * 37) % EMBEDDING_DIMENSION;
    vector[idx] += 0.2;
  }

  // 2. Word-level hashing & semantic clusters
  for (const word of words) {
    const wordHash = crypto.createHash('sha256').update(word).digest();
    for (let i = 0; i < 16; i++) {
      const idx = (wordHash[i] * 43 + i * 19) % EMBEDDING_DIMENSION;
      const sign = (wordHash[(i + 5) % 16] % 2 === 0) ? 1 : -1;
      vector[idx] += sign * 0.4;
    }

    // Check synonym clusters
    for (const [clusterName, clusterWords] of Object.entries(synonyms)) {
      if (clusterWords.includes(word)) {
        const clusterHash = crypto.createHash('sha256').update(clusterName).digest();
        for (let j = 0; j < 24; j++) {
          const idx = (clusterHash[j] * 53 + j * 17) % EMBEDDING_DIMENSION;
          vector[idx] += 0.6; // strong shared semantic component
        }
      }
    }
  }

  // 3. Normalize vector to unit length (L2 norm = 1.0)
  let sumSq = 0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    sumSq += vector[i] * vector[i];
  }
  const norm = Math.sqrt(sumSq) || 1.0;
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    vector[i] = vector[i] / norm;
  }

  return Array.from(vector);
}

/**
 * Generates vector embedding for input text.
 * Uses OpenAI text-embedding-3-small when OPENAI_API_KEY is available;
 * otherwise uses deterministic semantic mock generator.
 *
 * @param {string} text - The input text to embed
 * @returns {Promise<{ embedding: number[], isMock: boolean, model: string }>}
 */
export async function getEmbedding(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Input text must be a non-empty string');
  }

  if (openaiClient) {
    try {
      const response = await openaiClient.embeddings.create({
        model: 'text-embedding-3-small',
        input: text.replace(/\n/g, ' '),
      });
      return {
        embedding: response.data[0].embedding,
        isMock: false,
        model: 'text-embedding-3-small'
      };
    } catch (error) {
      console.warn(`⚠️  [Embedding] OpenAI API call failed (${error.message}). Falling back to deterministic mock embedding.`);
    }
  }

  // Zero-config deterministic fallback
  const mockVector = generateDeterministicEmbedding(text);
  return {
    embedding: mockVector,
    isMock: true,
    model: 'mock-semantic-embedder-1536'
  };
}

export { EMBEDDING_DIMENSION };
