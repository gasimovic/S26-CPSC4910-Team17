const axios = require('axios');
const { getEbayToken } = require('./ebayTokenManager');

// ─────────────────────────────────────────────────────────────────────────────
// eBay Browse API thin client
// All raw HTTP + response normalization lives here.
// Route handlers import { search, popular } — they never touch axios directly.
// ─────────────────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 8000;
const MARKETPLACE_HEADER = 'EBAY_US';

/**
 * Map a raw eBay itemSummary to the flat shape the frontend expects.
 * Frontend reads: item.itemId  item.title  item.image  item.price.value  item.itemWebUrl
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
 * Returns { items: NormalizedItem[], useProd: boolean }
 */
async function browseAPI(params) {
    const { token, useProd } = await getEbayToken();
    const base = useProd ? 'https://api.ebay.com' : 'https://api.sandbox.ebay.com';

    const response = await axios.get(`${base}/buy/browse/v1/item_summary/search`, {
        params,
        headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': MARKETPLACE_HEADER,
        },
        timeout: TIMEOUT_MS,
    });

    const items = (response.data.itemSummaries || []).map(normalizeItem);
    return { items, useProd };
}

/**
 * Search eBay by keyword.
 * @param {string} keyword
 * @param {number} [limit=12]
 * @returns {Promise<{ items: object[], useProd: boolean }>}
 */
async function search(keyword, limit = 12) {
    return browseAPI({ q: keyword, limit });
}

/**
 * Fetch popular items from eBay using a single category browse call.
 * Uses category 293 (Consumer Electronics) with bestMatch sort — one API call
 * instead of multiple parallel keyword searches.
 * @param {number} [limit=12]
 * @returns {Promise<{ items: object[], useProd: boolean }>}
 */
async function popular(limit = 12) {
    return browseAPI({ category_ids: 293, sort: 'bestMatch', limit });
}

module.exports = { search, popular };
