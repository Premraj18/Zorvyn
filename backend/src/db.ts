import dotenv from 'dotenv';
dotenv.config();
import { MongoClient, MongoServerError } from "mongodb";
import type { Role } from "./types.js";

type CounterDoc = {
  _id: string;
  seq: number;
};

export type UserDoc = {
  id: number;
  name: string;
  email: string;
  role: Role;
  isActive: number;
  createdAt: string;
};

export type RecordDoc = {
  id: number;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  notes: string;
  created_by: number;
  createdAt: string;
  updatedAt: string;
};

const mongoUri = process.env.MONGO_URI;
if (!mongoUri) {
  throw new Error("MONGO_URI is required");
}

const mongoDbName = process.env.MONGO_DB_NAME ?? "finance_dashboard";
const client = new MongoClient(mongoUri, {
  // Serverless-friendly defaults to avoid long hangs on bad network/Atlas config.
  maxPoolSize: 5,
  minPoolSize: 0,
  maxIdleTimeMS: 15000,
  serverSelectionTimeoutMS: 5000,
  connectTimeoutMS: 10000,
  socketTimeoutMS: 20000
});
let initialized = false;
let connectPromise: Promise<unknown> | null = null;
let initializationPromise: Promise<void> | null = null;

export async function getDb() {
  if (!connectPromise) {
    connectPromise = client.connect();
  }

  await connectPromise;
  return client.db(mongoDbName);
}

export async function getUsersCollection() {
  const db = await getDb();
  return db.collection<UserDoc>("users");
}

export async function getRecordsCollection() {
  const db = await getDb();
  return db.collection<RecordDoc>("records");
}

export async function getCountersCollection() {
  const db = await getDb();
  return db.collection<CounterDoc>("counters");
}

export async function getNextSequence(name: "users" | "records"): Promise<number> {
  const counters = await getCountersCollection();
  const counter = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );

  if (!counter) {
    throw new Error("Failed to generate sequence");
  }

  return counter.seq;
}

function isDuplicateKeyError(error: unknown): boolean {
  return error instanceof MongoServerError && error.code === 11000;
}

async function ensureSeedUsers(): Promise<void> {
  const users = await getUsersCollection();
  const userCount = await users.countDocuments();

  if (userCount > 0) {
    return;
  }

  const now = new Date().toISOString();
  const seedUsers = [
    { name: "Admin User", email: "admin@finance.local", role: "admin" as const },
    { name: "Analyst User", email: "analyst@finance.local", role: "analyst" as const },
    { name: "Viewer User", email: "viewer@finance.local", role: "viewer" as const }
  ];

  for (const seedUser of seedUsers) {
    const nextId = await getNextSequence("users");

    try {
      await users.insertOne({
        id: nextId,
        name: seedUser.name,
        email: seedUser.email,
        role: seedUser.role,
        isActive: 1,
        createdAt: now
      });
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    }
  }

  const counters = await getCountersCollection();
  await counters.updateOne({ _id: "users" }, { $max: { seq: 3 } }, { upsert: true });
}

export async function initDatabase(): Promise<void> {
  if (initialized) {
    return;
  }

  if (initializationPromise) {
    await initializationPromise;
    return;
  }

  initializationPromise = (async () => {
    const users = await getUsersCollection();
    const records = await getRecordsCollection();

    await users.createIndex({ id: 1 }, { unique: true });
    await users.createIndex({ email: 1 }, { unique: true });
    await records.createIndex({ id: 1 }, { unique: true });
    await records.createIndex({ created_by: 1 });
    await records.createIndex({ date: 1 });

    await ensureSeedUsers();
    initialized = true;
  })();

  try {
    await initializationPromise;
  } finally {
    initializationPromise = null;
  }
}
