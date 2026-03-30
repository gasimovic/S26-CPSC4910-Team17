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
 
// ─── Auth Middleware ──────────────────────────────────────────────────────────
 
async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
 
  try {
    const payload = verifyToken(token);
    if (payload.role !== ROLE) {
      return res.status(403).json({ error: "Wrong role for this service" });
    }
 
    // Check is_active and temp admin expiry (skip gracefully if columns are missing)
    try {
      const rows = await query(
        'SELECT is_active, temp_admin_expires_at FROM users WHERE id = ? LIMIT 1',
        [payload.sub]
      );
      const u = rows?.[0];
      if (u?.is_active === 0) {
        res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax' });
        return res.status(403).json({ error: 'Account has been deactivated' });
      }
      if (u?.temp_admin_expires_at && new Date(u.temp_admin_expires_at) < new Date()) {
        res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: 'lax' });
        return res.status(403).json({ error: 'Temporary admin access has expired' });
      }
    } catch {
      // Columns may not exist yet — continue
    }
 
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
 
// ─── Health ───────────────────────────────────────────────────────────────────
 
app.get("/healthz", async (_req, res) => {
  let dbStatus = 'disconnected';
  try {
    await query("SELECT 1");
    dbStatus = 'connected';
  } catch { /* ignore */ }
  return res.json({
    status: 'ok',
    db: { status: dbStatus, type: 'mysql' },
    uptime: Math.floor(process.uptime())
  });
});
 
// ─── Auth: Register ──────────────────────────────────────────────────────────
 
app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    display_name: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
 
  const email = parsed.data.email.toLowerCase();
  try {
    const password_hash = await hashPassword(parsed.data.password);
    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, password_hash, ROLE]
    );
    const userId = userInsert.insertId;
    await exec(
      "INSERT INTO admin_profiles (user_id, display_name) VALUES (?, ?)",
      [userId, parsed.data.display_name || null]
    );
    const userRows = await query("SELECT id, email, role, created_at FROM users WHERE id = ?", [userId]);
    return res.status(201).json({ user: userRows[0] });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY" || String(err?.message || '').includes("Duplicate")) {
      return res.status(409).json({ error: "Email already in use" });
    }
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
 
// ─── Auth: Login (#38 — records last_login_at) ───────────────────────────────
 
app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
 
  const email = parsed.data.email.toLowerCase();
  try {
    const rows = await query(
      `SELECT id, email, password_hash, role,
         COALESCE(is_active, 1) AS is_active,
         temp_admin_expires_at
       FROM users WHERE email = ? AND role = ? LIMIT 1`,
      [email, ROLE]
    );
    if (!rows?.length) return res.status(401).json({ error: "Invalid credentials" });
 
    const user = rows[0];
    if (user.is_active === 0) return res.status(403).json({ error: "Account is deactivated" });
    if (user.temp_admin_expires_at && new Date(user.temp_admin_expires_at) < new Date()) {
      return res.status(403).json({ error: "Temporary admin access has expired" });
    }
 
    const ok = await verifyPassword(parsed.data.password, user.password_hash);

    await exec(
      'INSERT INTO login_attempts (email, success, ip_address, user_agent, failure_reason) VALUES (?, ?, ?, ?, ?)',
      [email, ok ? 1 : 0, req.ip || null, (req.headers['user-agent'] || '').slice(0, 500), ok ? null : 'invalid_password']
    ).catch(() => {});

    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
 
    const token = signToken({ sub: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
      path: "/",
    });
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
 
// ─── Auth: Logout ─────────────────────────────────────────────────────────────
 
app.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: "lax" });
  return res.json({ ok: true });
});
 
// ─── /me ─────────────────────────────────────────────────────────────────────
 
app.get("/me", requireAuth, async (req, res) => {
  try {
    const userRows = await query("SELECT id, email, role, created_at FROM users WHERE id = ?", [req.user.id]);
    const profileRows = await query("SELECT * FROM admin_profiles WHERE user_id = ?", [req.user.id]);
    return res.json({ user: userRows[0], profile: profileRows[0] || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
 
// ─── /me profile + password ──────────────────────────────────────────────────
 
app.put("/me/profile", requireAuth, async (req, res) => {
  const schema = z.object({
    display_name: z.string().min(1).optional(),
    first_name: z.string().min(1).optional(),
    last_name: z.string().min(1).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
    phone: z.string().max(25).optional().or(z.literal('')),
    address_line1: z.string().max(200).optional().or(z.literal('')),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  const d = parsed.data;
  try {
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
      [d.display_name || null, d.first_name || null, d.last_name || null,
       d.dob || null, d.phone || null, d.address_line1 || null, req.user.id]
    );
    const profileRows = await query("SELECT * FROM admin_profiles WHERE user_id = ?", [req.user.id]);
    return res.json({ ok: true, profile: profileRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
 
app.put("/me/password", requireAuth, async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  try {
    const rows = await query("SELECT id, password_hash FROM users WHERE id = ? AND role = ? LIMIT 1", [req.user.id, ROLE]);
    if (!rows?.length) return res.status(404).json({ error: "User not found" });
    if (!await verifyPassword(parsed.data.currentPassword, rows[0].password_hash))
      return res.status(401).json({ error: "Invalid current password" });
    if (await verifyPassword(parsed.data.newPassword, rows[0].password_hash))
      return res.status(400).json({ error: "New password must differ from current" });
    await exec("UPDATE users SET password_hash = ? WHERE id = ? AND role = ?",
      [await hashPassword(parsed.data.newPassword), req.user.id, ROLE]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});
 
// ─── Users List (#38 — includes last_login_at + is_active) ───────────────────
 
app.get('/users', requireAuth, async (req, res) => {
  const { role } = req.query;
  try {
    let rows;
    if (role === 'driver') {
      rows = await query(
        `SELECT u.id, u.email, u.role, u.created_at,
           COALESCE(u.is_active, 1) AS is_active,
           u.last_login_at,
           dp.first_name, dp.last_name, dp.dob, dp.phone,
           dp.address_line1, dp.city, dp.state, dp.postal_code, dp.country, dp.sponsor_org,
           COALESCE(SUM(l.delta), 0) AS points_balance
         FROM users u
         LEFT JOIN driver_profiles dp ON u.id = dp.user_id
         LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
         WHERE u.role = 'driver'
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        []
      );
    } else if (role === 'sponsor') {
      rows = await query(
        `SELECT u.id, u.email, u.role, u.created_at,
           COALESCE(u.is_active, 1) AS is_active,
           u.last_login_at,
           sp.first_name, sp.last_name, sp.phone, sp.city, sp.state, sp.company_name,
           COUNT(DISTINCT dp.user_id) AS driver_count
         FROM users u
         LEFT JOIN sponsor_profiles sp ON u.id = sp.user_id
         LEFT JOIN driver_profiles dp ON dp.sponsor_org = sp.company_name
         WHERE u.role = 'sponsor'
         GROUP BY u.id
         ORDER BY u.created_at DESC`,
        []
      );
    } else if (role === 'admin') {
      rows = await query(
        `SELECT u.id, u.email, u.role, u.created_at,
           COALESCE(u.is_active, 1) AS is_active,
           u.last_login_at,
           ap.display_name, ap.first_name, ap.last_name, ap.phone
         FROM users u
         LEFT JOIN admin_profiles ap ON u.id = ap.user_id
         WHERE u.role = 'admin'
         ORDER BY u.created_at DESC`,
        []
      );
    } else {
      rows = await query(
        `SELECT id, email, role, created_at,
           COALESCE(is_active, 1) AS is_active,
           last_login_at
         FROM users ORDER BY created_at DESC`,
        []
      );
    }
    return res.json({ users: rows || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── Applications ─────────────────────────────────────────────────────────────
 
app.get('/applications', requireAuth, async (req, res) => {
  const { status, sponsor_id, driver_id } = req.query;
  const conditions = [];
  const params = [];
  if (status)    { conditions.push('a.status = ?');     params.push(status); }
  if (sponsor_id){ conditions.push('a.sponsor_id = ?'); params.push(Number(sponsor_id)); }
  if (driver_id) { conditions.push('a.driver_id = ?');  params.push(Number(driver_id)); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
 
  try {
    const applications = await query(
      `SELECT
         a.id, a.driver_id, a.sponsor_id, a.ad_id, a.status,
         a.applied_at, a.reviewed_at, a.reviewed_by, a.notes,
         u_driver.email AS driver_email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
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
    );
    return res.json({ applications: applications || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.put('/applications/:applicationId', requireAuth, async (req, res) => {
  const schema = z.object({
    status: z.enum(['accepted', 'approved', 'rejected', 'cancelled', 'pending']),
    notes: z.string().max(1000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
 
  const dbStatus = parsed.data.status === 'approved' ? 'accepted' : parsed.data.status;
  try {
    const existing = await query(
      'SELECT id, driver_id, sponsor_id FROM applications WHERE id = ? LIMIT 1',
      [req.params.applicationId]
    );
    if (!existing?.length) return res.status(404).json({ error: 'Application not found' });
 
    const { driver_id, sponsor_id } = existing[0];
    await exec(
      'UPDATE applications SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ?',
      [dbStatus, parsed.data.notes || null, req.user.id, req.params.applicationId]
    );
 
    if (dbStatus === 'accepted') {
      const sponsorRows = await query('SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1', [sponsor_id]);
      const company = sponsorRows?.[0]?.company_name;
      if (company?.trim()) {
        await exec('INSERT INTO driver_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id', [driver_id]);
        await exec('UPDATE driver_profiles SET sponsor_org = ? WHERE user_id = ?', [company.trim(), driver_id]);
      }
    }
 
    if (dbStatus === 'cancelled' || dbStatus === 'rejected') {
      const sponsorRows = await query('SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1', [sponsor_id]);
      const company = sponsorRows?.[0]?.company_name;
      if (company?.trim()) {
        await exec('UPDATE driver_profiles SET sponsor_org = NULL WHERE user_id = ? AND sponsor_org = ?', [driver_id, company.trim()]);
      }
    }
 
    const updated = await query('SELECT * FROM applications WHERE id = ?', [req.params.applicationId]);
    return res.json({ ok: true, application: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── Driver Points ────────────────────────────────────────────────────────────
 
app.get('/drivers/:driverId/points', requireAuth, async (req, res) => {
  const driverId = Number(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
  try {
    const driverRows = await query(
      `SELECT u.id, u.email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS name,
         dp.sponsor_org, COALESCE(SUM(l.delta), 0) AS balance
       FROM users u
       LEFT JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
       WHERE u.id = ? AND u.role = 'driver' GROUP BY u.id`,
      [driverId]
    );
    if (!driverRows?.length) return res.status(404).json({ error: 'Driver not found' });
 
    const ledger = await query(
      `SELECT dpl.id, dpl.driver_id, dpl.sponsor_id, dpl.delta, dpl.reason, dpl.created_at,
              sp.company_name AS sponsor_company
       FROM driver_points_ledger dpl
       LEFT JOIN sponsor_profiles sp ON dpl.sponsor_id = sp.user_id
       WHERE dpl.driver_id = ? ORDER BY dpl.created_at DESC, dpl.id DESC`,
      [driverId]
    );
    return res.json({ driver: driverRows[0], balance: Number(driverRows[0].balance || 0), ledger: ledger || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.post('/drivers/:driverId/points/add', requireAuth, async (req, res) => {
  const schema = z.object({ points: z.coerce.number().int().positive(), reason: z.string().min(1).max(255) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const driverId = Number(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
  try {
    const check = await query('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [driverId, 'driver']);
    if (!check?.length) return res.status(404).json({ error: 'Driver not found' });
    await exec('INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, NULL, ?, ?)',
      [driverId, parsed.data.points, parsed.data.reason]);
    const bal = await query('SELECT COALESCE(SUM(delta), 0) AS balance FROM driver_points_ledger WHERE driver_id = ?', [driverId]);
    return res.json({ ok: true, driverId, delta: parsed.data.points, balance: Number(bal[0]?.balance || 0) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.post('/drivers/:driverId/points/deduct', requireAuth, async (req, res) => {
  const schema = z.object({ points: z.coerce.number().int().positive(), reason: z.string().min(1).max(255) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const driverId = Number(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
  try {
    const check = await query('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [driverId, 'driver']);
    if (!check?.length) return res.status(404).json({ error: 'Driver not found' });
    const delta = -Math.abs(parsed.data.points);
    await exec('INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, NULL, ?, ?)',
      [driverId, delta, parsed.data.reason]);
    const bal = await query('SELECT COALESCE(SUM(delta), 0) AS balance FROM driver_points_ledger WHERE driver_id = ?', [driverId]);
    return res.json({ ok: true, driverId, delta, balance: Number(bal[0]?.balance || 0) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.delete('/drivers/:driverId/sponsor', requireAuth, async (req, res) => {
  const driverId = Number(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: 'Invalid driverId' });
  try {
    const check = await query('SELECT id FROM users WHERE id = ? AND role = ? LIMIT 1', [driverId, 'driver']);
    if (!check?.length) return res.status(404).json({ error: 'Driver not found' });
    await exec('UPDATE driver_profiles SET sponsor_org = NULL WHERE user_id = ?', [driverId]);
    await exec(
      `UPDATE applications SET status = 'cancelled', notes = 'Removed by admin',
        reviewed_at = NOW(), reviewed_by = ? WHERE driver_id = ? AND status = 'accepted'`,
      [req.user.id, driverId]
    );
    return res.json({ ok: true, driverId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── Transactions ─────────────────────────────────────────────────────────────
 
app.get('/transactions', requireAuth, async (req, res) => {
  const { driver_id, sponsor_id, date_from, date_to } = req.query;
  const conditions = [];
  const params = [];
  if (driver_id)  { conditions.push('dpl.driver_id = ?');   params.push(Number(driver_id)); }
  if (sponsor_id) { conditions.push('dpl.sponsor_id = ?');  params.push(Number(sponsor_id)); }
  if (date_from)  { conditions.push('dpl.created_at >= ?'); params.push(date_from); }
  if (date_to)    { conditions.push('dpl.created_at <= ?'); params.push(date_to + ' 23:59:59'); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
 
  try {
    const rows = await query(
      `SELECT dpl.id, dpl.driver_id, dpl.sponsor_id, dpl.delta, dpl.reason, dpl.created_at,
         u_driver.email AS driver_email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
         sp.company_name AS sponsor_company, u_sponsor.email AS sponsor_email
       FROM driver_points_ledger dpl
       JOIN users u_driver ON dpl.driver_id = u_driver.id
       LEFT JOIN driver_profiles dp ON dpl.driver_id = dp.user_id
       LEFT JOIN users u_sponsor ON dpl.sponsor_id = u_sponsor.id
       LEFT JOIN sponsor_profiles sp ON dpl.sponsor_id = sp.user_id
       ${where}
       ORDER BY dpl.created_at DESC LIMIT 2000`,
      params
    );
    return res.json({ transactions: rows || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── Sprint Info ──────────────────────────────────────────────────────────────
 
app.get('/sprint-info', async (_req, res) => {
  try {
    const rows = await query('SELECT * FROM sprint_info WHERE id = 1 LIMIT 1', []);
    return res.json(rows?.[0] || null);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.put('/sprint-info', requireAuth, async (req, res) => {
  const schema = z.object({
    sprint_number: z.coerce.number().int().min(0),
    title: z.string().max(255).optional().default(''),
    description: z.string().max(2000).optional().default(''),
    goals: z.string().max(2000).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  const { sprint_number, title, description, goals } = parsed.data;
  try {
    await exec(
      'UPDATE sprint_info SET sprint_number=?, title=?, description=?, goals=?, updated_at=NOW() WHERE id=1',
      [sprint_number, title, description, goals]
    );
    const rows = await query('SELECT * FROM sprint_info WHERE id = 1 LIMIT 1', []);
    return res.json(rows[0]);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── Language ─────────────────────────────────────────────────────────────────
 
app.get('/me/language', requireAuth, async (req, res) => {
  try {
    const rows = await query('SELECT preferred_language FROM users WHERE id = ? LIMIT 1', [req.user.id]);
    return res.json({ language: rows?.[0]?.preferred_language || 'en' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.put('/me/language', requireAuth, async (req, res) => {
  const schema = z.object({ language: z.string().min(2).max(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  try {
    await exec('UPDATE users SET preferred_language = ? WHERE id = ?', [parsed.data.language, req.user.id]);
    return res.json({ ok: true, language: parsed.data.language });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ════════════════════════════════════════════════════════════════════
//  NEW ROUTES (Sprint work items #29, #37, #38, #41, #43, #44)
// ════════════════════════════════════════════════════════════════════
 
// ─── #29: Create Sponsor Org ──────────────────────────────────────────────────
 
app.post('/users/create-sponsor', requireAuth, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    company_name: z.string().min(1).max(200),
    first_name: z.string().max(100).optional().default(''),
    last_name: z.string().max(100).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
 
  const email = parsed.data.email.toLowerCase();
  try {
    const password_hash = await hashPassword(parsed.data.password);
    const insert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'sponsor')",
      [email, password_hash]
    );
    const userId = insert.insertId;
    await exec(
      'INSERT INTO sponsor_profiles (user_id, company_name, first_name, last_name) VALUES (?, ?, ?, ?)',
      [userId, parsed.data.company_name, parsed.data.first_name || null, parsed.data.last_name || null]
    );
    return res.status(201).json({ ok: true, userId, email, company_name: parsed.data.company_name });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ─── Create User (driver/sponsor/admin) ───────────────────────────────────────
app.post('/users/create', requireAuth, async (req, res) => {
  const schema = z.object({
    role: z.enum(['driver', 'sponsor', 'admin']),
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string().max(100).optional().default(''),
    last_name: z.string().max(100).optional().default(''),
    company_name: z.string().max(200).optional().default(''),
    display_name: z.string().max(200).optional().default(''),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    phone: z.string().max(25).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const data = parsed.data;
  if (data.role === 'sponsor' && !String(data.company_name || '').trim()) {
    return res.status(400).json({ error: 'company_name is required for sponsor accounts' });
  }

  const email = data.email.toLowerCase();
  try {
    const password_hash = await hashPassword(data.password);
    const insert = await exec(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, password_hash, data.role]
    );
    const userId = insert.insertId;

    if (data.role === 'driver') {
      await exec(
        `INSERT INTO driver_profiles (user_id, first_name, last_name, dob, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, data.first_name || null, data.last_name || null, data.dob || null, data.phone || null]
      );
    } else if (data.role === 'sponsor') {
      await exec(
        `INSERT INTO sponsor_profiles (user_id, company_name, first_name, last_name, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, data.company_name.trim(), data.first_name || null, data.last_name || null, data.phone || null]
      );
    } else {
      await exec(
        `INSERT INTO admin_profiles (user_id, display_name, first_name, last_name, phone)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, data.display_name || null, data.first_name || null, data.last_name || null, data.phone || null]
      );
    }

    return res.status(201).json({ ok: true, userId, email, role: data.role });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
app.put('/users/:id/reactivate', requireAuth, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid user id' });
  try {
    const check = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    if (!check?.length) return res.status(404).json({ error: 'User not found' });
    await exec('UPDATE users SET is_active = 1 WHERE id = ?', [userId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── #41: Drivers by Sponsor ──────────────────────────────────────────────────
 
app.get('/sponsors/:sponsorId/drivers', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId);
  if (!Number.isFinite(sponsorId)) return res.status(400).json({ error: 'Invalid sponsor id' });
  try {
    const sponsorRows = await query(
      'SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1',
      [sponsorId]
    );
    const company = sponsorRows?.[0]?.company_name;
    if (!company) return res.json({ drivers: [] });
 
    const drivers = await query(
      `SELECT u.id, u.email,
         COALESCE(u.is_active, 1) AS is_active,
         u.last_login_at,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS name,
         dp.first_name, dp.last_name, dp.dob, dp.phone, dp.city, dp.state, dp.sponsor_org,
         COALESCE(SUM(l.delta), 0) AS points_balance
       FROM users u
       JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
       WHERE u.role = 'driver' AND dp.sponsor_org = ?
       GROUP BY u.id
       ORDER BY name ASC`,
      [company]
    );
    return res.json({ drivers: drivers || [], company_name: company });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 
// ─── #43: Bulk Driver Import ──────────────────────────────────────────────────
 
app.post('/drivers/bulk-import', requireAuth, async (req, res) => {
  const driverSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string().max(100).optional().default(''),
    last_name: z.string().max(100).optional().default(''),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  });
  const schema = z.object({ drivers: z.array(driverSchema).min(1).max(100) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
 
  const results = [];
  for (const d of parsed.data.drivers) {
    const email = d.email.toLowerCase();
    try {
      const password_hash = await hashPassword(d.password);
      const insert = await exec(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'driver')",
        [email, password_hash]
      );
      const userId = insert.insertId;
      await exec(
        'INSERT INTO driver_profiles (user_id, first_name, last_name, dob) VALUES (?, ?, ?, ?)',
        [userId, d.first_name || null, d.last_name || null, d.dob || null]
      );
      results.push({ email, ok: true, userId });
    } catch (err) {
      const isDup = err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate');
      results.push({ email, ok: false, error: isDup ? 'Email already in use' : (err?.message || 'Unknown error') });
    }
  }
 
  return res.json({
    ok: true,
    results,
    successCount: results.filter(r => r.ok).length,
    failCount: results.filter(r => !r.ok).length,
  });
});
 
// ─── #44: Temporary Admin ─────────────────────────────────────────────────────
 
app.post('/users/temp-admin', requireAuth, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    display_name: z.string().max(200).optional().default(''),
    expires_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
 
  if (new Date(parsed.data.expires_at) <= new Date()) {
    return res.status(400).json({ error: 'Expiry date must be in the future' });
  }
 
  const email = parsed.data.email.toLowerCase();
  const expiresAt = parsed.data.expires_at + ' 23:59:59';
 
  try {
    const password_hash = await hashPassword(parsed.data.password);
    let userId;
 
    try {
      const insert = await exec(
        "INSERT INTO users (email, password_hash, role, temp_admin_expires_at) VALUES (?, ?, 'admin', ?)",
        [email, password_hash, expiresAt]
      );
      userId = insert.insertId;
    } catch (colErr) {
      // Graceful fallback if temp_admin_expires_at column doesn't exist yet
      if (String(colErr?.message || '').includes('temp_admin_expires_at')) {
        const insert = await exec(
          "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
          [email, password_hash]
        );
        userId = insert.insertId;
      } else {
        throw colErr;
      }
    }
 
    await exec(
      'INSERT INTO admin_profiles (user_id, display_name) VALUES (?, ?)',
      [userId, parsed.data.display_name || null]
    );
 
    return res.status(201).json({ ok: true, userId, email, expiresAt });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});
 

app.put('/users/:id', requireAuth, async (req, res) => {
  const userId = Number(req.params.id)
  if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid user id' })
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot change your own role via this endpoint' })
 
  const schema = z.object({
    email:      z.string().email().optional(),
    first_name: z.string().max(100).optional(),
    last_name:  z.string().max(100).optional(),
    role:       z.enum(['driver', 'sponsor', 'admin']).optional(),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
 
  try {
    const userRows = await query('SELECT id, role FROM users WHERE id = ? LIMIT 1', [userId])
    if (!userRows?.length) return res.status(404).json({ error: 'User not found' })
 
    const updates = []
    const params = []
 
    if (parsed.data.email) { updates.push('email = ?'); params.push(parsed.data.email.toLowerCase()) }
    if (parsed.data.role)  { updates.push('role = ?');  params.push(parsed.data.role) }
 
    if (updates.length) {
      params.push(userId)
      await exec(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params)
    }
 
    // Update profile name in whichever profile table matches current role
    const currentRole = userRows[0].role
    if (parsed.data.first_name !== undefined || parsed.data.last_name !== undefined) {
      const profileTable =
        currentRole === 'admin'   ? 'admin_profiles' :
        currentRole === 'sponsor' ? 'sponsor_profiles' : 'driver_profiles'
 
      await exec(
        `INSERT INTO ${profileTable} (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id`,
        [userId]
      )
 
      const nameUpdates = []
      const nameParams = []
      if (parsed.data.first_name !== undefined) { nameUpdates.push('first_name = ?'); nameParams.push(parsed.data.first_name) }
      if (parsed.data.last_name  !== undefined) { nameUpdates.push('last_name = ?');  nameParams.push(parsed.data.last_name) }
      if (nameUpdates.length) {
        nameParams.push(userId)
        await exec(`UPDATE ${profileTable} SET ${nameUpdates.join(', ')} WHERE user_id = ?`, nameParams)
      }
    }
 
    return res.json({ ok: true })
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate'))
      return res.status(409).json({ error: 'Email already in use' })
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})
 
// ─── PUT /users/:id/deactivate — with optional reason ────────────────────────
//  REPLACE the existing /users/:id/deactivate route with this version
 
app.put('/users/:id/deactivate', requireAuth, async (req, res) => {
  const userId = Number(req.params.id)
  if (!Number.isFinite(userId)) return res.status(400).json({ error: 'Invalid user id' })
  if (userId === req.user.id) return res.status(400).json({ error: 'Cannot deactivate your own account' })
 
  const schema = z.object({ reason: z.string().max(500).optional() })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' })
 
  try {
    const check = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId])
    if (!check?.length) return res.status(404).json({ error: 'User not found' })
 
    // Store reason if column exists, ignore if not
    try {
      await exec(
        'UPDATE users SET is_active = 0, deactivate_reason = ? WHERE id = ?',
        [parsed.data.reason || null, userId]
      )
    } catch {
      // deactivate_reason column may not exist yet — fall back
      await exec('UPDATE users SET is_active = 0 WHERE id = ?', [userId])
    }
 
    return res.json({ ok: true })
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Server error' })
  }
})
 
// ─── Sponsor Tools routes (admin acting as sponsor) ───────────────────────────
 
// GET /sponsors/:sponsorId/ads
app.get('/sponsors/:sponsorId/ads', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId)
  if (!Number.isFinite(sponsorId)) return res.status(400).json({ error: 'Invalid sponsorId' })
  try {
    const ads = await query(
      'SELECT id, title, description, requirements, benefits, created_at FROM ads WHERE sponsor_id = ? ORDER BY created_at DESC',
      [sponsorId]
    )
    return res.json({ ads: ads || [] })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' })
  }
})
 
// POST /sponsors/:sponsorId/ads
app.post('/sponsors/:sponsorId/ads', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId)
  if (!Number.isFinite(sponsorId)) return res.status(400).json({ error: 'Invalid sponsorId' })
 
  const schema = z.object({
    title:        z.string().min(1).max(255),
    description:  z.string().min(1),
    requirements: z.string().optional().default(''),
    benefits:     z.string().optional().default(''),
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() })
 
  try {
    const result = await exec(
      'INSERT INTO ads (sponsor_id, title, description, requirements, benefits) VALUES (?, ?, ?, ?, ?)',
      [sponsorId, parsed.data.title, parsed.data.description, parsed.data.requirements, parsed.data.benefits]
    )
    const rows = await query('SELECT * FROM ads WHERE id = ?', [result.insertId])
    return res.status(201).json({ ok: true, ad: rows[0] })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' })
  }
})
 
// DELETE /sponsors/:sponsorId/ads/:adId
app.delete('/sponsors/:sponsorId/ads/:adId', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId)
  const adId      = Number(req.params.adId)
  if (!Number.isFinite(sponsorId) || !Number.isFinite(adId)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const rows = await query('SELECT id FROM ads WHERE id = ? AND sponsor_id = ? LIMIT 1', [adId, sponsorId])
    if (!rows?.length) return res.status(404).json({ error: 'Ad not found' })
    await exec('DELETE FROM ads WHERE id = ?', [adId])
    return res.json({ ok: true })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' })
  }
})
 
// GET /sponsors/:sponsorId/catalog
app.get('/sponsors/:sponsorId/catalog', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId)
  if (!Number.isFinite(sponsorId)) return res.status(400).json({ error: 'Invalid sponsorId' })
  try {
    // Catalog items are stored per sponsor — adjust table/column names to match your schema
    const items = await query(
      'SELECT id, title, description, image_url, price, point_cost, external_item_id, created_at FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC',
      [sponsorId]
    )
    return res.json({ items: items || [] })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' })
  }
})
 
// DELETE /sponsors/:sponsorId/catalog/:itemId
app.delete('/sponsors/:sponsorId/catalog/:itemId', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId)
  const itemId    = Number(req.params.itemId)
  if (!Number.isFinite(sponsorId) || !Number.isFinite(itemId)) return res.status(400).json({ error: 'Invalid id' })
  try {
    const rows = await query('SELECT id FROM catalog_items WHERE id = ? AND sponsor_id = ? LIMIT 1', [itemId, sponsorId])
    if (!rows?.length) return res.status(404).json({ error: 'Item not found' })
    await exec('DELETE FROM catalog_items WHERE id = ?', [itemId])
    return res.json({ ok: true })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' })
  }
})
 
// GET /sponsors/:sponsorId/analytics
app.get('/sponsors/:sponsorId/analytics', requireAuth, async (req, res) => {
  const sponsorId = Number(req.params.sponsorId)
  if (!Number.isFinite(sponsorId)) return res.status(400).json({ error: 'Invalid sponsorId' })
 
  try {
    const sponsorRows = await query('SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1', [sponsorId])
    const company = sponsorRows?.[0]?.company_name
 
    const [unredeemedRows, awardedRows, redeemedRows, driverBreakdown] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(l.delta), 0) AS total_unredeemed
         FROM driver_points_ledger l JOIN users u ON l.driver_id = u.id JOIN driver_profiles dp ON u.id = dp.user_id
         WHERE l.sponsor_id = ?
           AND (dp.sponsor_org = ? OR EXISTS (SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'))`,
        [sponsorId, company || '', sponsorId]
      ),
      query(
        `SELECT COALESCE(SUM(delta), 0) AS total_awarded FROM driver_points_ledger
         WHERE sponsor_id = ? AND delta > 0 AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
        [sponsorId]
      ),
      query(
        `SELECT COALESCE(ABS(SUM(delta)), 0) AS total_redeemed FROM driver_points_ledger
         WHERE sponsor_id = ? AND delta < 0 AND MONTH(created_at) = MONTH(CURRENT_DATE()) AND YEAR(created_at) = YEAR(CURRENT_DATE())`,
        [sponsorId]
      ),
      query(
        `SELECT l.driver_id,
                TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
                u.email AS driver_email, COALESCE(SUM(l.delta), 0) AS balance
         FROM driver_points_ledger l JOIN users u ON l.driver_id = u.id JOIN driver_profiles dp ON u.id = dp.user_id
         WHERE l.sponsor_id = ?
           AND (dp.sponsor_org = ? OR EXISTS (SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'))
         GROUP BY l.driver_id HAVING balance > 0 ORDER BY balance DESC`,
        [sponsorId, company || '', sponsorId]
      ),
    ])
 
    return res.json({
      totalUnredeemed:       Number(unredeemedRows[0]?.total_unredeemed || 0),
      totalAwardedThisMonth: Number(awardedRows[0]?.total_awarded || 0),
      totalRedeemedThisMonth:Number(redeemedRows[0]?.total_redeemed || 0),
      driverBreakdown:       driverBreakdown || [],
    })
  } catch (err) {
    console.error(err); return res.status(500).json({ error: 'Server error' })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM MONITORING (#3142-#3150)
// ═══════════════════════════════════════════════════════════════════════════

// ── In-memory API metrics collector ──
const apiMetrics = { totalRequests: 0, byEndpoint: {}, byMinute: [], errors: 0, startedAt: new Date().toISOString() };
app.use((req, _res, next) => {
  apiMetrics.totalRequests++;
  const key = `${req.method} ${req.path}`;
  apiMetrics.byEndpoint[key] = (apiMetrics.byEndpoint[key] || 0) + 1;
  const minute = new Date().toISOString().slice(0, 16);
  const last = apiMetrics.byMinute[apiMetrics.byMinute.length - 1];
  if (last && last.minute === minute) { last.count++; }
  else { apiMetrics.byMinute.push({ minute, count: 1 }); if (apiMetrics.byMinute.length > 1440) apiMetrics.byMinute.shift(); }
  next();
});

// ── #3144 — System uptime / stats ──
app.get('/system/stats', requireAuth, async (_req, res) => {
  try {
    const dbRows = await query("SELECT 1 AS ok").catch(() => null);
    const [userCount] = await query("SELECT COUNT(*) AS cnt FROM users").catch(() => [{ cnt: 0 }]);
    return res.json({
      uptime_seconds: Math.floor(process.uptime()),
      started_at: apiMetrics.startedAt,
      db_connected: !!dbRows,
      total_users: Number(userCount?.cnt || 0),
      node_version: process.version,
      memory: process.memoryUsage(),
    });
  } catch (err) { console.error(err); return res.status(500).json({ error: 'Server error' }); }
});

// ── #3145 — API usage metrics ──
app.get('/system/metrics', requireAuth, (_req, res) => {
  // Top endpoints sorted by hit count
  const topEndpoints = Object.entries(apiMetrics.byEndpoint)
    .map(([endpoint, count]) => ({ endpoint, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 30);

  // Requests per minute for the last 60 minutes
  const recentMinutes = apiMetrics.byMinute.slice(-60);

  return res.json({
    total_requests: apiMetrics.totalRequests,
    total_errors: apiMetrics.errors,
    top_endpoints: topEndpoints,
    requests_per_minute: recentMinutes,
    since: apiMetrics.startedAt,
  });
});

// ── #3146 — Background job statuses (scheduled point awards) ──
app.get('/system/jobs', requireAuth, async (_req, res) => {
  try {
    const jobs = await query(
      `SELECT id, driver_id, sponsor_id, points, reason, frequency,
              scheduled_date, is_recurring, is_paused,
              last_run_at, next_run_at, run_count, last_error, created_at
       FROM scheduled_point_awards
       ORDER BY created_at DESC
       LIMIT 200`
    );
    return res.json({ jobs: jobs || [] });
  } catch (err) {
    // Table may not exist yet
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ jobs: [] });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── #3147 — Retry failed background job ──
app.post('/system/jobs/:jobId/retry', requireAuth, async (req, res) => {
  const jobId = Number(req.params.jobId);
  if (!Number.isFinite(jobId)) return res.status(400).json({ error: 'Invalid jobId' });

  try {
    const rows = await query('SELECT * FROM scheduled_point_awards WHERE id = ? LIMIT 1', [jobId]);
    if (!rows?.length) return res.status(404).json({ error: 'Job not found' });

    const job = rows[0];

    // Re-execute the award
    await exec(
      "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
      [job.driver_id, job.sponsor_id, job.points, `[Retry] ${job.reason || 'Scheduled award'}`]
    );

    // Clear error, update run count
    await exec(
      "UPDATE scheduled_point_awards SET last_error = NULL, last_run_at = NOW(), run_count = run_count + 1 WHERE id = ?",
      [jobId]
    );

    return res.json({ ok: true, message: 'Job retried successfully' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── #3148 — Maintenance windows ──
app.get('/system/maintenance', requireAuth, async (_req, res) => {
  try {
    const rows = await query(
      `SELECT id, title, description, starts_at, ends_at, is_active, created_by, created_at
       FROM maintenance_windows ORDER BY starts_at DESC LIMIT 50`
    );
    return res.json({ windows: rows || [] });
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ windows: [] });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/system/maintenance', requireAuth, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().max(2000).optional().default(''),
    starts_at: z.string().min(1),
    ends_at: z.string().min(1),
    is_active: z.boolean().optional().default(true),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    const r = await exec(
      `INSERT INTO maintenance_windows (title, description, starts_at, ends_at, is_active, created_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [parsed.data.title, parsed.data.description, parsed.data.starts_at, parsed.data.ends_at, parsed.data.is_active ? 1 : 0, req.user.id]
    );
    return res.status(201).json({ ok: true, id: r.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/system/maintenance/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  const schema = z.object({
    title: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    starts_at: z.string().optional(),
    ends_at: z.string().optional(),
    is_active: z.boolean().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  try {
    const sets = [];
    const vals = [];
    if (parsed.data.title !== undefined) { sets.push('title = ?'); vals.push(parsed.data.title); }
    if (parsed.data.description !== undefined) { sets.push('description = ?'); vals.push(parsed.data.description); }
    if (parsed.data.starts_at !== undefined) { sets.push('starts_at = ?'); vals.push(parsed.data.starts_at); }
    if (parsed.data.ends_at !== undefined) { sets.push('ends_at = ?'); vals.push(parsed.data.ends_at); }
    if (parsed.data.is_active !== undefined) { sets.push('is_active = ?'); vals.push(parsed.data.is_active ? 1 : 0); }
    if (!sets.length) return res.status(400).json({ error: 'Nothing to update' });

    vals.push(id);
    await exec(`UPDATE maintenance_windows SET ${sets.join(', ')} WHERE id = ?`, vals);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/system/maintenance/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await exec('DELETE FROM maintenance_windows WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── #3149 — Feature flags ──
app.get('/system/features', requireAuth, async (_req, res) => {
  try {
    const rows = await query(
      `SELECT id, feature_key, label, description, is_enabled, updated_by, updated_at, created_at
       FROM feature_flags ORDER BY feature_key ASC`
    );
    return res.json({ features: rows || [] });
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ features: [] });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.post('/system/features', requireAuth, async (req, res) => {
  const schema = z.object({
    feature_key: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/),
    label: z.string().min(1).max(255),
    description: z.string().max(1000).optional().default(''),
    is_enabled: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    const r = await exec(
      `INSERT INTO feature_flags (feature_key, label, description, is_enabled, updated_by) VALUES (?, ?, ?, ?, ?)`,
      [parsed.data.feature_key, parsed.data.label, parsed.data.description, parsed.data.is_enabled ? 1 : 0, req.user.id]
    );
    return res.status(201).json({ ok: true, id: r.insertId });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Feature key already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.put('/system/features/:id/toggle', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const rows = await query('SELECT id, is_enabled FROM feature_flags WHERE id = ? LIMIT 1', [id]);
    if (!rows?.length) return res.status(404).json({ error: 'Feature not found' });

    const newState = rows[0].is_enabled ? 0 : 1;
    await exec('UPDATE feature_flags SET is_enabled = ?, updated_by = ?, updated_at = NOW() WHERE id = ?', [newState, req.user.id, id]);
    return res.json({ ok: true, is_enabled: !!newState });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/system/features/:id', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });
  try {
    await exec('DELETE FROM feature_flags WHERE id = ?', [id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Public endpoint: active maintenance banner (no auth) ──
app.get('/system/maintenance/active', async (_req, res) => {
  try {
    const rows = await query(
      `SELECT title, description, starts_at, ends_at
       FROM maintenance_windows
       WHERE is_active = 1 AND ends_at > NOW()
       ORDER BY starts_at ASC LIMIT 5`
    );
    return res.json({ windows: rows || [] });
  } catch {
    return res.json({ windows: [] });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SPRINT ADDITIONS: User Stories #24, #28-#35
// Append these routes to the bottom of your admin server file (before app.listen)
// ═══════════════════════════════════════════════════════════════════════════

// ── #24 / #35: System Configuration + Changelog ──────────────────────────────

// GET /system/config  — list all config entries
app.get('/system/config', requireAuth, async (_req, res) => {
  try {
    const rows = await query(
      `SELECT id, config_key, config_value, description, updated_by, updated_at, created_at
       FROM system_config ORDER BY config_key ASC`
    );
    return res.json({ config: rows || [] });
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ config: [] });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// POST /system/config  — create a config entry
app.post('/system/config', requireAuth, async (req, res) => {
  const schema = z.object({
    config_key:  z.string().min(1).max(100).regex(/^[a-z0-9_.]+$/i),
    config_value: z.string().max(2000),
    description: z.string().max(500).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    const r = await exec(
      `INSERT INTO system_config (config_key, config_value, description, updated_by) VALUES (?, ?, ?, ?)`,
      [parsed.data.config_key, parsed.data.config_value, parsed.data.description, req.user.id]
    );
    return res.status(201).json({ ok: true, id: r.insertId });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Config key already exists' });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /system/config/:key  — update a config value (records changelog)
app.put('/system/config/:key', requireAuth, async (req, res) => {
  const schema = z.object({
    config_value: z.string().max(2000),
    description: z.string().max(500).optional(),
    change_reason: z.string().max(500).optional().default(''),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    // Fetch old value for changelog
    const existing = await query(
      'SELECT id, config_value FROM system_config WHERE config_key = ? LIMIT 1',
      [req.params.key]
    );
    if (!existing?.length) return res.status(404).json({ error: 'Config key not found' });

    const oldValue = existing[0].config_value;

    // Update the value
    const updates = ['config_value = ?', 'updated_by = ?', 'updated_at = NOW()'];
    const vals = [parsed.data.config_value, req.user.id];
    if (parsed.data.description !== undefined) { updates.push('description = ?'); vals.push(parsed.data.description); }
    vals.push(req.params.key);
    await exec(`UPDATE system_config SET ${updates.join(', ')} WHERE config_key = ?`, vals);

    // Record changelog
    try {
      await exec(
        `INSERT INTO system_config_changelog (config_key, old_value, new_value, changed_by, change_reason)
         VALUES (?, ?, ?, ?, ?)`,
        [req.params.key, oldValue, parsed.data.config_value, req.user.id, parsed.data.change_reason || null]
      );
    } catch { /* changelog table may not exist yet */ }

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /system/config/:key
app.delete('/system/config/:key', requireAuth, async (req, res) => {
  try {
    const existing = await query('SELECT id FROM system_config WHERE config_key = ? LIMIT 1', [req.params.key]);
    if (!existing?.length) return res.status(404).json({ error: 'Config key not found' });
    await exec('DELETE FROM system_config WHERE config_key = ?', [req.params.key]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// GET /system/config/changelog  — #35: view config change history
app.get('/system/config/changelog', requireAuth, async (req, res) => {
  const { config_key, limit = 200 } = req.query;
  const conditions = [];
  const params = [];
  if (config_key) { conditions.push('c.config_key = ?'); params.push(config_key); }
  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(Math.min(Number(limit) || 200, 1000));

  try {
    const rows = await query(
      `SELECT c.id, c.config_key, c.old_value, c.new_value, c.change_reason,
              c.changed_at, c.changed_by,
              COALESCE(ap.display_name, CONCAT(COALESCE(ap.first_name,''), ' ', COALESCE(ap.last_name,'')), u.email) AS changed_by_name
       FROM system_config_changelog c
       LEFT JOIN users u ON c.changed_by = u.id
       LEFT JOIN admin_profiles ap ON c.changed_by = ap.user_id
       ${where}
       ORDER BY c.changed_at DESC
       LIMIT ?`,
      params
    );
    return res.json({ changelog: rows || [] });
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ changelog: [] });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// GET /system/audit-logs  — system-wide point transactions / audit trail
//   Filters: date_from, date_to, sponsor_id, driver_id, reviewed (true/false/all)
app.get('/system/audit-logs', requireAuth, async (req, res) => {
  const { date_from, date_to, sponsor_id, driver_id, reviewed, limit = 500 } = req.query;
  const conditions = [];
  const params = [];

  if (date_from)  { conditions.push('dpl.created_at >= ?');  params.push(date_from); }
  if (date_to)    { conditions.push('dpl.created_at <= ?');  params.push(date_to + ' 23:59:59'); }
  if (sponsor_id) { conditions.push('dpl.sponsor_id = ?');   params.push(Number(sponsor_id)); }
  if (driver_id)  { conditions.push('dpl.driver_id = ?');    params.push(Number(driver_id)); }
  if (reviewed === 'true')  conditions.push('dpl.reviewed_at IS NOT NULL');
  if (reviewed === 'false') conditions.push('dpl.reviewed_at IS NULL');

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(Math.min(Number(limit) || 500, 2000));

  try {
    const rows = await query(
      `SELECT dpl.id, dpl.driver_id, dpl.sponsor_id, dpl.delta, dpl.reason,
              dpl.created_at,
              dpl.reviewed_at, dpl.reviewed_by,
              u_driver.email AS driver_email,
              TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
              sp.company_name AS sponsor_company,
              u_sponsor.email AS sponsor_email,
              COALESCE(ap.display_name, CONCAT(COALESCE(ap.first_name,''), ' ', COALESCE(ap.last_name,'')), u_rev.email) AS reviewed_by_name
       FROM driver_points_ledger dpl
       JOIN users u_driver ON dpl.driver_id = u_driver.id
       LEFT JOIN driver_profiles dp ON dpl.driver_id = dp.user_id
       LEFT JOIN users u_sponsor ON dpl.sponsor_id = u_sponsor.id
       LEFT JOIN sponsor_profiles sp ON dpl.sponsor_id = sp.user_id
       LEFT JOIN users u_rev ON dpl.reviewed_by = u_rev.id
       LEFT JOIN admin_profiles ap ON dpl.reviewed_by = ap.user_id
       ${where}
       ORDER BY dpl.created_at DESC
       LIMIT ?`,
      params
    );
    return res.json({ logs: rows || [], count: rows?.length || 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PUT /system/audit-logs/:id/review  — #33: mark an entry as reviewed
app.put('/system/audit-logs/:id/review', requireAuth, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid id' });

  try {
    const rows = await query('SELECT id, reviewed_at FROM driver_points_ledger WHERE id = ? LIMIT 1', [id]);
    if (!rows?.length) return res.status(404).json({ error: 'Log entry not found' });

    // Toggle: if already reviewed, un-review; otherwise mark reviewed
    const alreadyReviewed = !!rows[0].reviewed_at;
    if (alreadyReviewed) {
      await exec('UPDATE driver_points_ledger SET reviewed_at = NULL, reviewed_by = NULL WHERE id = ?', [id]);
    } else {
      await exec('UPDATE driver_points_ledger SET reviewed_at = NOW(), reviewed_by = ? WHERE id = ?', [req.user.id, id]);
    }
    return res.json({ ok: true, reviewed: !alreadyReviewed });
  } catch (err) {
    // If reviewed_at column doesn't exist yet, return gracefully
    if (String(err?.message || '').includes('reviewed')) {
      return res.json({ ok: false, error: 'reviewed_at column not yet added to driver_points_ledger' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


// ── #31, #32: Login Attempt Logs ──────────────────────────────────────────────

// GET /system/login-attempts  — all or failed only
//   Filters: failed_only (bool), email, date_from, date_to
app.get('/system/login-attempts', requireAuth, async (req, res) => {
  const { failed_only, email, date_from, date_to, limit = 500 } = req.query;
  const conditions = [];
  const params = [];

  if (failed_only === 'true') conditions.push('la.success = 0');
  if (email)      { conditions.push('la.email LIKE ?'); params.push(`%${email}%`); }
  if (date_from)  { conditions.push('la.attempted_at >= ?'); params.push(date_from); }
  if (date_to)    { conditions.push('la.attempted_at <= ?'); params.push(date_to + ' 23:59:59'); }

  const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';
  params.push(Math.min(Number(limit) || 500, 2000));

  try {
    const rows = await query(
      `SELECT la.id, la.email, la.success, la.ip_address, la.user_agent,
              la.attempted_at, la.failure_reason,
              u.id AS user_id, u.role
       FROM login_attempts la
       LEFT JOIN users u ON la.email = u.email
       ${where}
       ORDER BY la.attempted_at DESC
       LIMIT ?`,
      params
    );
    return res.json({ attempts: rows || [], count: rows?.length || 0 });
  } catch (err) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return res.json({ attempts: [], count: 0 });
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`[admin] listening on :${PORT}`);
});