# EC2_RDS_CONTEXT — SafeMiles GDIP Infrastructure
# LLM-optimized: dense facts, no prose filler, no section introductions
# Last verified: 2026-04-07 via SSH

---

## IDENTITY

PROJECT: S26-CPSC4910-Team17 (SafeMiles GDIP driver-incentive platform)
EC2_PUBLIC_IP: 3.90.235.83
EC2_USER: ec2-user
SSH_KEY_LOCAL: /Users/coledigregorio/desktop/team17-key.pem
SSH_CMD: ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83
EC2_OS: Amazon Linux (nginx from /usr/sbin/nginx, Node v20.20.0)
APP_ROOT_ON_EC2: /home/ec2-user/S26-CPSC4910-Team17

---

## RDS (AWS MySQL)

ENGINE: MySQL 8.x (compatible)
HOST: cpsc4910-s26.cobd8enwsupz.us-east-1.rds.amazonaws.com
PORT: 3306
DATABASE: Team17_DB
USER: Team17
PASSWORD: CPSCTeam_17
DATABASE_URL: mysql://Team17:CPSCTeam_17@cpsc4910-s26.cobd8enwsupz.us-east-1.rds.amazonaws.com:3306/Team17_DB
CONNECTION_POOL: mysql2/promise, connectionLimit=10, waitForConnections=true
CONFIG_RESOLUTION_ORDER: DATABASE_URL env var → individual DB_HOST/DB_PORT/DB_USER/DB_PASSWORD/DB_NAME env vars
CONFIG_FILE: /home/ec2-user/S26-CPSC4910-Team17/backend/.env (loaded via dotenv in each service)
DB_MODULE_PATH: backend/packages/db/src/index.js
DB_MODULE_EXPORTS: { pool, query, exec, ping }
  query(sql, params) → pool.execute → returns rows array
  exec(sql, params) → pool.execute → returns result object
  ping() → pool.getConnection() + conn.ping() + conn.release()

---

## BACKEND .ENV (full, at /home/ec2-user/S26-CPSC4910-Team17/backend/.env)

DB_HOST=cpsc4910-s26.cobd8enwsupz.us-east-1.rds.amazonaws.com
DB_PORT=3306
DB_USER=Team17
DB_PASSWORD=CPSCTeam_17
DB_NAME=Team17_DB
DATABASE_URL=mysql://Team17:CPSCTeam_17@cpsc4910-s26.cobd8enwsupz.us-east-1.rds.amazonaws.com:3306/Team17_DB
JWT_SECRET=RE1GAvIBoEu20JPt6rEMvwQeEiBMG/gRBzo7jDA1OGo=
COOKIE_NAME=gdip_token
COOKIE_SECURE=false
EBAY_PROD_CLIENT_ID=ColeDiGr-Goo-PRD-89545edfa-a255146a
EBAY_PROD_CLIENT_SECRET=PRD-9545edfa1b52-0624-40cf-85f4-0ab7

---

## FRONTEND .ENV (full, at /home/ec2-user/S26-CPSC4910-Team17/frontend/.env)

VITE_DRIVER_API_BASE=/api/driver
VITE_ADMIN_API_BASE=/api/admin
VITE_SPONSOR_API_BASE=/api/sponsor
VITE_API_TIMEOUT_MS=12000

NOTE: VITE_* vars are baked into the static bundle at build time (npm run build).
Changing these files has NO effect until a new build is deployed.

---

## PROCESS MANAGER: PM2 v6.0.14

PM2_HOME: /home/ec2-user/.pm2
PM2_LOGS: /home/ec2-user/.pm2/logs/
  gdip-driver-out.log
  gdip-driver-error.log
  (same pattern for admin, sponsor, frontend)

PM2_PROCESS_TABLE (as of 2026-04-07):
  id=0  name=gdip-admin    mode=fork  port=4001  status=online   restarts=60   pid=dynamic
  id=1  name=gdip-driver   mode=fork  port=4002  status=ERRORED  restarts=80   pid=0       ← BROKEN (pdfkit missing)
  id=2  name=gdip-sponsor  mode=fork  port=4003  status=online   restarts=79   pid=dynamic
  id=7  name=gdip-frontend mode=fork  port=5173  status=online   restarts=81   pid=dynamic (UNUSED — see below)
  id=8  name=gdip-frontend mode=fork  port=5173  status=online   restarts=76   pid=dynamic (DUPLICATE — UNUSED)

PM2_START_COMMANDS (as registered in PM2):
  gdip-admin:    npm run dev:admin   (cwd: backend/)
  gdip-driver:   npm run dev:driver  (cwd: backend/)
  gdip-sponsor:  npm run dev:sponsor (cwd: backend/)
  gdip-frontend: vite --port 7983 --host 0.0.0.0 --port 5173  (cwd: frontend/)

IMPORTANT: gdip-frontend (ids 7 and 8) runs Vite dev server on port 5173.
nginx does NOT proxy to port 5173. Users never hit this process.
Production frontend is served from /var/www/myapp (static nginx).
The gdip-frontend PM2 entries are vestigial and waste ~55MB RAM each.

USEFUL PM2 COMMANDS:
  pm2 list                          → current status
  pm2 logs gdip-driver --lines 50 --nostream  → last 50 log lines
  pm2 restart gdip-driver           → restart single service
  pm2 restart all                   → restart all
  pm2 save                          → persist current process list to survive reboot
  pm2 delete gdip-frontend          → remove vestigial Vite entries (caution: both ids)

---

## NGINX

BINARY: /usr/sbin/nginx
CONFIG: /etc/nginx/nginx.conf (no conf.d/*.conf files — all config is inline in nginx.conf)
STATUS: active (systemd)
SERVE_FRONTEND_ROOT: /var/www/myapp
SERVE_FRONTEND_OWNER: nginx:nginx

NGINX CONFIG (verbatim reverse proxy section):

  server {
    listen 80;
    listen [::]:80;
    server_name _;

    root /var/www/myapp;
    index index.html;

    location / {
      try_files $uri $uri/ /index.html;   ← SPA fallback — returns index.html for unknown paths
    }

    location /api/driver/ {
      rewrite ^/api/driver/(.*)$ /$1 break;
      proxy_pass http://localhost:4002;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header Cookie $http_cookie;
      proxy_pass_header Set-Cookie;
    }

    location /api/admin/ {
      rewrite ^/api/admin/(.*)$ /$1 break;
      proxy_pass http://localhost:4001;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header Cookie $http_cookie;
      proxy_pass_header Set-Cookie;
    }

    location /api/sponsor/ {
      rewrite ^/api/sponsor/(.*)$ /$1 break;
      proxy_pass http://localhost:4003;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header Cookie $http_cookie;
      proxy_pass_header Set-Cookie;
    }
  }

PROXY_STRIP_PREFIX: yes — /api/driver/orders → /orders when forwarded to 4002 (likewise for admin/sponsor)
FALLBACK_BEHAVIOR: if a backend port is not listening → nginx has no upstream → falls through to try_files → returns /index.html (HTML, not JSON) → frontend api() helper detects HTML response → throws "Received HTML from the server instead of API JSON for ..."
HTTPS: not configured (TLS server block is commented out in nginx.conf)
RELOAD_CMD: sudo nginx -s reload  (OR: sudo systemctl reload nginx)

---

## FRONTEND STATIC BUILD

BUILD_OUTPUT: /var/www/myapp/
BUILD_TOOL: Vite 5 (npm run build in frontend/)
BUILD_CMD_LOCAL: npm --prefix frontend run build
DEPLOY_CMD: sudo cp -r frontend/dist/* /var/www/myapp/   (or equivalent rsync)
CURRENT_BUILD_CONTENTS (2026-04-07):
  /var/www/myapp/index.html
  /var/www/myapp/assets/index-B25dJYKl.js  ← confirmed contains OrderHistoryPage, preview-catalog strings
  /var/www/myapp/assets/index-DSpM_PiC.js  ← same

BUILD_INCLUDES_NEW_FEATURES: YES — OrderHistoryPage, OrderDetailPage, OrderConfirmationPage, SponsorPreviewPage, CartPage real checkout, api base useEffect correction are confirmed present in current build at /var/www/myapp.

IMPORTANT: npm run build must be re-run and output re-copied to /var/www/myapp whenever App.jsx or any frontend source changes. nginx serves the cached static files; it does NOT hot-reload.

---

## BACKEND NODE.JS SERVICES

RUNTIME: Node v20.20.0
PACKAGE_MANAGER: npm (npm workspaces)
WORKSPACE_ROOT: /home/ec2-user/S26-CPSC4910-Team17/backend/
NODE_MODULES_LOCATION: /home/ec2-user/S26-CPSC4910-Team17/backend/node_modules/ (hoisted workspace root)

SERVICES:
  Admin   — services/admin/src/index.js   → port 4001
  Driver  — services/driver/src/index.js  → port 4002
  Sponsor — services/sponsor/src/index.js → port 4003

START_COMMANDS (from backend/package.json scripts):
  npm run dev:admin   → node services/admin/src/index.js
  npm run dev:driver  → node services/driver/src/index.js
  npm run dev:sponsor → node services/sponsor/src/index.js
  npm run dev:all     → admin & driver & sponsor in parallel
  npm run db:migrate  → node packages/db/scripts/migrate.js

KNOWN_ISSUE_2026-04-07:
  pdfkit ^0.15.0 is declared in backend/services/driver/package.json dependencies
  but NOT yet installed on EC2 (npm install was not run after package.json was modified locally and pushed).
  routes/driver/orders.js line 2: const PDFDocument = require('pdfkit')  ← thrown at startup
  Result: gdip-driver crashes immediately → port 4002 never binds → all /api/driver/* returns HTML
  FIX: cd /home/ec2-user/S26-CPSC4910-Team17/backend && npm install

RULE: After any package.json change is pushed to EC2, ALWAYS run npm install in the backend/ directory before restarting services.

---

## AUTH / COOKIE CONFIGURATION

COOKIE_NAME: gdip_token
COOKIE_SECURE: false (HTTP only deployment, no TLS)
JWT_SECRET: RE1GAvIBoEu20JPt6rEMvwQeEiBMG/gRBzo7jDA1OGo=
TOKEN_CONTENTS: { sub: user.id, role: user.role }
TOKEN_EXPIRY: 2 hours (maxAge: 2*60*60*1000 ms)

COOKIE_PATH per service:
  admin service:   path="/" (assumed standard)
  sponsor service: path="/"   ← was "/api/sponsor", fixed to "/" (see comment "FIX #1" ~line 184 sponsor/src/index.js)
  driver service:  path="/api/driver"  ← NOT fixed yet. Browser sends cookie ONLY to /api/driver/* paths.
                   This is technically correct for nginx proxy (all driver API calls go through /api/driver/*)
                   but could cause issues if the driver cookie is ever needed at a path outside /api/driver/.

AUTH_MIDDLEWARE: requireAuth (defined inline in each service's index.js)
  Reads req.cookies[COOKIE_NAME] → verifies JWT → sets req.user = { id, role }
  Returns 401 JSON if missing/invalid

---

## DATABASE SCHEMA (as of 2026-04-07, applied migrations)

MIGRATION_RUNNER: backend/packages/db/scripts/migrate.js
MIGRATION_TABLE: schema_migrations (id, filename VARCHAR(255) UNIQUE, applied_at TIMESTAMP)
MIGRATION_DIR: backend/packages/db/migrations/
MIGRATION_FILTER_RULE: runner splits SQL on semicolons then FILTERS OUT any statement whose trimmed text starts with "--". Do NOT add leading SQL comments to migration files.
MIGRATION_IDEMPOTENCY: each file is skipped if filename already in schema_migrations

APPLIED_MIGRATIONS:
  001_point_management.sql
  002_sponsor_org_management.sql
  003_catalog_and_conversion.sql
  003_system_monitoring.sql
  004_notifications.sql
  004_system_monitoring.sql
  005_driver_cart.sql
  006_orders.sql  ← STATUS UNKNOWN — needs verification after npm run db:migrate is run

006_orders.sql CREATES:
  TABLE orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    driver_id INT NOT NULL,  FK→users(id) ON DELETE CASCADE
    status ENUM('pending','confirmed','delivered','cancelled') NOT NULL DEFAULT 'pending',
    total_points INT NOT NULL,
    confirmation_number VARCHAR(20) NOT NULL UNIQUE,
    confirmed_at DATETIME,
    cancelled_at DATETIME,
    cancellation_reason TEXT,
    cancelled_by_user_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  )
  TABLE order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,  FK→orders(id) ON DELETE CASCADE
    catalog_item_id INT NOT NULL,
    sponsor_id INT NOT NULL,
    item_title_snapshot VARCHAR(255),
    item_image_url_snapshot TEXT,
    points_cost_snapshot INT NOT NULL,
    qty INT NOT NULL DEFAULT 1
  )

---

## NEW ROUTE FILES (created in current project session)

backend/routes/driver/orders.js
  REGISTERED: services/driver/src/index.js line ~919: app.use('/orders', requireAuth, driverOrderRoutes)
  ROUTES (order matters for Express param matching):
    GET  /export       → PDF of full order history (pdfkit)
    POST /             → checkout: reads driver_cart_items, validates points, creates order+items in transaction, clears cart
    GET  /             → list orders (query params: status, from, to, page, limit)
    GET  /:id          → order detail + items array
    GET  /:id/export   → PDF receipt for single order (pdfkit)
    POST /:id/cancel   → driver cancel (pending only, else 409)
  DEPENDENCIES: pdfkit ^0.15.0, @gdip/db (pool, query, exec)
  POINTS_BALANCE_LOGIC: available = SUM(ledger.delta) − SUM(orders.total_points WHERE status IN ('pending','confirmed'))
  CONFIRMATION_NUMBER: "ORD-" + Date.now().toString(36).toUpperCase() + rand (≤20 chars)

backend/routes/sponsor/orders.js
  REGISTERED: services/sponsor/src/index.js line ~1291: app.use('/orders', requireAuth, sponsorOrderRoutes)
  ROUTES:
    GET   /         → list orders containing sponsor's items (JOIN on order_items.sponsor_id)
    PATCH /:id/status → status transitions: pending→confirmed, pending→cancelled, confirmed→delivered (deducts ledger), confirmed→cancelled
  LEDGER_DEDUCTION: only on →delivered: INSERT INTO driver_points_ledger (driver_id,sponsor_id,delta,reason) VALUES (?,?,−total_points,'Order #X delivered')
  GUARD: sponsorOwnsOrder verifies order_items.sponsor_id = req.user.id before any mutation
  BLOCKED_TRANSITIONS: pending→delivered returns 409 "Must confirm before delivering"; modifying delivered/cancelled returns 409

inline GET /preview-catalog in services/sponsor/src/index.js lines 1299-1325
  Returns is_available=1 catalog items from all sponsors sharing same company_name as authenticated sponsor
  query: catalog_items WHERE sponsor_id IN (all sponsor_ids with same company_name) AND is_available=1

---

## MODIFIED FILES (current project session)

backend/routes/driver/catalog.js
  POST /:id/redeem → returns 410 JSON: { error: 'Single-item redemption is no longer supported. Use the cart checkout flow at POST /orders.' }

backend/services/driver/src/index.js  line ~919
  ADDED: const driverOrderRoutes = require('../../../routes/driver/orders'); app.use('/orders', requireAuth, driverOrderRoutes);

backend/services/sponsor/src/index.js  lines ~1287-1325
  ADDED: const sponsorOrderRoutes = require('../../../routes/sponsor/orders'); app.use('/orders', requireAuth, sponsorOrderRoutes);
  ADDED: inline app.get('/preview-catalog', requireAuth, ...) at line 1299

backend/services/driver/package.json
  ADDED: "pdfkit": "^0.15.0" to dependencies — NOT YET INSTALLED ON EC2

frontend/src/App.jsx
  ADDED state: lastOrder, orderToView
  ADDED useEffect: auto-corrects apiBase to match currentUser.role (prevents stale localStorage)
  ADDED pages: OrderConfirmationPage, OrderHistoryPage, OrderDetailPage, SponsorPreviewPage
  MODIFIED CartPage: real POST /orders checkout (replaced window.alert placeholder)
  ADDED nav links: "Orders" (driver), "Preview Catalog" (sponsor)
  ADDED render block entries: all 4 new pages
  UPDATED getAllowedPages: sponsorPages += 'sponsor-preview'; driverPages += 'order-confirmation','order-history','order-detail'
  IMPROVED html error message: includes URL + restart hint

---

## DEPLOYMENT WORKFLOW (what must happen after each type of change)

AFTER package.json change (backend):
  1. git pull (or scp changed files to EC2)
  2. cd /home/ec2-user/S26-CPSC4910-Team17/backend && npm install
  3. pm2 restart <affected-service>
  4. pm2 save

AFTER backend .js change (no new deps):
  1. git pull (or scp)
  2. pm2 restart <affected-service>
  3. pm2 save

AFTER new migration file:
  1. git pull (or scp)
  2. cd /home/ec2-user/S26-CPSC4910-Team17/backend && npm run db:migrate
  3. (no service restart needed unless routes changed too)

AFTER frontend source change (App.jsx etc):
  1. git pull (or scp) to local OR directly on EC2
  2. npm --prefix /home/ec2-user/S26-CPSC4910-Team17/frontend run build
  3. sudo cp -r /home/ec2-user/S26-CPSC4910-Team17/frontend/dist/* /var/www/myapp/
     OR: sudo rsync -a --delete frontend/dist/ /var/www/myapp/
  4. sudo nginx -s reload  (optional — static files are read per-request, reload not strictly required)

AFTER nginx config change:
  sudo nginx -t && sudo nginx -s reload

---

## CURRENT OUTSTANDING FIXES NEEDED (2026-04-07)

FIX_1 (BLOCKING — driver service down):
  cd /home/ec2-user/S26-CPSC4910-Team17/backend && npm install
  pm2 restart gdip-driver
  VERIFY: pm2 list → gdip-driver status=online; curl -si http://localhost:4002/healthz → 200 JSON
  FIXES: "Received HTML from the server instead of API JSON for /api/driver/orders"
         "Received HTML from the server instead of API JSON for /api/driver/orders (POST, checkout)"

FIX_2 (BLOCKING — DB tables may not exist):
  cd /home/ec2-user/S26-CPSC4910-Team17/backend && npm run db:migrate
  VERIFY: output "Applied: 006_orders.sql" or "Skipping (already applied): 006_orders.sql"
  FIXES: driver checkout POST /orders would 500 with "Table 'Team17_DB.orders' doesn't exist" if 006 not applied

FIX_3 (VERIFY — sponsor preview-catalog):
  curl -si http://localhost:4003/preview-catalog → expect 401 JSON (not HTML)
  If HTML: pm2 restart gdip-sponsor
  FIXES: "Received HTML from the server instead of API JSON for /api/sponsor/preview-catalog"

PERSIST:
  pm2 save  (after all restarts)

---

## DIAGNOSTIC COMMANDS (SSH one-liners)

# Full status snapshot
ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83 "pm2 list && ss -tlnp | grep -E '4001|4002|4003'"

# Check driver crash reason
ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83 "pm2 logs gdip-driver --lines 20 --nostream"

# Health check all three services
ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83 "curl -si http://localhost:4001/healthz | head -1; curl -si http://localhost:4002/healthz | head -1; curl -si http://localhost:4003/healthz | head -1"

# Verify pdfkit installed
ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83 "ls /home/ec2-user/S26-CPSC4910-Team17/backend/node_modules/pdfkit 2>/dev/null && echo FOUND || echo MISSING"

# Check applied migrations
ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83 "cd /home/ec2-user/S26-CPSC4910-Team17/backend && node -e \"require('dotenv').config(); const {query} = require('./packages/db/src/index'); query('SELECT filename FROM schema_migrations ORDER BY applied_at').then(r=>{r.forEach(x=>console.log(x.filename));process.exit()}).catch(e=>{console.log(e.message);process.exit(1)})\""

# Install deps + migrate + restart driver + save (THE FIX)
ssh -i /Users/coledigregorio/desktop/team17-key.pem -o StrictHostKeyChecking=no ec2-user@3.90.235.83 "cd /home/ec2-user/S26-CPSC4910-Team17/backend && npm install && npm run db:migrate && pm2 restart gdip-driver && pm2 save"
