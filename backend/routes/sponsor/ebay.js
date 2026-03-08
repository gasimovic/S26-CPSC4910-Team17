const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const ebay = require('../../utils/ebayClient');

// ─────────────────────────────────────────────────────────────────────────────
// Minimal fallback shown only when the eBay API is completely unreachable.
// In production, real data is returned and this is never used.
// ─────────────────────────────────────────────────────────────────────────────
const API_FALLBACK = [
    { itemId: 'fallback-001', title: 'Sony WH-1000XM5 Noise Canceling Headphones', price: { value: '279.99' }, image: null, itemWebUrl: null },
    { itemId: 'fallback-002', title: 'Apple AirPods Pro (2nd Generation)', price: { value: '189.99' }, image: null, itemWebUrl: null },
    { itemId: 'fallback-003', title: 'Nintendo Switch OLED Model', price: { value: '349.00' }, image: null, itemWebUrl: null },
];

// ─────────────────────────────────────────────────────────────────────────────
// Popular items cache — 10 minutes, invalidated on server restart.
// Prevents burning API quota on every catalog page load.
// ─────────────────────────────────────────────────────────────────────────────
let _popularCache = null;
let _popularCacheExp = 0;
const POPULAR_TTL_MS = 10 * 60 * 1000; // 10 minutes

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sponsor/ebay/search?q=<keyword>
// ─────────────────────────────────────────────────────────────────────────────
router.get('/search', async (req, res) => {
    const keyword = (req.query.q || '').trim();
    if (!keyword) return res.status(400).json({ error: 'Search keyword is required' });

    try {
        const { items, useProd } = await ebay.search(keyword, 12);
        const env = useProd ? 'PRODUCTION' : 'SANDBOX';
        console.log(`[eBay] ${env} search "${keyword}" → ${items.length} items`);
        return res.json({ items, mock: false });
    } catch (err) {
        const status = err.response?.status;
        console.error(`[eBay] search failed (HTTP ${status ?? 'N/A'}):`, err.response?.data ?? err.message);
        // Return fallback so the UI never goes blank
        return res.json({ items: API_FALLBACK, mock: true });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/sponsor/ebay/popular
// Single-call category browse (Electronics, bestMatch) with a 10-min cache.
// ─────────────────────────────────────────────────────────────────────────────
router.get('/popular', async (req, res) => {
    if (_popularCache && Date.now() < _popularCacheExp) {
        console.log('[eBay] popular → cache hit');
        return res.json(_popularCache);
    }

    try {
        const { items, useProd } = await ebay.popular(12);
        const env = useProd ? 'PRODUCTION' : 'SANDBOX';
        console.log(`[eBay] ${env} popular → ${items.length} items`);

        const payload = { items: items.length ? items : API_FALLBACK, mock: items.length === 0 };
        _popularCache = payload;
        _popularCacheExp = Date.now() + POPULAR_TTL_MS;
        return res.json(payload);
    } catch (err) {
        const status = err.response?.status;
        console.error(`[eBay] popular failed (HTTP ${status ?? 'N/A'}):`, err.response?.data ?? err.message);
        return res.json({ items: API_FALLBACK, mock: true });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// eBay Marketplace Account Deletion Webhook
// REQUIRED for production key compliance (GDPR).
//   GET  — eBay verification challenge (SHA-256 hash response)
//   POST — marketplace account deletion notification (just acknowledge)
//
// Set in .env:
//   EBAY_VERIFICATION_TOKEN  — token you created on developer.ebay.com
//   EBAY_DELETION_ENDPOINT   — full public HTTPS URL of this route
// ─────────────────────────────────────────────────────────────────────────────
router.get('/account-deletion', (req, res) => {
    const { challenge_code: challengeCode } = req.query;
    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
    const endpoint = process.env.EBAY_DELETION_ENDPOINT;

    if (!challengeCode) return res.status(400).json({ error: 'Missing challenge_code' });
    if (!verificationToken || !endpoint) {
        console.error('[eBay] EBAY_VERIFICATION_TOKEN or EBAY_DELETION_ENDPOINT not set');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    // eBay spec: SHA-256(challengeCode + verificationToken + endpoint)
    const hash = crypto.createHash('sha256')
        .update(challengeCode + verificationToken + endpoint)
        .digest('hex');

    console.log('[eBay] Account deletion challenge responded');
    return res.json({ challengeResponse: hash });
});

router.post('/account-deletion', (req, res) => {
    // We store no eBay user data — acknowledge receipt.
    console.log('[eBay] Account deletion notification received');
    return res.status(200).json({ ok: true });
});

module.exports = router;
