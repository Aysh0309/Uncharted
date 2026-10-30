import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME || 'agentic_memory_db';

let client = null;
let db = null;
let isConnectedToAtlas = false;

/**
 * In-memory fallback store if MongoDB Atlas URI is not configured.
 * This guarantees the project runs seamlessly for zero-friction evaluation
 * while preserving full vector similarity logic.
 */
class InMemoryDatabase {
  constructor() {
    this.agents = new Map();
    this.memories = new Map();
    console.log('⚡ [DB] Initialized in-memory fallback store (Atlas URI not configured).');
  }

  // Pre-seed default agent
  init() {
    if (!this.agents.has('default-agent')) {
      this.agents.set('default-agent', {
        agent_id: 'default-agent',
        owner: 'hackathon-judge',
        createdAt: new Date(),
      });
    }
  }
}

const inMemoryDb = new InMemoryDatabase();
inMemoryDb.init();

/**
 * Connect to MongoDB Atlas
 */
export async function connectDB() {
  if (!uri || uri.includes('<username>')) {
    console.warn('\n⚠️  [MongoDB] MONGODB_URI is not set or contains placeholder credentials.');
    console.warn('ℹ️  Running in Zero-Config In-Memory Mode with vector similarity simulation.');
    console.warn('👉 To connect to your MongoDB Atlas cluster, update MONGODB_URI in .env\n');
    isConnectedToAtlas = false;
    return null;
  }

  try {
    console.log('🔄 [MongoDB] Connecting to MongoDB Atlas cluster...');
    client = new MongoClient(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 5000,
    });

    await client.connect();
    db = client.db(dbName);
    isConnectedToAtlas = true;
    console.log(`✅ [MongoDB] Successfully connected to Atlas database: "${dbName}"`);

    // Ensure collections exist and seed default agent
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);

    if (!collectionNames.includes('memories')) {
      await db.createCollection('memories');
      console.log('📁 [MongoDB] Created collection: "memories"');
    }

    if (!collectionNames.includes('agents')) {
      await db.createCollection('agents');
      console.log('📁 [MongoDB] Created collection: "agents"');
    }

    // Seed default agent if not exists
    const agentsCol = db.collection('agents');
    const existingAgent = await agentsCol.findOne({ agent_id: 'default-agent' });
    if (!existingAgent) {
      await agentsCol.insertOne({
        agent_id: 'default-agent',
        owner: 'hackathon-judge',
        createdAt: new Date(),
      });
      console.log('👤 [MongoDB] Seeded default agent: "default-agent"');
    }

    return db;
  } catch (error) {
    console.error('❌ [MongoDB] Failed to connect to MongoDB Atlas:', error.message);
    console.warn('⚠️  Falling back to Zero-Config In-Memory Mode for continuous operation.');
    isConnectedToAtlas = false;
    return null;
  }
}

/**
 * Get active database instance
 */
export function getDb() {
  return db;
}

/**
 * Get memories collection or in-memory adapter
 */
export function getMemoriesCollection() {
  if (isConnectedToAtlas && db) {
    return db.collection('memories');
  }
  return null;
}

/**
 * Get agents collection or in-memory adapter
 */
export function getAgentsCollection() {
  if (isConnectedToAtlas && db) {
    return db.collection('agents');
  }
  return null;
}

/**
 * Check if connected to real Atlas cluster
 */
export function isUsingAtlas() {
  return isConnectedToAtlas;
}

/**
 * In-memory database store reference
 */
export function getInMemoryStore() {
  return inMemoryDb;
}

/**
 * Closes the MongoDB connection
 */
export async function closeDB() {
  if (client) {
    await client.close();
    isConnectedToAtlas = false;
    console.log('🔌 [MongoDB] Connection closed.');
  }
}
