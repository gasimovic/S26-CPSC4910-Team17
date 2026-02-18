
// using native fetch

const BASE_URL = 'http://localhost:4003';
let cookie = '';

async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };

    if (cookie) {
        headers['Cookie'] = cookie;
    }

    const res = await fetch(url, { ...options, headers });

    // Update cookie if provided
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
        cookie = setCookie.split(';')[0];
    }

    const text = await res.text();
    try {
        return { status: res.status, data: JSON.parse(text) };
    } catch {
        return { status: res.status, data: text };
    }
}

async function run() {
    console.log('--- Verification Script ---');

    // 1. Health check
    console.log('1. Checking health...');
    const health = await request('/healthz');
    console.log('Health:', health.data);

    // 2. Register Sponsor
    const email = `sponsor_${Date.now()}@test.com`;
    const password = 'password123';
    console.log(`2. Registering sponsor: ${email}`);
    const reg = await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, companyName: 'Test Inc' })
    });
    console.log('Register Res:', reg.data);

    // 3. Login (if not auto-logged in, but register usually doesn't return cookie in this app? let's check code)
    // The register endpoint in index.js returns 201 and user, but DOES NOT set cookie.
    // So we MUST login.
    console.log('3. Logging in...');
    const login = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });
    console.log('Login Res:', login.data);
    if (login.status !== 200) throw new Error('Login failed');

    // 4. Search eBay (Mock)
    console.log('4. Searching eBay for "iphone"...');
    const search = await request('/ebay/search?q=iphone');
    console.log('Search Results:', search.data.items?.length || 0, 'items found');

    if (!search.data.items || search.data.items.length === 0) {
        throw new Error('No items found');
    }
    const itemToAdd = search.data.items[0];

    // 5. Add to Catalog
    console.log('5. Adding item to catalog:', itemToAdd.title);
    const add = await request('/catalog', {
        method: 'POST',
        body: JSON.stringify({
            ebayItemId: itemToAdd.itemId,
            title: itemToAdd.title,
            imageUrl: itemToAdd.image,
            price: parseFloat(itemToAdd.price.value),
            pointCost: 5000
        })
    });
    console.log('Add Res:', add.data);
    if (add.status !== 201) throw new Error('Add to catalog failed');

    const newItemId = add.data.itemId;

    // 6. List Catalog
    console.log('6. Listing catalog...');
    const list = await request('/catalog');
    console.log('Catalog items:', list.data.items?.length);
    const found = list.data.items.find(i => i.id === newItemId);
    if (!found) throw new Error('Added item not found in catalog');
    console.log('Item verified in catalog.');

    // 7. Delete Item
    console.log('7. Deleting item...');
    const del = await request(`/catalog/${newItemId}`, { method: 'DELETE' });
    console.log('Delete Res:', del.data);

    console.log('--- Verification Complete: SUCCESS ---');
}

run().catch(err => {
    console.error('--- Verification Failed ---');
    console.error(err);
    process.exit(1);
});
