

# Driver Incentive Program

## How to run

### Prerequisites

- Node.js 18+ (Node 20 also works)
- npm
- Access to the shared AWS RDS MySQL instance (or your own MySQL)

### 1) Configure environment variables

Create a `.env` file in the repo root (same level as `backend/` and `frontend/`). Use .env example for reference.

> Do **not** commit `.env` to git. Use `.env.example` as a template for teammates.

### 2) Install backend dependencies

From the repo root:

```bash
cd backend
npm install
```

### 3) Start backend services (admin/driver/sponsor)

Open three terminals.

**Terminal 1**
```bash
cd backend
npm run dev:admin
```

**Terminal 2**
```bash
cd backend
npm run dev:driver
```

**Terminal 3**
```bash
cd backend
npm run dev:sponsor
```

Health checks (should return `{ "ok": true }`):

```bash
curl http://localhost:4001/healthz
curl http://localhost:4002/healthz
curl http://localhost:4003/healthz
```

### 4) Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 5) Start the frontend

```bash
npm run dev
```

Vite will print the local URL. By default this is usually:

- http://localhost:5173

If that port is already taken, Vite will choose a different one (or you can set one explicitly in `frontend/package.json`).

### Troubleshooting

- **Can’t connect to RDS:** ensure your IP is allowed by the RDS security group and the instance is running.
- **Auth/500 errors:** check backend terminal logs for the real error and confirm `.env` values are loaded.
- **Port conflicts:** change `ADMIN_PORT/DRIVER_PORT/SPONSOR_PORT` in `.env` and restart the backend services.