const express = require('express');
const router = express.Router();
const db = require('../../packages/db/src/index');

// -- Shared helper: resolve affiliated sponsor for a driver --------------------
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

// POST /api/driver/catalog/:id/redeem
// Deducts point_cost from the driver's balance and records the redemption in the ledger.
router.post('/:id/redeem', async (req, res) => {
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

        const item = rows[0];

        if (!item.is_available) {
            return res.status(400).json({ error: 'Item is not available for redemption' });
        }

        const balanceRows = await db.query(
            `SELECT COALESCE(SUM(delta), 0) AS balance FROM driver_points_ledger WHERE driver_id = ?`,
            [req.user.id]
        );
        const balance = Number(balanceRows[0]?.balance || 0);

        if (balance < item.point_cost) {
            return res.status(402).json({ error: 'Insufficient points' });
        }

        await db.exec(
            `INSERT INTO driver_points_ledger (driver_id, sponsor_id, delta, reason) VALUES (?, ?, ?, ?)`,
            [req.user.id, sponsorId, -item.point_cost, `Catalog redemption: ${item.title}`]
        );

        res.json({
            success: true,
            item: { id: item.id, title: item.title, point_cost: item.point_cost },
            newBalance: balance - item.point_cost
        });
    } catch (err) {
        console.error("POST /catalog/:id/redeem driver error:", err);
        res.status(500).json({ error: 'Failed to process redemption' });
    }
});

module.exports = router;
