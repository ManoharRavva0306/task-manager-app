/**
 * Authentication middleware.
 * Verifies the JWT from the Authorization header and attaches
 * the decoded user payload to `req.user`.
 */
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "task-manager-secret-change-in-production";
const TOKEN_EXPIRY = "7d";

/** Sign a JWT for a user id + email. */
function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

/** Express middleware that guards protected routes. */
function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Authentication required" });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { signToken, authRequired, JWT_SECRET };
