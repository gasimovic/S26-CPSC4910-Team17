const express = require('express');
const router = express.Router();
const ebay = require('../../utils/ebayClient');

// ─────────────────────────────────────────────────────────────────────────────
// Fallback — shown only when the eBay production API is completely unreachable.
// Three items with no images so the UI never goes blank on a network failure.
// ─────────────────────────────────────────────────────────────────────────────
const API_FALLBACK = [
    { itemId: 'fallback-001', title: 'Sony WH-1000XM5 Noise Canceling Headphones', price: { value: '279.99' }, image: null, itemWebUrl: null },
    { itemId: 'fallback-002', title: 'Apple AirPods Pro (2nd Generation)', price: { value: '189.99' }, image: null, itemWebUrl: null },
    { itemId: 'fallback-003', title: 'Nintendo Switch OLED Model', price: { value: '349.00' }, image: null, itemWebUrl: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// Popular items cache — 10 minutes.
// Prevents spending API quota on every catalog page load.
// ─────────────────────────────────────────────────────────────────────────────
let _popularCache = null;
let _popularCacheExp = 0;
const POPULAR_TTL_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sponsor/ebay/search?q=<keyword>
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    const keyword = (req.query.q || '').trim();
    if (!keyword) return res.status(400).json({ error: 'Search keyword is required' });

    try {
        const items = await ebay.search(keyword, 12);
        console.log(`[eBay] search "${keyword}" → ${items.length} items`);
        return res.json({ items, mock: false });
    } catch (err) {
        console.error(`[eBay] search failed (HTTP ${err.response?.status ?? 'N/A'}):`, err.response?.data ?? err.message);
        return res.json({ items: API_FALLBACK, mock: true });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sponsor/ebay/popular
// Single category browse (Electronics, bestMatch) — cached 10 minutes.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/popular', async (req, res) => {
    if (_popularCache && Date.now() < _popularCacheExp) {
        console.log('[eBay] popular → cache hit');
        return res.json(_popularCache);
    }

    try {
        const items = await ebay.popular(12);
        console.log(`[eBay] popular → ${items.length} items`);

        const payload = { items: items.length ? items : API_FALLBACK, mock: items.length === 0 };
        _popularCache = payload;
        _popularCacheExp = Date.now() + POPULAR_TTL_MS;
        return res.json(payload);
    } catch (err) {
        console.error(`[eBay] popular failed (HTTP ${err.response?.status ?? 'N/A'}):`, err.response?.data ?? err.message);
        return res.json({ items: API_FALLBACK, mock: true });
    }
});

module.exports = router;
