# ORDER DOMAIN IMPLEMENTATION PLAN

## CONSTRAINTS AND INVARIANTS
- Statuses are SIMULATED. No physical shipping. Sponsor manually advances status via API call.
- Points deduct ONLY when sponsor patches status to `delivered`. Balance is NOT touched at checkout or confirmation.
- Reserved balance: at checkout time, available = `actual_balance − SUM(total_points of orders WHERE status IN ('pending','confirmed') AND driver_id = ?)`. Reject if available < cart total.
- Cart is cleared in the same DB transaction as order INSERT. No partial state allowed.
- One order per checkout regardless of how many sponsors' items are in cart. No `sponsor_id` on `orders` table. Each `order_items` row holds its own `sponsor_id`.
- `POST /catalog/:id/redeem` MUST return 410 after new checkout is live. It creates shadow ledger entries not visible in order history.
- Migration number is `006`. File `005_driver_cart.sql` already exists.
- No `withTransaction` helper exists in `@gdip/db`. Use `pool.getConnection()` directly.

---

## EXISTING CODE REFERENCE

### Package imports (driver service)
```js
// backend/services/driver/src/index.js line 1-4
const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");                // pool also exported: require("@gdip/db").pool
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");
```

### Package imports (sponsor service)
```js
// backend/services/sponsor/src/index.js line 1-5
const { makeApp } = require("@gdip/server");
const { query, exec } = require("@gdip/db");
const { hashPassword, verifyPassword, signToken, verifyToken } = require("@gdip/auth");
const { z } = require("zod");
```

### DB pool export (for transactions)
```js
// backend/packages/db/src/index.js — full exports
module.exports = { pool, query, exec, ping };
// pool is mysql2/promise pool; use pool.getConnection() for transactions
```

### Transaction pattern (no helper exists; use this pattern)
```js
const { pool } = require("@gdip/db");
const conn = await pool.getConnection();
try {
  await conn.beginTransaction();
  // ... await conn.execute(sql, params)
  await conn.commit();
} catch (err) {
  await conn.rollback();
  throw err;
} finally {
  conn.release();
}
```

### requireAuth (driver service) — lines 14-27
```js
function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Not authenticated" });
  try {
    const payload = verifyToken(token);
    if (payload.role !== ROLE) return res.status(403).json({ error: "Wrong role for this service" });
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}
```

### requireAuth (sponsor service) — lines 95-127 (also checks is_active)
```js
async function requireAuth(req, res, next) { /* identical shape but async; checks is_active */ }
```

### Affiliation helpers (backend/routes/driver/catalog.js lines 8-43)
```js
async function getAffiliatedCompanyNames(driverId) { /* returns string[] */ }
async function getSponsorIdsForCompanies(companyNames) { /* returns number[] */ }
async function getAffiliatedSponsorIds(driverId) { /* returns number[] */ }
```
REUSE these in the new `backend/routes/driver/orders.js` via `require('../catalog')` or copy into the file.

### Cart endpoints (driver service lines ~920-985)
- `GET /cart` — returns `{ items: [{id, title, image_url, point_cost, sponsor_id, is_available, qty}] }`
- `PUT /cart` — replaces full cart; body `{ items: [{id, qty}] }`
- `DELETE /cart` — clears cart

### Route registration insertion points
- **Driver service** — line 916: `app.use('/catalog', requireAuth, driverCatalogRoutes);`
  Insert NEW line AFTER: `app.use('/orders', requireAuth, driverOrderRoutes);`
- **Sponsor service** — line 1288-1289:
  ```js
  app.use("/fakestore", requireAuth, fakestoreRoutes);
  app.use("/catalog", requireAuth, sponsorCatalogRoutes);
  ```
  Insert NEW lines AFTER line 1289:
  ```js
  const sponsorOrderRoutes = require("../../../routes/sponsor/orders");
  app.use("/orders", requireAuth, sponsorOrderRoutes);
  ```
  Also add `GET /preview-catalog` inline after .use("/catalog",...) or in a new route file.

### Frontend routing functions (App.jsx lines ~100-183)
- `pageToPath(page)` — switch/case returning URL string
- `pathToPage(pathname, searchParams)` — if-chain returning page string
- ADD cases for: `'order-confirmation'→'/order-confirmation'`, `'order-history'→'/order-history'`, `'order-detail'→'/order-detail'`

### CartPage location: App.jsx line 5881
- `const CartPage = () => {`
- Checkout button at line ~5998; currently calls `window.alert` placeholder
- `canCheckout` variable at line 5889 — reuse as the disabled check

### App-level state (App.jsx top of App())
- Currently: `cart`, `setCart`, `clearCart`, `addToCart`, etc.
- ADD: `const [lastOrder, setLastOrder] = useState(null)` — stores the order returned from POST /orders
- ADD: `const [orderToView, setOrderToView] = useState(null)` — stores order id for detail page navigation

### getSponsorCompanyName (sponsor service line ~23)
```js
async function getSponsorCompanyName(sponsorId) {
  const rows = await query("SELECT company_name FROM sponsor_profiles WHERE user_id = ? LIMIT 1", [sponsorId]);
  const company = rows?.[0]?.company_name;
  return company && String(company).trim().length > 0 ? String(company).trim() : null;
}
```
REUSE this in the preview-catalog and sponsor order routes.

---

## PHASE 1 — DATABASE MIGRATION

**File to create:** `backend/packages/db/migrations/006_orders.sql`

```sql
-- Migration: Order domain (simulated order lifecycle)
-- Depends on: 001 (users), 003_catalog (catalog_items), 005 (driver_cart_items)
-- Idempotent: all CREATE TABLE IF NOT EXISTS; ALTER TABLE uses migrate.js duplicate-column tolerance.

CREATE TABLE IF NOT EXISTS orders (
  id                    INT AUTO_INCREMENT PRIMARY KEY,
  driver_id             INT NOT NULL,
  status                ENUM('pending','confirmed','delivered','cancelled') NOT NULL DEFAULT 'pending',
  total_points          INT NOT NULL DEFAULT 0,
  confirmation_number   VARCHAR(20) NOT NULL,
  confirmed_at          TIMESTAMP NULL,
  cancelled_at          TIMESTAMP NULL,
  cancellation_reason   VARCHAR(255) NULL,
  cancelled_by_user_id  INT NULL,
  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_orders_confirmation (confirmation_number),
  INDEX idx_orders_driver          (driver_id),
  INDEX idx_orders_driver_status   (driver_id, status),
  INDEX idx_orders_driver_created  (driver_id, created_at),
  INDEX idx_orders_status          (status),
  CONSTRAINT fk_orders_driver FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  order_id                INT NOT NULL,
  catalog_item_id         INT NULL,
  sponsor_id              INT NOT NULL,
  item_title_snapshot     VARCHAR(255) NOT NULL,
  item_image_url_snapshot VARCHAR(500) NULL,
  points_cost_snapshot    INT NOT NULL,
  qty                     INT NOT NULL DEFAULT 1,
  INDEX idx_oi_order      (order_id),
  INDEX idx_oi_sponsor    (sponsor_id),
  CONSTRAINT fk_oi_order  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Verify idempotency:** Run twice. No errors expected.

---

## PHASE 2 — BACKEND: DRIVER ORDER ROUTES

**File to create:** `backend/routes/driver/orders.js`

### Module header
```js
const express = require('express');
const router = express.Router();
const { query, exec, pool } = require('../../packages/db/src/index');
// OR: const { query, exec, pool } = require('@gdip/db');
```

Copy `getAffiliatedCompanyNames`, `getSponsorIdsForCompanies`, `getAffiliatedSponsorIds` from `catalog.js` or require them.

### Confirmation number generator
```js
function generateConfirmationNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`.substring(0, 20);
}
```

### ROUTE ORDER IN THIS FILE (critical for Express param matching)
1. `GET /export`                 ← MUST be before `GET /:id`
2. `POST /`                      ← checkout
3. `GET /`                       ← history list
4. `GET /:id`                    ← detail (covers stories 4 and 6)
5. `GET /:id/export`             ← single order PDF
6. `POST /:id/cancel`            ← driver cancel

---

### POST / — CHECKOUT

```
INPUT: no body (reads from driver_cart_items)
AUTH: requireAuth (driver role enforced by service-level middleware)
PROCESS:
  1. SELECT dci.qty, ci.id, ci.title, ci.image_url, ci.point_cost, ci.sponsor_id, ci.is_available
     FROM driver_cart_items dci JOIN catalog_items ci ON ci.id = dci.catalog_item_id
     WHERE dci.driver_id = req.user.id
  2. If rows.length === 0 → 400 { error: 'Cart is empty' }
  3. If any row.is_available === 0 → 400 { error: 'Cart contains unavailable items', items: [...] }
  4. Validate affiliation: get affiliatedSponsorIds for req.user.id.
     For each cart row, verify row.sponsor_id is in affiliatedSponsorIds.
     If any fails → 400 { error: 'Cart contains items from unaffiliated sponsors' }
  5. total_points = SUM(row.point_cost * row.qty)
  6. Reserved balance check:
     actualBalance = SELECT COALESCE(SUM(delta), 0) AS b FROM driver_points_ledger WHERE driver_id = req.user.id
     reserved = SELECT COALESCE(SUM(total_points), 0) AS r FROM orders WHERE driver_id = req.user.id AND status IN ('pending','confirmed')
     available = actualBalance - reserved
     If available < total_points → 402 { error: 'Insufficient available points', available, required: total_points }
  7. confirmation_number = generateConfirmationNumber()
  8. DB TRANSACTION (pool.getConnection):
     a. INSERT INTO orders (driver_id, status, total_points, confirmation_number) VALUES (?, 'pending', ?, ?)
        → orderId = result.insertId
     b. Bulk INSERT INTO order_items (order_id, catalog_item_id, sponsor_id, item_title_snapshot, item_image_url_snapshot, points_cost_snapshot, qty)
        VALUES (?,?,?,?,?,?,?), ... [one row per cart item]
     c. DELETE FROM driver_cart_items WHERE driver_id = req.user.id
     COMMIT
OUTPUT: 201 { order: { id, confirmation_number, status:'pending', total_points, items:[{...snapshots, qty}], created_at } }
ERRORS: 400 (cart invalid), 402 (points), 500 (DB)
```

---

### GET / — HISTORY LIST

```
QUERY PARAMS: status (optional, one of pending|confirmed|delivered|cancelled), from (ISO date), to (ISO date), page (int ≥1, default 1), limit (int 1-100, default 20)
PROCESS:
  Build WHERE clause: driver_id = req.user.id [+ AND status = ? if provided] [+ AND created_at >= ? AND created_at <= ?]
  SELECT id, status, total_points, confirmation_number, confirmed_at, cancelled_at, cancellation_reason, created_at, updated_at
  FROM orders WHERE ... ORDER BY created_at DESC LIMIT ? OFFSET ?
  Total count: SELECT COUNT(*) FROM orders WHERE ...
OUTPUT: 200 { orders: [...], total, page, limit, pages }
```

---

### GET /:id — ORDER DETAIL

```
PROCESS:
  1. SELECT * FROM orders WHERE id = ? AND driver_id = req.user.id LIMIT 1 → 404 if none
  2. SELECT oi.*, ci.image_url AS current_image_url FROM order_items oi
     LEFT JOIN catalog_items ci ON ci.id = oi.catalog_item_id
     WHERE oi.order_id = ?
OUTPUT: 200 { order: { id, status, total_points, confirmation_number, confirmed_at, cancelled_at, cancellation_reason, cancelled_by_user_id, created_at, updated_at, items: [{id, catalog_item_id, sponsor_id, item_title_snapshot, item_image_url_snapshot, points_cost_snapshot, qty}] } }
```

---

### POST /:id/cancel — DRIVER CANCEL

```
INPUT: body { reason?: string }
POLICY: driver may only cancel orders with status = 'pending'
PROCESS:
  1. SELECT id, status FROM orders WHERE id = ? AND driver_id = req.user.id LIMIT 1 → 404 if none
  2. If status !== 'pending' → 409 { error: 'Only pending orders can be cancelled by the driver' }
  3. UPDATE orders SET status='cancelled', cancelled_at=NOW(), cancellation_reason=?, cancelled_by_user_id=req.user.id, updated_at=NOW() WHERE id = ?
  4. Return full order detail (re-fetch or inline)
OUTPUT: 200 { order: { ...updated fields } }
NOTE: NO ledger entry. Points were never deducted.
```

---

### GET /export — FULL HISTORY PDF

```
REQUIRES: pdfkit (npm install pdfkit in backend/services/driver)
PROCESS:
  1. SELECT all orders for req.user.id ORDER BY created_at DESC (no pagination)
  2. For each order, fetch order_items
  3. Build PDF: title, driver id/name, export date. Table: Order #, Date, Status, Items, Total pts.
     Include cancellation_reason when status = 'cancelled'.
HEADERS: Content-Type: application/pdf, Content-Disposition: attachment; filename="order-history.pdf"
```

---

### GET /:id/export — SINGLE ORDER PDF

```
PROCESS:
  1. Fetch order + items same as GET /:id
  2. Build PDF: confirmation number, order date, status, itemized list (snapshot title, qty, pts each, subtotal), total pts.
     If cancelled: show reason prominently.
HEADERS: Content-Type: application/pdf, Content-Disposition: attachment; filename="order-{confirmation_number}.pdf"
```

---

### DEPRECATE POST /catalog/:id/redeem

In `backend/routes/driver/catalog.js`, replace the `router.post('/:id/redeem', ...)` handler body with:
```js
router.post('/:id/redeem', async (req, res) => {
  return res.status(410).json({ error: 'Single-item redemption is no longer supported. Use the cart checkout flow at POST /orders.' });
});
```

---

### Register in driver service

In `backend/services/driver/src/index.js` AFTER line 916 (`app.use('/catalog', requireAuth, driverCatalogRoutes);`), add:
```js
const driverOrderRoutes = require('../../../routes/driver/orders');
app.use('/orders', requireAuth, driverOrderRoutes);
```

---

## PHASE 3 — BACKEND: SPONSOR ORDER ROUTES

**File to create:** `backend/routes/sponsor/orders.js`

```js
const express = require('express');
const router = express.Router();
const { query, exec, pool } = require('../../packages/db/src/index');
// OR require('@gdip/db')
```

### "Sponsor owns this order" guard helper
```js
async function sponsorOwnsOrder(orderId, sponsorId) {
  const rows = await query(
    'SELECT id FROM order_items WHERE order_id = ? AND sponsor_id = ? LIMIT 1',
    [orderId, sponsorId]
  );
  return rows && rows.length > 0;
}
```

---

### GET / — SPONSOR ORDER LIST

```
QUERY PARAMS: status, page (default 1), limit (default 20, max 100)
PROCESS:
  Build WHERE: oi.sponsor_id = req.user.id [+ AND o.status = ?]
  SELECT DISTINCT o.id, o.driver_id, o.status, o.total_points, o.confirmation_number,
         o.confirmed_at, o.cancelled_at, o.cancellation_reason, o.created_at, o.updated_at
  FROM orders o JOIN order_items oi ON oi.order_id = o.id
  WHERE oi.sponsor_id = ? [AND o.status = ?]
  ORDER BY o.created_at DESC LIMIT ? OFFSET ?
OUTPUT: 200 { orders: [...], total, page, limit, pages }
```

---

### PATCH /:id/status — SPONSOR STATUS UPDATE

```
INPUT: body { status: 'confirmed'|'delivered'|'cancelled', reason?: string }
ALLOWED TRANSITIONS:
  pending    → confirmed  (sponsor)
  confirmed  → delivered  (sponsor) ← triggers point deduction
  pending    → cancelled  (sponsor)
  confirmed  → cancelled  (sponsor)
POLICY: sponsor may NOT advance to delivered from pending (must confirm first).
        sponsor may NOT modify an already-delivered order.
        sponsor may NOT modify an already-cancelled order.

PROCESS:
  1. Validate body: status must be one of the three values above; reason is optional string.
  2. Fetch: SELECT id, driver_id, status, total_points, confirmation_number FROM orders WHERE id = ? LIMIT 1 → 404 if none
  3. Verify sponsorOwnsOrder(orderId, req.user.id) → 403 if false
  4. Check current status is not 'delivered' and not 'cancelled' → 409 if either
  5. Validate transition:
     if currentStatus === 'pending' and newStatus === 'delivered' → 409 { error: 'Must confirm before delivering' }
  6. TRANSACTION:
     a. UPDATE orders SET status=?, updated_at=NOW(),
        [confirmed_at = IF(status='confirmed', NOW(), confirmed_at)],
        [cancelled_at = IF(status='cancelled', NOW(), NULL)],
        [cancellation_reason = IF(status='cancelled', ?, NULL)],
        [cancelled_by_user_id = IF(status='cancelled', req.user.id, NULL)]
        WHERE id = ?
     b. IF new status = 'delivered':
        INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason)
        VALUES (order.driver_id, req.user.id, -order.total_points,
                CONCAT('Order #', order.confirmation_number, ' delivered'))
  7. Return updated order (re-fetch or inline)
OUTPUT: 200 { order: { ...updated } }
```

---

### Register in sponsor service

In `backend/services/sponsor/src/index.js` AFTER line 1289 (`app.use("/catalog", requireAuth, sponsorCatalogRoutes);`), add:
```js
const sponsorOrderRoutes = require("../../../routes/sponsor/orders");
app.use("/orders", requireAuth, sponsorOrderRoutes);
```

---

## PHASE 4 — BACKEND: SPONSOR CATALOG PREVIEW

Add inline in `backend/services/sponsor/src/index.js` AFTER the new `/orders` registration:

```js
app.get("/preview-catalog", requireAuth, async (req, res) => {
  try {
    const companyName = await getSponsorCompanyName(req.user.id);
    if (!companyName) return res.json({ items: [] });

    const sponsorRows = await query(
      "SELECT user_id AS sponsor_id FROM sponsor_profiles WHERE TRIM(company_name) = ? ",
      [companyName]
    );
    const sponsorIds = (sponsorRows || []).map(r => Number(r.sponsor_id)).filter(Number.isFinite);
    if (!sponsorIds.length) return res.json({ items: [] });

    const placeholders = sponsorIds.map(() => '?').join(',');
    const items = await query(
      `SELECT id, sponsor_id, title, description, image_url, point_cost, category, is_available, created_at
       FROM catalog_items
       WHERE sponsor_id IN (${placeholders}) AND is_available = 1
       ORDER BY created_at DESC`,
      sponsorIds
    );
    return res.json({ items: items || [] });
  } catch (err) {
    console.error('GET /preview-catalog error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});
```

**DO NOT modify `GET /catalog`** — that is sponsor item CRUD management, not a preview.

---

## PHASE 5 — PDF DEPENDENCY

In `backend/services/driver/package.json`, add to `dependencies`:
```json
"pdfkit": "^0.15.0"
```

Run `npm install` in `backend/services/driver/`.

---

## PHASE 6 — FRONTEND

**File:** `frontend/src/App.jsx`

### 6A — New state (add near top of App(), after existing cart state)
```jsx
const [lastOrder, setLastOrder] = useState(null)         // set after successful checkout
const [orderToView, setOrderToView] = useState(null)     // order id for detail page
```

### 6B — pageToPath additions (add cases before `default: return '/'`)
```jsx
case 'order-confirmation':
  return '/order-confirmation'
case 'order-history':
  return '/order-history'
case 'order-detail':
  return '/order-detail'
```

### 6C — pathToPage additions (add before the fallback `return 'landing'`)
```jsx
if (path === '/order-confirmation') return 'order-confirmation'
if (path === '/order-history') return 'order-history'
if (path === '/order-detail') return 'order-detail'
```

### 6D — CartPage checkout handler (replace lines ~6009-6011 in CartPage)

FIND (exact existing text inside onClick):
```jsx
                    // Placeholder for future checkout
                    // eslint-disable-next-line no-alert
                    window.alert('Checkout is coming soon. For now, items stay in your cart.')
```

REPLACE WITH:
```jsx
                    const [checkoutLoading, setCheckoutLoading] = React.useState(false)
                    const [checkoutError, setCheckoutError] = React.useState('')
                    // NOTE: This state must be hoisted OUT of the onClick.
                    // Restructure CartPage to include checkoutLoading/checkoutError as component-level state.
```

**ACTUAL RESTRUCTURE REQUIRED:** Add `checkoutLoading` and `checkoutError` as state variables at the TOP of `CartPage` component body (not inside onClick). Replace the entire checkout `onClick` with:
```jsx
onClick={async () => {
  setCheckoutLoading(true)
  setCheckoutError('')
  try {
    const result = await api('/orders', { method: 'POST' })
    setLastOrder(result.order)
    clearCart()
    setCurrentPage('order-confirmation')
  } catch (err) {
    setCheckoutError(err?.message || 'Checkout failed. Please try again.')
  } finally {
    setCheckoutLoading(false)
  }
}}
disabled={!canCheckout || checkoutLoading}
```
Also render `checkoutError` below the button when non-empty.

**ALSO update the `canCheckout` balance check:** The current guard uses `balance >= totalPoints` but does NOT account for reserved points. Add a separate fetch of `/orders?status=pending&status=confirmed` to sum reserved points, or accept a minor UX gap where the server authoritatively rejects the order on 402 and the frontend shows the error. The simpler approach is letting the server be authoritative and handling the 402 error in `checkoutError`.

---

### 6E — OrderConfirmationPage component (add after CartPage component, before RewardsPage)
```jsx
const OrderConfirmationPage = () => {
  const order = lastOrder
  if (!order) {
    return (
      <div><Navigation />
        <main className="app-main">
          <h1 className="page-title">Order Confirmed</h1>
          <div className="card"><p>No order data available.</p>
            <button className="btn btn-primary" onClick={() => setCurrentPage('order-history')}>View Order History</button>
          </div>
        </main>
      </div>
    )
  }
  return (
    <div><Navigation />
      <main className="app-main">
        <h1 className="page-title">Order Placed</h1>
        <div className="card">
          <p><strong>Confirmation #:</strong> {order.confirmation_number}</p>
          <p><strong>Status:</strong> {order.status}</p>
          <p><strong>Total Points:</strong> {Number(order.total_points).toLocaleString()}</p>
          <p style={{ color:'var(--text-muted)', fontSize:'0.85em' }}>Points will be deducted when the sponsor marks your order as delivered.</p>
          <table className="table"><thead><tr><th>Item</th><th>Qty</th><th>Points</th></tr></thead>
            <tbody>{(order.items || []).map(item => (
              <tr key={item.id}>
                <td>{item.item_title_snapshot}</td>
                <td>{item.qty}</td>
                <td>{(item.points_cost_snapshot * item.qty).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ display:'flex', gap:8, marginTop:12 }}>
            <button className="btn btn-primary" onClick={() => setCurrentPage('order-history')}>View Order History</button>
            <button className="btn btn-ghost" onClick={() => setCurrentPage('shop')}>Continue Shopping</button>
          </div>
        </div>
      </main>
    </div>
  )
}
```

---

### 6F — OrderHistoryPage component

```jsx
const OrderHistoryPage = () => {
  const [orders, setOrders] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('all')
  const STATUS_TABS = ['all', 'pending', 'confirmed', 'delivered', 'cancelled']
  const STATUS_COLORS = { pending:'#d97706', confirmed:'#2563eb', delivered:'#16a34a', cancelled:'#dc2626' }

  React.useEffect(() => {
    let cancelled = false
    const fetchOrders = async () => {
      setLoading(true); setError('')
      try {
        const params = new URLSearchParams()
        if (statusFilter !== 'all') params.set('status', statusFilter)
        const data = await api(`/orders?${params}`, { method: 'GET' })
        if (!cancelled) setOrders(data.orders || [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load orders')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchOrders()
    return () => { cancelled = true }
  }, [statusFilter])

  const handleExportAll = () => {
    window.open(`${apiBase}/orders/export`, '_blank')
  }

  return (
    <div><Navigation />
      <main className="app-main">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1 className="page-title">Order History</h1>
          <button className="btn btn-ghost" onClick={handleExportAll}>Export All (PDF)</button>
        </div>
        <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
          {STATUS_TABS.map(s => (
            <button key={s} className={`btn ${statusFilter===s?'btn-primary':'btn-ghost'}`}
              onClick={() => setStatusFilter(s)} style={{ textTransform:'capitalize' }}>{s}</button>
          ))}
        </div>
        {loading ? <p>Loading...</p> : error ? <p style={{ color:'var(--danger)' }}>{error}</p> :
          orders.length === 0 ? <div className="card"><p className="activity-empty">No orders found.</p></div> :
          <div className="card">
            <table className="table"><thead><tr>
              <th>Confirmation #</th><th>Date</th><th>Status</th><th>Points</th><th>Action</th>
            </tr></thead>
            <tbody>{orders.map(o => (
              <tr key={o.id}>
                <td>{o.confirmation_number}</td>
                <td>{new Date(o.created_at).toLocaleDateString()}</td>
                <td><span style={{ color: STATUS_COLORS[o.status] || '#374151', fontWeight:600, textTransform:'capitalize' }}>{o.status}</span></td>
                <td>{Number(o.total_points).toLocaleString()}</td>
                <td><button className="btn btn-ghost" onClick={() => { setOrderToView(o.id); setCurrentPage('order-detail') }}>View</button></td>
              </tr>
            ))}</tbody></table>
          </div>
        }
      </main>
    </div>
  )
}
```

---

### 6G — OrderDetailPage component

```jsx
const OrderDetailPage = () => {
  const [order, setOrder] = React.useState(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')
  const [cancelLoading, setCancelLoading] = React.useState(false)
  const [cancelError, setCancelError] = React.useState('')
  const STATUS_COLORS = { pending:'#d97706', confirmed:'#2563eb', delivered:'#16a34a', cancelled:'#dc2626' }

  React.useEffect(() => {
    if (!orderToView) { setLoading(false); return }
    let cancelled = false
    const fetchOrder = async () => {
      setLoading(true); setError('')
      try {
        const data = await api(`/orders/${orderToView}`, { method: 'GET' })
        if (!cancelled) setOrder(data.order)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load order')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchOrder()
    return () => { cancelled = true }
  }, [orderToView])

  const handleCancel = async () => {
    if (!window.confirm('Cancel this order?')) return
    setCancelLoading(true); setCancelError('')
    try {
      const data = await api(`/orders/${order.id}/cancel`, { method: 'POST', body: JSON.stringify({ reason: 'Cancelled by driver' }) })
      setOrder(data.order)
    } catch (e) {
      setCancelError(e?.message || 'Failed to cancel order')
    } finally {
      setCancelLoading(false)
    }
  }

  const handleExport = () => {
    window.open(`${apiBase}/orders/${order?.id}/export`, '_blank')
  }

  if (loading) return <div><Navigation /><main className="app-main"><p>Loading...</p></main></div>
  if (error) return <div><Navigation /><main className="app-main"><p style={{ color:'var(--danger)' }}>{error}</p></main></div>
  if (!order) return <div><Navigation /><main className="app-main"><p>Order not found.</p></main></div>

  return (
    <div><Navigation />
      <main className="app-main">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <h1 className="page-title">Order {order.confirmation_number}</h1>
          <button className="btn btn-ghost" onClick={handleExport}>Export Receipt (PDF)</button>
        </div>
        <div className="card">
          <p><strong>Status:</strong> <span style={{ color: STATUS_COLORS[order.status], fontWeight:600, textTransform:'capitalize' }}>{order.status}</span></p>
          <p><strong>Placed:</strong> {new Date(order.created_at).toLocaleString()}</p>
          {order.confirmed_at && <p><strong>Confirmed:</strong> {new Date(order.confirmed_at).toLocaleString()}</p>}
          {order.status === 'cancelled' && (
            <div style={{ background:'#fef2f2', border:'1px solid #fca5a5', borderRadius:6, padding:'10px 14px', margin:'8px 0' }}>
              <strong style={{ color:'#dc2626' }}>Cancelled</strong>
              {order.cancellation_reason && <p style={{ margin:'4px 0 0', color:'#dc2626' }}>Reason: {order.cancellation_reason}</p>}
              {order.cancelled_at && <p style={{ margin:'2px 0 0', fontSize:'0.8em', color:'#6b7280' }}>{new Date(order.cancelled_at).toLocaleString()}</p>}
            </div>
          )}
          <p><strong>Total Points:</strong> {Number(order.total_points).toLocaleString()}</p>
          {order.status !== 'delivered' && order.status !== 'cancelled' && (
            <p style={{ fontSize:'0.85em', color:'var(--text-muted)' }}>Points will be deducted when sponsor marks order delivered.</p>
          )}
          <table className="table" style={{ marginTop:12 }}>
            <thead><tr><th>Item</th><th>Qty</th><th>Points each</th><th>Subtotal</th></tr></thead>
            <tbody>{(order.items || []).map(item => (
              <tr key={item.id}>
                <td>{item.item_title_snapshot}</td>
                <td>{item.qty}</td>
                <td>{Number(item.points_cost_snapshot).toLocaleString()}</td>
                <td>{(item.points_cost_snapshot * item.qty).toLocaleString()}</td>
              </tr>
            ))}</tbody>
          </table>
          <div style={{ display:'flex', gap:8, marginTop:12, flexWrap:'wrap' }}>
            <button className="btn btn-ghost" onClick={() => setCurrentPage('order-history')}>← Back to History</button>
            {order.status === 'pending' && (
              <button className="btn btn-secondary" style={{ color:'#dc2626', borderColor:'#dc2626' }}
                disabled={cancelLoading} onClick={handleCancel}>
                {cancelLoading ? 'Cancelling...' : 'Cancel Order'}
              </button>
            )}
          </div>
          {cancelError && <p style={{ color:'var(--danger)', marginTop:8 }}>{cancelError}</p>}
        </div>
      </main>
    </div>
  )
}
```

---

### 6H — SponsorPreviewPage component

Add in sponsor section of App.jsx:
```jsx
const SponsorPreviewPage = () => {
  const [items, setItems] = React.useState([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    let cancelled = false
    const fetch = async () => {
      setLoading(true); setError('')
      try {
        const data = await api('/preview-catalog', { method: 'GET' })
        if (!cancelled) setItems(data.items || [])
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Failed to load preview')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetch()
    return () => { cancelled = true }
  }, [])

  return (
    <div><Navigation />
      <main className="app-main">
        <h1 className="page-title">Catalog Preview</h1>
        <p className="page-subtitle">This is how your catalog appears to affiliated drivers (read-only).</p>
        {loading ? <p>Loading...</p> : error ? <p style={{ color:'var(--danger)' }}>{error}</p> :
          items.length === 0 ? <div className="card"><p className="activity-empty">No available items found.</p></div> :
          <div className="card">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:16 }}>
              {items.map(item => (
                <div key={item.id} style={{ border:'1px solid var(--border)', borderRadius:8, padding:12 }}>
                  {item.image_url && <img src={item.image_url} alt={item.title} style={{ width:'100%', height:120, objectFit:'contain' }} />}
                  <p style={{ fontWeight:600, margin:'8px 0 4px' }}>{item.title}</p>
                  <p style={{ color:'var(--text-muted)', fontSize:'0.85em' }}>{Number(item.point_cost).toLocaleString()} pts</p>
                </div>
              ))}
            </div>
          </div>
        }
      </main>
    </div>
  )
}
```

Add page routing:
```jsx
// pageToPath
case 'sponsor-preview':
  return '/sponsor-preview'

// pathToPage
if (path === '/sponsor-preview') return 'sponsor-preview'

// render block (near other logged-in pages)
{isLoggedIn && currentPage === 'sponsor-preview' && <SponsorPreviewPage />}
```

---

### 6I — Render block additions (near App.jsx line 8804)

FIND:
```jsx
{isLoggedIn && currentPage === 'cart' && <CartPage />}
```
ADD AFTER:
```jsx
{isLoggedIn && currentPage === 'order-confirmation' && <OrderConfirmationPage />}
{isLoggedIn && currentPage === 'order-history' && <OrderHistoryPage />}
{isLoggedIn && currentPage === 'order-detail' && <OrderDetailPage />}
{isLoggedIn && currentPage === 'sponsor-preview' && <SponsorPreviewPage />}
```

### 6J — Navigation links

In the driver navigation (wherever the "Cart" link is), add a link to `'order-history'` labeled "Orders".
In the sponsor navigation, add a link to `'sponsor-preview'` labeled "Preview Catalog".

---

## VERIFICATION CHECKLIST

```
[ ] 006_orders.sql runs twice with zero errors
[ ] POST /orders with empty cart → 400
[ ] POST /orders with insufficient reserved balance → 402
[ ] POST /orders success → order row + order_items rows created, driver_cart_items empty, all in same transaction
[ ] GET /orders?status=pending → only pending orders returned
[ ] GET /orders/:id → full items array with snapshots
[ ] POST /orders/:id/cancel with status=confirmed → 409
[ ] POST /orders/:id/cancel with status=pending → 200, status='cancelled'
[ ] PATCH /orders/:id/status pending→confirmed (sponsor) → 200, no ledger entry
[ ] PATCH /orders/:id/status confirmed→delivered (sponsor) → 200, driver_points_ledger row inserted with delta=-total_points
[ ] PATCH /orders/:id/status pending→delivered (sponsor) → 409 (must confirm first)
[ ] PATCH /orders/:id/status delivered→cancelled (sponsor) → 409
[ ] Sponsor without item in order cannot PATCH status → 403
[ ] GET /preview-catalog → items from all sponsors with same company_name, is_available=1 only
[ ] POST /catalog/:id/redeem → 410
[ ] GET /orders/export → Content-Type: application/pdf, attachment
[ ] GET /orders/:id/export → Content-Type: application/pdf, attachment
[ ] CartPage checkout: success → clears cart, navigates to order-confirmation, shows lastOrder
[ ] CartPage checkout: 402 response → shows checkoutError message, cart retained
[ ] OrderDetailPage: cancelled order shows cancellation_reason prominently
[ ] OrderDetailPage: Cancel button visible only when status=pending
[ ] SponsorPreviewPage: read-only grid, no add-to-cart controls
[ ] Cross-org cart: items from 2 sponsors same company → single order, 2 sponsor_ids in order_items
```

---

## FILE MANIFEST

| Action | Path |
|--------|------|
| CREATE | `backend/packages/db/migrations/006_orders.sql` |
| CREATE | `backend/routes/driver/orders.js` |
| CREATE | `backend/routes/sponsor/orders.js` |
| MODIFY | `backend/routes/driver/catalog.js` — POST /:id/redeem → 410 |
| MODIFY | `backend/services/driver/src/index.js` — add require + app.use /orders after line 916 |
| MODIFY | `backend/services/sponsor/src/index.js` — add require + app.use /orders + GET /preview-catalog after line 1289 |
| MODIFY | `backend/services/driver/package.json` — add "pdfkit" dependency |
| MODIFY | `frontend/src/App.jsx` — state, pageToPath, pathToPage, CartPage checkout, 4 new page components, render blocks, nav links |
