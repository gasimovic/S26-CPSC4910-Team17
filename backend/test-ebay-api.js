const ebay = require('./utils/ebayClient');

async function testEbayApi() {
    console.log('🧪 Starting Direct eBay API Tests (Bypassing Auth Routes)...\n');

    try {
        // ==========================================
        // 1. Test popular()
        // ==========================================
        console.log(`[1] Testing ebay.popular()`);
        const popularStart = Date.now();
        const popularItems = await ebay.popular(12);
        const popularTime = Date.now() - popularStart;

        console.log(`   ✅ Success! (${popularTime}ms)`);
        console.log(`   📦 Items received: ${popularItems.length}`);

        if (popularItems.length > 0) {
            const first = popularItems[0];
            console.log(`   ⭐ First item: "${first.title}" - $${first.price?.value}`);
        }
        console.log('');

        // ==========================================
        // 2. Test search()
        // ==========================================
        const keyword = 'macbook';
        console.log(`[2] Testing ebay.search('${keyword}')`);
        const searchStart = Date.now();
        const searchItems = await ebay.search(keyword, 12);
        const searchTime = Date.now() - searchStart;

        console.log(`   ✅ Success! (${searchTime}ms)`);
        console.log(`   📦 Items received: ${searchItems.length}`);

        if (searchItems.length > 0) {
            const first = searchItems[0];
            console.log(`   ⭐ First item: "${first.title}" - $${first.price?.value}`);
        }
        console.log('');

        console.log('🎉 All internal API tests completed successfully!');

    } catch (error) {
        console.error('\n❌ API Test Failed!');
        console.error(`   Error: ${error.message}`);
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   eBay Error Data:`, JSON.stringify(error.response.data, null, 2));
        }
        console.error('\nMake sure EBAY_PROD_CLIENT_ID and EBAY_PROD_CLIENT_SECRET are correct in .env');
        process.exit(1);
    }
}

testEbayApi();
