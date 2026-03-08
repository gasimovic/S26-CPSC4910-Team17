const axios = require('axios');
const path = require('path');
const dotenv = require('dotenv');

// Load .env from the backend root (two levels up from utils/)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// ─────────────────────────────────────────────────────────────────────────────
// eBay Production OAuth token manager.
// Uses the Client Credentials grant (no user sign-in required).
// Scope: https://api.ebay.com/oauth/api_scope  (View public data from eBay)
// Token is cached in memory and auto-refreshed 60 seconds before expiry.
// ─────────────────────────────────────────────────────────────────────────────

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const OAUTH_SCOPE = 'https://api.ebay.com/oauth/api_scope';

let _cachedToken = null;
let _tokenExpiresAt = 0;

async function getEbayToken() {
    // Return cached token if still valid
    if (_cachedToken && Date.now() < _tokenExpiresAt) {
        return _cachedToken;
    }

    const clientId = process.env.EBAY_PROD_CLIENT_ID;
    const clientSecret = process.env.EBAY_PROD_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
        throw new Error(
            'eBay production credentials missing. ' +
            'Set EBAY_PROD_CLIENT_ID and EBAY_PROD_CLIENT_SECRET in .env'
        );
    }

    console.log(`[eBay] Requesting production token for client: ${clientId.substring(0, 10)}...`);

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
        const response = await axios.post(
            TOKEN_URL,
            new URLSearchParams({ grant_type: 'client_credentials', scope: OAUTH_SCOPE }).toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Authorization: `Basic ${credentials}`,
                },
            }
        );

        const token = response.data.access_token;
        const expiresIn = response.data.expires_in; // seconds

        // Cache with a 60-second safety buffer
        _cachedToken = token;
        _tokenExpiresAt = Date.now() + expiresIn * 1000 - 60_000;

        console.log(`[eBay] Token acquired, expires in ${expiresIn}s`);
        return token;
    } catch (err) {
        const status = err.response?.status;
        const body = err.response?.data;
        console.error(`[eBay] Token request failed (HTTP ${status ?? 'N/A'}):`, JSON.stringify(body ?? err.message));
        throw new Error(`eBay authentication failed: ${body?.error_description ?? body?.error ?? err.message}`);
    }
}

function clearEbayTokenCache() {
    _cachedToken = null;
    _tokenExpiresAt = 0;
}

module.exports = { getEbayToken, clearEbayTokenCache };
