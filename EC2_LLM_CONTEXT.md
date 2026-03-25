# EC2 Runtime Context (LLM-Optimized)

## Host + Stack
- Host: `ip-172-31-30-162` (AWS EC2)
- App repo path: `/home/ec2-user/S26-CPSC4910-Team17`
- Database: AWS RDS MySQL (external)
- Process manager: PM2
- Web server: Nginx (systemd service)

## Service Runtime (Observed)
- `nginx.service`: active/running since 2026-02-17
- PM2 apps online:
  - `gdip-admin` (id 0)
  - `gdip-driver` (id 1)
  - `gdip-sponsor` (id 2)
  - `gdip-frontend` (id 7)
  - `gdip-frontend` (id 8)  <-- duplicate frontend process present
- `gdip-sponsor` execution details:
  - script: `npm run dev:sponsor`
  - cwd: `/home/ec2-user/S26-CPSC4910-Team17/backend`
  - node: `v20.20.0`
  - restarts observed: `37` after last restart

## Nginx Routing (Current)
From `/etc/nginx/nginx.conf` server block:
- Frontend root: `/var/www/myapp`
- SPA fallback:
  - `location / { try_files $uri $uri/ /index.html; }`
- API reverse proxy:
  - `/api/admin/` -> `http://localhost:4001` with path rewrite
  - `/api/driver/` -> `http://localhost:4002` with path rewrite
  - `/api/sponsor/` -> `http://localhost:4003` with path rewrite
- Cookie forwarding enabled via:
  - `proxy_set_header Cookie $http_cookie;`
  - `proxy_pass_header Set-Cookie;`

## Sponsor API Facts
- Sponsor service health endpoint works:
  - `curl -s http://localhost:4003/healthz` -> `{"ok":true}`
- Sponsor FakeStore route now resolves through Express auth layer:
  - `curl -s "http://localhost:4003/fakestore/search?q=test"` -> `{"error":"Not authenticated"}`
  - This confirms route registration is active and returning JSON.

## Production Failure Observed (Before Fix)
- Frontend catalog page showed:
  - "Received HTML from the server instead of API JSON"
- PM2 error logs showed repeated outbound provider failures:
  - `[FakeStore] search failed: Request failed with status code 403`
  - `[FakeStore] popular failed: Request failed with status code 403`
- Interpretation:
  - Public provider `fakestoreapi.com` blocked EC2-origin traffic (403).

## Code Change Applied
Updated provider client file:
- [backend/utils/fakestoreClient.js](backend/utils/fakestoreClient.js)

Change summary:
- API base switched:
  - from `https://fakestoreapi.com`
  - to `https://dummyjson.com`
- Data mapping preserved to frontend contract:
  - `itemId`, `title`, `description`, `image`, `price.value`, `category`
- Search implementation changed to native provider search endpoint:
  - `/products/search?q=...`
- Product list extraction updated for provider envelope shape:
  - reads `data.products`

## Deploy Action Performed
- Restarted sponsor service:
  - `pm2 restart gdip-sponsor`
- Result: service online and `/fakestore/search` now responds with JSON (auth-guarded), not HTML/404.

## Known Additional Issues (Separate from FakeStore Provider)
PM2 logs also contain unrelated DB parameter errors in sponsor service:
- `Error: Bind parameters must not contain undefined. To pass SQL NULL specify JS null`
- Seen at stack locations:
  - `backend/services/sponsor/src/index.js:223`
  - `backend/services/sponsor/src/index.js:277`
- This is a separate backend data-validation issue (not the catalog provider outage).

## Quick Verification Commands
```bash
# Sponsor service
curl -s http://localhost:4003/healthz
curl -s "http://localhost:4003/fakestore/search?q=technology"

# Through nginx public route (when authenticated in browser)
# GET /api/sponsor/fakestore/search?q=technology
```

## LLM Handoff Summary (Minimal)
- Infra is up (nginx + PM2 + sponsor service healthy).
- Reverse proxy config is present and routes sponsor API correctly.
- Root external issue was provider-level 403 from `fakestoreapi.com`.
- Provider client has been switched to `dummyjson.com` in [backend/utils/fakestoreClient.js](backend/utils/fakestoreClient.js).
- Sponsor endpoint now returns JSON and is auth-gated as expected.
- There are unrelated SQL undefined-bind errors pending cleanup in sponsor service.
