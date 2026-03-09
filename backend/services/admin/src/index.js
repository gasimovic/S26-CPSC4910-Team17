require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") })
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
      path: "/api/admin",
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

app.get('/users', requireAuth, async (req, res) => {
  const { role } = req.query
  try {
    let rows
    if (role === 'driver') {
      rows = await query(
        `SELECT
           u.id, u.email, u.role, u.created_at,
           dp.first_name, dp.last_name, dp.dob, dp.phone,
           dp.address_line1, dp.city, dp.state, dp.postal_code, dp.country,
           dp.sponsor_org,
           COALESCE(SUM(l.delta), 0) AS points_balance
         FROM users u
         LEFT JOIN driver_profiles dp ON u.id = dp.user_id
         LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
         WHERE u.role = 'driver'
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        []
      )
    } else if (role === 'sponsor') {
      rows = await query(
        `SELECT
           u.id, u.email, u.role, u.created_at,
           sp.first_name, sp.last_name, sp.phone,
           sp.city, sp.state, sp.company_name,
           COUNT(DISTINCT dp.user_id) AS driver_count
         FROM users u
         LEFT JOIN sponsor_profiles sp ON u.id = sp.user_id
         LEFT JOIN driver_profiles dp ON dp.sponsor_org = sp.company_name
         WHERE u.role = 'sponsor'
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        []
      )
    } else {
      rows = await query(
        `SELECT id, email, role, created_at FROM users ORDER BY created_at DESC`,
        []
      )
    }
    return res.json({ users: rows || [] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── Applications (Admin) ─────────────────────────────────

app.get('/applications', requireAuth, async (req, res) => {
  const { status, sponsor_id, driver_id } = req.query
  const conditions = []
  const params = []
  if (status)    { conditions.push('a.status = ?');    params.push(status) }
  if (sponsor_id){ conditions.push('a.sponsor_id = ?'); params.push(Number(sponsor_id)) }
  if (driver_id) { conditions.push('a.driver_id = ?');  params.push(Number(driver_id)) }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  try {
    const applications = await query(
      `SELECT
        a.id, a.driver_id, a.sponsor_id, a.ad_id, a.status,
        a.applied_at, a.reviewed_at, a.reviewed_by, a.notes,
        u_driver.email AS driver_email,
        TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
        dp.phone AS driver_phone,
        dp.sponsor_org AS driver_sponsor_org,
        COALESCE(SUM(lp.delta), 0) AS driver_points,
        u_sponsor.email AS sponsor_email,
        sp.company_name AS sponsor_company,
        ad.title AS ad_title
      FROM applications a
      JOIN users u_driver ON a.driver_id = u_driver.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      LEFT JOIN driver_points_ledger lp ON lp.driver_id = a.driver_id
      JOIN users u_sponsor ON a.sponsor_id = u_sponsor.id
      LEFT JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
      LEFT JOIN ads ad ON a.ad_id = ad.id
      ${where}
      GROUP BY a.id
      ORDER BY a.applied_at DESC`,
      params
    )
    return res.json({ applications: applications || [] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.get('/applications/:applicationId', requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT
        a.id, a.driver_id, a.sponsor_id, a.ad_id, a.status,
        a.applied_at, a.reviewed_at, a.reviewed_by, a.notes,
        u_driver.email AS driver_email,
        TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
        u_sponsor.email AS sponsor_email,
        sp.company_name AS sponsor_company,
        ad.title AS ad_title
      FROM applications a
      JOIN users u_driver ON a.driver_id = u_driver.id
      LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
      JOIN users u_sponsor ON a.sponsor_id = u_sponsor.id
      LEFT JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
      LEFT JOIN ads ad ON a.ad_id = ad.id
      WHERE a.id = ?`,
      [req.params.applicationId]
    )
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Application not found' })
    return res.json({ application: rows[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.put('/applications/:applicationId', requireAuth, async (req, res) => {
  const schema = z.object({
    status: z.enum(['accepted', 'approved', 'rejected', 'cancelled', 'pending']),
    notes: z.string().max(1000).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

  const dbStatus = parsed.data.status === 'approved' ? 'accepted' : parsed.data.status

  try {
    const existing = await query(
      'SELECT id, driver_id, sponsor_id FROM applications WHERE id = ? LIMIT 1',
      [req.params.applicationId]
    )
    if (!existing || existing.length === 0) return res.status(404).json({ error: 'Application not found' })

    const { driver_id, sponsor_id } = existing[0]

    await exec(
      `UPDATE applications SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?`,
      [dbStatus, parsed.data.notes || null, req.user.id, req.params.applicationId]
    )

    if (dbStatus === 'accepted') {
      const sponsorRows = await query('SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1', [sponsor_id])
      const company = sponsorRows?.[0]?.company_name
      if (company && String(company).trim()) {
        await exec('INSERT INTO driver_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id', [driver_id])
        await exec('UPDATE driver_profiles SET sponsor_org = ? WHERE user_id = ?', [String(company).trim(), driver_id])
      }
    }

    if (dbStatus === 'cancelled' || dbStatus === 'rejected') {
      const sponsorRows = await query('SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1', [sponsor_id])
      const company = sponsorRows?.[0]?.company_name
      if (company && String(company).trim()) {
        await exec('UPDATE driver_profiles SET sponsor_org = NULL WHERE user_id = ? AND sponsor_org = ?', [driver_id, String(company).trim()])
      }
    }

    const updated = await query('SELECT * FROM applications WHERE id = ?', [req.params.applicationId])
    return res.json({ ok: true, application: updated[0] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

// ── Driver Points (Admin) ────────────────────────────────

app.get('/drivers/:driverId/points', requireAuth, async (req, res) => {
  const driverId = Number(req.params.driverId)
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' })

  try {
    const driverRows = await query(
      `SELECT u.id, u.email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS name,
         dp.sponsor_org,
         COALESCE(SUM(l.delta), 0) AS balance
       FROM users u
       LEFT JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
       WHERE u.id = ? AND u.role = 'driver'
       GROUP BY u.id`,
      [driverId]
    )
    if (!driverRows || driverRows.length === 0) return res.status(404).json({ error: 'Driver not found' })

    const ledger = await query(
      `SELECT dpl.id, dpl.driver_id, dpl.sponsor_id, dpl.delta, dpl.reason, dpl.created_at,
              sp.company_name AS sponsor_company
       FROM driver_points_ledger dpl
       LEFT JOIN sponsor_profiles sp ON dpl.sponsor_id = sp.user_id
       WHERE dpl.driver_id = ?
       ORDER BY dpl.created_at DESC, dpl.id DESC`,
      [driverId]
    )

    return res.json({ driver: driverRows[0], balance: Number(driverRows[0].balance || 0), ledger: ledger || [] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.post('/drivers/:driverId/points/add', requireAuth, async (req, res) => {
  const schema = z.object({ points: z.coerce.number().int().positive(), reason: z.string().min(1).max(255) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

  const driverId = Number(req.params.driverId)
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' })

  try {
    const check = await query('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [driverId, 'driver'])
    if (!check || check.length === 0) return res.status(404).json({ error: 'Driver not found' })

    await exec('INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, NULL, ?, ?)',
      [driverId, parsed.data.points, parsed.data.reason])

    const bal = await query('SELECT COALESCE(SUM(delta), 0) AS balance FROM driver_points_ledger WHERE driver_id = ?', [driverId])
    return res.json({ ok: true, driverId, delta: parsed.data.points, reason: parsed.data.reason, balance: Number(bal[0]?.balance || 0) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.post('/drivers/:driverId/points/deduct', requireAuth, async (req, res) => {
  const schema = z.object({ points: z.coerce.number().int().positive(), reason: z.string().min(1).max(255) })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })

  const driverId = Number(req.params.driverId)
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' })

  try {
    const check = await query('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [driverId, 'driver'])
    if (!check || check.length === 0) return res.status(404).json({ error: 'Driver not found' })

    const delta = -Math.abs(parsed.data.points)
    await exec('INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, NULL, ?, ?)',
      [driverId, delta, parsed.data.reason])

    const bal = await query('SELECT COALESCE(SUM(delta), 0) AS balance FROM driver_points_ledger WHERE driver_id = ?', [driverId])
    return res.json({ ok: true, driverId, delta, reason: parsed.data.reason, balance: Number(bal[0]?.balance || 0) })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.delete('/drivers/:driverId/sponsor', requireAuth, async (req, res) => {
  const driverId = Number(req.params.driverId)
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' })

  try {
    const check = await query('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [driverId, 'driver'])
    if (!check || check.length === 0) return res.status(404).json({ error: 'Driver not found' })

    await exec('UPDATE driver_profiles SET sponsor_org = NULL WHERE user_id = ?', [driverId])

    // Also cancel any accepted applications for this driver so state stays consistent
    await exec(
      `UPDATE applications SET status = 'cancelled', notes = 'Removed by admin', reviewed_at = NOW(), reviewed_by = ?
       WHERE driver_id = ? AND status = 'accepted'`,
      [req.user.id, driverId]
    )

    return res.json({ ok: true, driverId })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.get('/transactions', requireAuth, async (req, res) => {
  const { driver_id, sponsor_id, date_from, date_to } = req.query
  const conditions = []
  const params = []

  if (driver_id)  { conditions.push('dpl.driver_id = ?');  params.push(Number(driver_id)) }
  if (sponsor_id) { conditions.push('dpl.sponsor_id = ?'); params.push(Number(sponsor_id)) }
  if (date_from)  { conditions.push('dpl.created_at >= ?'); params.push(date_from) }
  if (date_to)    { conditions.push('dpl.created_at <= ?'); params.push(date_to + ' 23:59:59') }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''

  try {
    const rows = await query(
      `SELECT
         dpl.id, dpl.driver_id, dpl.sponsor_id, dpl.delta, dpl.reason, dpl.created_at,
         u_driver.email AS driver_email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
         sp.company_name AS sponsor_company,
         u_sponsor.email AS sponsor_email
       FROM driver_points_ledger dpl
       JOIN users u_driver ON dpl.driver_id = u_driver.id
       LEFT JOIN driver_profiles dp ON dpl.driver_id = dp.user_id
       LEFT JOIN users u_sponsor ON dpl.sponsor_id = u_sponsor.id
       LEFT JOIN sponsor_profiles sp ON dpl.sponsor_id = sp.user_id
       ${where}
       ORDER BY dpl.created_at DESC
       LIMIT 2000`,
      params
    )
    return res.json({ transactions: rows || [] })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.get('/sprint-info', async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM sprint_info WHERE id = 1 LIMIT 1', [])
    if (!rows || rows.length === 0) return res.json(null)
    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.put('/sprint-info', requireAuth, async (req, res) => {
  const schema = z.object({
    sprint_number: z.coerce.number().int().min(0),
    title: z.string().max(255).optional().default(''),
    description: z.string().max(2000).optional().default(''),
    goals: z.string().max(2000).optional().default(''),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
  }
  const { sprint_number, title, description, goals } = parsed.data
  try {
    await exec(
      `UPDATE sprint_info SET sprint_number=?, title=?, description=?, goals=?, updated_at=NOW() WHERE id=1`,
      [sprint_number, title, description, goals]
    )
    const rows = await query('SELECT * FROM sprint_info WHERE id = 1 LIMIT 1', [])
    return res.json(rows[0])
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})

app.listen(PORT, () => {
  console.log(`[admin] listening on :${PORT}`);
});
