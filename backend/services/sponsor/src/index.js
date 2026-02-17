const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");

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

async function getSponsorCompanyName(sponsorId) {
  const rows = await query(
    "SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1",
    [sponsorId]
  );
  const company = rows?.[0]?.company_name;
  return company && String(company).trim().length > 0 ? String(company).trim() : null;
}

async function getDriverInSponsorOrgOr404(res, sponsorCompany, driverId) {
  const rows = await query(
    `SELECT u.id, u.email, dp.*
     FROM users u
     JOIN driver_profiles dp ON u.id = dp.user_id
     WHERE u.role = 'driver' AND u.id = ? AND dp.sponsor_org = ?
     LIMIT 1`,
    [driverId, sponsorCompany]
  );

  if (!rows || rows.length === 0) {
    res.status(404).json({ error: "Driver not found in your organization" });
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

    // address can be a single string OR expanded fields
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
      return res.status(400).json({ error: "New password must be different" });
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

/**
 * GET /applications
 * Get all applications for this sponsor
 */
app.get('/applications', requireAuth, async (req, res) => {
  try {
    const applications = await query(
      `SELECT 
        a.id,
        a.driver_id,
        a.status,
        a.applied_at,
        a.reviewed_at,
        a.notes,
        u.email,
        dp.first_name,
        dp.last_name,
        dp.phone,
        dp.dob
      FROM applications a
      JOIN users u ON a.driver_id = u.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      WHERE a.sponsor_id = ?
      ORDER BY a.applied_at DESC`,
      [req.user.id]
    )

    return res.json({ applications })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

/**
 * GET /applications/:applicationId
 * Get full details of a specific application
 */
app.get('/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const applicationRows = await query(
      `SELECT 
        a.id,
        a.driver_id,
        a.status,
        a.applied_at,
        a.reviewed_at,
        a.notes,
        u.email,
        dp.first_name,
        dp.last_name,
        dp.phone,
        dp.dob,
        dp.address_line1,
        dp.address_line2,
        dp.city,
        dp.state,
        dp.postal_code,
        dp.country
      FROM applications a
      JOIN users u ON a.driver_id = u.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      WHERE a.id = ? AND a.sponsor_id = ?`,
      [req.params.applicationId, req.user.id]
    )

    if (!applicationRows || applicationRows.length === 0) {
      return res.status(404).json({ error: 'Application not found' })
    }

    return res.json({ application: applicationRows[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

/**
 * Sprint 3: Sponsor driver points + org driver listing
 */

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
       WHERE u.role = 'driver' AND dp.sponsor_org = ?
       GROUP BY u.id
       ORDER BY dp.last_name ASC, dp.first_name ASC, u.email ASC`,
      [sponsorCompany]
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
 * GET /drivers/:driverId/points
 * Return the points ledger for a driver in this sponsor's org.
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

    const driver = await getDriverInSponsorOrgOr404(res, sponsorCompany, driverId);
    if (!driver) return; // response already sent

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
    points: z.number().int().positive(),
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

    const driver = await getDriverInSponsorOrgOr404(res, sponsorCompany, driverId);
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
 * Body: { points: number, reason: string }
 */
app.post("/drivers/:driverId/points/deduct", requireAuth, async (req, res) => {
  const schema = z.object({
    points: z.number().int().positive(),
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

    const driver = await getDriverInSponsorOrgOr404(res, sponsorCompany, driverId);
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
 * PUT /applications/:applicationId/review
 * Review and update application status
 */
app.put('/applications/:applicationId/review', requireAuth, async (req, res) => {
  const schema = z.object({
    status: z.enum(['accepted', 'rejected']),
    notes: z.string().optional()
  })

  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
  }

  try {
    await exec(
      `UPDATE applications 
       SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ?
       WHERE id = ? AND sponsor_id = ?`,
      [parsed.data.status, parsed.data.notes || null, req.user.id, req.params.applicationId, req.user.id]
    )

    const updated = await query(
      'SELECT * FROM applications WHERE id = ?',
      [req.params.applicationId]
    )

    return res.json({ ok: true, application: updated[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.listen(PORT, () => {
  console.log(`[sponsor] listening on :${PORT}`);
});
