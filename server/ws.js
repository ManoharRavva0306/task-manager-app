/**
 * WebSocket manager — broadcasts task change events to every connected
 * client that belongs to the same user, so the UI updates in real time.
 */
const { WebSocketServer } = require("ws");
const url = require("url");
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./auth");

/** @type {Map<WebSocket, number>}  socket → userId */
const sockets = new Map();

function initWebSocket(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", (ws, req) => {
    // Read token from the query string ?token=xxx
    const { query } = url.parse(req.url, true);
    const token = query.token;

    let userId = null;
    try {
      userId = jwt.verify(token, JWT_SECRET).id;
    } catch {
      ws.close(4001, "Invalid token");
      return;
    }

    sockets.set(ws, userId);
    ws.send(JSON.stringify({ type: "connected", message: "WebSocket connected" }));

    ws.on("close", () => sockets.delete(ws));
  });

  return wss;
}

/** Broadcast an event to every socket belonging to `userId`. */
function broadcastToUser(userId, event) {
  const payload = JSON.stringify(event);
  for (const [ws, uid] of sockets) {
    if (uid === userId && ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

module.exports = { initWebSocket, broadcastToUser };
