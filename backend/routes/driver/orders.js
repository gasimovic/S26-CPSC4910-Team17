const express = require('express');
const PDFDocument = require('pdfkit');
const router = express.Router();
const { query, pool } = require('../../packages/db/src/index');

async function getAffiliatedCompanyNames(driverId) {
  const rows = await query(
    `
      SELECT DISTINCT TRIM(dp.sponsor_org) AS company_name
      FROM driver_profiles dp
      WHERE dp.user_id = ? AND dp.sponsor_org IS NOT NULL AND TRIM(dp.sponsor_org) != ''

      UNION

      SELECT DISTINCT TRIM(sp.company_name) AS company_name
      FROM applications a
      JOIN sponsor_profiles sp ON a.sponsor_id = sp.user_id
      WHERE a.driver_id = ? AND a.status = 'accepted'
        AND sp.company_name IS NOT NULL AND TRIM(sp.company_name) != ''
    `,
    [driverId, driverId]
  );
  return (rows || []).map((r) => r.company_name).filter(Boolean);
}

async function getSponsorIdsForCompanies(companyNames) {
  const names = (companyNames || []).map((n) => String(n).trim()).filter(Boolean);
  if (!names.length) return [];
  const placeholders = names.map(() => '?').join(',');
  const rows = await query(
    `SELECT user_id AS sponsor_id
     FROM sponsor_profiles
     WHERE TRIM(company_name) IN (${placeholders})`,
    names
  );
  return (rows || []).map((r) => Number(r.sponsor_id)).filter(Number.isFinite);
}

async function getAffiliatedSponsorIds(driverId) {
  const companies = await getAffiliatedCompanyNames(driverId);
  return getSponsorIdsForCompanies(companies);
}

function generateConfirmationNumber() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`.substring(0, 20);
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.trunc(n);
  return v > 0 ? v : fallback;
}

function parseDateOrNull(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

async function fetchOrderDetailForDriver(orderId, driverId) {
  const orderRows = await query(
    `SELECT id, driver_id, status, total_points, confirmation_number,
            confirmed_at, cancelled_at, cancellation_reason, cancelled_by_user_id,
            created_at, updated_at
     FROM orders
     WHERE id = ? AND driver_id = ?
     LIMIT 1`,
    [orderId, driverId]
  );
  const order = orderRows?.[0];
  if (!order) return null;

  const items = await query(
    `SELECT oi.id, oi.catalog_item_id, oi.sponsor_id,
            oi.item_title_snapshot, oi.item_image_url_snapshot,
            oi.points_cost_snapshot, oi.qty
     FROM order_items oi
     WHERE oi.order_id = ?
     ORDER BY oi.id ASC`,
    [order.id]
  );

  return { ...order, items: items || [] };
}

function startPdf(res, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);
  return doc;
}

// 1) GET /export
router.get('/export', async (req, res) => {
  try {
    const orders = await query(
      `SELECT id, status, total_points, confirmation_number, confirmed_at,
              cancelled_at, cancellation_reason, created_at
       FROM orders
       WHERE driver_id = ?
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    const doc = startPdf(res, 'order-history.pdf');
    doc.fontSize(18).text('Order History', { align: 'left' });
    doc.moveDown(0.3);
    doc.fontSize(10).text(`Driver ID: ${req.user.id}`);
    doc.text(`Exported: ${new Date().toLocaleString()}`);
    doc.moveDown();

    for (const order of orders || []) {
      const items = await query(
        `SELECT item_title_snapshot, qty, points_cost_snapshot
         FROM order_items
         WHERE order_id = ?
         ORDER BY id ASC`,
        [order.id]
      );
      const itemSummary = (items || [])
        .map((it) => `${it.item_title_snapshot} x${it.qty}`)
        .join(', ');

      doc.fontSize(11).text(`#${order.confirmation_number} | ${new Date(order.created_at).toLocaleString()}`);
      doc.fontSize(10).text(`Status: ${order.status} | Total: ${Number(order.total_points).toLocaleString()} pts`);
      doc.fontSize(10).text(`Items: ${itemSummary || 'None'}`);
      if (order.status === 'cancelled' && order.cancellation_reason) {
        doc.fillColor('red').text(`Cancellation reason: ${order.cancellation_reason}`).fillColor('black');
      }
      doc.moveDown(0.7);
    }

    doc.end();
  } catch (err) {
    console.error('GET /orders/export error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 2) POST /
router.post('/', async (req, res) => {
  try {
    const rows = await query(
      `SELECT dci.qty, ci.id, ci.title, ci.image_url, ci.point_cost, ci.sponsor_id, ci.is_available
       FROM driver_cart_items dci
       JOIN catalog_items ci ON ci.id = dci.catalog_item_id
       WHERE dci.driver_id = ?`,
      [req.user.id]
    );

    if (!rows?.length) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    const unavailable = rows.filter((r) => Number(r.is_available) === 0);
    if (unavailable.length) {
      return res.status(400).json({
        error: 'Cart contains unavailable items',
        items: unavailable.map((r) => ({ id: r.id, title: r.title }))
      });
    }

    const affiliatedSponsorIds = await getAffiliatedSponsorIds(req.user.id);
    const sponsorIdSet = new Set((affiliatedSponsorIds || []).map((id) => Number(id)));
    const unaffiliated = rows.filter((r) => !sponsorIdSet.has(Number(r.sponsor_id)));
    if (unaffiliated.length) {
      return res.status(400).json({ error: 'Cart contains items from unaffiliated sponsors' });
    }

    const totalPoints = rows.reduce(
      (sum, row) => sum + (Number(row.point_cost || 0) * Number(row.qty || 1)),
      0
    );

    const actualBalanceRows = await query(
      'SELECT COALESCE(SUM(delta), 0) AS b FROM driver_points_ledger WHERE driver_id = ?',
      [req.user.id]
    );
    const reservedRows = await query(
      `SELECT COALESCE(SUM(total_points), 0) AS r
       FROM orders
       WHERE driver_id = ? AND status IN ('pending','confirmed')`,
      [req.user.id]
    );

    const actualBalance = Number(actualBalanceRows?.[0]?.b || 0);
    const reserved = Number(reservedRows?.[0]?.r || 0);
    const available = actualBalance - reserved;

    if (available < totalPoints) {
      return res.status(402).json({
        error: 'Insufficient available points',
        available,
        required: totalPoints
      });
    }

    const confirmationNumber = generateConfirmationNumber();
    const conn = await pool.getConnection();
    let orderId;

    try {
      await conn.beginTransaction();

      const [orderResult] = await conn.execute(
        `INSERT INTO orders (driver_id, status, total_points, confirmation_number)
         VALUES (?, 'pending', ?, ?)`,
        [req.user.id, totalPoints, confirmationNumber]
      );
      orderId = orderResult.insertId;

      const values = [];
      const placeholders = rows.map(() => '(?,?,?,?,?,?,?)').join(',');
      for (const row of rows) {
        values.push(
          orderId,
          Number(row.id),
          Number(row.sponsor_id),
          String(row.title || ''),
          row.image_url || null,
          Number(row.point_cost || 0),
          Number(row.qty || 1)
        );
      }

      await conn.execute(
        `INSERT INTO order_items (
          order_id, catalog_item_id, sponsor_id, item_title_snapshot,
          item_image_url_snapshot, points_cost_snapshot, qty
        ) VALUES ${placeholders}`,
        values
      );

      await conn.execute('DELETE FROM driver_cart_items WHERE driver_id = ?', [req.user.id]);
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const order = await fetchOrderDetailForDriver(orderId, req.user.id);
    return res.status(201).json({ order });
  } catch (err) {
    console.error('POST /orders error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 3) GET /
router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.max(1, Math.min(100, parsePositiveInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const allowedStatuses = new Set(['pending', 'confirmed', 'delivered', 'cancelled']);
    let statusFilter = req.query.status;
    if (Array.isArray(statusFilter)) {
      statusFilter = statusFilter[0];
    }
    const status = allowedStatuses.has(statusFilter) ? statusFilter : null;

    const from = parseDateOrNull(req.query.from);
    const to = parseDateOrNull(req.query.to);

    const where = ['driver_id = ?'];
    const params = [req.user.id];

    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (from) {
      where.push('created_at >= ?');
      params.push(from);
    }
    if (to) {
      where.push('created_at <= ?');
      params.push(to);
    }

    const whereSql = where.join(' AND ');

    const orders = await query(
      `SELECT id, status, total_points, confirmation_number, confirmed_at,
              cancelled_at, cancellation_reason, created_at, updated_at
       FROM orders
       WHERE ${whereSql}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRows = await query(
      `SELECT COUNT(*) AS total FROM orders WHERE ${whereSql}`,
      params
    );

    const total = Number(countRows?.[0]?.total || 0);
    return res.json({
      orders: orders || [],
      total,
      page,
      limit,
      pages: Math.max(1, Math.ceil(total / limit))
    });
  } catch (err) {
    console.error('GET /orders error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 4) GET /:id
router.get('/:id', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await fetchOrderDetailForDriver(orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    return res.json({ order });
  } catch (err) {
    console.error('GET /orders/:id error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 5) GET /:id/export
router.get('/:id/export', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const order = await fetchOrderDetailForDriver(orderId, req.user.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const doc = startPdf(res, `order-${order.confirmation_number}.pdf`);
    doc.fontSize(18).text('Order Receipt');
    doc.moveDown(0.4);
    doc.fontSize(10).text(`Confirmation #: ${order.confirmation_number}`);
    doc.text(`Order Date: ${new Date(order.created_at).toLocaleString()}`);
    doc.text(`Status: ${order.status}`);
    doc.moveDown();

    for (const item of order.items || []) {
      const subtotal = Number(item.points_cost_snapshot || 0) * Number(item.qty || 1);
      doc.fontSize(11).text(item.item_title_snapshot || 'Item');
      doc.fontSize(10).text(`Qty: ${item.qty} | Each: ${Number(item.points_cost_snapshot).toLocaleString()} pts | Subtotal: ${subtotal.toLocaleString()} pts`);
      doc.moveDown(0.4);
    }

    doc.moveDown(0.5);
    doc.fontSize(12).text(`Total: ${Number(order.total_points).toLocaleString()} pts`);
    if (order.status === 'cancelled' && order.cancellation_reason) {
      doc.moveDown(0.5);
      doc.fillColor('red').fontSize(11).text(`Cancelled: ${order.cancellation_reason}`).fillColor('black');
    }

    doc.end();
  } catch (err) {
    console.error('GET /orders/:id/export error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// 6) POST /:id/cancel
router.post('/:id/cancel', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 255)
      : null;

    const rows = await query(
      'SELECT id, status FROM orders WHERE id = ? AND driver_id = ? LIMIT 1',
      [orderId, req.user.id]
    );
    const order = rows?.[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'pending') {
      return res.status(409).json({ error: 'Only pending orders can be cancelled by the driver' });
    }

    await query(
      `UPDATE orders
       SET status = 'cancelled',
           cancelled_at = NOW(),
           cancellation_reason = ?,
           cancelled_by_user_id = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [reason, req.user.id, orderId]
    );

    const updated = await fetchOrderDetailForDriver(orderId, req.user.id);
    return res.json({ order: updated });
  } catch (err) {
    console.error('POST /orders/:id/cancel error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
