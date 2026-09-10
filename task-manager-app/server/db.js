/**
 * Database initialization and helpers.
 * Uses better-sqlite3 for synchronous, fast, embedded SQLite access.
 */
const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "tasks.db");

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id    INTEGER PRIMARY KEY AUTOINCREMENT,
    name  TEXT    NOT NULL,
    email TEXT    NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    title      TEXT    NOT NULL,
    description TEXT   DEFAULT '',
    status     TEXT    NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending','in-progress','completed')),
    priority   TEXT    NOT NULL DEFAULT 'medium'
                        CHECK (priority IN ('low','medium','high')),
    due_date   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks (user_id);
`);

module.exports = db;
