# Sprint Implementation Plan — Catalog & Points Controls
## LLM Execution Guide

---

## 1. Environment & Infrastructure Context

| Property | Value |
|---|---|
| EC2 host | `ip-172-31-30-162` |
| Repo path on EC2 | `/home/ec2-user/S26-CPSC4910-Team17` |
| Database | AWS RDS MySQL (external) |
| Process manager | PM2 |
| Web server | Nginx |
| Sponsor service port | `4003` (PM2 app: `gdip-sponsor`) |
| Driver service port | `4002` (PM2 app: `gdip-driver`) |
| Admin service port | `4001` (PM2 app: `gdip-admin`) |
| Frontend serving path | `/var/www/myapp` (Nginx static root) |
| Frontend build command | `npm run build` (outputs to `frontend/dist/`) |
| Nginx proxy | `/api/sponsor/` → `localhost:4003` with path strip |
| Nginx proxy | `/api/driver/` → `localhost:4002` with path strip |

### Service restart commands (required after any backend change):
```bash
pm2 restart gdip-sponsor
pm2 restart gdip-driver
```

### Frontend deploy after any frontend change:
```bash
cd /home/ec2-user/S26-CPSC4910-Team17/frontend
npm run build
sudo cp -r dist/* /var/www/myapp/
```

### Migration execution (no automated runner; run against RDS manually):
```bash
mysql -h <RDS_ENDPOINT> -u <USER> -p <DB_NAME> < backend/packages/db/migrations/003_catalog_and_conversion.sql
```

---

## 2. Architectural Constraints

- **Do not modify** `backend/utils/fakestoreClient.js` — it already uses `dummyjson.com` (confirmed working). The attached "FakeStoreAPI" docs describe a different provider (`fakestoreapi.com`) that blocked EC2 traffic. DummyJSON is the real provider.
- **Do not modify** `backend/routes/sponsor/fakestore.js` — existing Fake Store search/popular routes are working.
- Driver-side search/filter runs entirely against `catalog_items` rows in RDS — no new external API calls are needed.
- All new SQL must use `CREATE TABLE IF NOT EXISTS`, `IF NOT EXISTS` column checks, or `ON DUPLICATE KEY UPDATE` — the DB is live and migrations must be safely re-runnable.
- The driver's shop page must use the page name `shop` and URL `/shop`, **not** `catalog`. The name `catalog` is already taken by the sponsor catalog management page and is part of `sponsorPages` in `getAllowedPages`.
- The driver Shop page must only appear in `driverPages` inside the `hasSponsor` branch (same gate as `rewards` and `log-trip`).
- New SQL bind parameters must never be `undefined`. Use explicit `null` for optional DB columns.

### Pre-existing bug (do NOT copy this pattern):
The sponsor service `password_reset_tokens` INSERT at `backend/services/sponsor/src/index.js` uses column name `token` but the schema defines `token_hash`. This causes the undefined-bind errors flagged in PM2 logs at lines ~223 and ~277. This is out of scope but worth noting so new code does not repeat the same column-name mismatch.

---

## 3. Files to Create

| # | File | Action |
|---|---|---|
| 1 | `backend/packages/db/migrations/003_catalog_and_conversion.sql` | Create |

## 4. Files to Modify

| # | File | Summary |
|---|---|---|
| 2 | `backend/packages/db/init_gdip_tables.sql` | Add new table + new columns for fresh-env setup |
| 3 | `backend/routes/sponsor/catalog.js` | Extend POST/GET; add PATCH `/:id/availability` |
| 4 | `backend/routes/driver/catalog.js` | Add search/filter, `/categories`, `/:id` endpoints |
| 5 | `backend/services/sponsor/src/index.js` | Add conversion-rate GET/PUT endpoints |
| 6 | `frontend/src/App.jsx` | Routing, nav, PointManagementPage tab, DriverShopPage |

---

## 5. Phase 1 — Database Migration (blocks all other phases)

### 5.1 Create `backend/packages/db/migrations/003_catalog_and_conversion.sql`

Create this file with the following exact content:

```sql
-- Migration: Catalog availability, category, and sponsor conversion rates
-- Sprint S26 features. Run AFTER 002_sponsor_org_management.sql.
-- All statements are safe to re-run (idempotent).

-- ── New table: sponsor_conversion_rates ──────────────────────────────────────
-- One row per sponsor, stores the dollar-to-point conversion reference value.
-- Mirrors the one-row-per-sponsor pattern used by point_expiration_rules.
CREATE TABLE IF NOT EXISTS sponsor_conversion_rates (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id        INT NOT NULL UNIQUE,
  dollars_per_point DECIMAL(10,4) NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scr_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── Extend catalog_items ──────────────────────────────────────────────────────
-- Use stored procedure for IF NOT EXISTS column check (MySQL limitation).
DELIMITER //
CREATE PROCEDURE add_catalog_sprint26_columns()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'catalog_items'
      AND COLUMN_NAME  = 'category'
  ) THEN
    ALTER TABLE catalog_items ADD COLUMN category VARCHAR(100) NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME   = 'catalog_items'
      AND COLUMN_NAME  = 'is_available'
  ) THEN
    ALTER TABLE catalog_items ADD COLUMN is_available TINYINT(1) NOT NULL DEFAULT 1;
  END IF;
END //
DELIMITER ;

CALL add_catalog_sprint26_columns();
DROP PROCEDURE IF EXISTS add_catalog_sprint26_columns;
```

### 5.2 Update `backend/packages/db/init_gdip_tables.sql` (fresh-environment parity)

**Change 1:** Inside the `CREATE TABLE IF NOT EXISTS catalog_items` block, add `category` and `is_available` columns after `point_cost`.

Find this exact block:
```sql
CREATE TABLE IF NOT EXISTS catalog_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id INT NOT NULL,
  external_item_id VARCHAR(100) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  price DECIMAL(10, 2) NOT NULL,
  point_cost INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_catalog_items_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

Replace with:
```sql
CREATE TABLE IF NOT EXISTS catalog_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id INT NOT NULL,
  external_item_id VARCHAR(100) NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NULL,
  image_url VARCHAR(500) NULL,
  price DECIMAL(10, 2) NOT NULL,
  point_cost INT NOT NULL,
  category VARCHAR(100) NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_catalog_items_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;
```

**Change 2:** Add the new `sponsor_conversion_rates` table after the `point_expiration_rules` table block. Insert:
```sql
-- Dollar-to-point conversion rate per sponsor
CREATE TABLE IF NOT EXISTS sponsor_conversion_rates (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  sponsor_id        INT NOT NULL UNIQUE,
  dollars_per_point DECIMAL(10,4) NOT NULL,
  updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_scr_sponsor FOREIGN KEY (sponsor_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

---

## 6. Phase 2 — Sponsor Backend: Catalog Route Extensions

**File:** `backend/routes/sponsor/catalog.js`

### 6.1 Update GET `/` — include new columns

Replace the existing GET `/` handler query:
```js
        const items = await query(
            `SELECT * FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC`,
            [sponsorId]
        );
```
With:
```js
        const items = await query(
            `SELECT id, sponsor_id, external_item_id, title, description, image_url, price, point_cost, category, is_available, created_at
             FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC`,
            [sponsorId]
        );
```

### 6.2 Update POST `/` — accept and persist `category` and `is_available`

After the existing variable declarations (`external_item_id`, `title`, `description`, `image_url`, `rawPrice`, `price`, `point_cost`), add:
```js
        const category = req.body.category || null;
        const is_available = (req.body.isAvailable !== undefined)
            ? (req.body.isAvailable ? 1 : 0)
            : (req.body.is_available !== undefined ? (req.body.is_available ? 1 : 0) : 1);
```

Replace the INSERT statement:
```js
        const result = await exec(
            `INSERT INTO catalog_items 
            (sponsor_id, external_item_id, title, description, image_url, price, point_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sponsorId, external_item_id, title, description, image_url, price !== null ? price : 0, point_cost]
        );
```
With:
```js
        const result = await exec(
            `INSERT INTO catalog_items 
            (sponsor_id, external_item_id, title, description, image_url, price, point_cost, category, is_available) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sponsorId, external_item_id, title, description, image_url, price !== null ? price : 0, point_cost, category, is_available]
        );
```

### 6.3 Add PATCH `/:id/availability` — append before `module.exports`

Add this route before the `module.exports = router;` line:
```js
// PATCH /api/sponsor/catalog/:id/availability - Toggle item availability
router.patch('/:id/availability', async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const itemId = parseInt(req.params.id, 10);
        if (!Number.isFinite(itemId)) {
            return res.status(400).json({ error: 'Invalid item id' });
        }

        const { isAvailable } = req.body;
        if (typeof isAvailable !== 'boolean') {
            return res.status(400).json({ error: 'isAvailable must be a boolean' });
        }

        const result = await exec(
            'UPDATE catalog_items SET is_available = ? WHERE id = ? AND sponsor_id = ?',
            [isAvailable ? 1 : 0, itemId, sponsorId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found or does not belong to you' });
        }

        res.json({ ok: true, isAvailable });
    } catch (err) {
        console.error("PATCH /catalog/:id/availability error:", err);
        res.status(500).json({ error: 'Failed to update availability' });
    }
});
```

---

## 7. Phase 3 — Sponsor Backend: Conversion Rate Endpoints

**File:** `backend/services/sponsor/src/index.js`

Locate the end of the point-expiration block. It ends with:
```js
app.put("/point-expiration", requireAuth, async (req, res) => {
  // ...
  } catch (err) { console.error(err); return res.status(500).json({ error: "Server error" }); }
});
```

Insert the following two endpoints immediately after that closing `});`:

```js
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
```

---

## 8. Phase 4 — Driver Backend: Catalog Route Extensions

**File:** `backend/routes/driver/catalog.js`

Replace the entire file contents with the following. This preserves the original GET `/` logic and adds `/categories` and `/:id`:

```js
const express = require('express');
const router = express.Router();
const db = require('../../packages/db/src/index');

// ── Shared helper: resolve affiliated sponsor for a driver ────────────────────
// Returns sponsor_id (number) or null.
async function getAffiliatedSponsorId(driverId) {
    const rows = await db.query(`
        SELECT u.id as sponsor_id
        FROM users u
        JOIN sponsor_profiles sp ON u.id = sp.user_id
        JOIN driver_profiles dp ON dp.sponsor_org = sp.company_name
        WHERE dp.user_id = ? AND u.role = 'sponsor'

        UNION

        SELECT sponsor_id FROM applications
        WHERE driver_id = ? AND status = 'accepted'

        LIMIT 1
    `, [driverId, driverId]);
    return rows.length > 0 ? rows[0].sponsor_id : null;
}

// GET /api/driver/catalog/categories
// Must be registered BEFORE /:id so Express does not match 'categories' as a numeric id.
router.get('/categories', async (req, res) => {
    try {
        const sponsorId = await getAffiliatedSponsorId(req.user.id);
        if (!sponsorId) return res.json({ categories: [] });

        const rows = await db.query(
            `SELECT DISTINCT category
             FROM catalog_items
             WHERE sponsor_id = ? AND category IS NOT NULL AND category != ''
             ORDER BY category ASC`,
            [sponsorId]
        );
        res.json({ categories: rows.map(r => r.category) });
    } catch (err) {
        console.error("GET /catalog/categories driver error:", err);
        res.status(500).json({ error: 'Failed to load categories' });
    }
});

// GET /api/driver/catalog
// Optional query params: ?search=<text>, ?category=<value>, ?available=1
router.get('/', async (req, res) => {
    try {
        const sponsorId = await getAffiliatedSponsorId(req.user.id);
        if (!sponsorId) return res.json({ items: [] });

        const conditions = ['sponsor_id = ?'];
        const params = [sponsorId];

        if (req.query.search) {
            conditions.push('title LIKE ?');
            params.push(`%${req.query.search}%`);
        }
        if (req.query.category) {
            conditions.push('category = ?');
            params.push(req.query.category);
        }
        if (req.query.available === '1') {
            conditions.push('is_available = 1');
        }

        const items = await db.query(
            `SELECT * FROM catalog_items WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
            params
        );

        res.json({ items: items || [] });
    } catch (err) {
        console.error("GET /catalog driver error:", err);
        res.status(500).json({ error: 'Failed to load driver catalog' });
    }
});

// GET /api/driver/catalog/:id
// Returns a single catalog item only if it belongs to the driver's affiliated sponsor.
router.get('/:id', async (req, res) => {
    try {
        const itemId = parseInt(req.params.id, 10);
        if (!Number.isFinite(itemId)) {
            return res.status(400).json({ error: 'Invalid item id' });
        }

        const sponsorId = await getAffiliatedSponsorId(req.user.id);
        if (!sponsorId) return res.status(404).json({ error: 'Item not found' });

        const rows = await db.query(
            `SELECT * FROM catalog_items WHERE id = ? AND sponsor_id = ? LIMIT 1`,
            [itemId, sponsorId]
        );

        if (!rows || rows.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }

        res.json({ item: rows[0] });
    } catch (err) {
        console.error("GET /catalog/:id driver error:", err);
        res.status(500).json({ error: 'Failed to load item' });
    }
});

module.exports = router;
```

---

## 9. Phase 5 — Frontend: App.jsx Changes

**File:** `frontend/src/App.jsx`

There are 7 distinct changes to make in this file. Apply them in order.

---

### 9.1 Add `shop` to `pageToPath`

Find:
```js
      case 'catalog':
        return '/catalog'
```
Add after it:
```js
      case 'shop':
        return '/shop'
```

---

### 9.2 Add `shop` to `pathToPage`

Find:
```js
    if (path === '/catalog') return 'catalog'
```
Add after it:
```js
    if (path === '/shop') return 'shop'
```

---

### 9.3 Add `shop` to driver allowed pages (hasSponsor branch only)

Find this exact line in `getAllowedPages`:
```js
      ? ['dashboard', 'log-trip', 'rewards', 'leaderboard', 'achievements', 'messages', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
```
Replace with:
```js
      ? ['dashboard', 'log-trip', 'shop', 'rewards', 'leaderboard', 'achievements', 'messages', 'profile', 'account-details', 'change-password', 'sponsor-affiliation', 'about']
```

---

### 9.4 Add Shop nav button (driver only)

Find the rewards nav button:
```jsx
          {isDriver && allowed.includes('rewards') && (
            <button type="button" onClick={() => setCurrentPage('rewards')} className="nav-link">
              Rewards
            </button>
          )}
```
Insert the shop button **before** it:
```jsx
          {isDriver && allowed.includes('shop') && (
            <button type="button" onClick={() => setCurrentPage('shop')} className="nav-link">
              Shop
            </button>
          )}
```

---

### 9.5 Add conversion rate state and handlers to `PointManagementPage`

**Location:** Inside the `PointManagementPage` component body, after the analytics state block.

Find:
```js
    // Analytics state
    const [analytics, setAnalytics] = useState(null)
```
Add after it:
```js
    // Conversion rate state
    const [conversionRate, setConversionRate] = useState(null)
    const [conversionInput, setConversionInput] = useState('')
```

Find the `loadAnalytics` function:
```js
    const loadAnalytics = async () => {
      try {
        const data = await api('/analytics/points', { method: 'GET' })
        setAnalytics(data || null)
      } catch (e) {
        setError(e?.message || 'Failed to load analytics')
      }
    }
```
Add the following function immediately after it:
```js
    const loadConversionRate = async () => {
      try {
        const data = await api('/conversion-rate', { method: 'GET' })
        setConversionRate(data?.rate || null)
        if (data?.rate) setConversionInput(String(data.rate.dollars_per_point))
      } catch (e) {
        setError(e?.message || 'Failed to load conversion rate')
      }
    }
```

Find the `useEffect` that calls the loaders:
```js
    useEffect(() => {
      setLoading(true)
      Promise.all([loadDrivers(), loadAwards(), loadExpiration(), loadAnalytics()])
        .finally(() => setLoading(false))
    }, [])
```
Replace with:
```js
    useEffect(() => {
      setLoading(true)
      Promise.all([loadDrivers(), loadAwards(), loadExpiration(), loadAnalytics(), loadConversionRate()])
        .finally(() => setLoading(false))
    }, [])
```

Find the `saveExpiration` function and add the following function immediately after its closing `}`:
```js
    // ── Conversion Rate ──
    const saveConversionRate = async () => {
      setError(''); setSuccess('')
      const val = Number(conversionInput)
      if (!Number.isFinite(val) || val <= 0) {
        setError('Enter a positive dollar amount (e.g. 0.01 means $0.01 per point).')
        return
      }
      try {
        await api('/conversion-rate', {
          method: 'PUT',
          body: JSON.stringify({ dollarsPerPoint: val })
        })
        setSuccess('Conversion rate saved.')
        await loadConversionRate()
      } catch (e) { setError(e?.message || 'Failed to save conversion rate') }
    }
```

Find the `tabs` array:
```js
    const tabs = [
      { key: 'analytics', label: 'Analytics' },
      { key: 'bulk', label: 'Bulk Points' },
      { key: 'scheduled', label: 'Scheduled Awards' },
      { key: 'calendar', label: 'Calendar' },
      { key: 'expiration', label: 'Expiration Rules' },
    ]
```
Replace with:
```js
    const tabs = [
      { key: 'analytics', label: 'Analytics' },
      { key: 'bulk', label: 'Bulk Points' },
      { key: 'scheduled', label: 'Scheduled Awards' },
      { key: 'calendar', label: 'Calendar' },
      { key: 'expiration', label: 'Expiration Rules' },
      { key: 'conversion', label: 'Conversion Rate' },
    ]
```

Find the expiration tab content block. It begins with:
```jsx
          {activeTab === 'expiration' && (
```
And ends with its closing `)}`. After that closing `)}`, insert the conversion rate tab:
```jsx
          {/* ── Conversion Rate Tab ── */}
          {activeTab === 'conversion' && (
            <div className="card">
              <h2 className="section-title" style={{ marginTop: 0 }}>Dollar-to-Point Conversion Rate</h2>
              <p className="page-subtitle" style={{ marginBottom: 12 }}>
                Set how many dollars equal one point in your program. This is a reference value —
                existing catalog item point costs are not automatically changed.
              </p>
              {conversionRate && (
                <p style={{ marginBottom: 12, fontSize: '0.875em', color: '#6b7280' }}>
                  Current rate: <strong>${Number(conversionRate.dollars_per_point).toFixed(4)}</strong> per point
                </p>
              )}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ width: 180 }}
                  type="number"
                  min="0.0001"
                  step="0.01"
                  placeholder="$ per point (e.g. 0.01)"
                  value={conversionInput}
                  onChange={e => setConversionInput(e.target.value)}
                />
                <button className="btn btn-success" type="button" onClick={saveConversionRate}>
                  Save Rate
                </button>
              </div>
            </div>
          )}
```

---

### 9.6 Add `DriverShopPage` component

Find the `RewardsPage` component. It begins with:
```js
  // ============ REWARDS PAGE ============
  const RewardsPage = () => {
```
Insert the following **before** that comment block:

```jsx
  // ============ DRIVER SHOP PAGE ============
  const DriverShopPage = () => {
    const [items, setItems] = useState([])
    const [categories, setCategories] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [selectedCategory, setSelectedCategory] = useState('')
    const [availableOnly, setAvailableOnly] = useState(false)
    const [selectedItem, setSelectedItem] = useState(null)

    const fetchCategories = async () => {
      try {
        const data = await api('/catalog/categories', { method: 'GET' })
        setCategories(Array.isArray(data?.categories) ? data.categories : [])
      } catch {
        // non-critical — filter just won't have options
      }
    }

    const fetchItems = async (s, cat, avail) => {
      setLoading(true)
      setError('')
      try {
        const params = new URLSearchParams()
        if (s) params.set('search', s)
        if (cat) params.set('category', cat)
        if (avail) params.set('available', '1')
        const qs = params.toString() ? `?${params.toString()}` : ''
        const data = await api(`/catalog${qs}`, { method: 'GET' })
        setItems(Array.isArray(data?.items) ? data.items : [])
      } catch (e) {
        setError(e?.message || 'Failed to load shop items.')
      } finally {
        setLoading(false)
      }
    }

    useEffect(() => {
      fetchCategories()
      fetchItems('', '', false)
    }, [])

    const handleSearchChange = (e) => {
      const val = e.target.value
      setSearch(val)
      fetchItems(val, selectedCategory, availableOnly)
    }

    const handleCategoryChange = (e) => {
      const val = e.target.value
      setSelectedCategory(val)
      fetchItems(search, val, availableOnly)
    }

    const handleAvailableToggle = (e) => {
      const val = e.target.checked
      setAvailableOnly(val)
      fetchItems(search, selectedCategory, val)
    }

    const openDetail = async (item) => {
      setSelectedItem(item)
      try {
        const data = await api(`/catalog/${item.id}`, { method: 'GET' })
        if (data?.item) setSelectedItem(data.item)
      } catch {
        // keep the card-level data already set
      }
    }

    const driverPoints = Number(currentUser?.points ?? 0)

    return (
      <div>
        <Navigation />
        <main className="app-main">
          <h1 className="page-title">Shop</h1>
          <p className="page-subtitle">
            Your balance: <strong>{driverPoints} pts</strong>
          </p>

          {/* ── Filters ── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24, alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: '1 1 200px', minWidth: 160 }}
              type="text"
              placeholder="Search items…"
              value={search}
              onChange={handleSearchChange}
            />
            <select
              className="form-input"
              style={{ flex: '0 1 180px' }}
              value={selectedCategory}
              onChange={handleCategoryChange}
            >
              <option value="">All categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.875em', whiteSpace: 'nowrap' }}>
              <input type="checkbox" checked={availableOnly} onChange={handleAvailableToggle} />
              Available only
            </label>
          </div>

          {/* ── Detail panel ── */}
          {selectedItem && (
            <div className="card" style={{ marginBottom: 24, position: 'relative' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ position: 'absolute', top: 16, right: 16, fontSize: '0.8em' }}
                onClick={() => setSelectedItem(null)}
              >
                Close
              </button>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                {selectedItem.image_url && (
                  <img
                    src={selectedItem.image_url}
                    alt={selectedItem.title}
                    style={{ width: 180, height: 180, objectFit: 'contain', borderRadius: 8, background: '#f9fafb', flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 180 }}>
                  <h2 className="section-title" style={{ marginTop: 0 }}>{selectedItem.title}</h2>
                  {selectedItem.category && (
                    <span style={{ fontSize: '0.75em', background: '#e0f2fe', color: '#0369a1', borderRadius: 4, padding: '2px 8px', marginBottom: 8, display: 'inline-block' }}>
                      {selectedItem.category}
                    </span>
                  )}
                  <p style={{ color: '#6b7280', margin: '8px 0' }}>
                    {selectedItem.description || `Retail value: $${Number(selectedItem.price || 0).toFixed(2)}`}
                  </p>
                  <p style={{ fontWeight: 700, fontSize: '1.1em', margin: '8px 0' }}>
                    {Number(selectedItem.point_cost || 0)} pts
                  </p>
                  {!selectedItem.is_available && (
                    <p style={{ color: '#dc2626', fontWeight: 600 }}>Currently unavailable</p>
                  )}
                  {selectedItem.is_available && Number(selectedItem.point_cost || 0) > driverPoints && (
                    <p style={{ color: '#d97706' }}>
                      You need <strong>{Number(selectedItem.point_cost || 0) - driverPoints}</strong> more points to redeem this item.
                    </p>
                  )}
                  {selectedItem.is_available && Number(selectedItem.point_cost || 0) <= driverPoints && Number(selectedItem.point_cost || 0) > 0 && (
                    <p style={{ color: '#059669', fontWeight: 600 }}>You have enough points!</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Item grid ── */}
          {loading ? (
            <p className="activity-empty">Loading shop items…</p>
          ) : error ? (
            <p style={{ color: 'crimson' }}>Could not load shop: {error}</p>
          ) : items.length === 0 ? (
            <p className="activity-empty">No items match your filters, or your sponsor's catalog is empty.</p>
          ) : (
            <div className="rewards-grid">
              {items.map(item => {
                const pointCost = Number(item.point_cost || 0)
                const canAfford = driverPoints >= pointCost && pointCost > 0
                const pointsNeeded = pointCost - driverPoints

                return (
                  <div
                    key={item.id}
                    className="reward-card"
                    style={{ cursor: 'pointer', opacity: item.is_available ? 1 : 0.55 }}
                    onClick={() => openDetail(item)}
                  >
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        style={{ width: '100%', height: 140, objectFit: 'contain', background: '#f9fafb', borderRadius: 6, marginBottom: 8 }}
                      />
                    )}
                    {item.category && (
                      <span style={{ fontSize: '0.7em', background: '#e0f2fe', color: '#0369a1', borderRadius: 3, padding: '1px 6px', marginBottom: 4, display: 'inline-block' }}>
                        {item.category}
                      </span>
                    )}
                    <h3 className="reward-title">{item.title}</h3>
                    <p className="reward-pts">{pointCost} pts</p>
                    {!item.is_available && (
                      <p style={{ fontSize: '0.8em', color: '#dc2626', marginTop: 4 }}>Unavailable</p>
                    )}
                    {item.is_available && !canAfford && pointsNeeded > 0 && (
                      <p style={{ fontSize: '0.8em', color: '#d97706', marginTop: 4 }}>{pointsNeeded} more pts needed</p>
                    )}
                    {item.is_available && canAfford && (
                      <p style={{ fontSize: '0.8em', color: '#059669', marginTop: 4 }}>Affordable ✓</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </main>
      </div>
    )
  }

```

---

### 9.7 Wire `DriverShopPage` into the main render switch

Find the area in App.jsx where `currentPage === 'rewards'` resolves to `<RewardsPage />`. The pattern looks like:
```jsx
else if (currentPage === 'rewards') return <RewardsPage />
```
or a ternary/switch equivalent. Add a matching case for `shop` **before** or adjacent to the rewards case:
```jsx
else if (currentPage === 'shop') return <DriverShopPage />
```

---

## 10. Phase 6 — Sponsor Catalog UI: Availability Toggle and Category Pass-Through

**File:** `frontend/src/App.jsx`

These changes are in the sponsor-facing catalog UI that sponsors use to manage their catalog. This UI appears in two places:

### 10.1 Locate the sponsor catalog section
Search for the string `sponsorToolsTab === 'catalog'` (around line 3915). This renders, for each item:
```jsx
<tbody>{sponsorCatalog.map(item => (
```

### 10.2 Add availability toggle column in the catalog item table
Inside that `.map(item => ...)`, find where the Remove button is rendered. The current row structure ends with a Remove button TD. Add an availability TD **before** it:
```jsx
<td>
  <button
    type="button"
    className="btn btn-secondary"
    style={{ fontSize: '0.75em', padding: '3px 8px' }}
    onClick={async () => {
      try {
        await api(`/sponsors/${selectedSponsorId}/catalog/${item.id}/availability`, {
          method: 'PATCH',
          body: JSON.stringify({ isAvailable: !item.is_available })
        })
        await loadSponsorCatalog(selectedSponsorId)
      } catch (e) { setSponsorToolsError(e?.message || 'Failed to update availability') }
    }}
  >
    {item.is_available ? 'Disable' : 'Enable'}
  </button>
</td>
```

### 10.3 Locate the Fake Store item-add flow and pass through `category`
Search for where the sponsor calls `POST /catalog` (the `fetchShopItems` or inline item-add function that sends `itemId`, `title`, `price`, `pointCost` etc.). The DummyJSON normalized response from the fakestore search already includes a `category` field. When posting to `/catalog`, ensure `category` is included in the body:
```js
body: JSON.stringify({
    itemId: item.itemId,
    title: item.title,
    description: item.description,
    imageUrl: item.image,
    price: item.price?.value ?? item.price,
    pointCost: pointCostValue,
    category: item.category || null,  // ← add this line
})
```
Search the sponsor catalog section of App.jsx for where items are added from the fakestore search results — it will contain a `pointCost` field in the POST body. Add `category: item.category || null` to that body.

---

## 11. Phase 7 — Deployment Steps (EC2)

Execute these steps in order on the EC2 host:

```bash
# 1. Pull latest code
cd /home/ec2-user/S26-CPSC4910-Team17
git pull origin main

# 2. Install any new dependencies (none expected for this sprint)
cd backend && npm install
cd ..

# 3. Run the database migration against RDS
#    (Replace <RDS_HOST>, <RDS_USER>, <DB_NAME> with the actual values from .env)
mysql -h <RDS_HOST> -u <RDS_USER> -p <DB_NAME> \
  < backend/packages/db/migrations/003_catalog_and_conversion.sql

# 4. Restart backend services to pick up code changes
pm2 restart gdip-sponsor
pm2 restart gdip-driver

# 5. Verify services came back up
pm2 status
curl -s http://localhost:4003/healthz   # should return {"ok":true}
curl -s http://localhost:4002/healthz   # should return {"ok":true}

# 6. Build and deploy the frontend
cd /home/ec2-user/S26-CPSC4910-Team17/frontend
npm run build
sudo cp -r dist/* /var/www/myapp/

# 7. Verify nginx is still running
sudo systemctl status nginx
```

---

## 12. Verification Checklist

Run these checks after deployment. All should pass before closing the sprint.

### Backend
- [ ] `curl -s -X GET http://localhost:4003/conversion-rate` (with valid session cookie) returns `{"rate": null}` for a sponsor with no rate set — not a 500.
- [ ] `curl -s -X PUT http://localhost:4003/conversion-rate -d '{"dollarsPerPoint":-1}'` returns 400 with an error field.
- [ ] `curl -s -X PUT http://localhost:4003/conversion-rate -d '{"dollarsPerPoint":0.01}'` returns `{"ok":true,"rate":{...}}`.
- [ ] `curl -s -X GET http://localhost:4003/conversion-rate` now returns the saved rate.
- [ ] Sponsor POST to `/catalog` with a payload that **omits** `category` and `isAvailable` still returns 201 (backward compatibility).
- [ ] Sponsor POST to `/catalog` with `category: "electronics"` and `isAvailable: false` returns 201 and the item appears in GET with those values.
- [ ] `PATCH /catalog/:id/availability` with `{"isAvailable": false}` returns `{"ok":true,"isAvailable":false}`.
- [ ] `PATCH /catalog/:id/availability` with an item belonging to a different sponsor returns 404.
- [ ] Driver `GET /catalog` with no params returns items scoped to affiliated sponsor only.
- [ ] Driver `GET /catalog?search=jacket` returns only items with "jacket" in the title.
- [ ] Driver `GET /catalog?category=electronics` returns only items in that category.
- [ ] Driver `GET /catalog?available=1` excludes items where `is_available = 0`.
- [ ] Driver `GET /catalog/categories` returns only category values that exist in that sponsor's catalog.
- [ ] Driver `GET /catalog/categories` is not confused with `GET /catalog/:id` (categories string is not treated as an id).
- [ ] Driver `GET /catalog/99999` for an item belonging to a different sponsor's catalog returns 404.

### Frontend
- [ ] A logged-in driver with a sponsor affiliation sees a "Shop" nav item.
- [ ] A logged-in driver without a sponsor affiliation does **not** see "Shop".
- [ ] The Shop page at `/shop` loads and shows the driver's point balance.
- [ ] Typing in the search box triggers a filtered fetch.
- [ ] The category dropdown shows only categories present in the sponsor's catalog.
- [ ] Checking "Available only" hides unavailable items.
- [ ] Clicking a product card opens the detail panel with image, description, and point cost.
- [ ] The detail panel shows "X more points needed" when the driver cannot afford the item.
- [ ] The detail panel shows "You have enough points!" when the driver can afford the item.
- [ ] Unavailable items show a visual indicator (dimmed card + "Unavailable" label).
- [ ] The sponsor Point Management page shows a "Conversion Rate" tab.
- [ ] Saving a valid rate persists and the current rate is shown on next load.
- [ ] Saving a negative or zero rate shows an inline error without submitting.
- [ ] The sponsor catalog table shows an Enable/Disable button per item that toggles `is_available`.
- [ ] The existing Rewards page is unchanged and still accessible to drivers.

---

## 13. Scope Boundaries

### In scope for this sprint
- Sponsor dollar-to-point conversion rate (stored per sponsor; does not auto-recalculate item costs)
- Sponsor catalog item availability toggle (manual on/off flag)
- Sponsor catalog items persist and return `category` on insert/list
- Driver shop page with search, category filter, availability filter, product cards with images and point costs
- Driver product detail panel with affordability messaging from current points balance
- Driver `/catalog/categories` endpoint for dynamic filter population

### Out of scope (do not implement)
- Automatic recalculation of catalog item point costs from the conversion rate
- Inventory quantity tracking
- External real-time stock sync
- Redemption / checkout flow
- Modifications to `fakestoreClient.js` or `fakestore.js`
