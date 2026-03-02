/**
 * test-ebay.js
 * Run from backend/: node test-ebay.js [searchTerm]
 * Example: node test-ebay.js headphones
 */

require('dotenv').config();
const axios = require('axios');

const keyword = process.argv[2] || 'headphones';

async function getToken() {
    const credentials = Buffer.from(
        `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString('base64');

    const res = await axios.post(
        'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
        'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
        {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Basic ${credentials}`,
            },
            timeout: 10000
        }
    );
    return res.data.access_token;
}

async function search(keyword) {
    const token = await getToken();
    console.log('✅ Token obtained\n');

    const url = `https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&limit=5`;

    const res = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        timeout: 10000
    });

    const items = (res.data.itemSummaries || []).map(item => ({
        itemId: item.itemId,
        title: item.title,
        price: item.price?.value || '0.00',
        image: item.image?.imageUrl || null,
    }));

    console.log(`🔍 Search: "${keyword}" → ${items.length} results\n`);
    items.forEach((item, i) => {
        console.log(`  [${i + 1}] ${item.title}`);
        console.log(`       Price: $${item.price}`);
        console.log(`       Image: ${item.image || '(none)'}`);
        console.log(`       ID:    ${item.itemId}\n`);
    });

    if (items.length === 0) {
        console.log('  (no items returned — sandbox may have sparse data for this term)');
    }
}

search(keyword).catch(err => {
    const status = err.response?.status;
    const body = err.response?.data;
    console.error(`\n❌ FAILED (HTTP ${status || 'N/A'})`);
    console.error(JSON.stringify(body || err.message, null, 2));
    process.exit(1);
});
