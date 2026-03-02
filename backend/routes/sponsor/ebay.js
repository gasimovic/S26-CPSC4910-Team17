const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getEbayToken } = require('../../utils/ebayTokenManager');

// Shared helper: call eBay Browse API
async function ebaySearch(keyword, limit = 12) {
    const token = await getEbayToken();
    const url = `https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;

    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        timeout: 10000
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
        const results = await ebaySearch(keyword, 12);
        console.log(`[eBay] found ${results.length} items for "${keyword}"`);
        res.json({ items: results });
    } catch (error) {
        const status = error.response?.status;
        const body = error.response?.data;
        console.error(`[eBay] search error (HTTP ${status || 'N/A'}):`, body || error.message);
        res.status(500).json({ error: 'Failed to search eBay Sandbox', detail: body || error.message });
    }
});

// GET /api/sponsor/ebay/popular
// Returns a curated mix of popular items across common reward categories.
// Cycles through categories so the sandbox returns a reasonable variety.
const POPULAR_TERMS = ['headphones', 'smartwatch', 'gaming', 'gift card', 'bluetooth'];

router.get('/popular', async (req, res) => {
    console.log('[eBay] fetching popular items');
    try {
        // Fetch from multiple terms in parallel, then mix them together
        const results = await Promise.allSettled(
            POPULAR_TERMS.map(term => ebaySearch(term, 3))
        );

        const items = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value)
            // De-dupe by itemId (sandbox sometimes returns the same item for different queries)
            .filter((item, idx, arr) => arr.findIndex(x => x.itemId === item.itemId) === idx)
            .slice(0, 12);

        if (items.length === 0) {
            console.warn('[eBay] Sandbox returned 0 items — this is common in sandbox mode.');
        }

        console.log(`[eBay] popular: ${items.length} items`);
        res.json({ items });
    } catch (error) {
        console.error('[eBay] popular error:', error.message);
        res.status(500).json({ error: 'Failed to fetch popular items', detail: error.message });
    }
});

module.exports = router;
