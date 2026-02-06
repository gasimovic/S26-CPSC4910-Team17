const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
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

    // Insert user (MySQL)
    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, password_hash, ROLE]
    );
    const userId = userInsert.insertId;

    // Create profile row
    await exec(
      "INSERT INTO driver_profiles (user_id, first_name, last_name, sponsor_org) VALUES (?, ?, ?, ?)",
      [userId, first_name, last_name, sponsor_org]
    );

    const userRows = await query(
      "SELECT id, email, role, created_at FROM users WHERE id = ?",
      [userId]
    );

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
    const userRows = await query(
      "SELECT id, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    const user = userRows[0];

    const profileRows = await query(
      "SELECT * FROM driver_profiles WHERE user_id = ?",
      [req.user.id]
    );
    const profile = profileRows[0] || null;

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
    // Ensure profile exists
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

    const profileRows = await query(
      "SELECT * FROM driver_profiles WHERE user_id = ?",
      [req.user.id]
    );
    return res.json({ ok: true, profile: profileRows[0] });
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
    sponsorId: z.number().int().positive(),  // ID of the sponsor (from users table where role='sponsor')
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
    if (sponsorRows.length === 0) {
      return res.status(404).json({ error: "Sponsor not found" });
    }

    // Check if driver already has a pending/accepted application to this sponsor
    const existingApp = await query(
      "SELECT id FROM applications WHERE driver_id = ? AND sponsor_id = ? AND status IN ('pending', 'accepted') LIMIT 1",
      [req.user.id, sponsorId]
    );
    if (existingApp.length > 0) {
      return res.status(409).json({ error: "You already have an active application to this sponsor" });
    }

    // Insert new application
    const insertResult = await exec(
      "INSERT INTO applications (driver_id, sponsor_id, status) VALUES (?, ?, 'pending')",
      [req.user.id, sponsorId]
    );

    return res.status(201).json({ 
      ok: true, 
      applicationId: insertResult.insertId, 
      message: "Application submitted successfully" 
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /applications
 * Returns the driver's applications with status.
 * Returns: Array of applications with sponsor details and status.
 */
app.get("/applications", requireAuth, async (req, res) => {
  try {
    const applications = await query(`
      SELECT a.id, a.status, a.applied_at, a.reviewed_at, a.notes,
             u.email AS sponsor_email, sp.company_name AS sponsor_company
      FROM applications a
      JOIN users u ON a.sponsor_id = u.id
      LEFT JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
      WHERE a.driver_id = ?
      ORDER BY a.applied_at DESC
    `, [req.user.id]);

    return res.json({ applications });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /driver/profile
 * Save driver profile information
 */
app.post('/driver/profile', requireAuth, async (req, res) => {
  const schema = z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    licenseNumber: z.string(),
    licenseState: z.string(),
    licenseExpiry: z.string(),
    dateOfBirth: z.string().optional(),
    vehicleType: z.string(),
    vehicleMake: z.string(),
    vehicleModel: z.string(),
    vehicleYear: z.string(),
    insuranceProvider: z.string(),
    insurancePolicyNumber: z.string()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
  }

  try {
    // TODO: Insert into driver profile table
    // await exec('INSERT INTO driver_profiles ...')
    return res.status(200).json({ message: 'Profile saved successfully' })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /sponsors
 * Public endpoint: returns a list of sponsors (id, email, company_name)
 */
app.get("/sponsors", async (req, res) => {
  try {
    const rows = await query(
      `SELECT u.id, u.email, sp.company_name, sp.first_name, sp.last_name
       FROM users u
       LEFT JOIN sponsor_profiles sp ON u.id = sp.user_id
       WHERE u.role = 'sponsor'
       ORDER BY sp.company_name IS NULL, sp.company_name ASC, u.email ASC`
    );

    return res.json({ sponsors: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /sponsors/:id
 * Public endpoint: returns detailed sponsor profile for the given sponsor id.
 */
app.get("/sponsors/:id", async (req, res) => {
  const id = Number(req.params.id || 0);
  if (!id) return res.status(400).json({ error: "Invalid sponsor id" });

  try {
    const rows = await query(
      `SELECT u.id, u.email, sp.*
       FROM users u
       LEFT JOIN sponsor_profiles sp ON u.id = sp.user_id
       WHERE u.role = 'sponsor' AND u.id = ? LIMIT 1`,
      [id]
    );

    if (!rows || rows.length === 0) return res.status(404).json({ error: "Sponsor not found" });

    return res.json({ sponsor: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`[driver] listening on :${PORT}`);
});

