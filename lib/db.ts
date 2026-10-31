import { MongoClient, Db } from "mongodb";
import dns from "node:dns";

// Fix querySrv EBADRESP on local networks/ISPs by using reliable public DNS (Google & Cloudflare)
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch {
  // Ignore in restricted environments
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

/**
 * Normalizes MongoDB connection strings.
 * If an SRV connection string for cluster0.byuhmwd.mongodb.net is supplied, automatically
 * maps it to the direct replica set nodes to prevent Node.js `querySrv EBADRESP` errors
 * caused by local Wi-Fi router / ISP DNS proxies.
 */
export function resolveMongoUri(rawUri: string): string {
  const uri = rawUri.trim();
  if (uri.startsWith("mongodb+srv://") && uri.includes("cluster0.byuhmwd.mongodb.net")) {
    const match = uri.match(
      /^mongodb\+srv:\/\/([^:]+):([^@]+)@cluster0\.byuhmwd\.mongodb\.net\/?([^?]*)(?:\?(.*))?$/
    );
    if (match) {
      const [, user, pass, dbName] = match;
      const targetDb = dbName || process.env.MONGODB_DB_NAME || "casememory";
      return `mongodb://${user}:${pass}@ac-ohiopem-shard-00-00.byuhmwd.mongodb.net:27017,ac-ohiopem-shard-00-01.byuhmwd.mongodb.net:27017,ac-ohiopem-shard-00-02.byuhmwd.mongodb.net:27017/${targetDb}?ssl=true&replicaSet=atlas-h6tc3l-shard-0&authSource=admin&retryWrites=true&w=majority`;
    }
  }
  return uri;
}

/**
 * Returns a cached MongoDB client promise.
 * In development, uses a global variable across HMR reloads.
 * In production / serverless (Vercel), reuses connection instances within execution context.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  const rawUri = process.env.MONGODB_URI;
  if (!rawUri) {
    throw new Error("Missing MONGODB_URI environment variable in .env.local or environment");
  }

  const uri = resolveMongoUri(rawUri);

  if (process.env.NODE_ENV === "development") {
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    return global._mongoClientPromise;
  } else {
    if (!clientPromise) {
      client = new MongoClient(uri, options);
      clientPromise = client.connect();
    }
    return clientPromise;
  }
}

/**
 * Convenience helper to get a connected Db instance.
 */
export async function getDb(dbName?: string): Promise<Db> {
  const client = await getMongoClientPromise();
  const name = dbName || process.env.MONGODB_DB_NAME || "casememory";
  return client.db(name);
}

export default getMongoClientPromise;

