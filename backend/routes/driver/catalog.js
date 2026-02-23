const express = require('express');
const router = express.Router();
const db = require('../../packages/db/src/index');

// GET /api/driver/catalog - Fetch store items available to the driver
router.get('/', async (req, res) => {
    try {
        const driverId = req.user.id;

        // Find which sponsor this driver is affiliated with via application OR sponsor_org
        const sponsorQuery = await db.query(`
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

        if (sponsorQuery.length === 0) {
            return res.json([]); // No sponsor = empty shop
        }

        const sponsorId = sponsorQuery[0].sponsor_id;

        // Fetch the catalog for that sponsor
        const items = await db.query(
            `SELECT * FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC`,
            [sponsorId]
        );

        res.json(items);
    } catch (err) {
        console.error("GET /catalog driver error:", err);
        res.status(500).json({ error: 'Failed to load driver catalog' });
    }
});

module.exports = router;
