const { makeApp } = require("@gdip/server");
const { query } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");

const app = makeApp();

const PORT = process.env.PORT || 4002;
const COOKIE_NAME = process.env.COOKIE_NAME || "gdip_token";
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false") === "true";
const ROLE = "driver";

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
 * Creates a user + driver profile row.
 */
app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    sponsorOrg: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { email, password, firstName, lastName, sponsorOrg } = parsed.data;

  try {
    const password_hash = await hashPassword(password);
    const userRes = await query(
      //INSERT INTO users(email, password_hash, role)
      //VALUES (?, ?, ?)
      `INSERT INTO users(email, password_hash, role)
       VALUES ($1, $2, $3)
       RETURNING id, email, role, created_at`,
      [email.toLowerCase(), password_hash, ROLE]
    );
    //const [userRows] = await query(
    //`SELECT id, email, role, created_at FROM users WHERE id = LAST_INSERT_ID()`
    //);
    const user = userRes.rows[0];

    await query(
      //INSERT INTO driver_profiles(user_id, first_name, last_name, sponsor_org)
      //VALUES (?, ?, ?, ?)
      `INSERT INTO driver_profiles(user_id, first_name, last_name, sponsor_org)
       VALUES ($1, $2, $3, $4)`,
      [user.id, firstName || null, lastName || null, sponsorOrg || null]
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
 * Validates credentials and sets an HttpOnly cookie with a JWT.
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
      //SELECT id, email, password_hash, role
      //FROM users
      //WHERE email = ? AND role = ?
      `SELECT id, email, password_hash, role
       FROM users
       WHERE email = $1 AND role = $2`,
      [email.toLowerCase(), ROLE]
    );

    if (userRes.rowCount === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = userRes.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

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
 * Clears the auth cookie.
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
 * Returns the logged-in user + profile.
 */
app.get("/me", requireAuth, async (req, res) => {
  try {
    const userRes = await query(
      //SELECT id, email, role, created_at FROM users WHERE id = ?
      `SELECT id, email, role, created_at FROM users WHERE id = $1`,
      [req.user.id]
    );
    const user = userRes.rows[0];
    //SELECT * FROM driver_profiles WHERE user_id = ?
    const r = await query(`SELECT * FROM driver_profiles WHERE user_id = $1`, [req.user.id]);
    const profile = r.rows[0] || null;

    return res.json({ user, profile });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /me/profile
 * Updates name + DOB + contact info (phone/address).
 */
app.put("/me/profile", requireAuth, async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    phone: z.string().min(7).max(25).optional(),
    address: z.string().min(3).max(200).optional(),
    sponsorOrg: z.string().min(1).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const d = parsed.data;

  try {
    await query(
      //UPDATE driver_profiles
       //SET first_name  = COALESCE(?, first_name),
           //last_name   = COALESCE(?, last_name),
           //dob         = COALESCE(?, dob),
           //phone       = COALESCE(?, phone),
           //address     = COALESCE(?, address),
           //sponsor_org = COALESCE(?, sponsor_org)
       //WHERE user_id = ?
      `UPDATE driver_profiles
       SET first_name  = COALESCE($2, first_name),
           last_name   = COALESCE($3, last_name),
           dob         = COALESCE($4::date, dob),
           phone       = COALESCE($5, phone),
           address     = COALESCE($6, address),
           sponsor_org = COALESCE($7, sponsor_org)
       WHERE user_id = $1`,
      [
        req.user.id,
        d.firstName || null,
        d.lastName || null,
        d.dob || null,
        d.phone || null,
        d.address || null,
        d.sponsorOrg || null,
      ]
    );
    //SELECT * FROM driver_profiles WHERE user_id = ?
    const r = await query(`SELECT * FROM driver_profiles WHERE user_id = $1`, [req.user.id]);
    return res.json({ ok: true, profile: r.rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`[driver] listening on :${PORT}`);
});
