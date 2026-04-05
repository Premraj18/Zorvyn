import Database from "better-sqlite3";
import path from "node:path";

function getDbPath(): string {
  const envPath = process.env.DB_PATH;

  if (process.env.VERCEL) {
    // Vercel serverless can only write to /tmp, so force any custom file name there.
    if (!envPath) {
      return "/tmp/finance.db";
    }

    return envPath.startsWith("/tmp/") ? envPath : `/tmp/${path.basename(envPath)}`;
  }

  return envPath ?? "finance.db";
}

const resolvedDbPath = getDbPath();

const db = new Database(resolvedDbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL CHECK (role IN ('viewer', 'analyst', 'admin')),
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    amount REAL NOT NULL CHECK (amount >= 0),
    type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    notes TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  );
`);

const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };

if (usersCount.count === 0) {
  const seedUsers = db.prepare(
    "INSERT INTO users (name, email, role, is_active) VALUES (?, ?, ?, ?)"
  );

  seedUsers.run("Admin User", "admin@finance.local", "admin", 1);
  seedUsers.run("Analyst User", "analyst@finance.local", "analyst", 1);
  seedUsers.run("Viewer User", "viewer@finance.local", "viewer", 1);
}

export default db;
