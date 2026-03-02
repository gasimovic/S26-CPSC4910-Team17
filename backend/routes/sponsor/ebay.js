const express = require('express');
const axios = require('axios');
const router = express.Router();
const { getEbayToken } = require('../../utils/ebayTokenManager');

// GET /api/sponsor/ebay/search?q=headphones
router.get('/search', async (req, res) => {
    try {
        const keyword = req.query.q;
        if (!keyword) {
            return res.status(400).json({ error: 'Search keyword is required' });
        }

        const token = await getEbayToken();
        const encodedKeyword = encodeURIComponent(keyword);

        // Build URL manually so curly braces in the filter don't get mis-encoded by proxies
        const url = `https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=${encodedKeyword}&limit=12`;

        console.log(`[eBay] searching: "${keyword}"`);

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
                'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
            },
            timeout: 10000
        });

        const results = (response.data.itemSummaries || []).map(item => ({
            itemId: item.itemId,
            title: item.title,
            price: { value: item.price?.value || '0.00' },
            image: item.image?.imageUrl || null,
            itemWebUrl: item.itemWebUrl
        }));

        console.log(`[eBay] found ${results.length} items for "${keyword}"`);
        res.json({ items: results });
    } catch (error) {
        const status = error.response?.status;
        const body = error.response?.data;
        console.error(`[eBay] search error (HTTP ${status || 'N/A'}):`, body || error.message);
        res.status(500).json({
            error: 'Failed to search eBay Sandbox',
            detail: body || error.message
        });
    }
});

module.exports = router;
