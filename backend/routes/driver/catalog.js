const express = require('express');
const router = express.Router();
const db = require('../../packages/db/src/index');

// -- Shared helpers: resolve affiliated sponsor org(s) and sponsor ids ----------
// Drivers can be affiliated either by sponsor_org OR by accepted applications.
// We treat the catalog as an *organization* catalog: items created by any sponsor
// account under the same company_name are visible to affiliated drivers.
async function getAffiliatedCompanyNames(driverId) {
    const rows = await db.query(
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
    return (rows || []).map(r => r.company_name).filter(Boolean);
}

async function getSponsorIdsForCompanies(companyNames) {
    const names = (companyNames || []).map(n => String(n).trim()).filter(Boolean);
    if (names.length === 0) return [];
    const placeholders = names.map(() => '?').join(',');
    const rows = await db.query(
        `SELECT user_id AS sponsor_id
         FROM sponsor_profiles
         WHERE TRIM(company_name) IN (${placeholders})`,
        names
    );
    return (rows || []).map(r => Number(r.sponsor_id)).filter(Number.isFinite);
}

async function getAffiliatedSponsorIds(driverId) {
    const companies = await getAffiliatedCompanyNames(driverId);
    return await getSponsorIdsForCompanies(companies);
}

// GET /api/driver/catalog/categories
// Must be registered BEFORE /:id so Express does not match 'categories' as a numeric id.
router.get('/categories', async (req, res) => {
    try {
        const sponsorIds = await getAffiliatedSponsorIds(req.user.id);
        if (!sponsorIds.length) return res.json({ categories: [] });

        const rows = await db.query(
            `SELECT DISTINCT category
             FROM catalog_items
             WHERE sponsor_id IN (${sponsorIds.map(() => '?').join(',')})
               AND category IS NOT NULL AND category != ''
             ORDER BY category ASC`,
            sponsorIds
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
        const sponsorIds = await getAffiliatedSponsorIds(req.user.id);
        if (!sponsorIds.length) return res.json({ items: [] });

        const conditions = [`sponsor_id IN (${sponsorIds.map(() => '?').join(',')})`];
        const params = [...sponsorIds];

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
            `SELECT id, sponsor_id, external_item_id, title, description, image_url, point_cost, category, is_available, created_at FROM catalog_items WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`,
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

        const sponsorIds = await getAffiliatedSponsorIds(req.user.id);
        if (!sponsorIds.length) return res.status(404).json({ error: 'Item not found' });

        const rows = await db.query(
            `SELECT id, sponsor_id, external_item_id, title, description, image_url, point_cost, category, is_available, created_at FROM catalog_items WHERE id = ? AND sponsor_id IN (${sponsorIds.map(() => '?').join(',')}) LIMIT 1`,
            [itemId, ...sponsorIds]
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

        const sponsorIds = await getAffiliatedSponsorIds(req.user.id);
        if (!sponsorIds.length) return res.status(404).json({ error: 'Item not found' });

        const rows = await db.query(
            `SELECT * FROM catalog_items WHERE id = ? AND sponsor_id IN (${sponsorIds.map(() => '?').join(',')}) LIMIT 1`,
            [itemId, ...sponsorIds]
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
            [req.user.id, item.sponsor_id, -item.point_cost, `Catalog redemption: ${item.title}`]
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
