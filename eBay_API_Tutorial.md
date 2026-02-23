# eBay API Integration: Step 1 (Authentication)

This guide explains how we set up the foundation for connecting our application to the eBay API so our sponsors can build their catalogs.

## 1. The Goal
Before we can search eBay for items, we need permission from eBay's servers. eBay uses **OAuth 2.0**, which means we can't just pass a static password in our URLs. Instead, we have to send our Developer Keys to an authentication server, which gives us a temporary "Access Token" that lasts for 2 hours. We attach this token to all our search requests.

## 2. What We Did

### Step A: Secure the Keys
We added the eBay Developer Keys (Targeting the Sandbox environment for testing) to the backend `.env` file. We do this so the keys are never accidentally pushed to GitHub.
```env
EBAY_CLIENT_ID="ColeDiGr-GH-SBX..."
EBAY_CLIENT_SECRET="SBX-4eb..."
```

### Step B: Install Axios
We ran `npm install axios` inside the `backend/` folder. Axios is a popular library that makes it much easier to send HTTP requests to external servers (like eBay) compared to the built-in Node `fetch` or `http` modules.

### Step C: Create the Token Manager
We built a new file: `backend/utils/ebayTokenManager.js`.

This file has one job: Provide a valid eBay access token whenever the app asks for it. 
It is smart enough to **cache** the token. If we do 100 eBay searches in an hour, it doesn't ask eBay for a new token 100 times. It asks once, saves it in memory, and reuses it until it's about to expire.

Here is what the code roughly does:
1.  Check if we already have a valid token saved in memory. If yes, return it.
2.  If not, take the Client ID and Secret from the `.env` file and encode them in Base64 (eBay's required security format).
3.  Send a POST request to `api.sandbox.ebay.com/identity/v1/oauth2/token` asking for "client credentials" access.
4.  Take the token eBay sends back, calculate exactly when it will expire (approx 2 hours), and save it to memory.

### Step D: The Test Script
To prove it works without building an entire frontend, we made a temporary file called `testToken.js` that simply asks `ebayTokenManager.js` for a token and prints it to the console. 

We ran `node testToken.js` and successfully received a massive string back from eBay, proving our credentials and logic are working perfectly!

---
*Ready for Step 2: Building the API Proxy to actually search for Sandbox items.*
