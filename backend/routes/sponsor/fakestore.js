const express = require('express');
const router = express.Router();
const fakestore = require('../../utils/fakestoreClient');

const POPULAR_TTL_MS = 10 * 60 * 1000;
let _popularCache = null;
let _popularCacheExp = 0;

// GET /api/sponsor/fakestore/search?q=<keyword>
router.get('/search', async (req, res) => {
    const keyword = (req.query.q || '').trim();
    if (!keyword) {
        return res.status(400).json({ error: 'Search keyword is required', items: [] });
    }

    try {
        const items = await fakestore.searchProducts(keyword, 12);
        return res.json({ items });
    } catch (err) {
        console.error('[FakeStore] search failed:', err.message);
        return res.status(502).json({ error: 'Failed to reach Fake Store API', items: [] });
    }
});

// GET /api/sponsor/fakestore/popular
router.get('/popular', async (req, res) => {
    if (_popularCache && Date.now() < _popularCacheExp) {
        return res.json(_popularCache);
    }

    try {
        const items = await fakestore.getProductsByCategory('electronics');
        const payload = { items };
        _popularCache = payload;
        _popularCacheExp = Date.now() + POPULAR_TTL_MS;
        return res.json(payload);
    } catch (err) {
        console.error('[FakeStore] popular failed:', err.message);
        return res.status(502).json({ error: 'Failed to reach Fake Store API', items: [] });
    }
});

module.exports = router;
