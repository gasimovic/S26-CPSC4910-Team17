const axios = require('axios');

// The sponsor service runs on port 4003 locally (and likely on your EC2 instance too)
// You can pass a different base URL via the API_URL environment variable if needed:
// e.g., API_URL=https://yourdomain.com/api/sponsor node test-ebay-api.js
const BASE_URL = process.env.API_URL || 'http://localhost:4003';

async function testEbayApi() {
    console.log('🧪 Starting eBay API Tests...\n');
    console.log(`Using Base URL: ${BASE_URL}\n`);

    try {
        // ==========================================
        // 1. Test /popular
        // ==========================================
        console.log(`[1] Testing GET ${BASE_URL}/ebay/popular`);
        const popularStart = Date.now();
        const popularRes = await axios.get(`${BASE_URL}/ebay/popular`);
        const popularTime = Date.now() - popularStart;

        console.log(`   ✅ Success! (${popularTime}ms)`);
        console.log(`   📦 Items received: ${popularRes.data.items?.length || 0}`);
        console.log(`   🛠️ Mock fallback used: ${popularRes.data.mock}`);

        if (popularRes.data.items && popularRes.data.items.length > 0) {
            const first = popularRes.data.items[0];
            console.log(`   ⭐ First item: "${first.title}" - $${first.price?.value}`);
        }
        console.log('');

        // ==========================================
        // 2. Test /search
        // ==========================================
        const keyword = 'macbook';
        console.log(`[2] Testing GET ${BASE_URL}/ebay/search?q=${keyword}`);
        const searchStart = Date.now();
        const searchRes = await axios.get(`${BASE_URL}/ebay/search?q=${keyword}`);
        const searchTime = Date.now() - searchStart;

        console.log(`   ✅ Success! (${searchTime}ms)`);
        console.log(`   📦 Items received: ${searchRes.data.items?.length || 0}`);
        console.log(`   🛠️ Mock fallback used: ${searchRes.data.mock}`);

        if (searchRes.data.items && searchRes.data.items.length > 0) {
            const first = searchRes.data.items[0];
            console.log(`   ⭐ First item: "${first.title}" - $${first.price?.value}`);
        }
        console.log('');

        console.log('🎉 All API tests completed successfully!');

    } catch (error) {
        console.error('\n❌ API Test Failed!');
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Data:`, typeof error.response.data === 'object' ? JSON.stringify(error.response.data, null, 2) : error.response.data);
        } else {
            console.error(`   Error: ${error.message}`);
        }

        console.error('\nMake sure your sponsor backend service is running (e.g. on port 4003).');
        process.exit(1);
    }
}

testEbayApi();
