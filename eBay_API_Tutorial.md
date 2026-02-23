# eBay API & Catalog Integration Guide

This guide explains how we set up the foundation for connecting our application to the eBay API and how our sponsors can build their catalogs.

## Step 1: Authentication
Before we can search eBay for items, we need permission from eBay's servers. eBay uses **OAuth 2.0**, which means we can't just pass a static password in our URLs. Instead, we have to send our Developer Keys to an authentication server, which gives us a temporary "Access Token" that lasts for 2 hours.

1. **Secure the Keys**: We added the eBay Developer Keys (Targeting the Sandbox environment for testing) to the backend `.env` file. We do this so the keys are never accidentally pushed to GitHub.
2. **The Token Manager (`backend/utils/ebayTokenManager.js`)**: This utility has one job: Provide a valid eBay access token whenever the app asks for it. It is smart enough to **cache** the token in memory so we don't ask eBay for a new token 100 times an hour.

---

## Step 2: The eBay Proxy Route
The frontend React application cannot (and should not) talk to eBay directly, as that would expose our secret keys to the browser. Instead, the frontend talks to our backend proxy.

1. **The Route (`backend/routes/sponsor/ebay.js`)**: We created an Express router that listens for `GET /api/sponsor/ebay/search?q=laptop`.
2. **The Logic**: The route receives the request, asks the Token Manager for our cached OAuth token, and fires a secure backend request to `api.sandbox.ebay.com/buy/browse/v1`.
3. **Data Mapping**: eBay returns a massive JSON payload with hundreds of fields we don't need. The proxy route cleans this up and returns a strictly formatted array directly to the frontend, containing only what we need for the UI UI (`title`, `price`, `image_url`, `ebay_item_id`).

---

## Step 3: The Catalog Database Routes
Once a sponsor searches for a sandbox item, they need the ability to "add" it to their own shop. We created the API to stitch eBay items directly into our MySQL database.

1. **Sponsor Catalog Logic (`backend/routes/sponsor/catalog.js`)**:
   - `GET /`: Pulls all items from the `catalog_items` table belonging to the currently authenticated sponsor.
   - `POST /`: Takes the eBay item the sponsor clicked on, assigns it a rigid point cost, and saves it into the `catalog_items` database.
   - `DELETE /:id`: Removes that item from the sponsor's shop.

2. **Driver Catalog Logic (`backend/routes/driver/catalog.js`)**:
   - `GET /`: When a driver logs in, this route first queries the database to figure out *which sponsor* they are affiliated with (via their `driver_profile` or an accepted `application`). It then fetches only the `catalog_items` belonging to that specific sponsor.

---

## Step 4: Express Service Mounting
Our backend is split into microservices (`@gdip/server`). To make these files accessible, we mounted them securely.

- In `backend/services/sponsor/src/index.js`, we injected our Token Manager proxy and Sponsor CRUD routes into the `/ebay` and `/catalog` prefixes.
- In `backend/services/driver/src/index.js`, we injected the Driver catalog fetcher so that drivers have a secure endpoint to view their sponsor's shop without being able to add/delete items.

## Testing Strategy
Because we were restricted from firing up the local Express and Vite development servers, we built localized Node.js integration scripts:
1. `testComprehensive.js`: Simulated an entire session by requesting an eBay token, firing an eBay search request, mocking a Sponsor adding an item to the DB, and mocking a Driver fetching that item.
2. All Database requests were validated using direct `@gdip/db` SQL execution bypassing localhost entirely.
