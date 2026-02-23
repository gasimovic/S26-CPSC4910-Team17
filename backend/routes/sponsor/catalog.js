const express = require('express');
const router = express.Router();
// We use relative path to ensure it imports the existing db config directly
const db = require('../../packages/db/src/index');

// Assuming a standard auth middleware exists or will be wired up in the main server.js
// For now, we expect req.user.id to be populated.

// GET /api/sponsor/catalog - View current items in sponsor's shop
router.get('/', async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const items = await db.query(
            `SELECT * FROM catalog_items WHERE sponsor_id = ? ORDER BY created_at DESC`,
            [sponsorId]
        );
        res.json(items);
    } catch (err) {
        console.error("GET /catalog error:", err);
        res.status(500).json({ error: 'Failed to fetch catalog' });
    }
});

// POST /api/sponsor/catalog - Add an eBay item to the shop
router.post('/', async (req, res) => {
    try {
        const sponsorId = req.user.id;
        const { ebay_item_id, title, description, image_url, price, point_cost } = req.body;

        if (!title || price === undefined || point_cost === undefined) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await db.exec(
            `INSERT INTO catalog_items 
            (sponsor_id, ebay_item_id, title, description, image_url, price, point_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sponsorId, ebay_item_id, title, description || '', image_url, price, point_cost]
        );

        res.status(201).json({ success: true, insertId: result.insertId });
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

        await db.exec(
            `DELETE FROM catalog_items WHERE id = ? AND sponsor_id = ?`,
            [itemId, sponsorId]
        );
        res.json({ success: true });
    } catch (err) {
        console.error("DELETE /catalog error:", err);
        res.status(500).json({ error: 'Failed to delete item' });
    }
});

module.exports = router;
