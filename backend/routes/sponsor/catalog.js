const express = require('express');
const router = express.Router();
const { query, exec } = require('@gdip/db');

// GET /api/sponsor/catalog - View current items in sponsor's shop
router.get('/', async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const items = await query(
            `SELECT * FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC`,
            [sponsorId]
        );
        // Return as { items: [...] } so frontend fetchShopItems works correctly
        res.json({ items: items || [] });
    } catch (err) {
        console.error("GET /catalog error:", err);
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

// POST /api/sponsor/catalog - Add an eBay item to the shop
router.post('/', async (req, res) => {
    try {
        const sponsorId = req.user.id;

        // Accept both camelCase (from frontend) and snake_case field names
        const ebay_item_id = req.body.ebayItemId || req.body.ebay_item_id || null;
        const title = req.body.title;
        const description = req.body.description || null;
        // Accept imageUrl (frontend sends camelCase) or image_url
        const image_url = req.body.imageUrl || req.body.image_url || null;
        const rawPrice = req.body.price;
        const price = (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') ? parseFloat(rawPrice) : null;
        const point_cost = parseInt(req.body.pointCost || req.body.point_cost, 10);

        if (!title) {
            return res.status(400).json({ error: 'title is required' });
        }
        if (price === null || !Number.isFinite(price) || price < 0) {
            return res.status(400).json({ error: 'price must be a non-negative number' });
        }
        if (!Number.isFinite(point_cost) || point_cost <= 0) {
            return res.status(400).json({ error: 'pointCost must be a positive integer' });
        }

        const result = await exec(
            `INSERT INTO catalog_items 
            (sponsor_id, ebay_item_id, title, description, image_url, price, point_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sponsorId, ebay_item_id, title, description, image_url, price !== null ? price : 0, point_cost]
        );

        res.status(201).json({ ok: true, itemId: result.insertId, message: 'Item added to catalog' });
    } catch (err) {
        console.error("POST /catalog error:", err);
        res.status(500).json({ error: 'Failed to add item to catalog' });
    }
});

// DELETE /api/sponsor/catalog/:id - Remove item
router.delete('/:id', async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const itemId = req.params.id;

        const result = await exec(
            `DELETE FROM catalog_items WHERE id = ? AND sponsor_id = ?`,
            [itemId, sponsorId]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: 'Item not found or does not belong to you' });
        }

        res.json({ ok: true, message: 'Item removed' });
    } catch (err) {
        console.error("DELETE /catalog error:", err);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

module.exports = router;
