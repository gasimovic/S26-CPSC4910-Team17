const axios = require('axios');

const BASE = 'https://fakestoreapi.com';
const TIMEOUT_MS = 8000;

// Map a raw FakeStore product to the shape the frontend expects.
// Frontend reads: itemId, title, description, image, price.value, category.
function normalize(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const id = raw.id;
    const title = typeof raw.title === 'string' ? raw.title.trim() : '';
    const price = Number(raw.price);

    if (id == null || !title || !Number.isFinite(price)) return null;

    return {
        itemId: String(id),
        title,
        description: raw.description ?? null,
        image: raw.image ?? null,
        price: { value: Number(price.toFixed(2)), currency: 'USD' },
        category: raw.category ?? null,
    };
}

async function get(path) {
    const { data } = await axios.get(`${BASE}${path}`, { timeout: TIMEOUT_MS });
    return data;
}

async function getProducts() {
    const data = await get('/products');
    return (Array.isArray(data) ? data : []).map(normalize).filter(Boolean);
}

async function getProductsByCategory(category) {
    const data = await get(`/products/category/${encodeURIComponent(category)}`);
    return (Array.isArray(data) ? data : []).map(normalize).filter(Boolean);
}

async function getProduct(id) {
    const data = await get(`/products/${id}`);
    return normalize(data);
}

// FakeStore has no search endpoint — fetch all and filter client-side.
async function searchProducts(keyword, limit) {
    const kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return [];

    const all = await getProducts();
    const matches = all.filter(item =>
        (item.title || '').toLowerCase().includes(kw) ||
        (item.description || '').toLowerCase().includes(kw) ||
        (item.category || '').toLowerCase().includes(kw)
    );
    return limit ? matches.slice(0, limit) : matches;
}

module.exports = { getProducts, getProductsByCategory, getProduct, searchProducts };
