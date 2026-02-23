const { getEbayToken } = require('./utils/ebayTokenManager');

async function testEbayAuth() {
    try {
        console.log("Testing eBay sandbox authentication...");
        const token = await getEbayToken();
        console.log("Success! Received Token:", token.substring(0, 50) + "...");
    } catch (error) {
        console.error("Test failed:", error.message);
    }
}

testEbayAuth();
