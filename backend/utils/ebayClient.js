const axios = require('axios');
const { getEbayToken } = require('./ebayTokenManager');

// ─────────────────────────────────────────────────────────────────────────────
// eBay Browse API — production client
// All HTTP calls and item normalization live here.
// Route handlers call search() or popular() and never touch axios directly.
// ─────────────────────────────────────────────────────────────────────────────

const EBAY_API_BASE = 'https://api.ebay.com';
const BROWSE_SEARCH = `${EBAY_API_BASE}/buy/browse/v1/item_summary/search`;
const TIMEOUT_MS = 8000;

/**
 * Map a raw eBay itemSummary to the flat shape the frontend expects.
 * Frontend reads: item.itemId · item.title · item.image · item.price.value · item.itemWebUrl
 */
function normalizeItem(raw) {
    return {
        itemId: raw.itemId,
        title: raw.title,
        price: { value: raw.price?.value ?? '0.00', currency: raw.price?.currency ?? 'USD' },
        image: raw.image?.imageUrl ?? null,
        itemWebUrl: raw.itemWebUrl ?? null,
        condition: raw.condition ?? null,
    };
}

/**
 * Core Browse API caller — shared by search() and popular().
 * @param {object} params  Query params forwarded to eBay.
 * @returns {Promise<object[]>}  Array of normalized items.
 */
async function browseAPI(params) {
    const token = await getEbayToken();

    const response = await axios.get(BROWSE_SEARCH, {
        params,
        headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        timeout: TIMEOUT_MS,
    });

    return (response.data.itemSummaries || []).map(normalizeItem);
}

/**
 * Search eBay Production by keyword.
 * @param {string} keyword
 * @param {number} [limit=12]
 * @returns {Promise<object[]>}
 */
async function search(keyword, limit = 12) {
    return browseAPI({ q: keyword, limit });
}

/**
 * Fetch popular items via a single category browse call.
 * Category 293 = Consumer Electronics, sorted by bestMatch.
 * One API quota unit vs the old approach of 5 parallel keyword searches.
 * @param {number} [limit=12]
 * @returns {Promise<object[]>}
 */
async function popular(limit = 12) {
    return browseAPI({ category_ids: 293, sort: 'bestMatch', limit });
}

module.exports = { search, popular };
