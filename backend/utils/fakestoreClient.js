const axios = require('axios');

// ─────────────────────────────────────────────────────────────────────────────
// Fake Store API client — https://fakestoreapi.com
// No auth, no keys required. All HTTP calls and item normalization live here.
// Route handlers call search() or popular() and never touch axios directly.
// ─────────────────────────────────────────────────────────────────────────────

const FAKESTORE_BASE = 'https://fakestoreapi.com';
const TIMEOUT_MS = 8000;

function normalizePrice(rawPrice) {
    const price = Number(rawPrice);
    if (!Number.isFinite(price)) return null;
    return Number(price.toFixed(2));
}

/**
 * Map a raw Fake Store product to the flat shape the frontend expects.
 * Frontend reads: item.itemId · item.title · item.image · item.price.value · item.itemWebUrl
 */
function normalizeItem(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = raw.id;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const priceValue = normalizePrice(raw.price);

    if (id === undefined || id === null || !title || priceValue === null) {
        return null;
    }

    return {
        itemId: String(id),
        title,
        price: {
            value: priceValue,
            currency: 'USD',
        },
        image: raw.image ?? null,
        itemWebUrl: `https://fakestoreapi.com/products/${id}`,
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
    try {
        const response = await axios.get(`${FAKESTORE_BASE}${path}`, {
            params,
            timeout: TIMEOUT_MS,
        });
        const rows = Array.isArray(response.data) ? response.data : [];
        return rows.map(normalizeItem).filter(Boolean);
    } catch (err) {
        const wrapped = new Error(`FakeStore request failed for ${path}: ${err.message}`);
        wrapped.status = err.response?.status ?? null;
        wrapped.code = err.code ?? null;
        wrapped.path = path;
        wrapped.isTimeout = err.code === 'ECONNABORTED';
        throw wrapped;
    }
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
    const kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return [];

    const allItems = await fetchProducts('/products');
    const matches = allItems.filter(item =>
        (item.title || '').toLowerCase().includes(kw) ||
        (item.description || '').toLowerCase().includes(kw) ||
        (item.category || '').toLowerCase().includes(kw)
    );
    return matches.slice(0, limit);
}

module.exports = { search, popular };
