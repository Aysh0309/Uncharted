import { MongoClient, Db } from "mongodb";

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

/**
 * Returns a cached MongoDB client promise.
 * In development, uses a global variable across HMR reloads.
 * In production / serverless (Vercel), reuses connection instances within execution context.
 */
export function getMongoClientPromise(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable in .env.local or environment");
  }

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

