const db = require('../packages/db/src/index');
const { getEbayToken } = require('../utils/ebayTokenManager');
const axios = require('axios');

async function testAll() {
    console.log("=== Comprehensive Manual Test Suite (Integration) ===");

    // 1. Test eBay Token Authentication
    console.log("\n[1/4] Testing eBay OAuth Token Generation...");
    const token = await getEbayToken();
    if (!token) throw new Error("Failed to authenticate with eBay Sandbox.");
    console.log("  -> SUCCESS: Received token! " + token.substring(0, 20) + "...");

    // 2. Test eBay Sponsor Search Logic
    console.log("\n[2/4] Testing eBay Browse API Search Proxy Logic...");
    const keyword = 'laptop';
    const encodedKeyword = encodeURIComponent(keyword);

    // Simulating the exact GET request from our server
    const response = await axios.get(
        `https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=${encodedKeyword}&limit=2&filter=buyingOptions:{FIXED_PRICE}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    // Matching exact mapping from ebay.js
    const results = (response.data.itemSummaries || []).map(item => ({
        ebay_item_id: item.itemId,
        title: item.title,
        price: item.price?.value || "0.00",
        image_url: item.image?.imageUrl || null,
        item_web_url: item.itemWebUrl
    }));

    if (results.length === 0) throw new Error("Search returned no items.");
    console.log(`  -> SUCCESS: Searched for '${keyword}', found ${results.length} mapped items.`);
    console.log(`  -> Sample item: "${results[0].title}" | Price: $${results[0].price}`);

    // Define the test data based on search mapping
    const testEbayItemId = results[0].ebay_item_id;
    const testTitle = results[0].title;
    const testPrice = results[0].price;
    const testImageUrl = results[0].image_url;

    // 3. Test Sponsor Catalog DB logic
    console.log("\n[3/4] Testing Sponsor Catalog Database Operations...");
    let sponsorId, driverId, catalogItemId;

    try {
        // Mock a Sponsor User
        const sponsorInsert = await db.exec(
            "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
            [`test_sponsor_${Date.now()}@example.com`, 'hash', 'sponsor']
        );
        sponsorId = sponsorInsert.insertId;
        await db.exec("INSERT INTO sponsor_profiles (user_id, company_name) VALUES (?, ?)", [sponsorId, 'Test Sponsor Corp']);

        // Simulate POST /api/sponsor/catalog
        const catInsert = await db.exec(
            `INSERT INTO catalog_items (sponsor_id, ebay_item_id, title, description, image_url, price, point_cost) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sponsorId, testEbayItemId, testTitle, 'Testing integration from eBay', testImageUrl, testPrice, 100]
        );
        catalogItemId = catInsert.insertId;
        console.log(`  -> SUCCESS: Simulated POST /api/sponsor/catalog - Added item ID ${catalogItemId}`);

        // Simulate GET /api/sponsor/catalog
        const sponsorItems = await db.query(`SELECT * FROM catalog_items WHERE sponsor_id = ?`, [sponsorId]);
        if (sponsorItems.length !== 1 || sponsorItems[0].id !== catalogItemId) throw new Error("Sponsor could not fetch their own catalog.");
        console.log(`  -> SUCCESS: Simulated GET /api/sponsor/catalog - Sponsor sees 1 item.`);

        // 4. Test Driver Catalog Read Logic
        console.log("\n[4/4] Testing Driver Catalog Visibility...");

        // Mock a Driver User
        const driverInsert = await db.exec(
            "INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)",
            [`test_driver_${Date.now()}@example.com`, 'hash', 'driver']
        );
        driverId = driverInsert.insertId;

        // Link Driver to Sponsor
        await db.exec("INSERT INTO driver_profiles (user_id, sponsor_org) VALUES (?, ?)", [driverId, 'Test Sponsor Corp']);

        // Simulate exact Driver logic: GET /api/driver/catalog
        const sponsorQuery = await db.query(`
            SELECT u.id as sponsor_id 
            FROM users u
            JOIN sponsor_profiles sp ON u.id = sp.user_id
            JOIN driver_profiles dp ON dp.sponsor_org = sp.company_name
            WHERE dp.user_id = ? AND u.role = 'sponsor'
            UNION
            SELECT sponsor_id FROM applications WHERE driver_id = ? AND status = 'accepted' LIMIT 1
        `, [driverId, driverId]);

        const affiliatedSponsorId = sponsorQuery[0]?.sponsor_id;
        if (affiliatedSponsorId !== sponsorId) throw new Error("Driver-Sponsor linkage query failed.");

        const driverFetchedItems = await db.query(`SELECT * FROM catalog_items WHERE sponsor_id = ?`, [affiliatedSponsorId]);
        if (driverFetchedItems.length !== 1 || driverFetchedItems[0].id !== catalogItemId) throw new Error("Driver could not fetch catalog correctly.");
        console.log(`  -> SUCCESS: Simulated GET /api/driver/catalog - Driver correctly fetched the item from affiliated Sponsor's shop.`);

        // Simulate DELETE /api/sponsor/catalog
        await db.exec(`DELETE FROM catalog_items WHERE id = ? AND sponsor_id = ?`, [catalogItemId, sponsorId]);
        console.log(`  -> SUCCESS: Simulated DELETE /api/sponsor/catalog - Sponsor removed item from shop.`);

    } finally {
        if (sponsorId) await db.exec("DELETE FROM users WHERE id = ?", [sponsorId]);
        if (driverId) await db.exec("DELETE FROM users WHERE id = ?", [driverId]);
        if (catalogItemId) await db.exec("DELETE FROM catalog_items WHERE id = ?", [catalogItemId]);
        console.log("\nTest Data Cleaned Up.");
    }

    console.log("\n=== ALL TESTS PASSED SUCCESSFULLY ===");
}

testAll().catch(err => {
    console.error("\n!!! TEST FAILED !!!", err);
    process.exit(1);
});
