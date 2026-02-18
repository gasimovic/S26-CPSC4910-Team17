const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");

const app = makeApp();

const PORT = process.env.PORT || 4001;
const COOKIE_NAME = process.env.COOKIE_NAME || "gdip_token";
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false") === "true";
const ROLE = "admin";

function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const payload = verifyToken(token);
    if (payload.role !== ROLE) {
      return res.status(403).json({ error: "Wrong role for this service" });
    }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

app.get("/healthz", (_req, res) => res.json({ ok: true }));

/**
 * POST /auth/register
 */
app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    displayName: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const displayName = parsed.data.displayName || null;

  try {
    const password_hash = await hashPassword(password);

    // Create user
    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, password_hash, ROLE]
    );
    const userId = userInsert.insertId;

    // Create admin profile row
    await exec(
      "INSERT INTO admin_profiles (user_id, display_name) VALUES (?, ?)",
      [userId, displayName]
    );

    const userRows = await query("SELECT id, email, role, created_at FROM users WHERE id = ?", [userId]);
    return res.status(201).json({ user: userRows[0] });
  } catch (err) {
    if (err && (err.code === "ER_DUP_ENTRY" || String(err.message || err).includes("Duplicate"))) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /auth/login
 */
app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;

  try {
    const rows = await query(
      "SELECT id, email, password_hash, role FROM users WHERE email = ? AND role = ? LIMIT 1",
      [email, ROLE]
    );
    if (!rows || rows.length === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ sub: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
    });

    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /auth/logout
 */
app.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax",
  });
  return res.json({ ok: true });
});

/**
 * GET /me
 */
app.get("/me", requireAuth, async (req, res) => {
  try {
    const userRows = await query("SELECT id, email, role, created_at FROM users WHERE id = ?", [req.user.id]);
    const user = userRows[0];

    const profileRows = await query("SELECT * FROM admin_profiles WHERE user_id = ?", [req.user.id]);
    const profile = profileRows[0] || null;

    return res.json({ user, profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /me/profile
 */
app.put("/me/profile", requireAuth, async (req, res) => {
  const schema = z.object({
    displayName: z.string().min(1).optional(),
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    phone: z.string().min(7).max(25).optional(),
    address: z.string().min(3).max(200).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const d = parsed.data;

  try {
    // Ensure profile exists
    await exec(
      "INSERT INTO admin_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
      [req.user.id]
    );

    await exec(
      `UPDATE admin_profiles
       SET display_name = COALESCE(?, display_name),
           first_name   = COALESCE(?, first_name),
           last_name    = COALESCE(?, last_name),
           dob          = COALESCE(?, dob),
           phone        = COALESCE(?, phone),
           address      = COALESCE(?, address)
       WHERE user_id = ?`,
      [
        d.displayName || null,
        d.firstName || null,
        d.lastName || null,
        d.dob || null,
        d.phone || null,
        d.address || null,
        req.user.id,
      ]
    );

    const profileRows = await query("SELECT * FROM admin_profiles WHERE user_id = ?", [req.user.id]);
    return res.json({ ok: true, profile: profileRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /me/password
 * Body: { currentPassword: string, newPassword: string }
 */
app.put("/me/password", requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { currentPassword, newPassword } = parsed.data;

  try {
    const rows = await query(
      "SELECT id, password_hash, role FROM users WHERE id = ? AND role = ? LIMIT 1",
      [req.user.id, ROLE]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = rows[0];

    const ok = await verifyPassword(currentPassword, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid current password" });
    }

    const same = await verifyPassword(newPassword, user.password_hash);
    if (same) {
      return res.status(400).json({ error: "New password must be different from current password" });
    }

    const newHash = await hashPassword(newPassword);
    await exec("UPDATE users SET password_hash = ? WHERE id = ? AND role = ?", [
      newHash,
      req.user.id,
      ROLE,
    ]);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`[admin] listening on :${PORT}`);
});
