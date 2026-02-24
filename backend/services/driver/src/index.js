const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");
const crypto = require("crypto");

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

app.get("/healthz", async (_req, res) => {
  let dbStatus = 'disconnected'
  try {
    await query("SELECT 1")
    dbStatus = 'connected'
  } catch {
    dbStatus = 'disconnected'
  }

  return res.json({
    status: 'ok',
    db: {
      status: dbStatus,
      type: 'mysql'
    },
    uptime: Math.floor(process.uptime())
  })
})

/**
 * POST /auth/register
 * Creates a user + driver profile row.
 */
app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    first_name: z.string().optional(),
    lastName: z.string().optional(),
    last_name: z.string().optional(),
    sponsorOrg: z.string().optional(),
    sponsor_org: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const first_name = parsed.data.firstName || parsed.data.first_name || null;
  const last_name = parsed.data.lastName || parsed.data.last_name || null;
  const sponsor_org = parsed.data.sponsorOrg || parsed.data.sponsor_org || null;

  try {
    const password_hash = await hashPassword(password);

    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, password_hash, ROLE]
    );
    const userId = userInsert.insertId;

    await exec(
      "INSERT INTO driver_profiles (user_id, first_name, last_name, sponsor_org) VALUES (?, ?, ?, ?)",
      [userId, first_name, last_name, sponsor_org]
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

    if (!rows || rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user = rows[0];
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
 * POST /auth/forgot-password
 * Body: { email: string }
 * Dev-mode behavior: returns a resetUrl instead of sending email.
 */
app.post("/auth/forgot-password", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();

  try {
    // Only allow driver accounts in this service
    const rows = await query(
      "SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1",
      [email, ROLE]
    );

    // Always return ok (prevents user-enumeration)
    if (!rows || rows.length === 0) {
      return res.json({ ok: true });
    }

    const userId = rows[0].id;

    // Create token + store hash
    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    // 30 minute expiry
    await exec(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 MINUTE))`,
      [userId, tokenHash]
    );

    // Dev-mode: return link instead of email
    const publicBase =
      process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.FRONTEND_PORT || 5173}`;

    const resetUrl = `${publicBase}/?page=reset-password&email=${encodeURIComponent(
      email
    )}&token=${encodeURIComponent(token)}`;

    return res.json({ ok: true, resetUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /auth/reset-password
 * Body: { email: string, token: string, newPassword: string }
 */
app.post("/auth/reset-password", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    token: z.string().min(10),
    newPassword: z.string().min(8),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const token = parsed.data.token;
  const newPassword = parsed.data.newPassword;

  try {
    const userRows = await query(
      "SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1",
      [email, ROLE]
    );

    // don’t leak whether user exists
    if (!userRows || userRows.length === 0) {
      return res.json({ ok: true });
    }

    const userId = userRows[0].id;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const tokenRows = await query(
      `SELECT id
       FROM password_reset_tokens
       WHERE user_id = ?
         AND token_hash = ?
         AND used_at IS NULL
         AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId, tokenHash]
    );

    if (!tokenRows || tokenRows.length === 0) {
      return res.status(400).json({ error: "Invalid or expired reset token" });
    }

    const resetId = tokenRows[0].id;

    const newHash = await hashPassword(newPassword);
    await exec("UPDATE users SET password_hash = ? WHERE id = ? AND role = ?", [
      newHash,
      userId,
      ROLE,
    ]);

    await exec("UPDATE password_reset_tokens SET used_at = NOW() WHERE id = ?", [resetId]);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /me
 */
app.get("/me", requireAuth, async (req, res) => {
  try {
    const userRows = await query("SELECT id, email, role, created_at FROM users WHERE id = ?", [req.user.id]);
    const user = userRows[0];

    const profileRows = await query("SELECT * FROM driver_profiles WHERE user_id = ?", [req.user.id]);
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
    firstName: z.string().min(1).optional(),
    first_name: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    phone: z.string().min(7).max(25).optional(),
    address: z.string().min(3).max(200).optional(),
    address_line1: z.string().min(1).max(255).optional(),
    address_line2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    sponsorOrg: z.string().min(1).optional(),
    sponsor_org: z.string().min(1).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const d = parsed.data;
  const first_name = d.firstName || d.first_name || null;
  const last_name = d.lastName || d.last_name || null;
  const sponsor_org = d.sponsorOrg || d.sponsor_org || null;
  const address_line1 = d.address_line1 || d.address || null;

  try {
    await exec(
      "INSERT INTO driver_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
      [req.user.id]
    );

    await exec(
      `UPDATE driver_profiles
       SET first_name    = COALESCE(?, first_name),
           last_name     = COALESCE(?, last_name),
           dob           = COALESCE(?, dob),
           phone         = COALESCE(?, phone),
           address_line1 = COALESCE(?, address_line1),
           address_line2 = COALESCE(?, address_line2),
           city          = COALESCE(?, city),
           state         = COALESCE(?, state),
           postal_code   = COALESCE(?, postal_code),
           country       = COALESCE(?, country),
           sponsor_org   = COALESCE(?, sponsor_org)
       WHERE user_id = ?`,
      [
        first_name,
        last_name,
        d.dob || null,
        d.phone || null,
        address_line1,
        d.address_line2 || null,
        d.city || null,
        d.state || null,
        d.postal_code || null,
        d.country || null,
        sponsor_org,
        req.user.id,
      ]
    );

    const profileRows = await query("SELECT * FROM driver_profiles WHERE user_id = ?", [req.user.id]);
    return res.json({ ok: true, profile: profileRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /me/password
 * Changes the logged-in user's password.
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

// ============================================================
// FIX 1: GET /sponsors
// Lists all sponsors so drivers can find and apply to them.
// ============================================================
app.get("/sponsors", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.id, u.email, sp.company_name, sp.first_name, sp.last_name
       FROM users u
       LEFT JOIN sponsor_profiles sp ON u.id = sp.user_id
       WHERE u.role = 'sponsor'
       ORDER BY sp.company_name ASC, u.email ASC`,
      []
    );

    return res.json({ sponsors: rows || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /applications
 * Allows a driver to apply to join a sponsor program.
 * Expects: { sponsorId: number } in the request body.
 * Creates a new application with status 'pending'.
 */
app.post("/applications", requireAuth, async (req, res) => {
  const schema = z.object({
    sponsorId: z.coerce.number().int().positive(),
    adId: z.coerce.number().int().positive().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { sponsorId } = parsed.data;

  try {
    // Check if sponsor exists and is a sponsor
    const sponsorRows = await query(
      "SELECT id FROM users WHERE id = ? AND role = 'sponsor' LIMIT 1",
      [sponsorId]
    );
    if (!sponsorRows || sponsorRows.length === 0) {
      return res.status(404).json({ error: "Sponsor not found" });
    }

    const existingApp = await query(
      "SELECT id FROM applications WHERE driver_id = ? AND sponsor_id = ? AND status IN ('pending', 'accepted') LIMIT 1",
      [req.user.id, sponsorId]
    );
    if (existingApp && existingApp.length > 0) {
      return res.status(409).json({ error: "You already have an active application to this sponsor" });
    }

    // Insert new application (optionally reference an ad)
    const insertResult = await exec(
      "INSERT INTO applications (driver_id, sponsor_id, ad_id, status) VALUES (?, ?, ?, 'pending')",
      [req.user.id, sponsorId, parsed.data.adId || null]
    );

    return res.status(201).json({
      ok: true,
      applicationId: insertResult.insertId,
      message: "Application submitted successfully",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /ads
 * Returns all sponsorship ads visible to drivers.
 */
app.get("/ads", requireAuth, async (req, res) => {
  try {
    const ads = await query(
      `SELECT a.id, a.sponsor_id, a.title, a.description, a.requirements, a.benefits, a.created_at,
              sp.company_name AS sponsor_company, u.email AS sponsor_email
       FROM ads a
       JOIN users u ON a.sponsor_id = u.id
       LEFT JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
       ORDER BY a.created_at DESC`,
      []
    );
    return res.json({ ads: ads || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /applications
 * Returns all applications submitted by this driver.
 */
app.get("/applications", requireAuth, async (req, res) => {
  try {
    const applications = await query(
      `SELECT 
        a.id,
        a.sponsor_id,
        a.status,
        a.applied_at,
        a.reviewed_at,
        a.notes,
        u.email AS sponsor_email,
        sp.company_name AS sponsor_company,
        ad.title AS ad_title,
        a.ad_id
      FROM applications a
      JOIN users u ON a.sponsor_id = u.id
      LEFT JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
      LEFT JOIN ads ad ON a.ad_id = ad.id
      WHERE a.driver_id = ?
      ORDER BY a.applied_at DESC`,
      [req.user.id]
    );
    return res.json({ applications: applications || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

const driverCatalogRoutes = require('../../../routes/driver/catalog');
app.use('/catalog', requireAuth, driverCatalogRoutes);

app.listen(PORT, () => {
  console.log(`[driver] listening on :${PORT}`);
});