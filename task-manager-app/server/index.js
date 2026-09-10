/**
 * Task Manager — Express server entry point.
 *
 * Routes
 * ------
 *  POST   /api/auth/register   Create an account
 *  POST   /api/auth/login      Authenticate and receive a JWT
 *  GET    /api/tasks           List all tasks for the logged-in user
 *  POST   /api/tasks           Create a new task
 *  GET    /api/tasks/:id       Get a single task
 *  PUT    /api/tasks/:id       Update a task
 *  DELETE /api/tasks/:id       Delete a task
 *  GET    /api/tasks/stats     Dashboard statistics
 *  GET    /ws                  WebSocket for real-time task updates
 */
const http = require("http");
const path = require("path");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const db = require("./db");
const { signToken, authRequired } = require("./auth");
const { initWebSocket, broadcastToUser } = require("./ws");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Serve the static frontend so the whole app runs from one server
app.use(express.static(path.join(__dirname, "..", "client")));

// ---------------------------------------------------------------------------
// Auth routes
// ---------------------------------------------------------------------------
app.post("/api/auth/register", async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: "Name, email, and password are required" });
  }
  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare("INSERT INTO users (name, email, password) VALUES (?, ?, ?)")
    .run(name, email, hash);

  const user = { id: result.lastInsertRowid, email };
  res.status(201).json({ token: signToken(user), user: { id: user.id, name, email } });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  res.json({ token: signToken(user), user: { id: user.id, name: user.name, email: user.email } });
});

// ---------------------------------------------------------------------------
// Task routes  (all protected)
// ---------------------------------------------------------------------------
app.get("/api/tasks", authRequired, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json(rows);
});

app.post("/api/tasks", authRequired, (req, res) => {
  const { title, description = "", status = "pending", priority = "medium", due_date = null } =
    req.body || {};
  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Title is required" });
  }

  const result = db
    .prepare(
      `INSERT INTO tasks (user_id, title, description, status, priority, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(req.user.id, title.trim(), description, status, priority, due_date);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
  broadcastToUser(req.user.id, { type: "task:created", task });
  res.status(201).json(task);
});

app.get("/api/tasks/stats", authRequired, (req, res) => {
  const stats = db
    .prepare(
      `SELECT
         COUNT(*)                                          AS total,
         SUM(status = 'pending')                           AS pending,
         SUM(status = 'in-progress')                       AS inProgress,
         SUM(status = 'completed')                         AS completed,
         SUM(priority = 'high')                           AS highPriority,
         SUM(due_date < date('now') AND status != 'completed') AS overdue
       FROM tasks WHERE user_id = ?`
    )
    .get(req.user.id);
  res.json(stats);
});

app.get("/api/tasks/:id", authRequired, (req, res) => {
  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!task) return res.status(404).json({ error: "Task not found" });
  res.json(task);
});

app.put("/api/tasks/:id", authRequired, (req, res) => {
  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ? AND user_id = ?")
    .get(req.params.id, req.user.id);
  if (!existing) return res.status(404).json({ error: "Task not found" });

  const {
    title = existing.title,
    description = existing.description,
    status = existing.status,
    priority = existing.priority,
    due_date = existing.due_date,
  } = req.body || {};

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, priority = ?, due_date = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).run(title, description, status, priority, due_date, req.params.id);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  broadcastToUser(req.user.id, { type: "task:updated", task });
  res.json(task);
});

app.delete("/api/tasks/:id", authRequired, (req, res) => {
  const result = db
    .prepare("DELETE FROM tasks WHERE id = ? AND user_id = ?")
    .run(req.params.id, req.user.id);
  if (result.changes === 0) return res.status(404).json({ error: "Task not found" });

  broadcastToUser(req.user.id, { type: "task:deleted", taskId: Number(req.params.id) });
  res.json({ success: true });
});

// ---------------------------------------------------------------------------
// Catch-all — serve index.html for any non-API, non-file route (SPA fallback)
// ---------------------------------------------------------------------------
app.get(/^\/(?!api|ws).*/, (req, res) => {
  res.sendFile(path.join(__dirname, "..", "client", "index.html"));
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

// ---------------------------------------------------------------------------
// Start the HTTP + WebSocket server
// ---------------------------------------------------------------------------
const server = http.createServer(app);
initWebSocket(server);

server.listen(PORT, () => {
  console.log(`\n  🚀 Task Manager running at  http://localhost:${PORT}\n`);
});
