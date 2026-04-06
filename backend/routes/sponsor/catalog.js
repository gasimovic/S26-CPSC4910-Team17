const express = require('express');
const router = express.Router();
const { query, exec } = require('@gdip/db');

// GET /api/sponsor/catalog - View current items in sponsor's shop
router.get('/', async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const items = await query(
            `SELECT id, sponsor_id, external_item_id, title, description, image_url, price, point_cost, category, is_available, created_at
             FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC`,
            [sponsorId]
        );
        // Return as { items: [...] } so frontend fetchShopItems works correctly
        res.json({ items: items || [] });
    } catch (err) {
        console.error("GET /catalog error:", err);
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

// POST /api/sponsor/catalog - Add a product to the shop
router.post('/', async (req, res) => {
    try {
        const sponsorId = req.user.id;

        // Accept both camelCase (from frontend) and snake_case field names
        const external_item_id = req.body.itemId || req.body.external_item_id || null;
        const title = req.body.title;
        const description = req.body.description || null;
        // Accept imageUrl (frontend sends camelCase) or image_url
        const image_url = req.body.imageUrl || req.body.image_url || null;
        const rawPrice = req.body.price;
        const price = (rawPrice !== undefined && rawPrice !== null && rawPrice !== '') ? parseFloat(rawPrice) : null;
        const category = req.body.category || null;
        const is_available = (req.body.isAvailable !== undefined)
            ? (req.body.isAvailable ? 1 : 0)
            : (req.body.is_available !== undefined ? (req.body.is_available ? 1 : 0) : 1);

        if (!title) {
            return res.status(400).json({ error: 'title is required' });
        }
        if (price === null || !Number.isFinite(price) || price < 0) {
            return res.status(400).json({ error: 'price must be a non-negative number' });
        }

        if (price === 0) {
            return res.status(400).json({ error: 'Price must be greater than 0 to calculate points automatically.' });
        }

        const rateRows = await query(
            `SELECT dollars_per_point FROM sponsor_conversion_rates WHERE sponsor_id = ? LIMIT 1`,
            [sponsorId]
        );
        if (!rateRows || rateRows.length === 0) {
            return res.status(400).json({ error: 'No conversion rate configured. Set one in Point Management before adding catalog items.' });
        }
        const dollarsPerPoint = parseFloat(rateRows[0].dollars_per_point);
        if (!Number.isFinite(dollarsPerPoint) || dollarsPerPoint <= 0) {
            return res.status(400).json({ error: 'Invalid conversion rate on file. Update it in Point Management.' });
        }
        const point_cost = Math.ceil(price / dollarsPerPoint);
        if (point_cost < 1) {
            return res.status(400).json({ error: 'Computed point cost is less than 1. Reduce the conversion rate or use a higher price.' });
        }

        if (external_item_id) {
            const existing = await query(
                `SELECT id FROM catalog_items WHERE sponsor_id = ? AND external_item_id = ? LIMIT 1`,
                [sponsorId, external_item_id]
            );

            if (existing.length > 0) {
                return res.status(409).json({ error: 'Item is already in your catalog' });
            }
        }

        const result = await exec(
            `INSERT INTO catalog_items 
            (sponsor_id, external_item_id, title, description, image_url, price, point_cost, category, is_available) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [sponsorId, external_item_id, title, description, image_url, price !== null ? price : 0, point_cost, category, is_available]
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

module.exports = router;
