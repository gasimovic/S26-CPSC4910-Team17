const express = require('express');
const router = express.Router();
const fakestore = require('../../utils/fakestoreClient');

// ─────────────────────────────────────────────────────────────────────────────
// Popular items cache — 10 minutes.
// Prevents spending API calls on every catalog page load.
// ─────────────────────────────────────────────────────────────────────────────
let _popularCache = null;
let _popularCacheExp = 0;
const POPULAR_TTL_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sponsor/fakestore/search?q=<keyword>  (mounted at /fakestore/search)
// Searches Fake Store products by keyword (client-side filter across all 20 products).
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    const keyword = (req.query.q || '').trim();
    if (!keyword) {
        return res.status(400).json({ error: 'Search keyword is required', items: [] });
    }

    try {
        const items = await fakestore.search(keyword, 12);
        console.log(`[FakeStore] search "${keyword}" → ${items.length} items`);
        return res.json({ items, mock: false });
    } catch (err) {
        console.error('[FakeStore] search failed:', {
            message: err.message,
            status: err.status ?? null,
            code: err.code ?? null,
            path: err.path ?? null,
        });
        return res.status(502).json({ error: 'Failed to reach Fake Store API', items: [] });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sponsor/fakestore/popular  (mounted at /fakestore/popular)
// Returns all electronics from Fake Store (6 products) — cached 10 minutes.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/popular', async (req, res) => {
    if (_popularCache && Date.now() < _popularCacheExp) {
        console.log('[FakeStore] popular → cache hit');
        return res.json(_popularCache);
    }

    try {
        const items = await fakestore.popular();
        console.log(`[FakeStore] popular → ${items.length} items`);

        const payload = { items, mock: false };
        _popularCache = payload;
        _popularCacheExp = Date.now() + POPULAR_TTL_MS;
        return res.json(payload);
    } catch (err) {
        console.error('[FakeStore] popular failed:', {
            message: err.message,
            status: err.status ?? null,
            code: err.code ?? null,
            path: err.path ?? null,
        });
        return res.status(502).json({ error: 'Failed to reach Fake Store API', items: [] });
    }
});

module.exports = router;
