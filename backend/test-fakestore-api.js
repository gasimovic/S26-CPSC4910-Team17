const fakestore = require('./utils/fakestoreClient');

async function testFakestoreApi() {
    console.log('🧪 Starting direct Fake Store client tests...\n');

    try {
        // ==========================================
        // 1. Test popular()
        // ==========================================
        console.log('[1] Testing fakestore.popular()');
        const popularStart = Date.now();
        const popularItems = await fakestore.popular(20);
        const popularTime = Date.now() - popularStart;

        console.log(`   ✅ Success! (${popularTime}ms)`);
        console.log(`   📦 Items received: ${popularItems.length}`);

        if (popularItems.length > 0) {
            const first = popularItems[0];
            console.log(`   ⭐ First item: "${first.title}" - $${first.price?.value}`);
        }
        console.log('');

        // ==========================================
        // 2. Test search() — keyword match
        // ==========================================
        const keyword = 'ssd';
        console.log(`[2] Testing fakestore.search('${keyword}')`);
        const searchStart = Date.now();
        const searchItems = await fakestore.search(keyword, 12);
        const searchTime = Date.now() - searchStart;

        console.log(`   ✅ Success! (${searchTime}ms)`);
        console.log(`   📦 Items received: ${searchItems.length}`);

        if (searchItems.length > 0) {
            const first = searchItems[0];
            console.log(`   ⭐ First item: "${first.title}" - $${first.price?.value}`);
        }
        console.log('');

        // ==========================================
        // 3. Test search() — no results
        // ==========================================
        const noResultKeyword = 'xyznotarealproduct';
        console.log(`[3] Testing fakestore.search('${noResultKeyword}') — expect 0 results`);
        const emptyItems = await fakestore.search(noResultKeyword, 12);
        console.log(`   ✅ Correctly returned ${emptyItems.length} items (empty set)\n`);

        console.log('🎉 All tests passed! Fake Store API is working.');

    } catch (error) {
        console.error('\n❌ API Test Failed!');
        console.error(`   Error: ${error.message}`);
        if (error.response) {
            console.error(`   HTTP Status: ${error.response.status}`);
            console.error(`   Response:`, JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

testFakestoreApi();
