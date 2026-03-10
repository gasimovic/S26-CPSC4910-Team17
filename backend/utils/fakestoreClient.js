const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// Fake Store API client — https://fakestoreapi.com
// No auth, no keys required. All HTTP calls and item normalization live here.
// Route handlers call search() or popular() and never touch axios directly.
// ─────────────────────────────────────────────────────────────────────────────

const FAKESTORE_BASE = 'https://fakestoreapi.com';
const TIMEOUT_MS = 8000;

/**
 * Map a raw Fake Store product to the flat shape the frontend expects.
 * Frontend reads: item.itemId · item.title · item.image · item.price.value · item.itemWebUrl
 */
function normalizeItem(raw) {
    return {
        itemId: String(raw.id),
        title: raw.title,
        price: {
            value: Number(raw.price).toFixed(2),
            currency: 'USD',
        },
        image: raw.image ?? null,
        itemWebUrl: `https://fakestoreapi.com/products/${raw.id}`,
        condition: 'New',
        category: raw.category ?? null,
        description: raw.description ?? null,
        rating: raw.rating ?? null,
    };
}

/**
 * Fetch all products from a given path and return normalized items.
 * @param {string} path  e.g. '/products' or '/products/category/electronics'
 * @param {number} [limit]
 * @returns {Promise<object[]>}
 */
async function fetchProducts(path, limit) {
    const params = limit ? { limit } : {};
    const response = await axios.get(`${FAKESTORE_BASE}${path}`, {
        params,
        timeout: TIMEOUT_MS,
    });
    return (response.data || []).map(normalizeItem);
}

/**
 * Fetch popular items — all electronics from Fake Store (6 products total).
 * FakeStore does not support a server-side limit on category endpoints.
 * @returns {Promise<object[]>}
 */
async function popular() {
    return fetchProducts('/products/category/electronics');
}

/**
 * Search Fake Store by keyword (client-side filter across all 20 products).
 * Fake Store has no server-side search endpoint, so we fetch all products
 * and filter by keyword against title, description, and category.
 * @param {string} keyword
 * @param {number} [limit=12]
 * @returns {Promise<object[]>}
 */
async function search(keyword, limit = 12) {
    const allItems = await fetchProducts('/products');
    const kw = keyword.toLowerCase();
    const matches = allItems.filter(item =>
        item.title.toLowerCase().includes(kw) ||
        (item.description || '').toLowerCase().includes(kw) ||
        (item.category || '').toLowerCase().includes(kw)
    );
    return matches.slice(0, limit);
}

module.exports = { search, popular };
