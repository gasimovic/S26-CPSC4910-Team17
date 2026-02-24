const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");
const ebayService = require("./ebay");

const app = makeApp();

const PORT = process.env.PORT || 4003;
const COOKIE_NAME = process.env.COOKIE_NAME || "gdip_token";
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false") === "true";
const ROLE = "sponsor";

function toInt(v) {
  if (typeof v === "number") return Number.isFinite(v) ? Math.trunc(v) : NaN;
  if (typeof v !== "string") return NaN;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : NaN;
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

async function getSponsorCompanyName(sponsorId) {
  const rows = await query(
    "SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1",
    [sponsorId]
  );
  const company = rows?.[0]?.company_name;
  return company && String(company).trim().length > 0 ? String(company).trim() : null;
}


// Helper: Check if a driver belongs to a sponsor's program (by sponsor_org or accepted application)
async function driverBelongsToSponsorOr404(res, sponsorId, sponsorCompany, driverId) {
  // A driver is considered "in the sponsor program" if either:
  // 1) Their driver_profiles.sponsor_org matches the sponsor's company_name, OR
  // 2) They have an accepted application for this sponsor.
  const rows = await query(
    `SELECT u.id, u.email, dp.*
     FROM users u
     JOIN driver_profiles dp ON u.id = dp.user_id
     WHERE u.role = 'driver'
       AND u.id = ?
       AND (
         dp.sponsor_org = ?
         OR EXISTS (
           SELECT 1
           FROM applications a
           WHERE a.driver_id = u.id
             AND a.sponsor_id = ?
             AND a.status = 'accepted'
         )
       )
     LIMIT 1`,
    [driverId, sponsorCompany, sponsorId]
  );

  if (!rows || rows.length === 0) {
    res.status(404).json({ error: "Driver not found in your sponsor program" });
    return null;
  }

  return rows[0];
}

async function getDriverPointsBalance(driverId) {
  const rows = await query(
    "SELECT COALESCE(SUM(delta), 0) AS balance FROM driver_points_ledger WHERE driver_id = ?",
    [driverId]
  );
  return Number(rows?.[0]?.balance || 0);
}

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
    // allow either companyName or company_name
    companyName: z.string().optional(),
    company_name: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const company_name = parsed.data.companyName || parsed.data.company_name || null;

  try {
    const password_hash = await hashPassword(password);

    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, password_hash, ROLE]
    );
    const userId = userInsert.insertId;

    await exec(
      "INSERT INTO sponsor_profiles (user_id, company_name) VALUES (?, ?)",
      [userId, company_name]
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
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    const token = signToken({ sub: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      path: "/",
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
    path: "/",
  });
  return res.json({ ok: true });
});

/**
 * GET /me
 */
app.get("/me", requireAuth, async (req, res) => {
  try {
    const userRows = await query(
      "SELECT id, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    const user = userRows[0];

    const profileRows = await query(
      "SELECT * FROM sponsor_profiles WHERE user_id = ?",
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
 */
app.put("/me/profile", requireAuth, async (req, res) => {
  const schema = z.object({
    companyName: z.string().min(1).optional(),
    company_name: z.string().min(1).optional(),
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
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const d = parsed.data;
  const company_name = d.companyName || d.company_name || null;
  const first_name = d.firstName || d.first_name || null;
  const last_name = d.lastName || d.last_name || null;
  const address_line1 = d.address_line1 || d.address || null;

  try {
    // Ensure profile exists
    await exec(
      "INSERT INTO sponsor_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
      [req.user.id]
    );

    await exec(
      `UPDATE sponsor_profiles
       SET company_name  = COALESCE(?, company_name),
           first_name    = COALESCE(?, first_name),
           last_name     = COALESCE(?, last_name),
           dob           = COALESCE(?, dob),
           phone         = COALESCE(?, phone),
           address_line1 = COALESCE(?, address_line1),
           address_line2 = COALESCE(?, address_line2),
           city          = COALESCE(?, city),
           state         = COALESCE(?, state),
           postal_code   = COALESCE(?, postal_code),
           country       = COALESCE(?, country)
       WHERE user_id = ?`,
      [
        company_name,
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
        req.user.id,
      ]
    );

    const profileRows = await query(
      "SELECT * FROM sponsor_profiles WHERE user_id = ?",
      [req.user.id]
    );

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
// FIX 2: /ads endpoints (GET, POST, DELETE)
// The frontend ApplicationsPage calls these but they were missing.
// Requires an `ads` table:
//   id, sponsor_id, title, description, requirements, benefits, created_at
// ============================================================

/**
 * GET /ads
 * Returns all ads created by this sponsor.
 */
app.get("/ads", requireAuth, async (req, res) => {
  try {
    const ads = await query(
      `SELECT id, title, description, requirements, benefits, created_at
       FROM ads
       WHERE sponsor_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json({ ads: ads || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /ads
 * Create a new sponsorship ad.
 */
app.post("/ads", requireAuth, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    requirements: z.string().optional().default(""),
    benefits: z.string().optional().default(""),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const { title, description, requirements, benefits } = parsed.data;

  try {
    const result = await exec(
      `INSERT INTO ads (sponsor_id, title, description, requirements, benefits)
       VALUES (?, ?, ?, ?, ?)`,
      [req.user.id, title, description, requirements, benefits]
    );

    const rows = await query("SELECT * FROM ads WHERE id = ?", [result.insertId]);
    return res.status(201).json({ ok: true, ad: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /ads/:adId
 * Delete one of this sponsor's ads.
 */
app.delete("/ads/:adId", requireAuth, async (req, res) => {
  const adId = toInt(req.params.adId);
  if (!Number.isFinite(adId)) {
    return res.status(400).json({ error: "Invalid adId" });
  }

  try {
    const rows = await query(
      "SELECT id FROM ads WHERE id = ? AND sponsor_id = ? LIMIT 1",
      [adId, req.user.id]
    );
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: "Ad not found" });
    }

    await exec("DELETE FROM ads WHERE id = ? AND sponsor_id = ?", [adId, req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /ads/:adId/applications
 * List applications for a single ad (sponsor-only)
 */
app.get('/ads/:adId/applications', requireAuth, async (req, res) => {
  const adId = toInt(req.params.adId);
  if (!Number.isFinite(adId)) return res.status(400).json({ error: 'Invalid adId' });

  try {
    const rows = await query('SELECT id FROM ads WHERE id = ? AND sponsor_id = ? LIMIT 1', [adId, req.user.id]);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Ad not found' });

    const applications = await query(
      `SELECT
        a.id,
        a.driver_id,
        a.status,
        a.applied_at,
        a.reviewed_at,
        a.notes,
        u.email AS driver_email,
        TRIM(CONCAT(COALESCE(dp.first_name, ''), ' ', COALESCE(dp.last_name, ''))) AS driver_name,
        dp.phone,
        dp.dob
      FROM applications a
      JOIN users u ON a.driver_id = u.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      WHERE a.sponsor_id = ? AND a.ad_id = ?
      ORDER BY a.applied_at DESC`,
      [req.user.id, adId]
    );

    return res.json({ applications });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /applications
 * Get all applications for this sponsor.
 */
app.get("/applications", requireAuth, async (req, res) => {
  try {
    const applications = await query(
      `SELECT 
        a.id,
        a.driver_id,
        a.ad_id,
        a.status,
        a.applied_at,
        a.reviewed_at,
        a.notes,
        u.email AS driver_email,
        TRIM(CONCAT(COALESCE(dp.first_name, ''), ' ', COALESCE(dp.last_name, ''))) AS driver_name,
        dp.phone,
        dp.dob,
        ad.title AS ad_title
      FROM applications a
      JOIN users u ON a.driver_id = u.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      LEFT JOIN ads ad ON a.ad_id = ad.id
      WHERE a.sponsor_id = ?
      ORDER BY a.applied_at DESC`,
      [req.user.id]
    );

    return res.json({ applications });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /applications/:applicationId
 * Get full details of a specific application.
 */
app.get("/applications/:applicationId", requireAuth, async (req, res) => {
  try {
    const applicationRows = await query(
      `SELECT 
        a.id,
        a.driver_id,
        a.ad_id,
        a.status,
        a.applied_at,
        a.reviewed_at,
        a.notes,
        u.email AS driver_email,
        TRIM(CONCAT(COALESCE(dp.first_name, ''), ' ', COALESCE(dp.last_name, ''))) AS driver_name,
        dp.phone,
        dp.dob,
        dp.address_line1,
        dp.address_line2,
        dp.city,
        dp.state,
        dp.postal_code,
        dp.country,
        ad.title AS ad_title
      FROM applications a
      JOIN users u ON a.driver_id = u.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      LEFT JOIN ads ad ON a.ad_id = ad.id
      WHERE a.id = ? AND a.sponsor_id = ?`,
      [req.params.applicationId, req.user.id]
    );

    if (!applicationRows || applicationRows.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    return res.json({ application: applicationRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ============================================================
// FIX 3: PUT /applications/:applicationId
// Frontend calls this path with { status: 'approved' | 'rejected' }.
// Normalise 'approved' -> 'accepted' and delegate to the review logic.
// ============================================================

/**
 * PUT /applications/:applicationId
 * Frontend-compatible wrapper: accepts { status: 'approved'|'accepted'|'rejected' }.
 */
app.put("/applications/:applicationId", requireAuth, async (req, res) => {
  const schema = z.object({
    status: z.enum(["approved", "accepted", "rejected"]),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  // Normalise 'approved' to 'accepted' (DB constraint uses 'accepted')
  const dbStatus = parsed.data.status === "approved" ? "accepted" : parsed.data.status;

  try {
    const existing = await query(
      "SELECT id FROM applications WHERE id = ? AND sponsor_id = ? LIMIT 1",
      [req.params.applicationId, req.user.id]
    );
    if (!existing || existing.length === 0) {
      return res.status(404).json({ error: "Application not found" });
    }

    // fetch driver_id so we can assign sponsor on accept
    const appRows = await query("SELECT driver_id FROM applications WHERE id = ? LIMIT 1", [req.params.applicationId]);
    const driverId = appRows?.[0]?.driver_id;

    await exec(
      `UPDATE applications
       SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ?
       WHERE id = ? AND sponsor_id = ?`,
      [dbStatus, parsed.data.notes || null, req.user.id, req.params.applicationId, req.user.id]
    );

    // If accepted, set the driver's sponsor_org to this sponsor's company_name
    if (dbStatus === 'accepted' && Number.isFinite(driverId)) {
      const sponsorCompany = await getSponsorCompanyName(req.user.id);
      if (sponsorCompany) {
        await exec("INSERT INTO driver_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id", [driverId]);
        await exec("UPDATE driver_profiles SET sponsor_org = ? WHERE user_id = ?", [sponsorCompany, driverId]);
      }
    }

    const updated = await query("SELECT * FROM applications WHERE id = ?", [req.params.applicationId]);
    return res.json({ ok: true, application: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /applications/:applicationId/review  (original endpoint, kept for compatibility)
 */
app.put("/applications/:applicationId/review", requireAuth, async (req, res) => {
  const schema = z.object({
    status: z.enum(["accepted", "rejected"]),
    notes: z.string().optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  try {
    // fetch driver_id if we need to assign sponsor
    const appRows = await query("SELECT driver_id FROM applications WHERE id = ? LIMIT 1", [req.params.applicationId]);
    const driverId = appRows?.[0]?.driver_id;

    await exec(
      `UPDATE applications 
       SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ?
       WHERE id = ? AND sponsor_id = ?`,
      [parsed.data.status, parsed.data.notes || null, req.user.id, req.params.applicationId, req.user.id]
    );

    if (parsed.data.status === 'accepted' && Number.isFinite(driverId)) {
      const sponsorCompany = await getSponsorCompanyName(req.user.id);
      if (sponsorCompany) {
        await exec("INSERT INTO driver_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id", [driverId]);
        await exec("UPDATE driver_profiles SET sponsor_org = ? WHERE user_id = ?", [sponsorCompany, driverId]);
      }
    }

    const updated = await query("SELECT * FROM applications WHERE id = ?", [req.params.applicationId]);
    return res.json({ ok: true, application: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /drivers
 * List drivers in the sponsor's organization, including current points balance.
 */
app.get("/drivers", requireAuth, async (req, res) => {
  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) {
      return res.status(400).json({
        error: "Sponsor company_name is not set. Update your profile first.",
      });
    }

    const rows = await query(
      `SELECT 
         u.id,
         u.email,
         dp.first_name,
         dp.last_name,
         dp.dob,
         dp.phone,
         dp.address_line1,
         dp.address_line2,
         dp.city,
         dp.state,
         dp.postal_code,
         dp.country,
         dp.sponsor_org,
         COALESCE(SUM(l.delta), 0) AS points_balance
       FROM users u
       JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
       WHERE u.role = 'driver'
         AND (
           dp.sponsor_org = ?
           OR EXISTS (
             SELECT 1
             FROM applications a
             WHERE a.driver_id = u.id
               AND a.sponsor_id = ?
               AND a.status = 'accepted'
           )
         )
       GROUP BY u.id
       ORDER BY dp.last_name ASC, dp.first_name ASC, u.email ASC`,
      [sponsorCompany, req.user.id]
    );

    const drivers = (rows || []).map((r) => ({
      id: r.id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
      dob: r.dob,
      phone: r.phone,
      address_line1: r.address_line1,
      address_line2: r.address_line2,
      city: r.city,
      state: r.state,
      postal_code: r.postal_code,
      country: r.country,
      sponsor_org: r.sponsor_org,
      pointsBalance: Number(r.points_balance || 0),
    }));

    return res.json({ drivers });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /drivers/:driverId
 * Get a single driver in the sponsor program, including current points balance.
 */
app.get("/drivers/:driverId", requireAuth, async (req, res) => {
  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) {
    return res.status(400).json({ error: "Invalid driverId" });
  }

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) {
      return res.status(400).json({
        error: "Sponsor company_name is not set. Update your profile first.",
      });
    }

    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;

    const balance = await getDriverPointsBalance(driverId);

    return res.json({
      driver: {
        id: driver.id,
        email: driver.email,
        first_name: driver.first_name,
        last_name: driver.last_name,
        dob: driver.dob,
        phone: driver.phone,
        address_line1: driver.address_line1,
        address_line2: driver.address_line2,
        city: driver.city,
        state: driver.state,
        postal_code: driver.postal_code,
        country: driver.country,
        sponsor_org: driver.sponsor_org,
      },
      balance,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /drivers/:driverId/points
 */
app.get("/drivers/:driverId/points", requireAuth, async (req, res) => {
  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) {
    return res.status(400).json({ error: "Invalid driverId" });
  }

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) {
      return res.status(400).json({
        error: "Sponsor company_name is not set. Update your profile first.",
      });
    }

    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;

    const ledger = await query(
      `SELECT id, driver_id, sponsor_id, delta, reason, created_at
       FROM driver_points_ledger
       WHERE driver_id = ? AND sponsor_id = ?
       ORDER BY created_at DESC, id DESC`,
      [driverId, req.user.id]
    );

    const balance = await getDriverPointsBalance(driverId);

    return res.json({
      driver: { id: driver.id, email: driver.email, first_name: driver.first_name, last_name: driver.last_name },
      balance,
      ledger: ledger || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /drivers/:driverId/points/add
 * Body: { points: number, reason: string }
 */
app.post("/drivers/:driverId/points/add", requireAuth, async (req, res) => {
  const schema = z.object({
    // UI inputs often come through as strings; coerce safely.
    points: z.coerce.number().int().positive(),
    reason: z.string().min(1).max(255),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) {
    return res.status(400).json({ error: "Invalid driverId" });
  }

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) {
      return res.status(400).json({
        error: "Sponsor company_name is not set. Update your profile first.",
      });
    }

    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;

    await exec(
      "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
      [driverId, req.user.id, parsed.data.points, parsed.data.reason]
    );

    const balance = await getDriverPointsBalance(driverId);

    return res.json({ ok: true, driverId, delta: parsed.data.points, reason: parsed.data.reason, balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /drivers/:driverId/points/deduct
 */
app.post("/drivers/:driverId/points/deduct", requireAuth, async (req, res) => {
  const schema = z.object({
    // UI inputs often come through as strings; coerce safely.
    points: z.coerce.number().int().positive(),
    reason: z.string().min(1).max(255),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }

  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) {
    return res.status(400).json({ error: "Invalid driverId" });
  }

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) {
      return res.status(400).json({
        error: "Sponsor company_name is not set. Update your profile first.",
      });
    }

    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;

    const delta = -Math.abs(parsed.data.points);

    await exec(
      "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
      [driverId, req.user.id, delta, parsed.data.reason]
    );

    const balance = await getDriverPointsBalance(driverId);

    return res.json({ ok: true, driverId, delta, reason: parsed.data.reason, balance });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /catalog
 * List all items in the sponsor's shop
 */
app.get('/catalog', requireAuth, async (req, res) => {
  try {
    const items = await query(
      'SELECT * FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    return res.json({ items });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * POST /catalog
 * Add an item to the sponsor's shop (from eBay or custom)
 */
app.post('/catalog', requireAuth, async (req, res) => {
  const schema = z.object({
    ebayItemId: z.string().optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    imageUrl: z.string().url().optional(),
    price: z.number().positive(),
    pointCost: z.number().int().positive().optional(), // Optional, can be calculated
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }

  const { ebayItemId, title, description, imageUrl, price, pointCost } = parsed.data;

  // Simple conversion rate: 1 USD = 100 points (example)
  const finalPointCost = pointCost || Math.ceil(price * 100);

  try {
    const result = await exec(
      `INSERT INTO catalog_items 
       (sponsor_id, ebay_item_id, title, description, image_url, price, point_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, ebayItemId || null, title, description || null, imageUrl || null, price, finalPointCost]
    );

    return res.status(201).json({
      ok: true,
      itemId: result.insertId,
      message: 'Item added to catalog'
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

/**
 * DELETE /catalog/:id
 * Remove an item from the shop
 */
app.delete('/catalog/:id', requireAuth, async (req, res) => {
  try {
    const result = await exec(
      'DELETE FROM catalog_items WHERE id = ? AND sponsor_id = ?',
      [req.params.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    return res.json({ ok: true, message: 'Item removed' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

const sponsorEbayRoutes = require('../../../routes/sponsor/ebay');
const sponsorCatalogRoutes = require('../../../routes/sponsor/catalog');

app.use('/ebay', requireAuth, sponsorEbayRoutes);
app.use('/catalog', requireAuth, sponsorCatalogRoutes);

app.listen(PORT, () => {
  console.log(`[sponsor] listening on :${PORT}`);
});