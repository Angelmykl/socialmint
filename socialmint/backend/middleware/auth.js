const jwt  = require("jsonwebtoken");
const fs   = require("fs");
const path = require("path");

const DB_FILE = path.join(__dirname, "../db.json");

function getUser(userId) {
  if (!fs.existsSync(DB_FILE)) return null;
  const db = JSON.parse(fs.readFileSync(DB_FILE, "utf8"));
  return db.users[userId] || null;
}

module.exports = async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not logged in. Please sign in to continue." });
  }

  const token = authHeader.split(" ")[1];
  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET || "dev_secret");
  } catch (err) {
    return res.status(401).json({ error: err.name === "TokenExpiredError" ? "Session expired. Please sign in again." : "Invalid session. Please sign in again." });
  }

  const user = getUser(decoded.userId);
  if (!user) return res.status(401).json({ error: "User not found. Please sign in again." });

  req.user = user;
  next();
};