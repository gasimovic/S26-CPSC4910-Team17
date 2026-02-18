
// backend/services/sponsor/src/ebay.js

/**
 * Mock eBay Service
 * 
 * In a real implementation, this would use the eBay Finding API or Browse API.
 * Since we don't have credentials yet, we'll return mock data.
 */

const MOCK_ITEMS = [
  {
    itemId: "v1|111111111111|0",
    title: "iPhone 13 Pro 128GB Graphite Unlocked",
    image: "https://i.ebayimg.com/images/g/test1/s-l500.jpg",
    price: { value: "599.00", currency: "USD" },
    itemWebUrl: "https://www.ebay.com/itm/111111111111"
  },
  {
    itemId: "v1|222222222222|0",
    title: "Sony WH-1000XM5 Wireless Noise Cancelling Headphones",
    image: "https://i.ebayimg.com/images/g/test2/s-l500.jpg",
    price: { value: "348.00", currency: "USD" },
    itemWebUrl: "https://www.ebay.com/itm/222222222222"
  },
  {
    itemId: "v1|333333333333|0",
    title: "MacBook Air M2 13.6\" 8GB 256GB Midnight",
    image: "https://i.ebayimg.com/images/g/test3/s-l500.jpg",
    price: { value: "1099.00", currency: "USD" },
    itemWebUrl: "https://www.ebay.com/itm/333333333333"
  }
];

class EbayService {
  constructor() {
    this.appId = process.env.EBAY_APP_ID;
    // In real impl, we'd check for credentials here
  }

  /**
   * Search for items on eBay
   * @param {string} query 
   * @param {number} limit 
   * @returns {Promise<Array>}
   */
  async searchItems(query, limit = 10) {
    console.log(`[EbayService] Searching for "${query}"`);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Simple filter for mock data
    if (!query) return MOCK_ITEMS;
    
    const lowerQ = query.toLowerCase();
    return MOCK_ITEMS.filter(item => 
      item.title.toLowerCase().includes(lowerQ)
    );
  }

  /**
   * Get item details by ID
   * @param {string} itemId 
   * @returns {Promise<Object|null>}
   */
  async getItem(itemId) {
    console.log(`[EbayService] Getting item details for "${itemId}"`);

    await new Promise(resolve => setTimeout(resolve, 300));
    
    const item = MOCK_ITEMS.find(i => i.itemId === itemId);
    return item || null;
  }
}

module.exports = new EbayService();
