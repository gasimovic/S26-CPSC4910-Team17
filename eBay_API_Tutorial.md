# FakeStore API & Catalog Integration Guide

## Overview

This guide explains how the application integrates with **[Fake Store API](https://fakestoreapi.com)** to power the sponsor catalog feature. Fake Store is a free, public REST API that provides 20 sample products across 4 categories — no authentication or API keys required.

---

## Step 1: The FakeStore Client (`backend/utils/fakestoreClient.js`)

All HTTP calls to `fakestoreapi.com` and item normalization live in a single utility module. Route handlers never touch `axios` directly.

### Key functions

| Function | Description |
|---|---|
| `popular()` | Fetches all 6 electronics products from `/products/category/electronics` |
| `search(keyword, limit)` | Fetches all 20 products, then client-side filters by `title`, `description`, or `category` |
| `normalizeItem(raw)` | Maps the FakeStore product shape to the frontend's expected contract |

### Product shape (raw FakeStore response)
```json
{
  "id": 9,
  "title": "WD 2TB Elements Portable External Hard Drive",
  "price": 64.00,
  "description": "USB 3.0 compatible...",
  "category": "electronics",
  "image": "https://fakestoreapi.com/img/61IBBVJvSDL._AC_SY879_t.png",
  "rating": { "rate": 3.3, "count": 203 }
}
```

### Normalized shape (what the frontend receives)
```json
{
  "itemId": "9",
  "title": "WD 2TB Elements Portable External Hard Drive",
  "price": { "value": "64.00", "currency": "USD" },
  "image": "https://fakestoreapi.com/img/...",
  "itemWebUrl": "https://fakestoreapi.com/products/9",
  "condition": "New",
  "category": "electronics",
  "description": "...",
  "rating": { "rate": 3.3, "count": 203 }
}
```

> **Note:** FakeStore has no server-side search. The `search()` function fetches all 20 products from `/products` and filters in-memory.

---

## Step 2: The FakeStore Proxy Route (`backend/routes/sponsor/fakestore.js`)

The frontend React app talks to the backend, never directly to FakeStore. The proxy is mounted at `/ebay` for URL compatibility.

| Endpoint | Description |
|---|---|
| `GET /api/sponsor/ebay/search?q=<keyword>` | Keyword search across all FakeStore products |
| `GET /api/sponsor/ebay/popular` | Returns the 6 electronics products (cached 10 min) |

Both return: `{ items: [...], mock: false }`

---

## Step 3: The Catalog CRUD Route (`backend/routes/sponsor/catalog.js`)

Once a sponsor finds an item they want to offer as a reward, they add it to their shop. This permanently stores it in the MySQL `catalog_items` table.

| Endpoint | Description |
|---|---|
| `GET /api/sponsor/catalog` | View the sponsor's saved reward items |
| `POST /api/sponsor/catalog` | Add a FakeStore item with a custom point cost |
| `DELETE /api/sponsor/catalog/:id` | Remove an item from the shop |

### POST body
```json
{
  "itemId": "9",
  "title": "WD 2TB Elements Portable External Hard Drive",
  "imageUrl": "https://fakestoreapi.com/img/...",
  "price": 64.00,
  "pointCost": 500
}
```

### Database column: `external_item_id`
Stores the FakeStore product ID (`item.id` as a string) for reference. Not used for live lookups — the title and image are cached in the row directly.

---

## Step 4: Service Configuration (`backend/services/sponsor/src/index.js`)

The two route modules are injected into the Express app:

```js
const fakestoreRoutes   = require('../../../routes/sponsor/fakestore');
const sponsorCatalogRoutes = require('../../../routes/sponsor/catalog');

app.use('/ebay',    requireAuth, fakestoreRoutes);
app.use('/catalog', requireAuth, sponsorCatalogRoutes);
```

---

## Step 5: Testing (`backend/test-fakestore-api.js`)

Run the test script to verify the FakeStore API is reachable and the client works correctly:

```bash
cd backend
node test-fakestore-api.js
```

Expected output:
```
[1] Testing fakestore.popular()    ✅  6 items
[2] Testing fakestore.search('ssd') ✅  2 items
[3] Testing fakestore.search('xyznotarealproduct') ✅  0 items
🎉 All tests passed!
```

---

## Categories available in FakeStore

| Category | Count |
|---|---|
| `men's clothing` | 4 |
| `women's clothing` | 6 |
| `jewelery` | 4 |
| `electronics` | 6 |
