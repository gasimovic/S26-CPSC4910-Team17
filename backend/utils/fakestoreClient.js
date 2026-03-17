const axios = require('axios');

const BASE = 'https://dummyjson.com';
const TIMEOUT_MS = 8000;

// Map a raw DummyJSON product to the shape the frontend expects.
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
        image: raw.thumbnail ?? null,
        price: { value: Number(price.toFixed(2)), currency: 'USD' },
        category: raw.category ?? null,
    };
}

async function get(path) {
    const { data } = await axios.get(`${BASE}${path}`, { timeout: TIMEOUT_MS });
    return data;
}

async function getProducts() {
    const data = await get('/products?limit=100');
    const list = data?.products ?? (Array.isArray(data) ? data : []);
    return list.map(normalize).filter(Boolean);
}

async function getProductsByCategory(category) {
    const data = await get(`/products/category/${encodeURIComponent(category)}`);
    const list = data?.products ?? (Array.isArray(data) ? data : []);
    return list.map(normalize).filter(Boolean);
}

async function getProduct(id) {
    const data = await get(`/products/${id}`);
    return normalize(data);
}

// DummyJSON has a native search endpoint — no client-side filtering needed.
async function searchProducts(keyword, limit) {
    const kw = String(keyword || '').trim();
    if (!kw) return [];

    const limitParam = limit ? `&limit=${limit}` : '';
    const data = await get(`/products/search?q=${encodeURIComponent(kw)}${limitParam}`);
    const list = data?.products ?? (Array.isArray(data) ? data : []);
    return list.map(normalize).filter(Boolean);
}

module.exports = { getProducts, getProductsByCategory, getProduct, searchProducts };
