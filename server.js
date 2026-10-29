
require("dotenv").config();

const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const uploadDir = path.join(ROOT, "uploads");

fs.mkdirSync(uploadDir, { recursive: true });

app.disable("x-powered-by");

// Security headers. CSP is disabled for now because the existing
// frontend uses inline onclick handlers and inline styles.
// HSTS is disabled because this local server uses HTTP.
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false
  })
);

app.use(express.json({ limit: "1mb" }));

/* ==========================================================
   PERSISTENT SESSION SECRET
========================================================== */

function getSessionSecret() {
  const envSecret = process.env.SESSION_SECRET;

  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  const secretPath = path.join(ROOT, ".session-secret");

  try {
    const existing = fs.readFileSync(secretPath, "utf8").trim();

    if (existing.length >= 32) {
      return existing;
    }
  } catch (_) {
    // Generate a secret on first startup.
  }

  const secret = crypto.randomBytes(48).toString("hex");

  fs.writeFileSync(secretPath, secret, { mode: 0o600 });

  return secret;
}

/* ==========================================================
   SQLITE SESSION STORE
========================================================== */

class SQLiteSessionStore extends session.Store {
  constructor(filename) {
    super();

    this.database = new Database(filename);
    this.database.pragma("journal_mode = WAL");

    this.database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        sid TEXT PRIMARY KEY,
        sess TEXT NOT NULL,
        expires INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_expires
      ON sessions(expires);
    `);

    this.getStatement = this.database.prepare(`
      SELECT sess, expires
      FROM sessions
      WHERE sid = ?
    `);

    this.setStatement = this.database.prepare(`
      INSERT INTO sessions (sid, sess, expires)
      VALUES (?, ?, ?)
      ON CONFLICT(sid) DO UPDATE SET
        sess = excluded.sess,
        expires = excluded.expires
    `);

    this.deleteStatement = this.database.prepare(`
      DELETE FROM sessions WHERE sid = ?
    `);

    this.cleanupStatement = this.database.prepare(`
      DELETE FROM sessions WHERE expires <= ?
    `);
  }

  get(sid, callback) {
    try {
      const row = this.getStatement.get(sid);

      if (!row) return callback(null, null);

      if (row.expires <= Date.now()) {
        this.deleteStatement.run(sid);
        return callback(null, null);
      }

      callback(null, JSON.parse(row.sess));
    } catch (error) {
      callback(error);
    }
  }

  set(sid, sess, callback) {
    try {
      const cookie = sess.cookie || {};

      let expires = cookie.expires
        ? new Date(cookie.expires).getTime()
        : Date.now() + (Number(cookie.maxAge) || 86400000);

      if (!Number.isFinite(expires)) {
        expires = Date.now() + 86400000;
      }

      if (expires <= Date.now()) {
        this.deleteStatement.run(sid);
        return callback?.(null);
      }

      this.setStatement.run(sid, JSON.stringify(sess), expires);
      this.cleanupStatement.run(Date.now());

      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  touch(sid, sess, callback) {
    this.set(sid, sess, callback);
  }

  destroy(sid, callback) {
    try {
      this.deleteStatement.run(sid);
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  clear(callback) {
    try {
      this.database.prepare("DELETE FROM sessions").run();
      callback?.(null);
    } catch (error) {
      callback?.(error);
    }
  }

  length(callback) {
    try {
      this.cleanupStatement.run(Date.now());

      const row = this.database
        .prepare("SELECT COUNT(*) AS count FROM sessions")
        .get();

      callback(null, row.count);
    } catch (error) {
      callback(error);
    }
  }

  all(callback) {
    try {
      this.cleanupStatement.run(Date.now());

      const rows = this.database
        .prepare("SELECT sess FROM sessions WHERE expires > ?")
        .all(Date.now());

      callback(null, rows.map(row => JSON.parse(row.sess)));
    } catch (error) {
      callback(error);
    }
  }
}

const sessionStore = new SQLiteSessionStore(
  path.join(ROOT, "skillmate-sessions.sqlite")
);

const sessionMiddleware = session({
  name: "skillmate.sid",
  store: sessionStore,
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
  }
});

app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);

/* ==========================================================
   RATE LIMITS
   Failed login/register attempts count toward the limits.
   Successful requests are skipped.
========================================================== */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many login attempts. Please try again in 15 minutes."
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: "Too many registration attempts. Please try again in 15 minutes."
  },
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json(options.message);
  }
});

/* ==========================================================
   APPLICATION DATABASE
   Existing skillmate.sqlite is preserved.
========================================================== */

const db = new Database(path.join(ROOT, "skillmate.sqlite"));

db.pragma("foreign_keys = ON");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    bio TEXT DEFAULT '',
    photo_url TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS interests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE TABLE IF NOT EXISTS user_interests (
    user_id INTEGER NOT NULL,
    interest_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, interest_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (interest_id) REFERENCES interests(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    requester_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending'
      CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(requester_id, recipient_id),
    CHECK (requester_id != recipient_id),
    FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER NOT NULL,
    recipient_id INTEGER NOT NULL,
    body TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_chat
  ON messages(sender_id, recipient_id, id);

  CREATE INDEX IF NOT EXISTS idx_connections_recipient
  ON connections(recipient_id, status);
`);

console.log("Application database connected.");
console.log("Persistent session storage connected.");

/* ==========================================================
   HELPERS
========================================================== */

function cleanInterests(value) {
  if (!Array.isArray(value)) return [];

  return [
    ...new Set(
      value
        .filter(item => typeof item === "string")
        .map(item => item.trim().slice(0, 40))
        .filter(Boolean)
    )
  ].slice(0, 20);
}

const replaceInterestsTransaction = db.transaction((userId, names) => {
  db.prepare("DELETE FROM user_interests WHERE user_id = ?")
    .run(userId);

  const addInterest = db.prepare(`
    INSERT OR IGNORE INTO interests (name) VALUES (?)
  `);

  const findInterest = db.prepare(`
    SELECT id FROM interests WHERE name = ?
  `);

  const linkInterest = db.prepare(`
    INSERT OR IGNORE INTO user_interests (user_id, interest_id)
    VALUES (?, ?)
  `);

  for (const name of names) {
    addInterest.run(name);

    const interest = findInterest.get(name);

    if (interest) {
      linkInterest.run(userId, interest.id);
    }
  }
});

function saveInterests(userId, interests) {
  replaceInterestsTransaction(userId, cleanInterests(interests));
}

function getProfile(userId) {
  const user = db.prepare(`
    SELECT id, name, email, bio, photo_url, created_at
    FROM users
    WHERE id = ?
  `).get(userId);

  if (!user) return null;

  const interests = db.prepare(`
    SELECT i.name
    FROM interests i
    JOIN user_interests ui ON ui.interest_id = i.id
    WHERE ui.user_id = ?
    ORDER BY i.name COLLATE NOCASE
  `).all(userId).map(item => item.name);

  return { ...user, interests };
}

function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({
      error: "Please log in first."
    });
  }

  next();
}

function isConnected(userA, userB) {
  return Boolean(db.prepare(`
    SELECT id
    FROM connections
    WHERE status = 'accepted'
      AND (
        (requester_id = ? AND recipient_id = ?)
        OR
        (requester_id = ? AND recipient_id = ?)
      )
  `).get(userA, userB, userB, userA));
}

function getMessage(messageId) {
  return db.prepare(`
    SELECT id, sender_id, recipient_id, body, image_url, created_at
    FROM messages
    WHERE id = ?
  `).get(messageId);
}

function establishSession(req, res, next, userId, status, message) {
  req.session.regenerate(error => {
    if (error) return next(error);

    req.session.userId = userId;

    req.session.save(saveError => {
      if (saveError) return next(saveError);

      res.status(status).json({
        message,
        user: getProfile(userId)
      });
    });
  });
}

/* ==========================================================
   FRONTEND
========================================================== */

app.get("/", (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.get("/style.css", (req, res) => {
  res.sendFile(path.join(ROOT, "style.css"));
});

app.get("/script.js", (req, res) => {
  res.sendFile(path.join(ROOT, "script.js"));
});

app.use("/uploads", express.static(uploadDir));

/* ==========================================================
   HEALTH CHECK
========================================================== */

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "SkillMate backend is running."
  });
});

/* ==========================================================
   REGISTER
========================================================== */

app.post(
  "/api/auth/register",
  registerLimiter,
  (req, res, next) => {
    try {
      const {
        name,
        email,
        password,
        bio = "",
        interests = []
      } = req.body;

      if (
        typeof name !== "string" ||
        typeof email !== "string" ||
        typeof password !== "string" ||
        !name.trim() ||
        !email.trim() ||
        password.length < 8 ||
        password.length > 128
      ) {
        return res.status(400).json({
          error: "Enter your name and email. Password must be 8–128 characters."
        });
      }

      const normalizedEmail = email.trim().toLowerCase();

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return res.status(400).json({
          error: "Enter a valid email address."
        });
      }

      if (db.prepare("SELECT id FROM users WHERE email = ?")
        .get(normalizedEmail)) {
        return res.status(409).json({
          error: "An account with this email already exists."
        });
      }

      const passwordHash = bcrypt.hashSync(password, 12);

      const result = db.prepare(`
        INSERT INTO users (name, email, password_hash, bio)
        VALUES (?, ?, ?, ?)
      `).run(
        name.trim().slice(0, 80),
        normalizedEmail,
        passwordHash,
        typeof bio === "string" ? bio.trim().slice(0, 500) : ""
      );

      const userId = Number(result.lastInsertRowid);

      saveInterests(userId, interests);

      establishSession(
        req,
        res,
        next,
        userId,
        201,
        "Account created successfully."
      );
    } catch (error) {
      next(error);
    }
  }
);

/* ==========================================================
   LOGIN
========================================================== */

app.post(
  "/api/auth/login",
  loginLimiter,
  (req, res, next) => {
    try {
      const { email, password } = req.body;

      if (
        typeof email !== "string" ||
        typeof password !== "string"
      ) {
        return res.status(400).json({
          error: "Enter email and password."
        });
      }

      const user = db.prepare(`
        SELECT id, password_hash
        FROM users
        WHERE email = ?
      `).get(email.trim().toLowerCase());

      if (!user || !bcrypt.compareSync(password, user.password_hash)) {
        return res.status(401).json({
          error: "Incorrect email or password."
        });
      }

      establishSession(
        req,
        res,
        next,
        user.id,
        200,
        "Login successful."
      );
    } catch (error) {
      next(error);
    }
  }
);

/* ==========================================================
   LOGOUT / CURRENT USER
========================================================== */

app.post("/api/auth/logout", (req, res, next) => {
  req.session.destroy(error => {
    if (error) return next(error);

    res.clearCookie("skillmate.sid", {
      httpOnly: true,
      sameSite: "lax",
      secure: false
    });

    res.json({ message: "Logged out successfully." });
  });
});

app.get("/api/auth/me", requireLogin, (req, res) => {
  const user = getProfile(req.session.userId);

  if (!user) {
    return res.status(401).json({
      error: "Account not found."
    });
  }

  res.json({ user });
});

/* ==========================================================
   PROFILE UPDATE
========================================================== */

app.put("/api/profile", requireLogin, (req, res) => {
  const { name, bio, interests } = req.body;
  const userId = req.session.userId;

  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        error: "Name cannot be empty."
      });
    }

    db.prepare("UPDATE users SET name = ? WHERE id = ?")
      .run(name.trim().slice(0, 80), userId);
  }

  if (bio !== undefined) {
    if (typeof bio !== "string") {
      return res.status(400).json({
        error: "Invalid bio."
      });
    }

    db.prepare("UPDATE users SET bio = ? WHERE id = ?")
      .run(bio.trim().slice(0, 500), userId);
  }

  if (interests !== undefined) {
    saveInterests(userId, interests);
  }

  res.json({
    message: "Profile updated.",
    user: getProfile(userId)
  });
});

/* ==========================================================
   PROFILE PHOTO UPLOAD
========================================================== */

const storage = multer.diskStorage({
  destination: (req, file, callback) => {
    callback(null, uploadDir);
  },

  filename: (req, file, callback) => {
    const extensions = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "image/gif": ".gif"
    };

    const extension = extensions[file.mimetype];

    if (!extension) {
      return callback(
        new Error("Upload a JPG, PNG, WEBP or GIF image.")
      );
    }

    callback(
      null,
      `${Date.now()}-${crypto.randomBytes(12).toString("hex")}${extension}`
    );
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },

  fileFilter: (req, file, callback) => {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif"
    ];

    if (!allowed.includes(file.mimetype)) {
      return callback(
        new Error("Upload a JPG, PNG, WEBP or GIF image.")
      );
    }

    callback(null, true);
  }
});

app.post(
  "/api/upload/photo",
  requireLogin,
  upload.single("photo"),
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({
        error: "Choose a photo to upload."
      });
    }

    const photoUrl = `/uploads/${req.file.filename}`;

    db.prepare("UPDATE users SET photo_url = ? WHERE id = ?")
      .run(photoUrl, req.session.userId);

    res.json({
      message: "Photo uploaded.",
      photo_url: photoUrl
    });
  }
);

/* ==========================================================
   SEARCH REGISTERED MEMBERS
========================================================== */

app.get("/api/profiles", requireLogin, (req, res) => {
  const search = String(req.query.search || "").trim().slice(0, 100);
  const interest = String(req.query.interest || "").trim().slice(0, 40);
  const currentUserId = req.session.userId;

  const escapedSearch = search.replace(/[\\%_]/g, "\\$&");
  const pattern = `%${escapedSearch}%`;

  let users = db.prepare(`
    SELECT id
    FROM users
    WHERE id != ?
      AND (
        ? = ''
        OR name LIKE ? ESCAPE '\\'
        OR bio LIKE ? ESCAPE '\\'
      )
    ORDER BY name COLLATE NOCASE
    LIMIT 100
  `).all(currentUserId, search, pattern, pattern);

  users = users.map(user => getProfile(user.id)).filter(Boolean);

  if (interest) {
    users = users.filter(user =>
      user.interests.some(item =>
        item.toLowerCase() === interest.toLowerCase()
      )
    );
  }

  res.json({ profiles: users });
});

/* ==========================================================
   CONNECTION REQUESTS
========================================================== */

app.post("/api/connections/request/:userId", requireLogin, (req, res) => {
  const requesterId = req.session.userId;
  const recipientId = Number(req.params.userId);

  if (!Number.isInteger(recipientId) || recipientId <= 0) {
    return res.status(400).json({ error: "Invalid user." });
  }

  if (recipientId === requesterId) {
    return res.status(400).json({
      error: "You cannot connect with yourself."
    });
  }

  if (!db.prepare("SELECT id FROM users WHERE id = ?").get(recipientId)) {
    return res.status(404).json({ error: "User not found." });
  }

  const existing = db.prepare(`
    SELECT *
    FROM connections
    WHERE
      (requester_id = ? AND recipient_id = ?)
      OR
      (requester_id = ? AND recipient_id = ?)
  `).get(requesterId, recipientId, recipientId, requesterId);

  if (existing && existing.status !== "rejected") {
    return res.status(409).json({
      error: "A connection request or connection already exists."
    });
  }

  if (existing) {
    db.prepare("DELETE FROM connections WHERE id = ?").run(existing.id);
  }

  const result = db.prepare(`
    INSERT INTO connections (requester_id, recipient_id)
    VALUES (?, ?)
  `).run(requesterId, recipientId);

  res.status(201).json({
    message: "Connection request sent.",
    connectionId: Number(result.lastInsertRowid)
  });
});

app.get("/api/connections", requireLogin, (req, res) => {
  const userId = req.session.userId;

  const connections = db.prepare(`
    SELECT
      c.id AS connection_id,
      c.requester_id,
      c.recipient_id,
      c.status,
      c.created_at,
      CASE
        WHEN c.requester_id = ? THEN c.recipient_id
        ELSE c.requester_id
      END AS other_user_id
    FROM connections c
    WHERE c.requester_id = ? OR c.recipient_id = ?
    ORDER BY c.id DESC
  `).all(userId, userId, userId);

  res.json({
    connections: connections.map(connection => ({
      ...connection,
      user: getProfile(connection.other_user_id)
    }))
  });
});

app.post("/api/connections/:id/accept", requireLogin, (req, res) => {
  const result = db.prepare(`
    UPDATE connections
    SET status = 'accepted'
    WHERE id = ?
      AND recipient_id = ?
      AND status = 'pending'
  `).run(Number(req.params.id), req.session.userId);

  if (!result.changes) {
    return res.status(404).json({
      error: "Pending request not found."
    });
  }

  res.json({ message: "Connection accepted." });
});

app.post("/api/connections/:id/reject", requireLogin, (req, res) => {
  const result = db.prepare(`
    UPDATE connections
    SET status = 'rejected'
    WHERE id = ?
      AND recipient_id = ?
      AND status = 'pending'
  `).run(Number(req.params.id), req.session.userId);

  if (!result.changes) {
    return res.status(404).json({
      error: "Connection request not found."
    });
  }

  res.json({ message: "Connection request declined." });
});

/* ==========================================================
   CHAT HISTORY
========================================================== */

app.get("/api/messages/:userId", requireLogin, (req, res) => {
  const currentUserId = req.session.userId;
  const otherUserId = Number(req.params.userId);

  if (!Number.isInteger(otherUserId) || otherUserId <= 0) {
    return res.status(400).json({ error: "Invalid user." });
  }

  if (!isConnected(currentUserId, otherUserId)) {
    return res.status(403).json({
      error: "You must be connected before messaging."
    });
  }

  const messages = db.prepare(`
    SELECT id, sender_id, recipient_id, body, image_url, created_at
    FROM messages
    WHERE
      (sender_id = ? AND recipient_id = ?)
      OR
      (sender_id = ? AND recipient_id = ?)
    ORDER BY id DESC
    LIMIT 200
  `).all(
    currentUserId,
    otherUserId,
    otherUserId,
    currentUserId
  );

  res.json({ messages: messages.reverse() });
});

/* ==========================================================
   SEND MESSAGE
========================================================== */

app.post("/api/messages/:userId", requireLogin, (req, res) => {
  const senderId = req.session.userId;
  const recipientId = Number(req.params.userId);

  const body = typeof req.body.body === "string"
    ? req.body.body.trim()
    : "";

  const imageUrl = typeof req.body.image_url === "string"
    ? req.body.image_url.trim()
    : "";

  if (!Number.isInteger(recipientId) || recipientId <= 0) {
    return res.status(400).json({ error: "Invalid recipient." });
  }

  if (!body && !imageUrl) {
    return res.status(400).json({
      error: "Message cannot be empty."
    });
  }

  if (body.length > 4000) {
    return res.status(400).json({
      error: "Message is too long."
    });
  }

  if (
    imageUrl &&
    !/^\/uploads\/[a-zA-Z0-9._-]+$/.test(imageUrl)
  ) {
    return res.status(400).json({
      error: "Invalid image URL."
    });
  }

  if (!isConnected(senderId, recipientId)) {
    return res.status(403).json({
      error: "You must be connected before messaging."
    });
  }

  const result = db.prepare(`
    INSERT INTO messages (sender_id, recipient_id, body, image_url)
    VALUES (?, ?, ?, ?)
  `).run(senderId, recipientId, body, imageUrl);

  const message = getMessage(Number(result.lastInsertRowid));

  io.to(`user:${senderId}`).emit("message:new", message);
  io.to(`user:${recipientId}`).emit("message:new", message);

  res.status(201).json({ message });
});

/* ==========================================================
   REAL-TIME SOCKET AUTHENTICATION
========================================================== */

io.on("connection", socket => {
  const userId = socket.request.session?.userId;

  if (!userId) {
    socket.disconnect(true);
    return;
  }

  socket.join(`user:${userId}`);
});

/* ==========================================================
   ERROR HANDLING
========================================================== */

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API endpoint not found." });
});

app.use((error, req, res, next) => {
  console.error(error);

  if (res.headersSent) return next(error);

  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      error: "Photo must be 5 MB or smaller."
    });
  }

  if (error.message?.startsWith("Upload a JPG")) {
    return res.status(400).json({ error: error.message });
  }

  if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
    return res.status(409).json({
      error: "That account or connection already exists."
    });
  }

  res.status(500).json({
    error: "An unexpected server error occurred."
  });
});

/* ==========================================================
   START SERVER
========================================================== */

server.listen(PORT, "127.0.0.1", () => {
  console.log("");
  console.log("SkillMate backend is running!");
  console.log(`Website: http://localhost:${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  console.log("Application data: skillmate.sqlite");
  console.log("Session data: skillmate-sessions.sqlite");
  console.log("Security headers: enabled");
  console.log("Login/register rate limits: enabled");
  console.log("Press Ctrl+C to stop the server.");
  console.log("");
});
