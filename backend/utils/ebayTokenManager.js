const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

let cachedToken = null;
let tokenExpiresAt = null;

async function getEbayToken() {
    // 1. Return cached token if still valid
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    // 2. Otherwise request a new token from eBay
    const credentials = Buffer.from(
        `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
    ).toString('base64');

    try {
        const response = await axios.post(
            'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
            'grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope',
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${credentials}`,
                },
            }
        );

        // 3. Cache token & set expiration (buffer of 60 seconds)
        cachedToken = response.data.access_token;
        tokenExpiresAt = Date.now() + response.data.expires_in * 1000 - 60000;

        return cachedToken;
    } catch (error) {
        console.error("Error fetching eBay token:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with eBay API");
    }
}

module.exports = { getEbayToken };
