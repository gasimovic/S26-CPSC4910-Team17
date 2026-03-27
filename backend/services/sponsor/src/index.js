require("dotenv").config({ path: require("path").resolve(__dirname, "../../../.env") })
const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");

const app = makeApp();

const PORT = process.env.PORT || 4003;
const COOKIE_NAME = process.env.COOKIE_NAME || "gdip_token";
const COOKIE_SECURE = (process.env.COOKIE_SECURE || "false") === "true";
const ROLE = "sponsor";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

async function driverBelongsToSponsorOr404(res, sponsorId, sponsorCompany, driverId) {
  const rows = await query(
    `SELECT u.id, u.email, dp.*
     FROM users u
     JOIN driver_profiles dp ON u.id = dp.user_id
     WHERE u.role = 'driver'
       AND u.id = ?
       AND (
         dp.sponsor_org = ?
         OR EXISTS (
           SELECT 1 FROM applications a
           WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'
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

// ─── Auth Middleware ──────────────────────────────────────────────────────────
// FIX: only allow role === 'sponsor' (removed admin passthrough)
// FIX: check is_active so deactivated sponsors are locked out

async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  try {
    const payload = verifyToken(token);

    // FIX #4: only sponsors may use this service
    if (payload.role !== ROLE) {
      return res.status(403).json({ error: "Wrong role for this service" });
    }

    // FIX #2: check is_active (graceful if column missing)
    try {
      const rows = await query(
        "SELECT COALESCE(is_active, 1) AS is_active FROM users WHERE id = ? LIMIT 1",
        [payload.sub]
      );
      if (rows?.[0]?.is_active === 0) {
        res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: "lax" });
        return res.status(403).json({ error: "Account has been deactivated" });
      }
    } catch {
      // column may not exist on older schema — continue
    }

    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get("/healthz", async (_req, res) => {
  let dbStatus = "disconnected";
  try {
    await query("SELECT 1");
    dbStatus = "connected";
  } catch { /* ignore */ }
  return res.json({
    status: "ok",
    db: { status: dbStatus, type: "mysql" },
    uptime: Math.floor(process.uptime()),
  });
});

// ─── Auth: Register ──────────────────────────────────────────────────────────

app.post("/auth/register", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    first_name: z.string().max(100).optional(),
    last_name: z.string().max(100).optional(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    companyName: z.string().optional(),
    company_name: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  const company_name = parsed.data.companyName || parsed.data.company_name || null;

  try {
    const password_hash = await hashPassword(parsed.data.password);
    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
      [email, password_hash, ROLE]
    );
    const userId = userInsert.insertId;
    await exec(
      "INSERT INTO sponsor_profiles (user_id, company_name, first_name, last_name, dob) VALUES (?, ?, ?, ?, ?)",
      [userId, company_name, parsed.data.first_name || null, parsed.data.last_name || null, parsed.data.dob || null]
    );
    const userRows = await query("SELECT id, email, role, created_at FROM users WHERE id = ?", [userId]);
    return res.status(201).json({ user: userRows[0] });
  } catch (err) {
    if (err?.code === "ER_DUP_ENTRY" || String(err?.message || "").includes("Duplicate"))
      return res.status(409).json({ error: "Email already in use" });
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Auth: Login ─────────────────────────────────────────────────────────────
// FIX #1: cookie path changed from "/api/sponsor" → "/"
// FIX #2: check is_active before granting session
// FIX #3: record last_login_at

app.post("/auth/login", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  try {
    const rows = await query(
      `SELECT id, email, password_hash, role,
         COALESCE(is_active, 1) AS is_active
       FROM users WHERE email = ? AND role = ? LIMIT 1`,
      [email, ROLE]
    );
    if (!rows?.length) return res.status(401).json({ error: "Invalid credentials" });

    const user = rows[0];

    const ok = await verifyPassword(parsed.data.password, user.password_hash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });

    // Check if sponsor is deactivated
    const profileRows = await query(
      "SELECT is_active FROM sponsor_profiles WHERE user_id = ? LIMIT 1",
      [user.id]
    );
    if (profileRows?.[0]?.is_active === 0) {
      return res.status(403).json({ error: "Your account has been deactivated. Contact your organization admin." });
    }

    // Record last login — fire-and-forget
    exec("UPDATE users SET last_login_at = NOW() WHERE id = ?", [user.id]).catch(() => {});

    const token = signToken({ sub: user.id, role: user.role });
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: "lax",
      maxAge: 2 * 60 * 60 * 1000,
      path: "/", // FIX #1: was "/api/sponsor" which broke subsequent requests
    });
    return res.json({ ok: true, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Auth: Logout ─────────────────────────────────────────────────────────────

app.post("/auth/logout", (_req, res) => {
  res.clearCookie(COOKIE_NAME, { httpOnly: true, secure: COOKIE_SECURE, sameSite: "lax", path: "/" });
  return res.json({ ok: true });
});

// ─── Auth: Forgot / Reset Password ───────────────────────────────────────────
// FIX: these routes were entirely missing from the sponsor service

app.post("/auth/forgot-password", async (req, res) => {
  const schema = z.object({ email: z.string().email() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  try {
    const rows = await query(
      "SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1",
      [email, ROLE]
    );
    // Always respond the same way to avoid email enumeration
    if (!rows?.length)
      return res.json({ ok: true, message: "If that account exists, a reset link has been generated." });

    const userId = rows[0].id;
    const token = require("crypto").randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await exec(
      `INSERT INTO password_reset_tokens (user_id, token, expires_at)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE token = VALUES(token), expires_at = VALUES(expires_at), used = 0`,
      [userId, token, expiresAt]
    );

    const resetUrl = `${process.env.APP_URL || "http://localhost:5173"}/reset-password?email=${encodeURIComponent(email)}&token=${token}`;
    // No email system yet — return the URL directly for dev/testing
    return res.json({ ok: true, message: "Reset link generated.", resetUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/auth/reset-password", async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    token: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const email = parsed.data.email.toLowerCase();
  try {
    const userRows = await query(
      "SELECT id FROM users WHERE email = ? AND role = ? LIMIT 1",
      [email, ROLE]
    );
    if (!userRows?.length) return res.status(400).json({ error: "Invalid or expired reset token" });

    const userId = userRows[0].id;
    const tokenRows = await query(
      `SELECT id FROM password_reset_tokens
       WHERE user_id = ? AND token = ? AND used = 0 AND expires_at > NOW() LIMIT 1`,
      [userId, parsed.data.token]
    );
    if (!tokenRows?.length) return res.status(400).json({ error: "Invalid or expired reset token" });

    const newHash = await hashPassword(parsed.data.newPassword);
    await exec("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, userId]);
    await exec("UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?", [userId]);

    return res.json({ ok: true, message: "Password reset successful." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── /me ─────────────────────────────────────────────────────────────────────

app.get("/me", requireAuth, async (req, res) => {
  try {
    const userRows = await query(
      "SELECT id, email, role, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    const profileRows = await query(
      "SELECT * FROM sponsor_profiles WHERE user_id = ?",
      [req.user.id]
    );
    return res.json({ user: userRows[0], profile: profileRows[0] || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

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
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const d = parsed.data;
  const company_name = d.companyName || d.company_name || null;
  const first_name = d.firstName || d.first_name || null;
  const last_name = d.lastName || d.last_name || null;
  const address_line1 = d.address_line1 || d.address || null;

  try {
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
      [company_name, first_name, last_name, d.dob || null, d.phone || null,
       address_line1, d.address_line2 || null, d.city || null, d.state || null,
       d.postal_code || null, d.country || null, req.user.id]
    );
    const profileRows = await query("SELECT * FROM sponsor_profiles WHERE user_id = ?", [req.user.id]);
    return res.json({ ok: true, profile: profileRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/me/password", requireAuth, async (req, res) => {
  const schema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const rows = await query(
      "SELECT id, password_hash FROM users WHERE id = ? AND role = ? LIMIT 1",
      [req.user.id, ROLE]
    );
    if (!rows?.length) return res.status(404).json({ error: "User not found" });

    if (!await verifyPassword(parsed.data.currentPassword, rows[0].password_hash))
      return res.status(401).json({ error: "Invalid current password" });
    if (await verifyPassword(parsed.data.newPassword, rows[0].password_hash))
      return res.status(400).json({ error: "New password must be different from current password" });

    await exec("UPDATE users SET password_hash = ? WHERE id = ? AND role = ?",
      [await hashPassword(parsed.data.newPassword), req.user.id, ROLE]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Ads ──────────────────────────────────────────────────────────────────────

app.get("/ads", requireAuth, async (req, res) => {
  try {
    const ads = await query(
      "SELECT id, title, description, requirements, benefits, created_at FROM ads WHERE sponsor_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    return res.json({ ads: ads || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/ads", requireAuth, async (req, res) => {
  const schema = z.object({
    title: z.string().min(1).max(255),
    description: z.string().min(1),
    requirements: z.string().optional().default(""),
    benefits: z.string().optional().default(""),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const result = await exec(
      "INSERT INTO ads (sponsor_id, title, description, requirements, benefits) VALUES (?, ?, ?, ?, ?)",
      [req.user.id, parsed.data.title, parsed.data.description, parsed.data.requirements, parsed.data.benefits]
    );
    const rows = await query("SELECT * FROM ads WHERE id = ?", [result.insertId]);
    return res.status(201).json({ ok: true, ad: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.delete("/ads/:adId", requireAuth, async (req, res) => {
  const adId = toInt(req.params.adId);
  if (!Number.isFinite(adId)) return res.status(400).json({ error: "Invalid adId" });
  try {
    const rows = await query(
      "SELECT id FROM ads WHERE id = ? AND sponsor_id = ? LIMIT 1",
      [adId, req.user.id]
    );
    if (!rows?.length) return res.status(404).json({ error: "Ad not found" });
    await exec("DELETE FROM ads WHERE id = ? AND sponsor_id = ?", [adId, req.user.id]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Applications ─────────────────────────────────────────────────────────────

app.get("/applications", requireAuth, async (req, res) => {
  try {
    const applications = await query(
      `SELECT a.id, a.driver_id, a.ad_id, a.status, a.applied_at, a.reviewed_at, a.notes,
         u.email AS driver_email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
         dp.phone, dp.dob, ad.title AS ad_title
       FROM applications a
       JOIN users u ON a.driver_id = u.id
       LEFT JOIN driver_profiles dp ON a.driver_id = dp.user_id
       LEFT JOIN ads ad ON a.ad_id = ad.id
       WHERE a.sponsor_id = ?
       ORDER BY a.applied_at DESC`,
      [req.user.id]
    );
    return res.json({ applications: applications || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/applications/:applicationId", requireAuth, async (req, res) => {
  const schema = z.object({
    status: z.enum(["approved", "accepted", "rejected", "cancelled"]),
    notes: z.string().optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const dbStatus = parsed.data.status === "approved" ? "accepted" : parsed.data.status;

  try {
    const existing = await query(
      "SELECT id, driver_id FROM applications WHERE id = ? AND sponsor_id = ? LIMIT 1",
      [req.params.applicationId, req.user.id]
    );
    if (!existing?.length) return res.status(404).json({ error: "Application not found" });

    const driverId = existing[0].driver_id;
    await exec(
      "UPDATE applications SET status = ?, notes = ?, reviewed_at = NOW(), reviewed_by = ? WHERE id = ? AND sponsor_id = ?",
      [dbStatus, parsed.data.notes || null, req.user.id, req.params.applicationId, req.user.id]
    );

    if (dbStatus === "accepted" && Number.isFinite(driverId)) {
      const sponsorCompany = await getSponsorCompanyName(req.user.id);
      if (sponsorCompany) {
        await exec(
          "INSERT INTO driver_profiles (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id",
          [driverId]
        );
        await exec("UPDATE driver_profiles SET sponsor_org = ? WHERE user_id = ?", [sponsorCompany, driverId]);
      }
    }

    if (dbStatus === "cancelled" || dbStatus === "rejected") {
      const sponsorCompany = await getSponsorCompanyName(req.user.id);
      if (sponsorCompany) {
        await exec(
          "UPDATE driver_profiles SET sponsor_org = NULL WHERE user_id = ? AND sponsor_org = ?",
          [driverId, sponsorCompany]
        );
      }
    }

    const updated = await query("SELECT * FROM applications WHERE id = ?", [req.params.applicationId]);
    return res.json({ ok: true, application: updated[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Drivers ──────────────────────────────────────────────────────────────────

app.get("/drivers", requireAuth, async (req, res) => {
  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany)
      return res.status(400).json({ error: "Your organization name is not set. Please update your account details." });

    const rows = await query(
      `SELECT u.id, u.email, dp.first_name, dp.last_name, dp.dob, dp.phone,
         dp.address_line1, dp.address_line2, dp.city, dp.state, dp.postal_code, dp.country,
         dp.sponsor_org, COALESCE(SUM(l.delta), 0) AS points_balance
       FROM users u
       JOIN driver_profiles dp ON u.id = dp.user_id
       LEFT JOIN driver_points_ledger l ON l.driver_id = u.id
       WHERE u.role = 'driver'
         AND (
           dp.sponsor_org = ?
           OR EXISTS (
             SELECT 1 FROM applications a
             WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'
           )
         )
       GROUP BY u.id
       ORDER BY dp.last_name ASC, dp.first_name ASC, u.email ASC`,
      [sponsorCompany, req.user.id]
    );
    return res.json({
      drivers: (rows || []).map(r => ({ ...r, pointsBalance: Number(r.points_balance || 0) })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// FIX #5: ledger now shows ALL sponsors' entries (not just this one) so balance matches
app.get("/drivers/:driverId/points", requireAuth, async (req, res) => {
  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: "Invalid driverId" });

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany)
      return res.status(400).json({ error: "Sponsor company_name is not set. Update your profile first." });

    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;

    // Full ledger (all sponsors) so balance matches displayed total
    const ledger = await query(
      `SELECT dpl.id, dpl.driver_id, dpl.sponsor_id, dpl.delta, dpl.reason, dpl.created_at,
              sp.company_name AS sponsor_company
       FROM driver_points_ledger dpl
       LEFT JOIN sponsor_profiles sp ON dpl.sponsor_id = sp.user_id
       WHERE dpl.driver_id = ?
       ORDER BY dpl.created_at DESC, dpl.id DESC`,
      [driverId]
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

// Bulk operations must be defined BEFORE /:driverId routes

app.post("/drivers/bulk/points/add", requireAuth, async (req, res) => {
  const schema = z.object({
    driverIds: z.array(z.coerce.number().int().positive()).min(1),
    points: z.coerce.number().int().positive(),
    reason: z.string().min(1).max(255),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });

    const results = [];
    for (const driverId of parsed.data.driverIds) {
      const memberRows = await query(
        `SELECT u.id FROM users u JOIN driver_profiles dp ON u.id = dp.user_id
         WHERE u.role = 'driver' AND u.id = ?
           AND (dp.sponsor_org = ? OR EXISTS (
             SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'
           )) LIMIT 1`,
        [driverId, sponsorCompany, req.user.id]
      );
      if (!memberRows?.length) { results.push({ driverId, ok: false, error: "Not in your program" }); continue; }
      await exec(
        "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
        [driverId, req.user.id, parsed.data.points, parsed.data.reason]
      );
      results.push({ driverId, ok: true, delta: parsed.data.points });
    }
    // Log to org activity log
    const successIds = results.filter(r => r.ok).map(r => r.driverId);
    if (successIds.length) {
      const sp = (await query("SELECT org_id FROM sponsor_profiles WHERE user_id = ? LIMIT 1", [req.user.id]))?.[0];
      if (sp?.org_id) {
        logAction(sp.org_id, req.user.id, 'add_points', null,
          `Added ${parsed.data.points} points to ${successIds.length} driver(s) [${successIds.join(', ')}]: ${parsed.data.reason}`);
      }
    }
    return res.json({ ok: true, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/drivers/bulk/points/deduct", requireAuth, async (req, res) => {
  const schema = z.object({
    driverIds: z.array(z.coerce.number().int().positive()).min(1),
    points: z.coerce.number().int().positive(),
    reason: z.string().min(1).max(255),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });

    const delta = -Math.abs(parsed.data.points);
    const results = [];
    for (const driverId of parsed.data.driverIds) {
      const memberRows = await query(
        `SELECT u.id FROM users u JOIN driver_profiles dp ON u.id = dp.user_id
         WHERE u.role = 'driver' AND u.id = ?
           AND (dp.sponsor_org = ? OR EXISTS (
             SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'
           )) LIMIT 1`,
        [driverId, sponsorCompany, req.user.id]
      );
      if (!memberRows?.length) { results.push({ driverId, ok: false, error: "Not in your program" }); continue; }
      await exec(
        "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
        [driverId, req.user.id, delta, parsed.data.reason]
      );
      results.push({ driverId, ok: true, delta });
    }
    // Log to org activity log
    const successIds = results.filter(r => r.ok).map(r => r.driverId);
    if (successIds.length) {
      const sp = (await query("SELECT org_id FROM sponsor_profiles WHERE user_id = ? LIMIT 1", [req.user.id]))?.[0];
      if (sp?.org_id) {
        logAction(sp.org_id, req.user.id, 'deduct_points', null,
          `Deducted ${parsed.data.points} points from ${successIds.length} driver(s) [${successIds.join(', ')}]: ${parsed.data.reason}`);
      }
    }
    return res.json({ ok: true, results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/drivers/:driverId/points/add", requireAuth, async (req, res) => {
  const schema = z.object({ points: z.coerce.number().int().positive(), reason: z.string().min(1).max(255) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: "Invalid driverId" });

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });
    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;
    await exec(
      "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
      [driverId, req.user.id, parsed.data.points, parsed.data.reason]
    );
    // Log to org activity log
    const sp = (await query("SELECT org_id FROM sponsor_profiles WHERE user_id = ? LIMIT 1", [req.user.id]))?.[0];
    if (sp?.org_id) {
      logAction(sp.org_id, req.user.id, 'add_points', driverId,
        `Added ${parsed.data.points} points to driver #${driverId}: ${parsed.data.reason}`);
    }
    return res.json({ ok: true, driverId, delta: parsed.data.points, balance: await getDriverPointsBalance(driverId) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/drivers/:driverId/points/deduct", requireAuth, async (req, res) => {
  const schema = z.object({ points: z.coerce.number().int().positive(), reason: z.string().min(1).max(255) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: "Invalid driverId" });

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });
    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;
    const delta = -Math.abs(parsed.data.points);
    await exec(
      "INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)",
      [driverId, req.user.id, delta, parsed.data.reason]
    );
    // Log to org activity log
    const sp = (await query("SELECT org_id FROM sponsor_profiles WHERE user_id = ? LIMIT 1", [req.user.id]))?.[0];
    if (sp?.org_id) {
      logAction(sp.org_id, req.user.id, 'deduct_points', driverId,
        `Deducted ${Math.abs(delta)} points from driver #${driverId}: ${parsed.data.reason}`);
    }
    return res.json({ ok: true, driverId, delta, balance: await getDriverPointsBalance(driverId) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// FIX #6: status changed from 'removed' → 'cancelled' to avoid CHECK constraint error
app.delete("/drivers/:driverId", requireAuth, async (req, res) => {
  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: "Invalid driverId" });

  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });
    const driver = await driverBelongsToSponsorOr404(res, req.user.id, sponsorCompany, driverId);
    if (!driver) return;

    await exec(
      "UPDATE driver_profiles SET sponsor_org = NULL WHERE user_id = ? AND sponsor_org = ?",
      [driverId, sponsorCompany]
    );
    // FIX #6: was 'removed' which violates the CHECK constraint — use 'cancelled'
    await exec(
      `UPDATE applications SET status = 'cancelled', reviewed_at = NOW(), reviewed_by = ?
       WHERE driver_id = ? AND sponsor_id = ? AND status = 'accepted'`,
      [req.user.id, driverId, req.user.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Messages ─────────────────────────────────────────────────────────────────

app.get("/messages", requireAuth, async (req, res) => {
  try {
    const sponsorId = req.user.id;
    const directRows = await query(
      `SELECT DISTINCT u.id AS driver_id, u.email AS driver_email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name
       FROM messages m
       JOIN users u ON (
         (m.sender_id = u.id AND m.recipient_id = ?)
         OR (m.recipient_id = u.id AND m.sender_id = ?)
       )
       JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE m.sponsor_id = ? AND u.role = 'driver'`,
      [sponsorId, sponsorId, sponsorId]
    );

    const broadcastDriverRows = await query(
      `SELECT DISTINCT u.id AS driver_id, u.email AS driver_email,
         TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name
       FROM users u
       JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE u.role = 'driver'
         AND EXISTS (SELECT 1 FROM messages m WHERE m.is_broadcast = 1 AND m.sponsor_id = ?)
         AND (
           dp.sponsor_org = (SELECT company_name FROM sponsor_profiles WHERE user_id = ?)
           OR EXISTS (
             SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'
           )
         )`,
      [sponsorId, sponsorId, sponsorId]
    );

    const driverMap = new Map();
    for (const r of [...directRows, ...broadcastDriverRows]) {
      if (!driverMap.has(r.driver_id)) driverMap.set(r.driver_id, r);
    }

    const conversations = await Promise.all(
      Array.from(driverMap.values()).map(async (d) => {
        const lastMsgRows = await query(
          `SELECT body, created_at FROM messages
           WHERE sponsor_id = ?
             AND ((sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?) OR (is_broadcast = 1 AND sender_id = ?))
           ORDER BY created_at DESC LIMIT 1`,
          [sponsorId, sponsorId, d.driver_id, d.driver_id, sponsorId, sponsorId]
        );
        const unreadRows = await query(
          `SELECT COUNT(*) AS cnt FROM messages m
           WHERE m.sponsor_id = ? AND m.sender_id = ? AND m.recipient_id = ?
             AND NOT EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?)`,
          [sponsorId, d.driver_id, sponsorId, sponsorId]
        );
        return {
          driverId: d.driver_id,
          driverEmail: d.driver_email,
          driverName: d.driver_name?.trim() || d.driver_email,
          unreadCount: Number(unreadRows[0]?.cnt || 0),
          lastMessage: lastMsgRows[0]?.body?.substring(0, 120) || null,
          lastAt: lastMsgRows[0]?.created_at || null,
        };
      })
    );

    conversations.sort((a, b) => (b.lastAt || 0) > (a.lastAt || 0) ? 1 : -1);
    return res.json({ conversations });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.get("/messages/driver/:driverId", requireAuth, async (req, res) => {
  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: "Invalid driverId" });

  const sponsorId = req.user.id;
  try {
    const driverRows = await query(
      `SELECT u.id, u.email, TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS name
       FROM users u JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE u.id = ? AND u.role = 'driver' LIMIT 1`,
      [driverId]
    );
    if (!driverRows?.length) return res.status(404).json({ error: "Driver not found" });

    const messages = await query(
      `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.is_broadcast, m.created_at,
              EXISTS (SELECT 1 FROM message_reads mr WHERE mr.message_id = m.id AND mr.user_id = ?) AS is_read
       FROM messages m
       WHERE m.sponsor_id = ?
         AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?) OR (m.is_broadcast = 1 AND m.sender_id = ?))
       ORDER BY m.created_at ASC`,
      [sponsorId, sponsorId, sponsorId, driverId, driverId, sponsorId, sponsorId]
    );

    const unreadIds = messages
      .filter(m => m.sender_id === driverId && m.recipient_id === sponsorId && !m.is_read)
      .map(m => m.id);
    for (const msgId of unreadIds) {
      await exec(
        "INSERT INTO message_reads (message_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE read_at = NOW()",
        [msgId, sponsorId]
      );
    }

    const driver = driverRows[0];
    return res.json({
      messages: messages.map(m => ({ ...m, is_read: Boolean(m.is_read) })),
      driver: { id: driver.id, email: driver.email, name: driver.name?.trim() || driver.email },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/messages/driver/:driverId", requireAuth, async (req, res) => {
  const driverId = toInt(req.params.driverId);
  if (!Number.isFinite(driverId)) return res.status(400).json({ error: "Invalid driverId" });

  const schema = z.object({ body: z.string().min(1).max(5000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const sponsorId = req.user.id;
  try {
    const sponsorCompany = await getSponsorCompanyName(sponsorId);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });
    const driver = await driverBelongsToSponsorOr404(res, sponsorId, sponsorCompany, driverId);
    if (!driver) return;

    const result = await exec(
      "INSERT INTO messages (sender_id, recipient_id, sponsor_id, body, is_broadcast) VALUES (?, ?, ?, ?, 0)",
      [sponsorId, driverId, sponsorId, parsed.data.body]
    );
    const rows = await query("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    return res.status(201).json({ ok: true, message: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/messages/broadcast", requireAuth, async (req, res) => {
  const schema = z.object({ body: z.string().min(1).max(5000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const sponsorId = req.user.id;
  try {
    const sponsorCompany = await getSponsorCompanyName(sponsorId);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });
    const result = await exec(
      "INSERT INTO messages (sender_id, recipient_id, sponsor_id, body, is_broadcast) VALUES (?, NULL, ?, ?, 1)",
      [sponsorId, sponsorId, parsed.data.body]
    );
    const rows = await query("SELECT * FROM messages WHERE id = ?", [result.insertId]);
    return res.status(201).json({ ok: true, message: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/messages/:messageId/read", requireAuth, async (req, res) => {
  const messageId = toInt(req.params.messageId);
  if (!Number.isFinite(messageId)) return res.status(400).json({ error: "Invalid messageId" });
  try {
    await exec(
      "INSERT INTO message_reads (message_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE read_at = NOW()",
      [messageId, req.user.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Scheduled Awards ─────────────────────────────────────────────────────────

app.get("/scheduled-awards", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      `SELECT sa.*,
         CASE WHEN sa.driver_id IS NULL THEN 'All Drivers'
              ELSE TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,'')))
         END AS driver_name,
         u.email AS driver_email
       FROM scheduled_point_awards sa
       LEFT JOIN driver_profiles dp ON sa.driver_id = dp.user_id
       LEFT JOIN users u ON sa.driver_id = u.id
       WHERE sa.sponsor_id = ? ORDER BY sa.scheduled_date ASC`,
      [req.user.id]
    );
    return res.json({ awards: rows || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.post("/scheduled-awards", requireAuth, async (req, res) => {
  const schema = z.object({
    driverId: z.coerce.number().int().positive().optional().nullable(),
    points: z.coerce.number().int().positive(),
    reason: z.string().min(1).max(255),
    frequency: z.enum(["once", "daily", "weekly", "monthly"]).optional().default("once"),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    isRecurring: z.boolean().optional().default(false),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });

  const { driverId, points, reason, frequency, scheduledDate, isRecurring } = parsed.data;
  try {
    const result = await exec(
      "INSERT INTO scheduled_point_awards (sponsor_id, driver_id, points, reason, frequency, scheduled_date, is_recurring) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [req.user.id, driverId || null, points, reason, frequency, scheduledDate, isRecurring ? 1 : 0]
    );
    const rows = await query("SELECT * FROM scheduled_point_awards WHERE id = ?", [result.insertId]);
    return res.status(201).json({ ok: true, award: rows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

app.put("/scheduled-awards/:awardId/pause", requireAuth, async (req, res) => {
  const awardId = toInt(req.params.awardId);
  if (!Number.isFinite(awardId)) return res.status(400).json({ error: "Invalid awardId" });
  try {
    const rows = await query("SELECT id FROM scheduled_point_awards WHERE id = ? AND sponsor_id = ? LIMIT 1", [awardId, req.user.id]);
    if (!rows?.length) return res.status(404).json({ error: "Award not found" });
    await exec("UPDATE scheduled_point_awards SET is_paused = 1 WHERE id = ?", [awardId]);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

app.put("/scheduled-awards/:awardId/resume", requireAuth, async (req, res) => {
  const awardId = toInt(req.params.awardId);
  if (!Number.isFinite(awardId)) return res.status(400).json({ error: "Invalid awardId" });
  try {
    const rows = await query("SELECT id FROM scheduled_point_awards WHERE id = ? AND sponsor_id = ? LIMIT 1", [awardId, req.user.id]);
    if (!rows?.length) return res.status(404).json({ error: "Award not found" });
    await exec("UPDATE scheduled_point_awards SET is_paused = 0 WHERE id = ?", [awardId]);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

app.delete("/scheduled-awards/:awardId", requireAuth, async (req, res) => {
  const awardId = toInt(req.params.awardId);
  if (!Number.isFinite(awardId)) return res.status(400).json({ error: "Invalid awardId" });
  try {
    const rows = await query("SELECT id FROM scheduled_point_awards WHERE id = ? AND sponsor_id = ? LIMIT 1", [awardId, req.user.id]);
    if (!rows?.length) return res.status(404).json({ error: "Award not found" });
    await exec("DELETE FROM scheduled_point_awards WHERE id = ?", [awardId]);
    return res.json({ ok: true });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

// ─── Point Expiration ─────────────────────────────────────────────────────────

app.get("/point-expiration", requireAuth, async (req, res) => {
  try {
    const rows = await query("SELECT * FROM point_expiration_rules WHERE sponsor_id = ? LIMIT 1", [req.user.id]);
    return res.json({ rule: rows?.[0] || null });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

app.put("/point-expiration", requireAuth, async (req, res) => {
  const schema = z.object({ expiryDays: z.coerce.number().int().positive(), isActive: z.boolean().optional().default(true) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  try {
    await exec(
      "INSERT INTO point_expiration_rules (sponsor_id, expiry_days, is_active) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expiry_days = VALUES(expiry_days), is_active = VALUES(is_active)",
      [req.user.id, parsed.data.expiryDays, parsed.data.isActive ? 1 : 0]
    );
    const rows = await query("SELECT * FROM point_expiration_rules WHERE sponsor_id = ? LIMIT 1", [req.user.id]);
    return res.json({ ok: true, rule: rows[0] });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

// ─── Conversion Rate ──────────────────────────────────────────────────────────

app.get("/conversion-rate", requireAuth, async (req, res) => {
  try {
    const rows = await query(
      "SELECT * FROM sponsor_conversion_rates WHERE sponsor_id = ? LIMIT 1",
      [req.user.id]
    );
    return res.json({ rate: rows?.[0] || null });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

app.put("/conversion-rate", requireAuth, async (req, res) => {
  const schema = z.object({ dollarsPerPoint: z.coerce.number().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  }
  try {
    await exec(
      `INSERT INTO sponsor_conversion_rates (sponsor_id, dollars_per_point)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE dollars_per_point = VALUES(dollars_per_point)`,
      [req.user.id, parsed.data.dollarsPerPoint]
    );
    const rows = await query(
      "SELECT * FROM sponsor_conversion_rates WHERE sponsor_id = ? LIMIT 1",
      [req.user.id]
    );
    return res.json({ ok: true, rate: rows[0] });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

// ─── Analytics ────────────────────────────────────────────────────────────────

app.get("/analytics/points", requireAuth, async (req, res) => {
  try {
    const sponsorCompany = await getSponsorCompanyName(req.user.id);
    if (!sponsorCompany) return res.status(400).json({ error: "Sponsor company_name is not set." });

    const [unredeemedRows, awardedRows, redeemedRows, driverBreakdown] = await Promise.all([
      query(
        `SELECT COALESCE(SUM(l.delta), 0) AS total_unredeemed
         FROM driver_points_ledger l JOIN users u ON l.driver_id = u.id JOIN driver_profiles dp ON u.id = dp.user_id
         WHERE l.sponsor_id = ?
           AND (dp.sponsor_org = ? OR EXISTS (SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'))`,
        [req.user.id, sponsorCompany, req.user.id]
      ),
      query(
        `SELECT COALESCE(SUM(l.delta), 0) AS total_awarded FROM driver_points_ledger l
         WHERE l.sponsor_id = ? AND l.delta > 0 AND MONTH(l.created_at) = MONTH(CURRENT_DATE()) AND YEAR(l.created_at) = YEAR(CURRENT_DATE())`,
        [req.user.id]
      ),
      query(
        `SELECT COALESCE(ABS(SUM(l.delta)), 0) AS total_redeemed FROM driver_points_ledger l
         WHERE l.sponsor_id = ? AND l.delta < 0 AND MONTH(l.created_at) = MONTH(CURRENT_DATE()) AND YEAR(l.created_at) = YEAR(CURRENT_DATE())`,
        [req.user.id]
      ),
      query(
        `SELECT l.driver_id, TRIM(CONCAT(COALESCE(dp.first_name,''), ' ', COALESCE(dp.last_name,''))) AS driver_name,
                u.email AS driver_email, COALESCE(SUM(l.delta), 0) AS balance
         FROM driver_points_ledger l JOIN users u ON l.driver_id = u.id JOIN driver_profiles dp ON u.id = dp.user_id
         WHERE l.sponsor_id = ?
           AND (dp.sponsor_org = ? OR EXISTS (SELECT 1 FROM applications a WHERE a.driver_id = u.id AND a.sponsor_id = ? AND a.status = 'accepted'))
         GROUP BY l.driver_id HAVING balance > 0 ORDER BY balance DESC`,
        [req.user.id, sponsorCompany, req.user.id]
      ),
    ]);

    return res.json({
      totalUnredeemed: Number(unredeemedRows[0]?.total_unredeemed || 0),
      totalAwardedThisMonth: Number(awardedRows[0]?.total_awarded || 0),
      totalRedeemedThisMonth: Number(redeemedRows[0]?.total_redeemed || 0),
      driverBreakdown: driverBreakdown || [],
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ─── Sprint Info ──────────────────────────────────────────────────────────────

app.get("/sprint-info", async (_req, res) => {
  try {
    const rows = await query("SELECT * FROM sprint_info WHERE id = 1 LIMIT 1", []);
    return res.json(rows?.[0] || null);
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

// ─── Language ─────────────────────────────────────────────────────────────────

app.get("/me/language", requireAuth, async (req, res) => {
  try {
    const rows = await query("SELECT preferred_language FROM users WHERE id = ? LIMIT 1", [req.user.id]);
    return res.json({ language: rows?.[0]?.preferred_language || "en" });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

app.put("/me/language", requireAuth, async (req, res) => {
  const schema = z.object({ language: z.string().min(2).max(10) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input", details: parsed.error.flatten() });
  try {
    await exec("UPDATE users SET preferred_language = ? WHERE id = ?", [parsed.data.language, req.user.id]);
    return res.json({ ok: true, language: parsed.data.language });
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});

// ─── External routes ──────────────────────────────────────────────────────────

const fakestoreRoutes = require("../../../routes/sponsor/fakestore");
const sponsorCatalogRoutes = require("../../../routes/sponsor/catalog");
app.use("/fakestore", requireAuth, fakestoreRoutes);
app.use("/catalog", requireAuth, sponsorCatalogRoutes);

// ============================================================
// ORGANIZATION MANAGEMENT
// ============================================================

/**
 * Helper: get or auto-create the sponsor's organization from their company_name.
 * Returns { org, sponsorProfile } or null (sends error response).
 */
async function getOrCreateOrg(sponsorId, res) {
  const profileRows = await query(
    "SELECT * FROM sponsor_profiles WHERE user_id = ? LIMIT 1",
    [sponsorId]
  );
  const profile = profileRows?.[0];
  if (!profile || !profile.company_name || !profile.company_name.trim()) {
    res.status(400).json({ error: "Your company name is not set. Update your profile first." });
    return null;
  }

  const companyName = profile.company_name.trim();

  // Auto-create org if it doesn't exist
  if (!profile.org_id) {
    await exec(
      "INSERT IGNORE INTO sponsor_organizations (name) VALUES (?)",
      [companyName]
    );
    const orgRows = await query(
      "SELECT id FROM sponsor_organizations WHERE name = ? LIMIT 1",
      [companyName]
    );
    const orgId = orgRows?.[0]?.id;
    if (orgId) {
      // Check if anyone else is already owner
      const existingOwner = await query(
        "SELECT user_id FROM sponsor_profiles WHERE org_id = ? AND sponsor_role = 'owner' LIMIT 1",
        [orgId]
      );
      const role = (!existingOwner || existingOwner.length === 0) ? 'owner' : (profile.sponsor_role || 'member');
      await exec(
        "UPDATE sponsor_profiles SET org_id = ?, sponsor_role = ? WHERE user_id = ?",
        [orgId, role, sponsorId]
      );
    }
  }

  // Re-fetch
  const updatedProfile = await query("SELECT * FROM sponsor_profiles WHERE user_id = ? LIMIT 1", [sponsorId]);
  const sp = updatedProfile?.[0];
  if (!sp?.org_id) {
    res.status(500).json({ error: "Failed to resolve organization." });
    return null;
  }

  const orgRows = await query("SELECT * FROM sponsor_organizations WHERE id = ? LIMIT 1", [sp.org_id]);
  return { org: orgRows?.[0], sponsorProfile: sp };
}

/** Helper: log a sponsor action */
async function logAction(orgId, sponsorId, action, targetUserId, details) {
  try {
    await exec(
      "INSERT INTO sponsor_action_log (org_id, sponsor_id, action, target_user_id, details) VALUES (?, ?, ?, ?, ?)",
      [orgId, sponsorId, action, targetUserId || null, details || null]
    );
  } catch { /* non-critical */ }
}

/** Helper: require owner or admin role */
function requireOrgRole(sponsorProfile, res, allowedRoles) {
  if (!allowedRoles.includes(sponsorProfile.sponsor_role)) {
    res.status(403).json({ error: "You do not have permission for this action. Required role: " + allowedRoles.join(" or ") });
    return false;
  }
  return true;
}

// ── View organization profile (#2980, #2990) ──

app.get('/organization', requireAuth, async (req, res) => {
  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;

    return res.json({
      organization: result.org,
      myRole: result.sponsorProfile.sponsor_role,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Update organization info (#2981) ──

app.put('/organization', requireAuth, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
    phone: z.string().max(50).optional(),
    address_line1: z.string().max(255).optional(),
    address_line2: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const d = parsed.data;
    await exec(
      `UPDATE sponsor_organizations
       SET name = COALESCE(?, name),
           description = COALESCE(?, description),
           phone = COALESCE(?, phone),
           address_line1 = COALESCE(?, address_line1),
           address_line2 = COALESCE(?, address_line2),
           city = COALESCE(?, city),
           state = COALESCE(?, state),
           postal_code = COALESCE(?, postal_code),
           country = COALESCE(?, country)
       WHERE id = ?`,
      [d.name || null, d.description || null, d.phone || null,
       d.address_line1 || null, d.address_line2 || null,
       d.city || null, d.state || null, d.postal_code || null, d.country || null,
       result.org.id]
    );

    // If org name changed, also update company_name on all sponsor_profiles in this org
    if (d.name && d.name !== result.org.name) {
      await exec(
        "UPDATE sponsor_profiles SET company_name = ? WHERE org_id = ?",
        [d.name, result.org.id]
      );
    }

    await logAction(result.org.id, req.user.id, 'update_organization', null, JSON.stringify(d));

    const orgRows = await query("SELECT * FROM sponsor_organizations WHERE id = ? LIMIT 1", [result.org.id]);
    return res.json({ ok: true, organization: orgRows[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── List all sponsor users in org (#2985) ──

app.get('/organization/users', requireAuth, async (req, res) => {
  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;

    const users = await query(
      `SELECT u.id, u.email, u.created_at, u.last_login_at,
              sp.first_name, sp.last_name, sp.phone, sp.sponsor_role, sp.is_active
       FROM users u
       JOIN sponsor_profiles sp ON u.id = sp.user_id
       WHERE sp.org_id = ?
       ORDER BY sp.sponsor_role ASC, u.email ASC`,
      [result.org.id]
    );

    return res.json({ users: users || [], myRole: result.sponsorProfile.sponsor_role });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Create additional sponsor user (#2982) ──

app.post('/organization/users', requireAuth, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    role: z.enum(['admin', 'member']).optional().default('member'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const { email, password, firstName, lastName, role } = parsed.data;
    const password_hash = await hashPassword(password);

    const userInsert = await exec(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'sponsor')",
      [email.toLowerCase(), password_hash]
    );
    const newUserId = userInsert.insertId;

    await exec(
      `INSERT INTO sponsor_profiles (user_id, first_name, last_name, company_name, org_id, sponsor_role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 1)`,
      [newUserId, firstName || null, lastName || null, result.org.name, result.org.id, role]
    );

    await logAction(result.org.id, req.user.id, 'create_sponsor_user', newUserId,
      `Created user ${email} with role ${role}`);

    return res.status(201).json({ ok: true, userId: newUserId });
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY' || String(err?.message || '').includes('Duplicate')) {
      return res.status(409).json({ error: 'Email already in use' });
    }
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Add existing sponsor account to organization ──

app.post('/organization/users/invite', requireAuth, async (req, res) => {
  const schema = z.object({
    email: z.string().email(),
    role: z.enum(['admin', 'member']).optional().default('member'),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const { email, role } = parsed.data;

    // Find the existing sponsor account
    const userRows = await query(
      "SELECT u.id, u.email FROM users u WHERE u.email = ? AND u.role = 'sponsor' LIMIT 1",
      [email.toLowerCase()]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ error: 'No sponsor account found with that email.' });
    }

    const targetId = userRows[0].id;

    // Check they aren't already in this org
    const existingProfile = await query(
      "SELECT user_id, org_id FROM sponsor_profiles WHERE user_id = ? LIMIT 1",
      [targetId]
    );
    if (existingProfile?.[0]?.org_id === result.org.id) {
      return res.status(409).json({ error: 'This user is already in your organization.' });
    }
    if (existingProfile?.[0]?.org_id && existingProfile[0].org_id !== result.org.id) {
      return res.status(409).json({ error: 'This user already belongs to another organization.' });
    }

    // Add them to the org
    await exec(
      "UPDATE sponsor_profiles SET org_id = ?, company_name = ?, sponsor_role = ?, is_active = 1 WHERE user_id = ?",
      [result.org.id, result.org.name, role, targetId]
    );

    await logAction(result.org.id, req.user.id, 'invite_existing_user', targetId,
      `Added existing sponsor ${email} as ${role}`);

    return res.json({ ok: true, userId: targetId, email: userRows[0].email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Assign role to sponsor user (#2983) ──

app.put('/organization/users/:userId/role', requireAuth, async (req, res) => {
  const schema = z.object({ role: z.enum(['admin', 'member']) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });

  const targetId = toInt(req.params.userId);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner'])) return;

    // Verify target is in same org
    const targetRows = await query(
      "SELECT user_id, sponsor_role FROM sponsor_profiles WHERE user_id = ? AND org_id = ? LIMIT 1",
      [targetId, result.org.id]
    );
    if (!targetRows || targetRows.length === 0) return res.status(404).json({ error: 'User not found in your organization' });
    if (targetRows[0].sponsor_role === 'owner') return res.status(400).json({ error: 'Cannot change the owner role' });

    await exec("UPDATE sponsor_profiles SET sponsor_role = ? WHERE user_id = ?", [parsed.data.role, targetId]);
    await logAction(result.org.id, req.user.id, 'change_role', targetId, `Changed role to ${parsed.data.role}`);

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Deactivate sponsor user (#2984) ──

app.put('/organization/users/:userId/deactivate', requireAuth, async (req, res) => {
  const targetId = toInt(req.params.userId);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const targetRows = await query(
      "SELECT user_id, sponsor_role FROM sponsor_profiles WHERE user_id = ? AND org_id = ? LIMIT 1",
      [targetId, result.org.id]
    );
    if (!targetRows || targetRows.length === 0) return res.status(404).json({ error: 'User not found in your organization' });
    if (targetRows[0].sponsor_role === 'owner') return res.status(400).json({ error: 'Cannot deactivate the owner' });
    if (targetId === req.user.id) return res.status(400).json({ error: 'Cannot deactivate yourself' });

    await exec("UPDATE sponsor_profiles SET is_active = 0 WHERE user_id = ?", [targetId]);
    await logAction(result.org.id, req.user.id, 'deactivate_user', targetId, 'Deactivated user');

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Reactivate sponsor user ──

app.put('/organization/users/:userId/activate', requireAuth, async (req, res) => {
  const targetId = toInt(req.params.userId);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const targetRows = await query(
      "SELECT user_id FROM sponsor_profiles WHERE user_id = ? AND org_id = ? LIMIT 1",
      [targetId, result.org.id]
    );
    if (!targetRows || targetRows.length === 0) return res.status(404).json({ error: 'User not found in your organization' });

    await exec("UPDATE sponsor_profiles SET is_active = 1 WHERE user_id = ?", [targetId]);
    await logAction(result.org.id, req.user.id, 'activate_user', targetId, 'Reactivated user');

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Edit another sponsor's profile (#2986) ──

app.put('/organization/users/:userId/profile', requireAuth, async (req, res) => {
  const schema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().max(50).optional(),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const targetId = toInt(req.params.userId);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const targetRows = await query(
      "SELECT user_id FROM sponsor_profiles WHERE user_id = ? AND org_id = ? LIMIT 1",
      [targetId, result.org.id]
    );
    if (!targetRows || targetRows.length === 0) return res.status(404).json({ error: 'User not found in your organization' });

    const d = parsed.data;
    await exec(
      `UPDATE sponsor_profiles
       SET first_name = COALESCE(?, first_name),
           last_name  = COALESCE(?, last_name),
           phone      = COALESCE(?, phone)
       WHERE user_id = ?`,
      [d.firstName || null, d.lastName || null, d.phone || null, targetId]
    );

    await logAction(result.org.id, req.user.id, 'edit_profile', targetId, JSON.stringify(d));
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Reset another sponsor's password (#2987) ──

app.post('/organization/users/:userId/reset-password', requireAuth, async (req, res) => {
  const schema = z.object({ newPassword: z.string().min(8) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });

  const targetId = toInt(req.params.userId);
  if (!Number.isFinite(targetId)) return res.status(400).json({ error: 'Invalid userId' });

  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;
    if (!requireOrgRole(result.sponsorProfile, res, ['owner', 'admin'])) return;

    const targetRows = await query(
      "SELECT user_id, sponsor_role FROM sponsor_profiles WHERE user_id = ? AND org_id = ? LIMIT 1",
      [targetId, result.org.id]
    );
    if (!targetRows || targetRows.length === 0) return res.status(404).json({ error: 'User not found in your organization' });

    // Only owner can reset admin passwords; admins can only reset member passwords
    if (result.sponsorProfile.sponsor_role === 'admin' && targetRows[0].sponsor_role !== 'member') {
      return res.status(403).json({ error: 'Admins can only reset member passwords' });
    }

    const newHash = await hashPassword(parsed.data.newPassword);
    await exec("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, targetId]);
    await logAction(result.org.id, req.user.id, 'reset_password', targetId, 'Reset password');

    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── View last login date for sponsor users (#2988) ──
// (Included in GET /organization/users via last_login_at)

// ── View other sponsors' actions / action log (#2989) ──

app.get('/organization/activity-log', requireAuth, async (req, res) => {
  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;

    const logs = await query(
      `SELECT sal.id, sal.action, sal.details, sal.created_at,
              u_actor.email AS actor_email,
              TRIM(CONCAT(COALESCE(sp_actor.first_name,''), ' ', COALESCE(sp_actor.last_name,''))) AS actor_name,
              u_target.email AS target_email,
              COALESCE(
                NULLIF(TRIM(CONCAT(COALESCE(sp_target.first_name,''), ' ', COALESCE(sp_target.last_name,''))), ''),
                NULLIF(TRIM(CONCAT(COALESCE(dp_target.first_name,''), ' ', COALESCE(dp_target.last_name,''))), '')
              ) AS target_name
       FROM sponsor_action_log sal
       JOIN users u_actor ON sal.sponsor_id = u_actor.id
       LEFT JOIN sponsor_profiles sp_actor ON sal.sponsor_id = sp_actor.user_id
       LEFT JOIN users u_target ON sal.target_user_id = u_target.id
       LEFT JOIN sponsor_profiles sp_target ON sal.target_user_id = sp_target.user_id
       LEFT JOIN driver_profiles dp_target ON sal.target_user_id = dp_target.user_id
       WHERE sal.org_id = ?
       ORDER BY sal.created_at DESC
       LIMIT 500`,
      [result.org.id]
    );

    return res.json({ logs: logs || [] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// ── Organization stats: total drivers (#2991), total points (#2992), creation date (#2990) ──

app.get('/organization/stats', requireAuth, async (req, res) => {
  try {
    const result = await getOrCreateOrg(req.user.id, res);
    if (!result) return;

    const sponsorCompany = result.org.name;

    // Total drivers in program
    const driverRows = await query(
      `SELECT COUNT(DISTINCT u.id) AS total_drivers
       FROM users u
       JOIN driver_profiles dp ON u.id = dp.user_id
       WHERE u.role = 'driver'
         AND (
           dp.sponsor_org = ?
           OR EXISTS (
             SELECT 1 FROM applications a
             JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
             WHERE a.driver_id = u.id AND sp.org_id = ? AND a.status = 'accepted'
           )
         )`,
      [sponsorCompany, result.org.id]
    );

    // Total points distributed (all positive deltas from sponsors in this org)
    const pointsRows = await query(
      `SELECT COALESCE(SUM(l.delta), 0) AS total_points_distributed
       FROM driver_points_ledger l
       JOIN sponsor_profiles sp ON l.sponsor_id = sp.user_id
       WHERE sp.org_id = ? AND l.delta > 0`,
      [result.org.id]
    );

    // Total sponsor users
    const sponsorCountRows = await query(
      "SELECT COUNT(*) AS total_sponsors FROM sponsor_profiles WHERE org_id = ?",
      [result.org.id]
    );

    return res.json({
      totalDrivers: Number(driverRows?.[0]?.total_drivers || 0),
      totalPointsDistributed: Number(pointsRows?.[0]?.total_points_distributed || 0),
      totalSponsors: Number(sponsorCountRows?.[0]?.total_sponsors || 0),
      organizationCreatedAt: result.org.created_at,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Server error' });
  }
});


app.listen(PORT, () => {
  console.log(`[sponsor] listening on :${PORT}`);
});