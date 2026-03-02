const { getEbayToken } = require('./backend/utils/ebayTokenManager.js');

getEbayToken().then(token => {
    console.log("Token success:", token.substring(0, 10) + '...');
}).catch(err => {
    console.error("Token error:", err.message);
});
