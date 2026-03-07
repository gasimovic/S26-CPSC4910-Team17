const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from the backend root (two levels up from utils/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

let cachedToken = null;
let tokenExpiresAt = null;

async function getEbayToken() {
    // 1. Return cached token if still valid
    if (cachedToken && Date.now() < tokenExpiresAt) {
        return cachedToken;
    }

    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    // 2. Guard: fail fast if credentials are missing
    if (!clientId || !clientSecret) {
        console.error('[eBay] EBAY_CLIENT_ID or EBAY_CLIENT_SECRET is not set in environment variables!');
        throw new Error('eBay API credentials are not configured on this server.');
    }

    console.log(`[eBay] Requesting new token for client: ${clientId.substring(0, 10)}...`);

    // 3. Request a new token from eBay Sandbox
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(
            'https://api.sandbox.ebay.com/identity/v1/oauth2/token',
            // Browse API item_summary/search uses client_credentials + api_scope
            new URLSearchParams({
                grant_type: 'client_credentials',
                scope: 'https://api.ebay.com/oauth/api_scope'
            }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${credentials}`,
                },
            }
        );

        // 4. Cache token & set expiration (buffer of 60 seconds)
        cachedToken = response.data.access_token;
        tokenExpiresAt = Date.now() + response.data.expires_in * 1000 - 60000;

        console.log(`[eBay] Token acquired successfully, expires in ${response.data.expires_in}s`);
        return cachedToken;
    } catch (error) {
        const status = error.response?.status;
        const body = error.response?.data;
        console.error(`[eBay] Token fetch failed (HTTP ${status || 'N/A'}):`, JSON.stringify(body || error.message));
        throw new Error(`Failed to authenticate with eBay API: ${body?.error_description || body?.error || error.message}`);
    }
}

function clearEbayTokenCache() {
    cachedToken = null;
    tokenExpiresAt = null;
}

module.exports = { getEbayToken, clearEbayTokenCache };
