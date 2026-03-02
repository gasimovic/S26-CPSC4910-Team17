const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();
const { getEbayToken } = require('./utils/ebayTokenManager.js');

async function ebaySearch(keyword, limit = 12) {
    const token = await getEbayToken();
    const url = `https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search?q=${encodeURIComponent(keyword)}&limit=${limit}`;

    const response = await axios.get(url, {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US',
        },
        timeout: 10000
    });

    return (response.data.itemSummaries || []).map(item => ({
        itemId: item.itemId,
        title: item.title,
        price: { value: item.price?.value || '0.00' },
        image: item.image?.imageUrl || null,
        itemWebUrl: item.itemWebUrl
    }));
}

ebaySearch('headphones', 2).then(results => {
    console.log('Search success. Found items:', results.length);
    console.log(results);
}).catch(err => {
    console.error('Search error:', err.response?.data || err.message);
});
