const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getEbayToken } = require('../../utils/ebayTokenManager');

// ─────────────────────────────────────────────────────────────────────────────
// NOTE ON eBay SANDBOX:
// The eBay Sandbox environment has almost NO real listings.
// Searches via item_summary/search almost always return 0 items.
// This is a known, documented eBay limitation — the sandbox is meant to test
// your auth flow and code structure, NOT to browse real products.
//
// SOLUTION: We attempt the real eBay Sandbox call first. If it returns 0 items
// (which it almost always will), we fall back to realistic mock data so that
// the catalog feature remains testable.
// ─────────────────────────────────────────────────────────────────────────────

// Realistic mock items for sandbox fallback
const MOCK_ITEMS = [
    {
        itemId: 'v1|mock-001|0',
        title: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones - Black',
        price: { value: '279.99' },
        image: 'https://i.ebayimg.com/images/g/mock001/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock001'
    },
    {
        itemId: 'v1|mock-002|0',
        title: 'Apple AirPods Pro (2nd Generation) with MagSafe Case',
        price: { value: '189.99' },
        image: 'https://i.ebayimg.com/images/g/mock002/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock002'
    },
    {
        itemId: 'v1|mock-003|0',
        title: 'Samsung Galaxy Watch 6 Classic - 47mm - Black Stainless',
        price: { value: '249.95' },
        image: 'https://i.ebayimg.com/images/g/mock003/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock003'
    },
    {
        itemId: 'v1|mock-004|0',
        title: 'Fitbit Charge 6 Advanced Fitness Tracker - Obsidian',
        price: { value: '129.95' },
        image: 'https://i.ebayimg.com/images/g/mock004/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock004'
    },
    {
        itemId: 'v1|mock-005|0',
        title: 'Amazon Echo Dot (5th Gen) Smart Speaker with Alexa',
        price: { value: '34.99' },
        image: 'https://i.ebayimg.com/images/g/mock005/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock005'
    },
    {
        itemId: 'v1|mock-006|0',
        title: 'Anker 735 Charger GaNPrime 65W USB-C Fast Charging Adapter',
        price: { value: '35.99' },
        image: 'https://i.ebayimg.com/images/g/mock006/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock006'
    },
    {
        itemId: 'v1|mock-007|0',
        title: 'Nintendo Switch OLED Model - White Joy-Con Bundle',
        price: { value: '349.00' },
        image: 'https://i.ebayimg.com/images/g/mock007/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock007'
    },
    {
        itemId: 'v1|mock-008|0',
        title: 'Logitech MX Master 3S Wireless Performance Mouse',
        price: { value: '79.99' },
        image: 'https://i.ebayimg.com/images/g/mock008/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock008'
    },
    {
        itemId: 'v1|mock-009|0',
        title: 'GoPro HERO12 Black — Waterproof Action Camera 5.3K',
        price: { value: '299.99' },
        image: 'https://i.ebayimg.com/images/g/mock009/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock009'
    },
    {
        itemId: 'v1|mock-010|0',
        title: 'Kindle Paperwhite (16 GB) - 6.8" Display, Adjustable Warm Light',
        price: { value: '99.99' },
        image: 'https://i.ebayimg.com/images/g/mock010/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock010'
    },
    {
        itemId: 'v1|mock-011|0',
        title: 'Bose SoundLink Flex Bluetooth Portable Speaker - Stone Blue',
        price: { value: '119.00' },
        image: 'https://i.ebayimg.com/images/g/mock011/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock011'
    },
    {
        itemId: 'v1|mock-012|0',
        title: 'Tile Mate Bluetooth Tracker - 4 Pack - Keys, Wallets, Bags',
        price: { value: '59.99' },
        image: 'https://i.ebayimg.com/images/g/mock012/s-l300.jpg',
        itemWebUrl: 'https://www.ebay.com/itm/mock012'
    }
];

// Filter mock items by keyword (simple case-insensitive substring match)
function filterMockItems(keyword, limit = 12) {
    const kw = keyword.toLowerCase();
    const matched = MOCK_ITEMS.filter(item =>
        item.title.toLowerCase().includes(kw)
    );
    // If nothing matched, return all items (sandbox has no real data anyway)
    return (matched.length > 0 ? matched : MOCK_ITEMS).slice(0, limit);
}

// Shared helper: call eBay Browse API (auto-selects production vs sandbox)
async function ebaySearch(keyword, limit = 12) {
    const token = await getEbayToken();
    const host = process.env._EBAY_USE_PROD === 'true'
        ? 'https://api.ebay.com'
        : 'https://api.sandbox.ebay.com';
    const url = `${host}/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;

    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        timeout: 8000
    });

    return (response.data.itemSummaries || []).map(item => ({
        itemId: item.itemId,
        title: item.title,
        price: { value: item.price?.value || '0.00' },
        image: item.image?.imageUrl || null,
        itemWebUrl: item.itemWebUrl
    }));
}

// GET /api/sponsor/ebay/search?q=headphones
router.get('/search', async (req, res) => {
    const keyword = req.query.q;
    if (!keyword) {
        return res.status(400).json({ error: 'Search keyword is required' });
    }

    console.log(`[eBay] searching: "${keyword}"`);

    try {
        let results = [];
        let usedMock = false;

        try {
            results = await ebaySearch(keyword, 12);
            console.log(`[eBay] Sandbox returned ${results.length} live items for "${keyword}"`);
        } catch (ebayErr) {
            const status = ebayErr.response?.status;
            const body = ebayErr.response?.data;
            console.warn(`[eBay] Sandbox call failed (HTTP ${status || 'N/A'}):`, JSON.stringify(body || ebayErr.message));
            console.warn(`[eBay] Falling back to mock data for "${keyword}"`);
        }

        // If sandbox returned nothing (extremely common), use mock data
        if (results.length === 0) {
            results = filterMockItems(keyword, 12);
            usedMock = true;
            console.log(`[eBay] Using ${results.length} mock items for "${keyword}" (sandbox has no data — this is expected)`);
        }

        res.json({ items: results, mock: usedMock });

    } catch (error) {
        console.error(`[eBay] Unexpected search error:`, error.message);
        // Last resort: return mock data so the UI doesn't break
        const fallback = filterMockItems(keyword, 12);
        res.json({ items: fallback, mock: true });
    }
});

// GET /api/sponsor/ebay/popular
// Returns a curated mix of popular items. Tries the Sandbox first,
// falls back to mock data (standard for eBay sandbox environments).
const POPULAR_TERMS = ['headphones', 'smartwatch', 'gaming', 'gift card', 'bluetooth'];

router.get('/popular', async (req, res) => {
    console.log('[eBay] fetching popular items');
    try {
        // Attempt sandbox calls in parallel
        const results = await Promise.allSettled(
            POPULAR_TERMS.map(term => ebaySearch(term, 3))
        );

        let items = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value)
            .filter((item, idx, arr) => arr.findIndex(x => x.itemId === item.itemId) === idx)
            .slice(0, 12);

        let usedMock = false;
        if (items.length === 0) {
            console.warn('[eBay] Sandbox returned 0 popular items — using mock data (expected sandbox behavior)');
            items = MOCK_ITEMS.slice(0, 12);
            usedMock = true;
        }

        console.log(`[eBay] popular: ${items.length} items (mock=${usedMock})`);
        res.json({ items, mock: usedMock });

    } catch (error) {
        console.error('[eBay] popular error:', error.message);
        res.json({ items: MOCK_ITEMS.slice(0, 12), mock: true });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// eBay Marketplace Account Deletion Notification Endpoint
// REQUIRED by eBay to activate Production API keys (GDPR compliance).
// eBay will:
//   1. Send a GET request with a challenge_code to verify your endpoint
//   2. Send POST requests when eBay users delete their marketplace accounts
//
// Set EBAY_VERIFICATION_TOKEN in your .env to the token you entered on the
// eBay developer portal under Application Keys → Alerts & Notifications.
// ─────────────────────────────────────────────────────────────────────────────
const crypto = require('crypto');

// GET /api/sponsor/ebay/account-deletion  (eBay endpoint verification challenge)
router.get('/account-deletion', (req, res) => {
    const challengeCode = req.query.challenge_code;
    const verificationToken = process.env.EBAY_VERIFICATION_TOKEN;
    const endpoint = process.env.EBAY_DELETION_ENDPOINT; // full HTTPS URL of this endpoint

    if (!challengeCode) {
        return res.status(400).json({ error: 'Missing challenge_code' });
    }

    if (!verificationToken || !endpoint) {
        console.error('[eBay] EBAY_VERIFICATION_TOKEN or EBAY_DELETION_ENDPOINT not set in .env');
        return res.status(500).json({ error: 'Webhook not configured' });
    }

    // eBay requires: SHA-256 hash of (challengeCode + verificationToken + endpoint)
    const hash = crypto
        .createHash('sha256')
        .update(challengeCode + verificationToken + endpoint)
        .digest('hex');

    console.log(`[eBay] Account deletion challenge verified`);
    return res.json({ challengeResponse: hash });
});

// POST /api/sponsor/ebay/account-deletion  (actual deletion notification)
router.post('/account-deletion', (req, res) => {
    // We don't store any eBay user data, so nothing to delete.
    // Just acknowledge receipt so eBay knows the endpoint is alive.
    console.log('[eBay] Account deletion notification received:', JSON.stringify(req.body));
    return res.status(200).json({ ok: true });
});

module.exports = router;

