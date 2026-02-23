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

        // eBay Browse API request
        const response = await axios.get(
            `https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=${encodedKeyword}&limit=12&filter=buyingOptions:{FIXED_PRICE}`,
            {
                headers: { Authorization: `Bearer ${token}` }
            }
        );

        // Transform the massive response into a clean UI-friendly array
        const results = (response.data.itemSummaries || []).map(item => ({
            ebay_item_id: item.itemId,
            title: item.title,
            price: item.price?.value || "0.00",
            image_url: item.image?.imageUrl || null,
            item_web_url: item.itemWebUrl
        }));

        res.json({ items: results });
    } catch (error) {
        console.error("eBay search error:", error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to search eBay Sandbox' });
    }
});

module.exports = router;
