const { makeApp } = require("@gdip/server");
const { query } = require("@gdip/db");
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

  const { email, password, displayName } = parsed.data;

  try {
    const password_hash = await hashPassword(password);
    const userRes = await query(
      `INSERT INTO users(email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email.toLowerCase(), password_hash, ROLE]
    );
    const user = userRes.rows[0];

    await query(
      `INSERT INTO admin_profiles(user_id, display_name)
       VALUES ($1, $2)`,
      [user.id, displayName || null]
    );

    return res.status(201).json({ user });
  } catch (err) {
    if (String(err).includes("users_email_key")) {
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

  const { email, password } = parsed.data;

  try {
    const userRes = await query(
      `SELECT id, email, password_hash, role
       FROM users
       WHERE email = $1 AND role = $2`,
      [email.toLowerCase(), ROLE]
    );
    if (userRes.rowCount === 0) return res.status(401).json({ error: "Invalid credentials" });

    const user = userRes.rows[0];
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
    const userRes = await query(
      `SELECT id, email, role, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = userRes.rows[0];

    const r = await query(`SELECT * FROM admin_profiles WHERE user_id = $1`, [req.user.id]);
    const profile = r.rows[0] || null;

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
    await query(
      `UPDATE admin_profiles
       SET display_name = COALESCE($2, display_name),
           first_name   = COALESCE($3, first_name),
           last_name    = COALESCE($4, last_name),
           dob          = COALESCE($5::date, dob),
           phone        = COALESCE($6, phone),
           address      = COALESCE($7, address)
       WHERE user_id = $1`,
      [
        req.user.id,
        d.displayName || null,
        d.firstName || null,
        d.lastName || null,
        d.dob || null,
        d.phone || null,
        d.address || null,
      ]
    );

    const r = await query(`SELECT * FROM admin_profiles WHERE user_id = $1`, [req.user.id]);
    return res.json({ ok: true, profile: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`[admin] listening on :${PORT}`);
});
