const express = require('express');
const router = express.Router();
const { query, pool } = require('../../packages/db/src/index');

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.trunc(n);
  return v > 0 ? v : fallback;
}

async function sponsorOwnsOrder(orderId, sponsorId) {
  const rows = await query(
    'SELECT id FROM order_items WHERE order_id = ? AND sponsor_id = ? LIMIT 1',
    [orderId, sponsorId]
  );
  return rows && rows.length > 0;
}

async function fetchSponsorOrderDetail(orderId, sponsorId) {
  const owns = await sponsorOwnsOrder(orderId, sponsorId);
  if (!owns) return null;

  const rows = await query(
    `SELECT id, driver_id, status, total_points, confirmation_number,
            confirmed_at, cancelled_at, cancellation_reason, cancelled_by_user_id,
            created_at, updated_at
     FROM orders
     WHERE id = ?
     LIMIT 1`,
    [orderId]
  );
  const order = rows?.[0];
  if (!order) return null;

  const items = await query(
    `SELECT id, catalog_item_id, sponsor_id, item_title_snapshot,
            item_image_url_snapshot, points_cost_snapshot, qty
     FROM order_items
     WHERE order_id = ?
     ORDER BY id ASC`,
    [orderId]
  );

  return { ...order, items: items || [] };
}

// GET /
router.get('/', async (req, res) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.max(1, Math.min(100, parsePositiveInt(req.query.limit, 20)));
    const offset = (page - 1) * limit;

    const allowedStatuses = new Set(['pending', 'confirmed', 'delivered', 'cancelled']);
    const status = allowedStatuses.has(req.query.status) ? req.query.status : null;

    const where = ['oi.sponsor_id = ?'];
    const params = [req.user.id];
    if (status) {
      where.push('o.status = ?');
      params.push(status);
    }
    const whereSql = where.join(' AND ');

    const orders = await query(
      `SELECT DISTINCT o.id, o.driver_id, o.status, o.total_points, o.confirmation_number,
              o.confirmed_at, o.cancelled_at, o.cancellation_reason, o.created_at, o.updated_at
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE ${whereSql}
       ORDER BY o.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const countRows = await query(
      `SELECT COUNT(DISTINCT o.id) AS total
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       WHERE ${whereSql}`,
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
    console.error('GET /sponsor/orders error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    const orderId = Number(req.params.id);
    if (!Number.isFinite(orderId)) {
      return res.status(400).json({ error: 'Invalid order id' });
    }

    const newStatus = String(req.body?.status || '').trim();
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim()
      ? req.body.reason.trim().slice(0, 255)
      : null;

    if (!['confirmed', 'delivered', 'cancelled'].includes(newStatus)) {
      return res.status(400).json({ error: 'Invalid status transition request' });
    }

    const orderRows = await query(
      'SELECT id, driver_id, status, total_points, confirmation_number FROM orders WHERE id = ? LIMIT 1',
      [orderId]
    );
    const order = orderRows?.[0];
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const owns = await sponsorOwnsOrder(orderId, req.user.id);
    if (!owns) return res.status(403).json({ error: 'You do not own this order' });

    if (order.status === 'delivered') {
      return res.status(409).json({ error: 'Delivered orders cannot be modified' });
    }
    if (order.status === 'cancelled') {
      return res.status(409).json({ error: 'Cancelled orders cannot be modified' });
    }

    if (order.status === 'pending' && newStatus === 'delivered') {
      return res.status(409).json({ error: 'Must confirm before delivering' });
    }

    if (order.status === 'pending' && !['confirmed', 'cancelled'].includes(newStatus)) {
      return res.status(409).json({ error: 'Invalid transition from pending' });
    }
    if (order.status === 'confirmed' && !['delivered', 'cancelled'].includes(newStatus)) {
      return res.status(409).json({ error: 'Invalid transition from confirmed' });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      if (newStatus === 'confirmed') {
        await conn.execute(
          `UPDATE orders
           SET status = 'confirmed', confirmed_at = NOW(), updated_at = NOW()
           WHERE id = ?`,
          [orderId]
        );
      } else if (newStatus === 'cancelled') {
        await conn.execute(
          `UPDATE orders
           SET status = 'cancelled',
               cancelled_at = NOW(),
               cancellation_reason = ?,
               cancelled_by_user_id = ?,
               updated_at = NOW()
           WHERE id = ?`,
          [reason, req.user.id, orderId]
        );
      } else {
        const [sponsorSubtotalRows] = await conn.execute(
          `SELECT COALESCE(SUM(points_cost_snapshot * qty), 0) AS sponsor_total
           FROM order_items
           WHERE order_id = ? AND sponsor_id = ?`,
          [orderId, req.user.id]
        );
        const sponsorTotal = Number(sponsorSubtotalRows?.[0]?.sponsor_total || 0);

        await conn.execute(
          `UPDATE orders
           SET status = 'delivered', updated_at = NOW()
           WHERE id = ?`,
          [orderId]
        );

        await conn.execute(
          `INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason)
           VALUES (?, ?, ?, ?)`,
          [
            order.driver_id,
            req.user.id,
            -sponsorTotal,
            `Order #${order.confirmation_number} delivered`
          ]
        );
      }

      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }

    const updated = await fetchSponsorOrderDetail(orderId, req.user.id);
    return res.json({ order: updated });
  } catch (err) {
    console.error('PATCH /sponsor/orders/:id/status error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
